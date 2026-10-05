import { describe, expect, it } from 'vitest';
import { hasActiveSalesSession, salesIdleExpired, salesPolicyText, salesSessionUntracked, salesIdleSignoutSeconds, salesSessionExpired, salesSessionExpiresAtFromNow, salesSessionTtlHours, shouldTouchSalesActivity } from '../src/services/sales-session';
import { isSalesPreVerifyCommand } from '../src/line/command-grid';

describe('sales session', () => {
  it('defaults TTL to 24 hours and honors SALES_SESSION_TTL_HOURS', () => {
    expect(salesSessionTtlHours({})).toBe(24);
    expect(salesSessionTtlHours({ SALES_SESSION_TTL_HOURS: '8' })).toBe(8);
    const expires = salesSessionExpiresAtFromNow(0, { SALES_SESSION_TTL_HOURS: '1' });
    expect(new Date(expires).getTime()).toBe(60 * 60 * 1000);
  });

  it('is gold-on after identity VERIFY while the expiry is in the future', () => {
    const later = new Date(Date.now() + 60_000).toISOString();
    expect(hasActiveSalesSession({ odooVerified: true, salesTier: 'salesperson', salesSessionExpiresAt: later })).toBe(true);
    expect(hasActiveSalesSession({ odooVerified: true, salesTier: 'sales_manager', salesSessionExpiresAt: later })).toBe(true);
    expect(hasActiveSalesSession({ odooVerified: true, salesSessionExpiresAt: later })).toBe(true);
    expect(hasActiveSalesSession({ odooVerified: false, salesTier: 'salesperson', salesSessionExpiresAt: later })).toBe(false);
    expect(hasActiveSalesSession({ odooVerified: true, salesTier: 'salesperson' })).toBe(false);
    expect(hasActiveSalesSession({ odooVerified: true })).toBe(true);
    expect(salesSessionExpired({ odooVerified: true, salesSessionExpiresAt: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });

  it('treats a past expiry as expired so VERIFY can turn regular', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const profile = { odooVerified: true, salesTier: 'salesperson' as const, salesSessionExpiresAt: past };
    expect(hasActiveSalesSession(profile)).toBe(false);
    expect(salesSessionExpired(profile)).toBe(true);
  });

  it('signs a verified staff session out after 1 hour of silence (SALES_IDLE_SIGNOUT_SECONDS, 0 = off)', () => {
    expect(salesIdleSignoutSeconds({})).toBe(3600);
    expect(salesIdleSignoutSeconds({ SALES_IDLE_SIGNOUT_SECONDS: '600' })).toBe(600);
    expect(salesIdleSignoutSeconds({ SALES_IDLE_SIGNOUT_SECONDS: 'nope' })).toBe(3600);
    const now = Date.now();
    const staff = { odooVerified: true, salesTier: 'salesperson' as const };
    expect(salesIdleExpired({ ...staff, salesLastActiveAt: new Date(now - 61 * 60_000).toISOString() }, now, {})).toBe(true);
    expect(salesIdleExpired({ ...staff, salesLastActiveAt: new Date(now - 59 * 60_000).toISOString() }, now, {})).toBe(false);
    expect(salesIdleExpired({ ...staff, salesLastActiveAt: new Date(now - 7200_000).toISOString() }, now, { SALES_IDLE_SIGNOUT_SECONDS: '0' })).toBe(false);
    expect(salesIdleExpired({ odooVerified: true, salesTier: undefined, salesLastActiveAt: new Date(0).toISOString() }, now, {})).toBe(false);
    expect(salesIdleExpired({ ...staff }, now, {})).toBe(false);
  });

  it('touches the activity clock at most once a minute for verified staff only', () => {
    const now = Date.now();
    const staff = { odooVerified: true, salesTier: 'salesperson' as const };
    expect(shouldTouchSalesActivity(staff, now)).toBe(true);
    expect(shouldTouchSalesActivity({ ...staff, salesLastActiveAt: new Date(now - 10_000).toISOString() }, now)).toBe(false);
    expect(shouldTouchSalesActivity({ ...staff, salesLastActiveAt: new Date(now - 61_000).toISOString() }, now)).toBe(true);
    expect(shouldTouchSalesActivity({ odooVerified: false, salesTier: 'salesperson' }, now)).toBe(false);
  });

  it('before verification the Sales OA only allows identity, help, privacy and language', () => {
    for (const ok of ['NAV VERIFY', 'FORM VERIFY', 'VERIFY START 0123', 'VERIFY ASK ADMIN 0123', 'VERIFY OTP 123456', 'HELP', 'MY DATA', 'LANG EN', 'LANG']) {
      expect(isSalesPreVerifyCommand(ok)).toBe(true);
    }
    for (const blocked of ['NAV HOME', 'NAV', 'BACK', 'NAV COMMERCE', 'QUOTE LIST', 'PRODUCT FIND shoes', 'FORM QUOTE CREATE FROM CARD 3']) {
      expect(isSalesPreVerifyCommand(blocked)).toBe(false);
    }
    expect(isSalesPreVerifyCommand('FORM FIELD 1', { flow: 'VERIFY' })).toBe(true);
  });

  it('treats a verified staff member with no session end on file as signed out (Verify again)', () => {
    expect(salesSessionUntracked({ odooVerified: true, salesTier: 'sales_manager' })).toBe(true);
    expect(salesSessionUntracked({ odooVerified: true, salesTier: 'sales_manager', salesSessionExpiresAt: new Date().toISOString() })).toBe(false);
    expect(salesSessionUntracked({ odooVerified: true })).toBe(false); // customers have no tier and no expiry
    expect(salesSessionUntracked({ odooVerified: false, salesTier: 'salesperson' })).toBe(false);
  });

  it('words the policy from config, never hard-coded', () => {
    expect(salesPolicyText('en', {})).toEqual({ ttl: '24 h', idle: '1 h' });
    expect(salesPolicyText('en', { SALES_SESSION_TTL_HOURS: '8', SALES_IDLE_SIGNOUT_SECONDS: '1800' })).toEqual({ ttl: '8 h', idle: '30 min' });
    expect(salesPolicyText('th', { SALES_IDLE_SIGNOUT_SECONDS: '0' }).idle).toBe('');
  });
});
