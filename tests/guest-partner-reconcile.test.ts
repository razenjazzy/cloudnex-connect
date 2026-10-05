import { describe, expect, it } from 'vitest';
import { isRecentGuestPartnerCreateDate } from '../src/services/odoo/partners';

describe('guest partner create reconcile window', () => {
  const now = Date.parse('2026-10-06T04:50:00.000Z');

  it('accepts an Odoo create_date from the last 10 minutes', () => {
    expect(isRecentGuestPartnerCreateDate('2026-10-06 04:49:30', now)).toBe(true);
    expect(isRecentGuestPartnerCreateDate('2026-10-06T04:49:30.000Z', now)).toBe(true);
  });

  it('rejects an older guest contact so we do not attach to someone else by phone', () => {
    expect(isRecentGuestPartnerCreateDate('2026-10-06 04:30:00', now)).toBe(false);
    expect(isRecentGuestPartnerCreateDate('', now)).toBe(false);
    expect(isRecentGuestPartnerCreateDate(undefined, now)).toBe(false);
  });
});
