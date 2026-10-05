import { getRuntime } from '../services/runtime-settings';
import { isValidPhone } from './command-validators';

type ContactLanguage = 'en' | 'th';

/** English / BD sample when env is unset. Thai locale uses Ashfaq instead. */
export const FALLBACK_CUSTOMER_NAME = 'Razen';
export const FALLBACK_CUSTOMER_PHONE = '+8801787671962';
export const FALLBACK_CUSTOMER_EMAIL = 'baizid.a@cloudnexsolutions.com';
export const FALLBACK_CUSTOMER_NAME_TH = 'Ashfaq';
export const FALLBACK_CUSTOMER_PHONE_TH = '+66635153342';
export const FALLBACK_CUSTOMER_EMAIL_TH = 'ashfaq.kc@cloudnexsolutions.com';

const trimOr = (value: string | undefined, fallback: string): string => {
  const cleaned = (value ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 120);
  return cleaned || fallback;
};

const isSampleEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const localeFallback = <T extends string>(language: ContactLanguage, en: T, th: T): T =>
  language === 'th' ? th : en;

export const getDefaultCustomerName = (language: ContactLanguage = 'en'): string =>
  trimOr(
    getRuntime(language === 'th' ? 'LINE_DEFAULT_CUSTOMER_NAME_TH' : 'LINE_DEFAULT_CUSTOMER_NAME'),
    localeFallback(language, FALLBACK_CUSTOMER_NAME, FALLBACK_CUSTOMER_NAME_TH),
  );

export const getDefaultCustomerPhone = (language: ContactLanguage = 'en'): string => {
  const fallback = localeFallback(language, FALLBACK_CUSTOMER_PHONE, FALLBACK_CUSTOMER_PHONE_TH);
  const raw = trimOr(
    getRuntime(language === 'th' ? 'LINE_DEFAULT_CUSTOMER_PHONE_TH' : 'LINE_DEFAULT_CUSTOMER_PHONE'),
    fallback,
  );
  return isValidPhone(raw) ? raw : fallback;
};

export const getDefaultCustomerEmail = (language: ContactLanguage = 'en'): string => {
  const fallback = localeFallback(language, FALLBACK_CUSTOMER_EMAIL, FALLBACK_CUSTOMER_EMAIL_TH);
  const raw = trimOr(
    getRuntime(language === 'th' ? 'LINE_DEFAULT_CUSTOMER_EMAIL_TH' : 'LINE_DEFAULT_CUSTOMER_EMAIL'),
    fallback,
  );
  return isSampleEmail(raw) ? raw : fallback;
};

export const getDefaultGuestName = (language: ContactLanguage = 'en'): string =>
  trimOr(getRuntime('LINE_DEFAULT_GUEST_NAME'), getDefaultCustomerName(language));

export const fillSampleContact = (template: string, language: ContactLanguage = 'en'): string =>
  template
    .replaceAll('{name}', getDefaultCustomerName(language))
    .replaceAll('{phone}', getDefaultCustomerPhone(language))
    .replaceAll('{email}', getDefaultCustomerEmail(language));
