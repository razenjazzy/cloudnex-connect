import { describe, expect, it } from 'vitest';
import { applyPortalI18nOverlay, t } from '../admin/src/i18n';

describe('applyPortalI18nOverlay', () => {
  it('stores only string en/th pairs for known keys', () => {
    applyPortalI18nOverlay({
      navHome: { en: 'HQ Home', th: 'บ้าน' },
      navSettings: { en: 1, th: 'ตั้งค่า' },
      missing: { en: 'nope' },
      signIn: 'not a pair',
    });
    expect(t('en', 'navHome')).toBe('HQ Home');
    expect(t('th', 'navHome')).toBe('บ้าน');
    expect(t('en', 'navSettings')).toBe('Settings');
    expect(t('en', 'signIn')).toBe('Sign in');
    applyPortalI18nOverlay({});
  });

  it('ignores unknown payload shapes', () => {
    applyPortalI18nOverlay({ navHome: { en: 'Overlay' } });
    applyPortalI18nOverlay(null);
    expect(t('en', 'navHome')).toBe('Home');
    applyPortalI18nOverlay({ navHome: { en: 'Overlay' } });
    applyPortalI18nOverlay([]);
    expect(t('en', 'navHome')).toBe('Home');
    applyPortalI18nOverlay({});
  });
});
