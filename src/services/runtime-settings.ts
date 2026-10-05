import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getPlatformConfig, setPlatformConfig } from './firestore';

export const RUNTIME_SECRETS_CONFIG_KEY = 'runtimeSecretsV1';
export const BOOTSTRAP_CONFIG_KEY = 'bootstrapCompleteV1';

const envFlag = (value: string | undefined): boolean => /^(1|true|yes|on)$/i.test(value || '');

export const SECRET_SETTING_KEYS = [
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SALES_SECRET',
  'LINE_CHANNEL_SALES_ACCESS_TOKEN',
  'LINE_CHANNEL_CUSTOMER_SECRET',
  'LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN',
  'ODOO_API_KEY',
  'OPS_API_TOKEN',
  'DEMO_CONTROL_TOKEN',
  'ADMIN_SECRET_TOKEN',
  'WEBHOOK_TEST_TOKEN',
  'LINE_LOGIN_CHANNEL_SECRET',
  'OKTA_CLIENT_SECRET',
  'FLOWISE_API_KEY',
] as const;

export const PUBLIC_SETTING_KEYS = [
  'PUBLIC_BASE_URL',
  'LINE_CHANNEL_BASIC_ID',
  'LINE_CHANNEL_SALES_BASIC_ID',
  'LINE_CHANNEL_CUSTOMER_BASIC_ID',
  'LINE_AGENT_NAME_EN',
  'LINE_AGENT_NAME_TH',
  'LINE_DEFAULT_CUSTOMER_NAME',
  'LINE_DEFAULT_CUSTOMER_PHONE',
  'LINE_DEFAULT_CUSTOMER_EMAIL',
  'LINE_DEFAULT_CUSTOMER_NAME_TH',
  'LINE_DEFAULT_CUSTOMER_PHONE_TH',
  'LINE_DEFAULT_CUSTOMER_EMAIL_TH',
  'LINE_DEFAULT_GUEST_NAME',
  'LINE_CHANNEL_DEFAULT_SERVICES',
  'LINE_CHANNEL_SALES_SERVICES',
  'LINE_CHANNEL_CUSTOMER_SERVICES',
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ADMIN_USER_ID',
  'SUPER_ADMIN_USER_IDS',
  'ERP_PROVIDER',
  'TENANT_KEY',
  'SALES_SESSION_TTL_HOURS',
  'SALES_IDLE_SIGNOUT_SECONDS',
  'LINE_LOGIN_CHANNEL_ID',
  'OKTA_ISSUER',
  'OKTA_CLIENT_ID',
  'OKTA_LINE_CLAIM',
  'OKTA_LINE_USER_MAP',
  'SAML_IDP_SSO_URL',
  'SAML_SP_ENTITY_ID',
  'SAML_LINE_ATTRIBUTE',
  'SAML_IDP_CERT',
  'DISABLED_COMMANDS',
  'LINE_GROUP_ROOMS',
  'LINE_SECOND_WEBHOOK',
  'GRAPHQL_LINE_INGEST',
  'ENABLE_GRAPHQL',
  'ENABLE_API_DOCS',
  'LINE_WEBHOOK_ASYNC',
  'MONGO_USERS',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'FLOWISE_BASE_URL',
  'FLOWISE_CHATFLOW_ID',
  'CUSTOMER_COMMERCE',
  'ODOO_WEBSITE_ID',
] as const;

const ALLOWED_OVERLAY_KEYS = new Set<string>([...SECRET_SETTING_KEYS, ...PUBLIC_SETTING_KEYS]);

const LINE_CHANNEL_DEFAULT_KEYS = new Set([
  'LINE_CHANNEL_ID',
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_BASIC_ID',
  'LINE_CHANNEL_DEFAULT_SERVICES',
]);

/** Longest suffix first so KEYBOARD_RICH_MENU is not parsed as RICH_MENU. */
const LINE_CHANNEL_NAMESPACED_SUFFIXES = [
  'KEYBOARD_RICH_MENU',
  'RICH_MENU_JSON',
  'ACCESS_TOKEN',
  'BASIC_ID',
  'SERVICES',
  'SECRET',
  'ID',
] as const;

export const isAllowedLineChannelOverlayKey = (key: string): boolean => {
  if (!key.startsWith('LINE_CHANNEL_')) return false;
  if (LINE_CHANNEL_DEFAULT_KEYS.has(key) || ALLOWED_OVERLAY_KEYS.has(key)) return true;
  const rest = key.slice('LINE_CHANNEL_'.length);
  for (const suffix of LINE_CHANNEL_NAMESPACED_SUFFIXES) {
    const token = `_${suffix}`;
    if (!rest.endsWith(token)) continue;
    const slug = rest.slice(0, -token.length);
    if (/^[A-Z][A-Z0-9_]{0,31}$/.test(slug) && !slug.includes('__')) return true;
  }
  return false;
};

export const isPublicLineChannelOverlayKey = (key: string): boolean =>
  isAllowedLineChannelOverlayKey(key) && !isSecretSettingKey(key);

let overlay: Record<string, string> = {};
let hydrated = false;

export const ADMIN_CONFIG_LOCK_ERROR =
  'ADMIN_CONFIG_LOCK is enabled. Set ADMIN_CONFIG_LOCK=false to edit settings, or paste the VPS ADMIN_SECRET_TOKEN on Jobs.';

export const isAdminConfigLocked = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env.ADMIN_CONFIG_LOCK;
  if (raw === undefined || raw === '') return true;
  return envFlag(raw);
};

export const getSecretRevealTtlSeconds = (env: NodeJS.ProcessEnv = process.env): number => {
  const n = Math.trunc(Number(env.SECRET_REVEAL_TTL_SECONDS || 10));
  if (!Number.isFinite(n)) return 10;
  return Math.min(60, Math.max(1, n));
};

export const isSecretSettingKey = (key: string): boolean =>
  SECRET_SETTING_KEYS.includes(key as (typeof SECRET_SETTING_KEYS)[number])
  || /(secret|token|password|api[-_]?key)/i.test(key);

/** Locked overlay may only set ADMIN_SECRET_TOKEN when env does not already have one. Extra keys (even empty) are rejected. */
export const isLockedAdminSecretBootstrapPatch = (
  patch: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  if (env.ADMIN_SECRET_TOKEN?.trim()) return false;
  const keys = Object.keys(patch);
  if (keys.length !== 1 || keys[0] !== 'ADMIN_SECRET_TOKEN') return false;
  return Boolean(String(patch.ADMIN_SECRET_TOKEN || '').trim());
};

const encryptionKeyBytes = (env: NodeJS.ProcessEnv = process.env): Buffer | null => {
  const material = env.SECRETS_ENCRYPTION_KEY?.trim() || env.CONNECT_BOOTSTRAP_TOKEN?.trim() || '';
  if (!material) return null;
  return createHash('sha256').update(material).digest();
};

const encryptJson = (value: Record<string, string>, env: NodeJS.ProcessEnv = process.env): string | null => {
  const key = encryptionKeyBytes(env);
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
};

const decryptJson = (blob: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> => {
  const key = encryptionKeyBytes(env);
  if (!key) return {};
  const raw = Buffer.from(blob, 'base64');
  if (raw.length < 29) return {};
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  const parsed = JSON.parse(plain) as unknown;
  if (!parsed || typeof parsed !== 'object') return {};
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
};

export const resetRuntimeSettingsForTests = (next: Record<string, string> = {}): void => {
  overlay = { ...next };
  hydrated = true;
};

/** LINE channel credentials are managed from Admin: a saved Admin value overrides the VPS .env even when ADMIN_CONFIG_LOCK is on. */
export const isLineChannelKey = (key: string): boolean => key.startsWith('LINE_CHANNEL_') && isAllowedLineChannelOverlayKey(key);

export const runtimeValueSource = (key: string, env: NodeJS.ProcessEnv = process.env): 'admin' | 'env' | 'unset' => {
  if (isLineChannelKey(key) && overlay[key]?.trim()) return 'admin';
  const envVal = env[key]?.trim() || '';
  const overlayVal = overlay[key]?.trim() || '';
  if (isAdminConfigLocked(env) && envVal) return 'env';
  if (!isAdminConfigLocked(env) && overlayVal) return 'admin';
  return envVal ? 'env' : overlayVal ? 'admin' : 'unset';
};

export const overlayKeys = (): string[] => Object.keys(overlay);

export const getRuntime = (key: string, env: NodeJS.ProcessEnv = process.env): string => {
  const envVal = env[key]?.trim() || '';
  const overlayVal = overlay[key]?.trim() || '';
  if (overlayVal && isLineChannelKey(key)) return overlayVal;
  if (isAdminConfigLocked(env) && envVal) return envVal;
  if (!isAdminConfigLocked(env) && overlayVal) return overlayVal;
  return envVal || overlayVal || '';
};

export const getEffectiveAdminUserIds = (env: NodeJS.ProcessEnv = process.env): Set<string> => {
  const parse = (raw: string): Set<string> => new Set(raw.split(',').map(v => v.trim()).filter(Boolean));
  const envList = parse(env.ADMIN_USER_ID || '');
  const overlayList = parse(overlay.ADMIN_USER_ID || '');
  if (envList.size && overlayList.size) {
    return new Set([...envList].filter(id => overlayList.has(id)));
  }
  if (envList.size) return envList;
  return overlayList;
};

export const getSuperAdminUserIds = (env: NodeJS.ProcessEnv = process.env): Set<string> => {
  const parse = (raw: string): Set<string> => new Set(raw.split(',').map(v => v.trim()).filter(Boolean));
  const fromEnv = parse(env.SUPER_ADMIN_USER_IDS || '');
  const fromOverlay = parse(overlay.SUPER_ADMIN_USER_IDS || '');
  const combined = new Set([...fromEnv, ...fromOverlay]);
  if (combined.size === 0) return new Set();
  const admin = getEffectiveAdminUserIds(env);
  if (admin.size === 0) return combined;
  return new Set([...combined].filter(id => admin.has(id)));
};

export const hydrateRuntimeSettings = async (): Promise<void> => {
  if (hydrated) return;
  const stored = await getPlatformConfig<{ blob?: string }>(RUNTIME_SECRETS_CONFIG_KEY);
  if (stored?.blob && typeof stored.blob === 'string') {
    try {
      overlay = decryptJson(stored.blob);
    } catch {
      overlay = {};
    }
  }
  hydrated = true;
};

export const mergeRuntimeOverlay = async (
  patch: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env,
  opts: { lineChannelBypass?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> => {
  const bypass = Boolean(opts.lineChannelBypass) && Object.keys(patch).length > 0 && Object.keys(patch).every(isLineChannelKey);
  if (isAdminConfigLocked(env) && !bypass) {
    if (!isLockedAdminSecretBootstrapPatch(patch, env)) {
      return { ok: false, error: ADMIN_CONFIG_LOCK_ERROR };
    }
  }
  const next = { ...overlay };
  const locked = isAdminConfigLocked(env);
  let applied = 0;
  for (const [key, value] of Object.entries(patch)) {
    if (locked && !bypass && key !== 'ADMIN_SECRET_TOKEN') {
      return { ok: false, error: ADMIN_CONFIG_LOCK_ERROR };
    }
    if (!ALLOWED_OVERLAY_KEYS.has(key) && !isAllowedLineChannelOverlayKey(key)) {
      continue;
    }
    if (env.APP_ENV === 'production' && (key === 'ENABLE_DEMO_CONTROL_PANEL' || key === 'ENABLE_WEBHOOK_TEST')) {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      delete next[key];
    } else {
      next[key] = trimmed;
    }
    applied += 1;
  }
  if (!applied) return { ok: false, error: locked ? ADMIN_CONFIG_LOCK_ERROR : 'No overlay keys applied.' };
  const blob = encryptJson(next, env);
  if (!blob) return { ok: false, error: 'SECRETS_ENCRYPTION_KEY is required to persist overlay.' };
  const result = await setPlatformConfig(RUNTIME_SECRETS_CONFIG_KEY, { blob });
  if (!result.ok) return { ok: false, error: result.error || 'Failed to persist overlay.' };
  overlay = next;
  hydrated = true;
  return { ok: true };
};

export const describeSettings = (env: NodeJS.ProcessEnv = process.env): Array<{
  key: string;
  kind: 'secret' | 'public';
  set: boolean;
  value?: string;
}> => {
  const keys = [...PUBLIC_SETTING_KEYS, ...SECRET_SETTING_KEYS];
  const extra = Object.keys(overlay).filter(key => isAllowedLineChannelOverlayKey(key) && !keys.includes(key as typeof keys[number]));
  return [...keys, ...extra].map(key => {
    const value = getRuntime(key, env);
    const kind = isSecretSettingKey(key) ? 'secret' as const : 'public' as const;
    return {
      key,
      kind,
      set: Boolean(value),
      ...(kind === 'public' && value ? { value } : {}),
    };
  });
};

export const isBootstrapComplete = async (): Promise<boolean> => {
  const stored = await getPlatformConfig<{ complete?: boolean }>(BOOTSTRAP_CONFIG_KEY);
  if (stored?.complete) return true;
  const hasOps = Boolean(process.env.OPS_API_TOKEN?.trim());
  const hasInstallToken = Boolean(process.env.CONNECT_BOOTSTRAP_TOKEN?.trim());
  return hasOps && !hasInstallToken;
};

export const markBootstrapComplete = async (): Promise<void> => {
  await setPlatformConfig(BOOTSTRAP_CONFIG_KEY, { complete: true, completedAt: new Date().toISOString() });
};

export const ipAllowedForAdmin = (ip: string, env: NodeJS.ProcessEnv = process.env): boolean => {
  const raw = env.ADMIN_ALLOWED_CIDRS?.trim();
  if (!raw) return true;
  const cidrs = raw.split(',').map(v => v.trim()).filter(Boolean);
  const normalized = ip.replace('::ffff:', '');
  return cidrs.some(cidr => {
    if (!cidr.includes('/')) return normalized === cidr;
    const [base, bitsRaw] = cidr.split('/');
    const bits = Number(bitsRaw);
    if (!base || !Number.isInteger(bits)) return false;
    const toInt = (addr: string): number | null => {
      const parts = addr.split('.').map(Number);
      if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return null;
      return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    };
    const ipInt = toInt(normalized);
    const baseInt = toInt(base);
    if (ipInt === null || baseInt === null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  });
};
