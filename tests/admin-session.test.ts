import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformConfig, setPlatformConfig } from '../src/services/firestore';
import {
  buildAdminActorCookie,
  consumeBindOtp,
  consumeRevealToken,
  issueBindOtp,
  issueRevealToken,
  parseAdminActorCookie,
} from '../src/services/admin-session';

vi.mock('../src/services/firestore', () => ({
  getPlatformConfig: vi.fn(),
  setPlatformConfig: vi.fn(),
}));

const mockedGet = vi.mocked(getPlatformConfig);
const mockedSet = vi.mocked(setPlatformConfig);

describe('admin session bind and reveal tokens', () => {
  const store: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    mockedGet.mockImplementation(async (key: string) => (store[key] as never) || null);
    mockedSet.mockImplementation(async (key: string, value: unknown) => {
      store[key] = value;
      return { ok: true };
    });
    process.env.SECRET_REVEAL_TTL_SECONDS = '10';
    process.env.OPS_API_TOKEN = 'ops-test-token-16chars';
  });

  afterEach(() => {
    delete process.env.SECRET_REVEAL_TTL_SECONDS;
  });

  it('sets an httpOnly SameSite Lax actor cookie', () => {
    const { cookie } = buildAdminActorCookie('Uadmin');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('cloudnex_admin_actor=');
    expect(parseAdminActorCookie(cookie)).toBe('Uadmin');
  });

  it('rejects a tampered actor cookie', () => {
    const { cookie } = buildAdminActorCookie('Uadmin');
    const spoofed = cookie.replace('Uadmin', 'Uevil');
    expect(parseAdminActorCookie(spoofed)).toBeNull();
  });

  it('stores bind OTP hashed and consumes once', async () => {
    const issued = await issueBindOtp('Uadmin');
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    const stored = store.adminBindOtpsV1 as Record<string, { hash: string }>;
    expect(stored.Uadmin.hash).not.toBe(issued.otp);
    expect(await consumeBindOtp('Uadmin', issued.otp)).toBe(true);
    expect(await consumeBindOtp('Uadmin', issued.otp)).toBe(false);
  });

  it('stores reveal tokens hashed and consumes once', async () => {
    const issued = await issueRevealToken('LINE_CHANNEL_SECRET', 'Uadmin');
    const stored = store.secretRevealTokensV1 as Record<string, { secretKey: string }>;
    expect(stored[issued.token]).toBeUndefined();
    expect(Object.keys(stored).length).toBe(1);
    const first = await consumeRevealToken(issued.token);
    expect(first?.secretKey).toBe('LINE_CHANNEL_SECRET');
    expect(await consumeRevealToken(issued.token)).toBeNull();
  });
});
