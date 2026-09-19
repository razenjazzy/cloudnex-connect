import { describe, expect, it } from 'vitest';
import { commandActor, evaluateCommandGrid, isGuestAllowedCommand, matchCommandGrid } from '../src/line/command-grid';
import type { UserProfile } from '../src/services/firestore';

const profile = (overrides: Partial<UserProfile>): UserProfile => ({
  language: 'en',
  role: 'user',
  odooVerified: false,
  marketingOptIn: false,
  ...overrides,
});

describe('command grid', () => {
  it('keeps guest catalog browse and blocks guest quotes', () => {
    expect(isGuestAllowedCommand('NAV COMMERCE')).toBe(true);
    expect(isGuestAllowedCommand('NAV DIRECTORY')).toBe(false);
    expect(isGuestAllowedCommand('FORM QUOTE CREATE')).toBe(false);
    expect(isGuestAllowedCommand('ADMIN ENABLE')).toBe(false);
  });

  it('blocks admin enable on Customer OA and allows it on Sales', () => {
    const verified = profile({ odooVerified: true, role: 'user' });
    expect(evaluateCommandGrid('ADMIN ENABLE', { profile: verified, channel: { channelId: 'customer' } })).toEqual({
      ok: false,
      reason: 'channel',
    });
    expect(evaluateCommandGrid('ADMIN ENABLE', { profile: verified, channel: { channelId: 'sales' } })).toEqual({ ok: true });
  });

  it('requires LINE admin for ADMIN CONFIG', () => {
    const staff = profile({ odooVerified: true, role: 'user', salesTier: 'salesperson' });
    expect(commandActor(staff)).toBe('staff');
    expect(evaluateCommandGrid('ADMIN CONFIG', { profile: staff, channel: { channelId: 'sales' } }).ok).toBe(false);
    expect(evaluateCommandGrid('ADMIN CONFIG', {
      profile: profile({ odooVerified: true, role: 'admin' }),
      channel: { channelId: 'sales' },
    })).toEqual({ ok: true });
  });

  it('matches longest admin prefix', () => {
    expect(matchCommandGrid('ADMIN ENABLE')?.id).toBe('admin-enable');
    expect(matchCommandGrid('ADMIN CHANNEL sales SERVICES commerce')?.id).toBe('admin-channel');
  });
});
