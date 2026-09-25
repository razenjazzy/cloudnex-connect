import { describe, expect, it } from 'vitest';
import {
  describeSettings,
  getRuntime,
  getSecretRevealTtlSeconds,
  ipAllowedForAdmin,
  isAdminConfigLocked,
  resetRuntimeSettingsForTests,
} from '../src/services/runtime-settings';

describe('runtime settings', () => {
  it('lets env win when ADMIN_CONFIG_LOCK is on', () => {
    resetRuntimeSettingsForTests({ LINE_CHANNEL_SECRET: 'overlay-secret' });
    const env = { ADMIN_CONFIG_LOCK: 'true', LINE_CHANNEL_SECRET: 'env-secret' };
    expect(getRuntime('LINE_CHANNEL_SECRET', env)).toBe('env-secret');
  });

  it('lets overlay win when unlocked', () => {
    resetRuntimeSettingsForTests({ PUBLIC_BASE_URL: 'https://overlay.example' });
    const env = { ADMIN_CONFIG_LOCK: 'false', PUBLIC_BASE_URL: 'https://env.example' };
    expect(getRuntime('PUBLIC_BASE_URL', env)).toBe('https://overlay.example');
  });

  it('never returns secret material on describeSettings', () => {
    resetRuntimeSettingsForTests({});
    const rows = describeSettings({
      ADMIN_CONFIG_LOCK: 'true',
      LINE_CHANNEL_SECRET: 'super-secret-value',
      PUBLIC_BASE_URL: 'https://public.example',
    });
    const secret = rows.find(row => row.key === 'LINE_CHANNEL_SECRET');
    const pub = rows.find(row => row.key === 'PUBLIC_BASE_URL');
    expect(secret?.kind).toBe('secret');
    expect(secret?.set).toBe(true);
    expect(secret?.value).toBeUndefined();
    expect(pub?.value).toBe('https://public.example');
  });

  it('clamps reveal TTL to 1–60 with default 10', () => {
    expect(getSecretRevealTtlSeconds({})).toBe(10);
    expect(getSecretRevealTtlSeconds({ SECRET_REVEAL_TTL_SECONDS: '3' })).toBe(3);
    expect(getSecretRevealTtlSeconds({ SECRET_REVEAL_TTL_SECONDS: '99' })).toBe(60);
    expect(getSecretRevealTtlSeconds({ SECRET_REVEAL_TTL_SECONDS: '0' })).toBe(1);
  });

  it('fails open for CIDR when unset and denies outside the list when set', () => {
    expect(ipAllowedForAdmin('10.0.0.8', {})).toBe(true);
    expect(ipAllowedForAdmin('10.0.0.8', { ADMIN_ALLOWED_CIDRS: '10.0.0.0/24' })).toBe(true);
    expect(ipAllowedForAdmin('11.0.0.8', { ADMIN_ALLOWED_CIDRS: '10.0.0.0/24' })).toBe(false);
  });

  it('defaults lock to true', () => {
    expect(isAdminConfigLocked({})).toBe(true);
  });
});
