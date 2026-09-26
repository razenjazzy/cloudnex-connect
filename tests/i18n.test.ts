import { describe, expect, it } from 'vitest';
import { EMPTY_COPY, pickLocale, t } from '../src/services/i18n';

describe('i18n locale fallback', () => {
  it('uses the requested locale when present', () => {
    expect(t('home', 'en')).toBe('Home');
    expect(t('home', 'th')).toBe('หน้าหลัก');
  });

  it('falls back to the other locale, then a non-empty sentinel', () => {
    expect(pickLocale('th', { en: 'Hello', th: '' })).toBe('Hello');
    expect(pickLocale('en', { en: '', th: 'สวัสดี' })).toBe('สวัสดี');
    expect(pickLocale('en', { en: '  ', th: '  ' })).toBe(EMPTY_COPY);
  });
});
