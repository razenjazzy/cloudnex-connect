import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FALLBACK_CUSTOMER_EMAIL,
  FALLBACK_CUSTOMER_EMAIL_TH,
  FALLBACK_CUSTOMER_NAME,
  FALLBACK_CUSTOMER_NAME_TH,
  FALLBACK_CUSTOMER_PHONE,
  FALLBACK_CUSTOMER_PHONE_TH,
  fillSampleContact,
  getDefaultCustomerEmail,
  getDefaultCustomerName,
  getDefaultCustomerPhone,
  getDefaultGuestName,
} from '../src/line/default-contact';
import { getCommandsForCategory } from '../src/line/command-guide';

const KEYS = [
  'LINE_DEFAULT_CUSTOMER_NAME',
  'LINE_DEFAULT_CUSTOMER_PHONE',
  'LINE_DEFAULT_CUSTOMER_EMAIL',
  'LINE_DEFAULT_CUSTOMER_NAME_TH',
  'LINE_DEFAULT_CUSTOMER_PHONE_TH',
  'LINE_DEFAULT_CUSTOMER_EMAIL_TH',
  'LINE_DEFAULT_GUEST_NAME',
];

describe('configurable default contact', () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('defaults to Razen / +880 for EN and Ashfaq / +66 for TH', () => {
    expect(getDefaultCustomerName()).toBe(FALLBACK_CUSTOMER_NAME);
    expect(getDefaultCustomerPhone()).toBe(FALLBACK_CUSTOMER_PHONE);
    expect(getDefaultCustomerEmail()).toBe(FALLBACK_CUSTOMER_EMAIL);
    expect(getDefaultGuestName()).toBe(FALLBACK_CUSTOMER_NAME);
    expect(getDefaultCustomerName('th')).toBe(FALLBACK_CUSTOMER_NAME_TH);
    expect(getDefaultCustomerPhone('th')).toBe(FALLBACK_CUSTOMER_PHONE_TH);
    expect(getDefaultCustomerEmail('th')).toBe(FALLBACK_CUSTOMER_EMAIL_TH);
    expect(getDefaultGuestName('th')).toBe(FALLBACK_CUSTOMER_NAME_TH);
    expect(FALLBACK_CUSTOMER_PHONE).toBe('+8801787671962');
    expect(FALLBACK_CUSTOMER_PHONE_TH).toBe('+66635153342');
  });

  it('reads LINE_DEFAULT_* from env per locale', () => {
    process.env.LINE_DEFAULT_CUSTOMER_NAME = 'Razen';
    process.env.LINE_DEFAULT_CUSTOMER_PHONE = '+8801787671962';
    process.env.LINE_DEFAULT_CUSTOMER_EMAIL = 'baizid.a@cloudnexsolutions.com';
    process.env.LINE_DEFAULT_CUSTOMER_NAME_TH = 'Ashfaq';
    process.env.LINE_DEFAULT_CUSTOMER_PHONE_TH = '+66635153342';
    process.env.LINE_DEFAULT_CUSTOMER_EMAIL_TH = 'ashfaq.kc@cloudnexsolutions.com';
    expect(getDefaultCustomerName('en')).toBe('Razen');
    expect(getDefaultCustomerPhone('th')).toBe('+66635153342');
    expect(getDefaultCustomerEmail('th')).toBe('ashfaq.kc@cloudnexsolutions.com');
    expect(fillSampleContact('USER CREATE {name},{phone},{email}', 'th')).toBe(
      'USER CREATE Ashfaq,+66635153342,ashfaq.kc@cloudnexsolutions.com',
    );
  });

  it('ignores an invalid configured phone and keeps the fallback', () => {
    process.env.LINE_DEFAULT_CUSTOMER_PHONE = '123';
    expect(getDefaultCustomerPhone()).toBe(FALLBACK_CUSTOMER_PHONE);
  });

  it('fills GUIDE examples from the locale contact', () => {
    const quoteEn = getCommandsForCategory('commerce', 'en').find(row => row.key === 'QUOTE CREATE');
    expect(quoteEn?.example).toBe(`QUOTE CREATE App Premium Plan,1,${FALLBACK_CUSTOMER_NAME},${FALLBACK_CUSTOMER_PHONE}`);
    const quoteTh = getCommandsForCategory('commerce', 'th').find(row => row.key === 'QUOTE CREATE');
    expect(quoteTh?.example).toBe(`QUOTE CREATE App Premium Plan,1,${FALLBACK_CUSTOMER_NAME_TH},${FALLBACK_CUSTOMER_PHONE_TH}`);
    const create = getCommandsForCategory('directory', 'en').find(row => row.key === 'USER CREATE');
    expect(create?.example).toBe(`USER CREATE ${FALLBACK_CUSTOMER_NAME},${FALLBACK_CUSTOMER_PHONE},${FALLBACK_CUSTOMER_EMAIL}`);
  });
});
