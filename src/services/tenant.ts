import { getRuntime } from './runtime-settings';

export const DEFAULT_TENANT_KEY = 'default';

export const getActiveTenantKey = (): string => {
  const raw = (getRuntime('TENANT_KEY') || process.env.TENANT_KEY || DEFAULT_TENANT_KEY).trim().toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_-]/g, '');
  return cleaned || DEFAULT_TENANT_KEY;
};

export const tenantScopedKey = (suffix: string): string => `${getActiveTenantKey()}:${suffix}`;
