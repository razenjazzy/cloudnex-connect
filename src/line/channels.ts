import { getPlatformConfig, setPlatformConfig } from '../services/firestore';
import { getRuntime } from '../services/runtime-settings';

export type ChannelContext = {
  channelId: string;
  enabledServices: string[] | null; // null = unrestricted (all services allowed)
};

export type ChannelConfig = ChannelContext & {
  channelSecret: string;
  channelAccessToken: string;
};

export const DEFAULT_CHANNEL_ID = 'default';
/** Cloudnex Sales (`POST /webhook/sales`). Falls back to default LINE_* credentials if SALES_* is unset. */
export const SALES_CHANNEL_ID = 'sales';
/** Cloudnex Customer (`POST /webhook/customer`). */
export const CUSTOMER_CHANNEL_ID = 'customer';
/** Flex / product name. LINE OA Manager names are Cloudnex Sales and Cloudnex Customer. */
export const APP_NAME = 'CloudNex Connect';

/** LINE user ids on this OA are not valid on the other. Pushes must use matching credentials. */
export const customerNotifyChannelId = (): string =>
  resolveChannelConfig(CUSTOMER_CHANNEL_ID) ? CUSTOMER_CHANNEL_ID : DEFAULT_CHANNEL_ID;

export const salesNotifyChannelId = (): string =>
  resolveChannelConfig(SALES_CHANNEL_ID) ? SALES_CHANNEL_ID : DEFAULT_CHANNEL_ID;

/**
 * Single source of truth for the bot's persona name and its fallback, so a
 * future rename can't drift between call sites (previously duplicated as a
 * literal in six files).
 */
export const getAgentName = (language: 'th' | 'en' = 'en'): string => {
  if (language === 'th') return getRuntime('LINE_AGENT_NAME_TH') || 'โซระ';
  return getRuntime('LINE_AGENT_NAME_EN') || 'Sora';
};

export const getBrandTitle = (language: 'th' | 'en' = 'en'): string =>
  `${APP_NAME}: ${getAgentName(language)}`;

const parseServiceList = (value: string | undefined): string[] | null => {
  if (value === undefined) return null;
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
};

const toEnvKey = (channelId: string): string => channelId.toUpperCase().replace(/[^A-Z0-9]/g, '_');

const defaultChannelConfig = (): ChannelConfig | null => {
  const channelSecret = getRuntime('LINE_CHANNEL_SECRET');
  const channelAccessToken = getRuntime('LINE_CHANNEL_ACCESS_TOKEN');
  if (!channelSecret || !channelAccessToken) return null;
  return {
    channelId: DEFAULT_CHANNEL_ID,
    channelSecret,
    channelAccessToken,
    enabledServices: parseServiceList(getRuntime('LINE_CHANNEL_DEFAULT_SERVICES') || undefined),
  };
};

/**
 * Resolves channel credentials/config from environment variables only.
 * The default channel preserves the existing flat LINE_CHANNEL_SECRET /
 * LINE_CHANNEL_ACCESS_TOKEN vars for backward compatibility. Additional
 * channels are configured via LINE_CHANNEL_<ID>_SECRET / _ACCESS_TOKEN / _SERVICES.
 * `sales` reuses default credentials when LINE_CHANNEL_SALES_* is unset so
 * Cloudnex Line Sales can use POST /webhook/sales without duplicating tokens.
 * Returns null when the channel is unknown or missing required credentials.
 */
export const resolveChannelConfig = (channelId: string): ChannelConfig | null => {
  const normalized = channelId.trim();
  if (!normalized) return null;

  if (normalized === DEFAULT_CHANNEL_ID) return defaultChannelConfig();

  const envKey = toEnvKey(normalized);
  const channelSecret = getRuntime(`LINE_CHANNEL_${envKey}_SECRET`);
  const channelAccessToken = getRuntime(`LINE_CHANNEL_${envKey}_ACCESS_TOKEN`);
  if (channelSecret && channelAccessToken) {
    return {
      channelId: normalized,
      channelSecret,
      channelAccessToken,
      enabledServices: parseServiceList(getRuntime(`LINE_CHANNEL_${envKey}_SERVICES`) || undefined),
    };
  }

  if (normalized === SALES_CHANNEL_ID) {
    const fallback = defaultChannelConfig();
    if (!fallback) return null;
    return {
      ...fallback,
      channelId: SALES_CHANNEL_ID,
      enabledServices: getRuntime('LINE_CHANNEL_SALES_SERVICES')
        ? parseServiceList(getRuntime('LINE_CHANNEL_SALES_SERVICES'))
        : fallback.enabledServices,
    };
  }

  return null;
};

/**
 * The bot's LINE "Basic ID" (the @xxx handle from LINE Official Account
 * Manager) — used only to build a deep link back to the specific OA chat
 * after an external browser action (e.g. the magic-link verification
 * landing page). Same default/per-channel env pattern as resolveChannelConfig;
 * returns undefined (not an error) when unconfigured so callers can fall
 * back to a generic app-open link instead.
 */
export const resolveBasicId = (channelId: string): string | undefined => {
  const normalized = channelId.trim();
  if (!normalized) return undefined;

  if (normalized === DEFAULT_CHANNEL_ID) {
    return getRuntime('LINE_CHANNEL_BASIC_ID') || undefined;
  }

  const envKey = toEnvKey(normalized);
  const namespaced = getRuntime(`LINE_CHANNEL_${envKey}_BASIC_ID`);
  if (namespaced) return namespaced;
  if (normalized === SALES_CHANNEL_ID) return getRuntime('LINE_CHANNEL_BASIC_ID') || undefined;
  return undefined;
};

/**
 * LINE in-app browser rejects `line://` and percent-encoded `@` (`%40`).
 * Keep the `@` literal: https://line.me/R/ti/p/@youroa
 */
export const oaChatDeepLink = (channelId: string): string | undefined => {
  const raw = resolveBasicId(channelId);
  if (!raw) return undefined;
  const id = raw.startsWith('@') ? raw : `@${raw}`;
  return `https://line.me/R/ti/p/${id}`;
};

/** Opens the OA chat with a prefilled command after add-friend. */
export const oaPrefillDeepLink = (channelId: string, text: string): string | undefined => {
  const raw = resolveBasicId(channelId);
  if (!raw) return undefined;
  const id = raw.startsWith('@') ? raw : `@${raw}`;
  return `https://line.me/R/oaMessage/${id}/?text=${encodeURIComponent(text)}`;
};

const channelServiceOverrideKey = (channelId: string): string => `channelServices:${channelId}`;

/**
 * Per-channel module enablement was env-var-only, which meant every toggle
 * needed a redeploy. This adds a Firestore-backed override on top of the env
 * default (reusing the existing generic platformConfig store) so an admin
 * command can flip modules per channel at runtime.
 */
export const getChannelServiceOverride = async (channelId: string): Promise<string[] | null | undefined> => {
  const stored = await getPlatformConfig<{ services: string[] | null }>(channelServiceOverrideKey(channelId));
  return stored ? stored.services : undefined;
};

export const setChannelServiceOverride = async (channelId: string, services: string[] | null): Promise<{ ok: boolean; error?: string }> => {
  return setPlatformConfig(channelServiceOverrideKey(channelId), { services } as unknown as Record<string, unknown>);
};

/**
 * Combines the env-resolved channel config with any live Firestore override
 * into the ChannelContext passed down into resolveCommandReply. An override
 * (even `null`, meaning explicitly unrestricted) always wins over the env
 * default; a channel with no override keeps its existing env-driven behavior.
 */
export const resolveEffectiveChannelContext = async (config: ChannelConfig): Promise<ChannelContext> => {
  const override = await getChannelServiceOverride(config.channelId);
  return {
    channelId: config.channelId,
    enabledServices: override !== undefined ? override : config.enabledServices,
  };
};
