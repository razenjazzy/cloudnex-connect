import { createHash } from 'crypto';
import { phoneMatchVariants } from './phone-match';

export const GUEST_QUOTE_DAILY_CAP = 3;
export const GUEST_QUOTE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const GUEST_QUOTE_GLOBAL_HOURLY_CAP = 40;
export const GUEST_QUOTE_HOUR_MS = 60 * 60 * 1000;
export const GUEST_QUOTE_GLOBAL_DOC = '__global';

const lastNineDigits = (phone: string): string => {
  const variants = phoneMatchVariants(phone);
  const last9 = variants.find(value => /^\d{9}$/.test(value));
  if (last9) return last9;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
};

/** Canonical last-9 national digits (Thai 0/66/+66 collapse to the same key). */
export const guestPhoneCanonical = (phone: string): string => lastNineDigits(phone);

/** Hashed Firestore document id — never store the raw phone as the doc id. */
export const guestPhoneKey = (phone: string): string => {
  const canonical = lastNineDigits(phone);
  if (!canonical) return '';
  return createHash('sha256').update(`guest-quote-phone:${canonical}`).digest('hex');
};

export const recentGuestQuoteStamps = (stamps: Array<string | number>, now = Date.now()): number[] => {
  const cutoff = now - GUEST_QUOTE_WINDOW_MS;
  return stamps
    .map(value => typeof value === 'number' ? value : Date.parse(value))
    .filter(value => Number.isFinite(value) && value > cutoff);
};

export const recentGuestHourStamps = (stamps: Array<string | number>, now = Date.now()): number[] => {
  const cutoff = now - GUEST_QUOTE_HOUR_MS;
  return stamps
    .map(value => typeof value === 'number' ? value : Date.parse(value))
    .filter(value => Number.isFinite(value) && value > cutoff);
};

export const appendGuestStampIsos = (
  stamps: Array<string | number>,
  now: number,
  kind: 'day' | 'hour' = 'day',
): string[] => {
  const recent = kind === 'hour' ? recentGuestHourStamps(stamps, now) : recentGuestQuoteStamps(stamps, now);
  return [...recent.map(ms => new Date(ms).toISOString()), new Date(now).toISOString()];
};

export const guestQuoteWouldExceedCap = (
  userStamps: Array<string | number>,
  phoneStamps: Array<string | number>,
  now = Date.now(),
  globalHourStamps: Array<string | number> = [],
): boolean => {
  const userRecent = recentGuestQuoteStamps(userStamps, now);
  const phoneRecent = recentGuestQuoteStamps(phoneStamps, now);
  const globalRecent = recentGuestHourStamps(globalHourStamps, now);
  return userRecent.length >= GUEST_QUOTE_DAILY_CAP
    || phoneRecent.length >= GUEST_QUOTE_DAILY_CAP
    || globalRecent.length >= GUEST_QUOTE_GLOBAL_HOURLY_CAP;
};
