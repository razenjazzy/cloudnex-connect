import { getPlatformConfig, mutatePlatformConfig } from '../services/firestore';
import { isServiceConfigured, resolveServiceForCommand } from '../services/service-catalog';
import { tenantScopedKey } from '../services/tenant';
import { COMMAND_GRID, type CommandChannel, type CommandGridEntry, type CommandRole } from './command-grid';
import { DEFAULT_CHANNEL_ID } from './channels';

export type CommandOverlayPatch = {
  enabled?: boolean;
  roles?: CommandRole[];
  channels?: CommandChannel[];
  labelEn?: string;
  labelTh?: string;
  aliases?: string[];
};

export type CommandOverlayMap = Record<string, CommandOverlayPatch>;

const VALID_ROLES = new Set<CommandRole>(['guest', 'customer', 'staff', 'admin']);
const VALID_CHANNELS = new Set<CommandChannel>(['default', 'sales', 'customer']);

let overlayCache: CommandOverlayMap = {};
let overlayLoadedAt = 0;
const OVERLAY_TTL_MS = 60_000;

const overlayKey = (): string => tenantScopedKey('command-overlay');

export const loadCommandOverlay = async (): Promise<CommandOverlayMap> => {
  if (overlayLoadedAt && Date.now() - overlayLoadedAt < OVERLAY_TTL_MS) return overlayCache;
  const stored = await getPlatformConfig<{ commands?: CommandOverlayMap }>(overlayKey());
  overlayCache = stored?.commands && typeof stored.commands === 'object' ? stored.commands : {};
  overlayLoadedAt = Date.now();
  return overlayCache;
};

export const getCachedCommandOverlay = (): CommandOverlayMap => overlayCache;

export const setCommandOverlayCacheForTests = (overlay: CommandOverlayMap): void => {
  overlayCache = overlay;
  overlayLoadedAt = overlay && Object.keys(overlay).length ? Date.now() : 0;
};

const LINE_ACTION_LABEL_MAX = 20;

const clipLabel = (value: string): string => value.slice(0, LINE_ACTION_LABEL_MAX);

/** Prefer longest prefix, then this-channel rows, then uiOnly glossary (not typed commands). */
const isBetterLabelEntry = (entry: CommandGridEntry, best: CommandGridEntry, channel: CommandChannel): boolean => {
  if (entry.prefix.length !== best.prefix.length) return entry.prefix.length > best.prefix.length;
  const entryScoped = Boolean(entry.channels?.includes(channel));
  const bestScoped = Boolean(best.channels?.includes(channel));
  if (entryScoped !== bestScoped) return entryScoped;
  if (Boolean(entry.uiOnly) !== Boolean(best.uiOnly)) return Boolean(entry.uiOnly);
  return false;
};

/** LINE Flex / menu label from Admin Commands EN/TH overlay. Prefix itself is not editable. */
export const overlayLabelForText = (
  text: string,
  language: 'en' | 'th',
  fallback: string,
  channelId?: string,
): string => {
  const upper = text.trim().toUpperCase();
  const channel = (channelId || DEFAULT_CHANNEL_ID) as CommandChannel;
  let best: CommandGridEntry | null = null;
  for (const entry of COMMAND_GRID) {
    if (entry.channels?.length && !entry.channels.includes(channel)) continue;
    const hit = entry.exact
      ? upper === entry.prefix
      : upper === entry.prefix || upper.startsWith(`${entry.prefix} `);
    if (!hit) continue;
    if (!best || isBetterLabelEntry(entry, best, channel)) best = entry;
  }
  if (!best) return clipLabel(fallback);
  const patch = overlayCache[best.id] || {};
  const overlayLabel = language === 'th' ? patch.labelTh : patch.labelEn;
  const gridLabel = language === 'th' ? best.labelTh : best.labelEn;
  const channelGlossary = Boolean(best.uiOnly || best.channels?.length);
  // Overlay on this row wins. Empty overlay still uses the channel glossary grid label.
  if (typeof overlayLabel === 'string' && overlayLabel.trim()) return clipLabel(overlayLabel.trim());
  if (channelGlossary && gridLabel.trim()) return clipLabel(gridLabel.trim());
  return clipLabel(fallback);
};

export const mergeCommandGridEntry = (entry: CommandGridEntry, overlay = overlayCache): CommandGridEntry & { enabled: boolean } => {
  const patch = overlay[entry.id] || {};
  let roles = Array.isArray(patch.roles) ? patch.roles.filter((role): role is CommandRole => VALID_ROLES.has(role)) : entry.roles;
  if (entry.requiresAdmin) {
    roles = roles.filter(role => role !== 'guest');
    if (!roles.includes('admin')) roles = [...roles, 'admin'];
  }
  const channels = Array.isArray(patch.channels)
    ? patch.channels.filter((channel): channel is CommandChannel => VALID_CHANNELS.has(channel))
    : entry.channels;
  return {
    ...entry,
    roles: roles.length ? roles : entry.roles,
    ...(channels?.length ? { channels } : {}),
    labelEn: typeof patch.labelEn === 'string' && patch.labelEn.trim() ? patch.labelEn.trim() : entry.labelEn,
    labelTh: typeof patch.labelTh === 'string' && patch.labelTh.trim() ? patch.labelTh.trim() : entry.labelTh,
    enabled: patch.enabled !== false,
    ...(Array.isArray(patch.aliases) ? { aliases: patch.aliases } : {}),
  };
};

export const sanitizeCommandOverlay = (input: unknown): { ok: true; commands: CommandOverlayMap } | { ok: false; error: string } => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'commands must be an object keyed by command id.' };
  }
  const known = new Set(COMMAND_GRID.map(entry => entry.id));
  const commands: CommandOverlayMap = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!known.has(id)) return { ok: false, error: `Unknown command id: ${id}` };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: `Invalid overlay for ${id}.` };
    const patch = raw as CommandOverlayPatch;
    const entry = COMMAND_GRID.find(item => item.id === id);
    if (!entry) return { ok: false, error: `Unknown command id: ${id}` };
    if (patch.enabled === true && !entry.uiOnly) {
      const service = resolveServiceForCommand(entry.prefix);
      if (service && !isServiceConfigured(service)) {
        return { ok: false, error: `Cannot enable ${id}; service ${service} is not configured.` };
      }
    }
    const next: CommandOverlayPatch = {};
    if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
    if (Array.isArray(patch.roles)) {
      next.roles = patch.roles.filter((role): role is CommandRole => VALID_ROLES.has(role));
      if (entry.requiresAdmin) {
        next.roles = next.roles.filter(role => role !== 'guest');
        if (!next.roles.includes('admin')) next.roles.push('admin');
      }
    }
    if (Array.isArray(patch.channels)) {
      next.channels = patch.channels.filter((channel): channel is CommandChannel => VALID_CHANNELS.has(channel));
    }
    if (typeof patch.labelEn === 'string') next.labelEn = patch.labelEn.trim().slice(0, 80);
    if (typeof patch.labelTh === 'string') next.labelTh = patch.labelTh.trim().slice(0, 80);
    if (Array.isArray(patch.aliases)) {
      const aliases: string[] = [];
      for (const rawAlias of patch.aliases.slice(0, 8)) {
        if (typeof rawAlias !== 'string') continue;
        const alias = rawAlias.replace(/\s+/g, ' ').trim().toUpperCase();
        if (alias.length < 2 || alias.length > 40) {
          return { ok: false, error: `Invalid alias for ${id}.` };
        }
        if (alias === entry.prefix) continue;
        if (COMMAND_GRID.some(item => !item.uiOnly && item.prefix === alias && item.id !== id)) {
          return { ok: false, error: `Alias ${alias} collides with a canonical prefix.` };
        }
        if (!aliases.includes(alias)) aliases.push(alias);
      }
      if (aliases.length) next.aliases = aliases;
    }
    commands[id] = next;
  }
  const claimed = new Map<string, string>();
  for (const [id, patch] of Object.entries(commands)) {
    for (const alias of patch.aliases || []) {
      const owner = claimed.get(alias);
      if (owner && owner !== id) return { ok: false, error: `Alias ${alias} is used by ${owner} and ${id}.` };
      claimed.set(alias, id);
    }
  }
  return { ok: true, commands };
};

export const saveCommandOverlay = async (commands: CommandOverlayMap): Promise<{ ok: boolean; error?: string }> => {
  const result = await mutatePlatformConfig<{ commands?: CommandOverlayMap }>(overlayKey(), () => ({ commands }));
  if (!result.ok) return result;
  overlayCache = commands;
  overlayLoadedAt = Date.now();
  return { ok: true };
};

/** Map overlay aliases to canonical prefixes. Buttons still emit canonical text. */
export const canonicalizeInboundCommand = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const upper = trimmed.toUpperCase();
  let best: { alias: string; prefix: string } | null = null;
  for (const entry of COMMAND_GRID) {
    if (entry.uiOnly) continue;
    const aliases = overlayCache[entry.id]?.aliases || [];
    for (const alias of aliases) {
      const token = alias.trim().toUpperCase();
      if (!token) continue;
      const hit = upper === token || upper.startsWith(`${token} `);
      if (!hit) continue;
      if (!best || token.length > best.alias.length) best = { alias: token, prefix: entry.prefix };
    }
  }
  if (!best) return trimmed;
  if (upper === best.alias) return best.prefix;
  return `${best.prefix}${trimmed.slice(best.alias.length)}`;
};
