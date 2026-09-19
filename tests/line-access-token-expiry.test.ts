import { describe, expect, it } from 'vitest';
import { jwtExpiryUnix, lineAccessTokenExpiryWarnings } from '../src/services/line-access-token-expiry';

const jwtWithExp = (exp: number): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  return `${header}.${payload}.sig`;
};

describe('line access token expiry', () => {
  it('returns null for opaque long-lived tokens', () => {
    expect(jwtExpiryUnix('long-lived-opaque-token')).toBeNull();
  });

  it('reads exp from a JWT payload without logging the token', () => {
    expect(jwtExpiryUnix(jwtWithExp(1_800_000_000))).toBe(1_800_000_000);
  });

  it('warns within seven days and when expired', () => {
    const now = 1_700_000_000;
    const soon = lineAccessTokenExpiryWarnings(
      { LINE_CHANNEL_ACCESS_TOKEN: jwtWithExp(now + 2 * 86400) },
      now,
    );
    expect(soon).toHaveLength(1);
    expect(soon[0]).toContain('LINE_CHANNEL_ACCESS_TOKEN');
    expect(soon[0]).toContain('expires in');

    const expired = lineAccessTokenExpiryWarnings(
      { LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN: jwtWithExp(now - 10) },
      now,
    );
    expect(expired[0]).toContain('expired');
  });

  it('is silent when expiry is more than seven days away', () => {
    const now = 1_700_000_000;
    expect(lineAccessTokenExpiryWarnings(
      { LINE_CHANNEL_ACCESS_TOKEN: jwtWithExp(now + 30 * 86400) },
      now,
    )).toEqual([]);
  });
});
