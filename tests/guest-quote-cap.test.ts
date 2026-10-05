import { describe, expect, it } from 'vitest';
import { GUEST_QUOTE_DAILY_CAP, GUEST_QUOTE_GLOBAL_HOURLY_CAP, appendGuestStampIsos, guestPhoneKey, guestQuoteWouldExceedCap, recentGuestQuoteStamps } from '../src/services/guest-quote-cap';
import { isGuestAllowedCommand } from '../src/line/guest-commands';
import { unverifiedPendingFlowKept } from '../src/line/command-grid';
import { isValidPhone } from '../src/line/command-validators';
import { FALLBACK_CUSTOMER_PHONE } from '../src/line/default-contact';

describe('guest quote cap', () => {
  it('keys 0812, 66812, and +66812 to the same hashed last-9 id', () => {
    // Thai-format equivalence needs a Thai number; the owner's own contact is not Thai.
    const thai = '0812345678';
    const hashed = guestPhoneKey(thai);
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    expect(guestPhoneKey('+66 81-234-5678')).toBe(hashed);
    expect(guestPhoneKey('66812345678')).toBe(hashed);
    expect(guestPhoneKey('812345678')).toBe(hashed);
    expect(guestPhoneKey(thai)).not.toBe(thai);
  });

  it('keys Razen 01… and +880 to the same cap id', () => {
    const hashed = guestPhoneKey('+8801787671962');
    expect(guestPhoneKey('01787671962')).toBe(hashed);
    expect(hashed).not.toBe(guestPhoneKey('0812345678'));
  });

  it('refuses a fourth guest draft in 24h for the same LINE user or phone', () => {
    const now = Date.parse('2026-10-06T03:00:00.000Z');
    const three = [now - 1000, now - 2000, now - 3000];
    expect(guestQuoteWouldExceedCap(three, [], now)).toBe(true);
    expect(guestQuoteWouldExceedCap([], three, now)).toBe(true);
    expect(guestQuoteWouldExceedCap(three.slice(0, 2), [], now)).toBe(false);
    expect(GUEST_QUOTE_DAILY_CAP).toBe(3);
    expect(recentGuestQuoteStamps([now - 25 * 60 * 60 * 1000], now)).toEqual([]);
    const hourly = Array.from({ length: GUEST_QUOTE_GLOBAL_HOURLY_CAP }, (_, i) => now - i * 1000);
    expect(guestQuoteWouldExceedCap([], [], now, hourly)).toBe(true);
    expect(guestQuoteWouldExceedCap([], [], now, hourly.slice(1))).toBe(false);
  });

  it('round-trips guest stamp lists through ISO without dropping a slot', () => {
    const now = Date.parse('2026-10-06T03:00:00.000Z');
    const earlier = now - 1000;
    const isos = appendGuestStampIsos([earlier], now);
    expect(isos).toEqual([new Date(earlier).toISOString(), new Date(now).toISOString()]);
    expect(recentGuestQuoteStamps(isos, now)).toEqual([earlier, now]);
  });

  it('does not produce a cap document id for an empty phone', () => {
    expect(guestPhoneKey('')).toBe('');
    expect(guestPhoneKey('abc')).toBe('');
  });

  it('validates guest phones with the shared checker', () => {
    expect(isValidPhone(FALLBACK_CUSTOMER_PHONE)).toBe(true);
    expect(isValidPhone('+66635153342')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });
});

describe('guest quote allowlist', () => {
  it('allows Customer OA guest QUOTE CREATE and keeps Sales OA blocked', () => {
    expect(isGuestAllowedCommand('QUOTE CREATE App,1', undefined, 'customer')).toBe(true);
    expect(isGuestAllowedCommand('FORM QUOTE CREATE', undefined, 'customer')).toBe(true);
    expect(isGuestAllowedCommand('QUOTE CREATE App,1', { flow: 'QUOTE_CREATE' }, 'customer')).toBe(true);
    expect(isGuestAllowedCommand('QUOTE CREATE App,1', { flow: 'QUOTE_CREATE' })).toBe(false);
    expect(isGuestAllowedCommand('QUOTE CREATE App,1', { flow: 'QUOTE_CREATE' }, 'sales')).toBe(false);
    expect(isGuestAllowedCommand('QUOTE CREATE App,1', undefined, 'sales')).toBe(false);
    expect(isGuestAllowedCommand('QUOTE LIST', undefined, 'customer')).toBe(false);
    expect(isGuestAllowedCommand('ORDER STATUS SO0001', undefined, 'customer')).toBe(false);
  });

  it('keeps an unverified QUOTE_CREATE flow on the Customer OA only; other guest flows are channel-neutral', () => {
    expect(unverifiedPendingFlowKept('QUOTE_CREATE', 'customer')).toBe(true);
    expect(unverifiedPendingFlowKept('QUOTE_CREATE', 'sales')).toBe(false);
    expect(unverifiedPendingFlowKept('QUOTE_CREATE', 'default')).toBe(false);
    expect(unverifiedPendingFlowKept('QUOTE_CREATE')).toBe(false);
    for (const flow of ['VERIFY', 'PRODUCT_FIND', 'CUSTOMER_REGISTER', 'MESSAGE_REQUEST']) {
      expect(unverifiedPendingFlowKept(flow, 'sales')).toBe(true);
    }
    expect(unverifiedPendingFlowKept('QUOTE_ADD', 'customer')).toBe(false);
    expect(isGuestAllowedCommand('FORM FIELD 2', { flow: 'QUOTE_CREATE' }, 'sales')).toBe(false);
  });
});
