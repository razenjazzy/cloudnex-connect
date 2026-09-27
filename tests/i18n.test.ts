import { describe, expect, it } from 'vitest';
import { EMPTY_COPY, pickLocale, t } from '../src/services/i18n';
import { i18nOverlayCacheIsWarmForTests, setI18nOverlayCacheForTests } from '../src/services/i18n-overlay';

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

  it('uses the same key for EN and TH overlay copy', () => {
    setI18nOverlayCacheForTests({ api: { home: { en: 'Home overlay', th: 'หน้าหลัก overlay' } } });
    expect(t('home', 'en')).toBe('Home overlay');
    expect(t('home', 'th')).toBe('หน้าหลัก overlay');
    setI18nOverlayCacheForTests({});
    expect(t('home', 'en')).toBe('Home');
    expect(i18nOverlayCacheIsWarmForTests()).toBe(false);
  });

  it('treats empty overlay maps as a cold cache', () => {
    setI18nOverlayCacheForTests({ api: {}, portal: {} });
    expect(i18nOverlayCacheIsWarmForTests()).toBe(false);
    setI18nOverlayCacheForTests({ api: undefined, portal: undefined });
    expect(i18nOverlayCacheIsWarmForTests()).toBe(false);
    setI18nOverlayCacheForTests({ api: { home: { en: 'Home overlay', th: 'หน้าหลัก overlay' } } });
    expect(i18nOverlayCacheIsWarmForTests()).toBe(true);
    setI18nOverlayCacheForTests({});
  });
});
