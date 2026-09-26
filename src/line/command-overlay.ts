import { getPlatformConfig, mutatePlatformConfig } from '../services/firestore';
import { isServiceConfigured, resolveServiceForCommand } from '../services/service-catalog';
import { tenantScopedKey } from '../services/tenant';
import { COMMAND_GRID, type CommandChannel, type CommandGridEntry, type CommandRole } from './command-grid';

export type CommandOverlayPatch = {
  enabled?: boolean;
  roles?: CommandRole[];
  channels?: CommandChannel[];
  labelEn?: string;
  labelTh?: string;
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

/** LINE Flex / menu label from Admin Commands EN/TH overlay. Prefix itself is not editable. */
export const overlayLabelForText = (
  text: string,
  language: 'en' | 'th',
  fallback: string,
): string => {
  const upper = text.trim().toUpperCase();
  let best: CommandGridEntry | null = null;
  for (const entry of COMMAND_GRID) {
    if (entry.uiOnly) continue;
    const hit = entry.exact
      ? upper === entry.prefix
      : upper === entry.prefix || upper.startsWith(`${entry.prefix} `);
    if (!hit) continue;
    if (!best || entry.prefix.length > best.prefix.length) best = entry;
  }
  if (!best) return fallback.slice(0, LINE_ACTION_LABEL_MAX);
  const patch = overlayCache[best.id] || {};
  const overlayLabel = language === 'th' ? patch.labelTh : patch.labelEn;
  const label = typeof overlayLabel === 'string' && overlayLabel.trim() ? overlayLabel.trim() : fallback;
  return label.slice(0, LINE_ACTION_LABEL_MAX);
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
    commands[id] = next;
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
