import { beforeEach, describe, expect, it, vi } from 'vitest';

const profiles: Record<string, Record<string, unknown>> = {};
const clearSalesLogin = vi.fn(async () => undefined);
const linkUserRichMenu = vi.fn(async () => undefined);

vi.mock('../src/services/firestore', () => ({
  listVerifiedSalesLineUserIds: async () => Object.keys(profiles),
  getUserProfile: async (id: string) => profiles[id],
}));
vi.mock('../src/services/sales-session', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/services/sales-session')>()),
  clearSalesLogin: (...args: unknown[]) => (clearSalesLogin as unknown as (...a: unknown[]) => Promise<void>)(...args),
}));
vi.mock('../src/line/rich-menu', () => ({ linkUserRichMenu: (...args: unknown[]) => (linkUserRichMenu as unknown as (...a: unknown[]) => Promise<void>)(...args) }));

import { sweepExpiredSalesSessions } from '../src/jobs/sales-session-sweep';

describe('sales session sweep', () => {
  const now = Date.parse('2026-10-04T12:00:00Z');
  const base = { odooVerified: true, salesTier: 'salesperson', language: 'en' };

  beforeEach(() => {
    for (const key of Object.keys(profiles)) delete profiles[key];
    clearSalesLogin.mockClear();
    linkUserRichMenu.mockClear();
  });

  it('signs out expired, idle and untracked sessions and resets the menu; leaves live ones alone', async () => {
    profiles.live = { ...base, salesSessionExpiresAt: '2026-10-05T10:00:00Z', salesLastActiveAt: '2026-10-04T11:50:00Z' };
    profiles.expired = { ...base, salesSessionExpiresAt: '2026-10-04T11:00:00Z', salesLastActiveAt: '2026-10-04T10:59:00Z' };
    profiles.idle = { ...base, salesSessionExpiresAt: '2026-10-05T10:00:00Z', salesLastActiveAt: '2026-10-04T10:00:00Z' };
    profiles.legacy = { ...base };
    profiles.th = { ...base, language: 'th', salesSessionExpiresAt: '2026-10-04T01:00:00Z' };
    const result = await sweepExpiredSalesSessions(now);
    expect(result).toEqual({ checked: 5, signedOut: 4, failed: 0 });
    expect(clearSalesLogin).not.toHaveBeenCalledWith('live');
    expect(linkUserRichMenu).toHaveBeenCalledWith('th', 'th', expect.any(String), 'default', false);
    expect(linkUserRichMenu).toHaveBeenCalledWith('expired', 'en', expect.any(String), 'default', false);
  });
});
