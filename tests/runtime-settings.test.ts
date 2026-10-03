import { describe, expect, it } from 'vitest';
import {
  describeSettings,
  getRuntime,
  getSecretRevealTtlSeconds,
  ipAllowedForAdmin,
  isAdminConfigLocked,
  isAllowedLineChannelOverlayKey,
  isLockedAdminSecretBootstrapPatch,
  isPublicLineChannelOverlayKey,
  mergeRuntimeOverlay,
  resetRuntimeSettingsForTests,
  runtimeValueSource,
} from '../src/services/runtime-settings';

describe('runtime settings', () => {
  it('lets env win when ADMIN_CONFIG_LOCK is on (non-LINE keys)', () => {
    resetRuntimeSettingsForTests({ PUBLIC_BASE_URL: 'https://overlay.example' });
    const env = { ADMIN_CONFIG_LOCK: 'true', PUBLIC_BASE_URL: 'https://env.example' };
    expect(getRuntime('PUBLIC_BASE_URL', env)).toBe('https://env.example');
  });

  it('lets an Admin-saved LINE channel credential override env even when locked', () => {
    resetRuntimeSettingsForTests({ LINE_CHANNEL_SALES_ACCESS_TOKEN: 'admin-token', LINE_CHANNEL_SECRET: 'overlay-secret' });
    const env = { ADMIN_CONFIG_LOCK: 'true', LINE_CHANNEL_SALES_ACCESS_TOKEN: 'env-token', LINE_CHANNEL_SECRET: 'env-secret' };
    expect(getRuntime('LINE_CHANNEL_SALES_ACCESS_TOKEN', env)).toBe('admin-token');
    expect(getRuntime('LINE_CHANNEL_SECRET', env)).toBe('overlay-secret');
    expect(runtimeValueSource('LINE_CHANNEL_SALES_ACCESS_TOKEN', env)).toBe('admin');
  });

  it('falls back to env for a LINE key with no Admin value, and reports the source', () => {
    resetRuntimeSettingsForTests({});
    const env = { ADMIN_CONFIG_LOCK: 'true', LINE_CHANNEL_ACCESS_TOKEN: 'env-token' };
    expect(getRuntime('LINE_CHANNEL_ACCESS_TOKEN', env)).toBe('env-token');
    expect(runtimeValueSource('LINE_CHANNEL_ACCESS_TOKEN', env)).toBe('env');
    expect(runtimeValueSource('LINE_CHANNEL_CUSTOMER_SECRET', env)).toBe('unset');
  });

  it('keeps the lock for non-LINE keys even when the LINE bypass is requested', async () => {
    resetRuntimeSettingsForTests({});
    const result = await mergeRuntimeOverlay({ PUBLIC_BASE_URL: 'https://x.example' }, { ADMIN_CONFIG_LOCK: 'true' }, { lineChannelBypass: true });
    expect(result.ok).toBe(false);
    const mixed = await mergeRuntimeOverlay({ LINE_CHANNEL_SALES_SECRET: 's', PUBLIC_BASE_URL: 'https://x.example' }, { ADMIN_CONFIG_LOCK: 'true' }, { lineChannelBypass: true });
    expect(mixed.ok).toBe(false);
  });

  it('lets LINE channel keys through the lock only with the bypass flag', async () => {
    resetRuntimeSettingsForTests({});
    const denied = await mergeRuntimeOverlay({ LINE_CHANNEL_SALES_SECRET: 's' }, { ADMIN_CONFIG_LOCK: 'true' });
    expect(denied.ok).toBe(false);
    const allowed = await mergeRuntimeOverlay({ LINE_CHANNEL_SALES_SECRET: 's' }, { ADMIN_CONFIG_LOCK: 'true', SECRETS_ENCRYPTION_KEY: 'k'.repeat(32) }, { lineChannelBypass: true });
    // Reaches persistence (Firestore is unconfigured in tests) rather than the lock error.
    expect(allowed.ok === false ? allowed.error : '').not.toContain('ADMIN_CONFIG_LOCK');
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

  it('accepts known LINE_CHANNEL_ suffixes and rejects junk overlay keys', () => {
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_HR_SECRET')).toBe(true);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_HR_ACCESS_TOKEN')).toBe(true);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_HR_SERVICES')).toBe(true);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_CUSTOMER_KEYBOARD_RICH_MENU')).toBe(true);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_DEFAULT_SERVICES')).toBe(true);
    expect(isPublicLineChannelOverlayKey('LINE_CHANNEL_HR_SERVICES')).toBe(true);
    expect(isPublicLineChannelOverlayKey('LINE_CHANNEL_HR_SECRET')).toBe(false);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_HR_PASSWORD')).toBe(false);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_FOO')).toBe(false);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL__SERVICES')).toBe(false);
    expect(isPublicLineChannelOverlayKey('LINE_CHANNEL_UNKNOWN_JUNK')).toBe(false);
  });

  it('rejects locked overlay patches that smuggle empty keys beside ADMIN_SECRET_TOKEN', () => {
    const env = { ADMIN_CONFIG_LOCK: 'true' };
    expect(isLockedAdminSecretBootstrapPatch({ ADMIN_SECRET_TOKEN: 'admin-token-16xx' }, env)).toBe(true);
    expect(isLockedAdminSecretBootstrapPatch({
      ADMIN_SECRET_TOKEN: 'admin-token-16xx',
      DISABLED_COMMANDS: '',
    }, env)).toBe(false);
    expect(isLockedAdminSecretBootstrapPatch({ DISABLED_COMMANDS: '' }, env)).toBe(false);
    expect(isLockedAdminSecretBootstrapPatch(
      { ADMIN_SECRET_TOKEN: 'admin-token-16xx' },
      { ADMIN_CONFIG_LOCK: 'true', ADMIN_SECRET_TOKEN: 'already-on-vps-16' },
    )).toBe(false);
  });

  it('rejects public overlay merges when ADMIN_CONFIG_LOCK is on', async () => {
    resetRuntimeSettingsForTests({});
    const result = await mergeRuntimeOverlay(
      { PUBLIC_BASE_URL: 'https://overlay.example' },
      { ADMIN_CONFIG_LOCK: 'true' },
    );
    expect(result).toEqual({
      ok: false,
      error: 'ADMIN_CONFIG_LOCK is enabled. Set ADMIN_CONFIG_LOCK=false to edit settings, or paste the VPS ADMIN_SECRET_TOKEN on Jobs.',
    });
  });

  it('allows per-channel numeric LINE channel ids in the Admin overlay', () => {
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_SALES_ID')).toBe(true);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_CUSTOMER_ID')).toBe(true);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_ID')).toBe(true);
    expect(isAllowedLineChannelOverlayKey('LINE_CHANNEL_')).toBe(false);
  });
});
