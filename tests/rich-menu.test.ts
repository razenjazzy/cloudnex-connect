import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { richMenuIdForLanguage, trayVariantForCommand } from '../src/line/rich-menu';

describe('native LINE rich menu layout', () => {
  const layout = JSON.parse(readFileSync('assets/rich-menu/layout.json', 'utf8')) as {
    size: { width: number; height: number };
    chatBarTextEn: string;
    chatBarTextTh: string;
    areas: { id?: string; action: { text: string }; labelEn: string; labelTh: string; fill?: string }[];
  };

  it('uses a compact 2x3 grid matching the native tray screenshot', () => {
    expect(layout.size).toEqual({ width: 2500, height: 843 });
    expect(layout.areas.map(area => area.action.text)).toEqual([
      'NAV HOME',
      'FORM VERIFY',
      'NAV commerce',
      'FORM ORDER STATUS',
      'GUIDE',
      'LANG',
    ]);
    expect(layout.areas.map(area => area.labelEn)).toEqual([
      'Home',
      'Verify',
      'Products & Quotes',
      'Order Status',
      'Help',
      'Language',
    ]);
    expect(layout.areas.every(area => !area.fill)).toBe(true);
    expect(layout.areas.map(area => area.id)).toEqual(['home', 'verify', 'commerce', 'orders', 'help', 'language']);
  });

  it('uses sentence-case i18n labels', () => {
    expect(layout.chatBarTextEn).toBe('Menu');
    expect(layout.chatBarTextTh).toBe('เมนู');
    expect(layout.areas.map(area => area.labelTh)).toEqual([
      'หน้าหลัก',
      'ยืนยันตัวตน',
      'สินค้าและใบเสนอราคา',
      'สถานะออเดอร์',
      'ช่วยเหลือ',
      'ภาษา',
    ]);
  });
});

describe('rich menu SVG type', () => {
  it('uses compact type and screenshot labels', () => {
    const svg = readFileSync('assets/rich-menu/menu-en.svg', 'utf8');
    expect(svg).toContain('font-size: 48px');
    expect(svg).toContain('>Home<');
    expect(svg).toContain('>Verify<');
    expect(svg).toContain('>Products &amp; Quotes<');
    expect(svg).toContain('stroke-width="10"');
    expect(svg).toContain('#A97A2B');
    expect(svg).toContain('#E3F0EE');
    const th = readFileSync('assets/rich-menu/menu-th.svg', 'utf8');
    expect(th).toContain('>หน้าหลัก<');
    expect(th).toContain('#E3F0EE');
  });
});

describe('richMenuIdForLanguage', () => {
  it('reads EN and TH ids from env and ignores blanks', () => {
    expect(richMenuIdForLanguage('en', { LINE_RICH_MENU_EN: 'richmenu-en' })).toBe('richmenu-en');
    expect(richMenuIdForLanguage('th', { LINE_RICH_MENU_TH: 'richmenu-th' })).toBe('richmenu-th');
    expect(richMenuIdForLanguage('en', {})).toBeUndefined();
  });

  it('prefers LINE_RICH_MENU_JSON variants for the active tray cell', () => {
    const env = {
      LINE_RICH_MENU_EN: 'richmenu-en-default',
      LINE_RICH_MENU_JSON: JSON.stringify({
        en: { default: 'richmenu-en-default', verify: 'richmenu-en-verify' },
        th: { default: 'richmenu-th-default', language: 'richmenu-th-language' },
      }),
    };
    expect(richMenuIdForLanguage('en', env, 'verify')).toBe('richmenu-en-verify');
    expect(richMenuIdForLanguage('en', env, 'home')).toBe('richmenu-en-default');
    expect(richMenuIdForLanguage('th', env, 'language')).toBe('richmenu-th-language');
    const withSession = {
      ...env,
      LINE_RICH_MENU_JSON: JSON.stringify({
        en: { default: 'richmenu-en-default', 'default-verified': 'richmenu-en-verified', verify: 'richmenu-en-verify', 'verify-verified': 'richmenu-en-verify-on', home: 'richmenu-en-home' },
        th: { default: 'richmenu-th-default' },
      }),
    };
    expect(richMenuIdForLanguage('en', withSession, 'default', true)).toBe('richmenu-en-verified');
    expect(richMenuIdForLanguage('en', withSession, 'home', true)).toBe('richmenu-en-home');
    expect(richMenuIdForLanguage('en', withSession, 'verify', true)).toBe('richmenu-en-verify-on');
    expect(richMenuIdForLanguage('en', {
      LINE_RICH_MENU_JSON: JSON.stringify({
        en: { default: 'en-rest', 'default-verified': 'en-gold-verify', language: 'en-lang-press', 'language-verified': 'en-lang-press-on' },
      }),
    }, 'language', true)).toBe('en-lang-press-on');
    expect(richMenuIdForLanguage('en', {
      LINE_RICH_MENU_JSON: JSON.stringify({ en: { default: 'sales-rest' } }),
      LINE_CHANNEL_CUSTOMER_RICH_MENU_JSON: JSON.stringify({ en: { default: 'customer-rest' } }),
    }, 'default', false, 'customer')).toBe('customer-rest');
  });
});

describe('trayVariantForCommand', () => {
  it('maps tray taps to the active cell', () => {
    expect(trayVariantForCommand('NAV HOME')).toBe('home');
    expect(trayVariantForCommand('FORM VERIFY')).toBe('verify');
    expect(trayVariantForCommand('VERIFY SIGNOUT')).toBe('verify');
    expect(trayVariantForCommand('NAV commerce')).toBe('commerce');
    expect(trayVariantForCommand('FORM ORDER STATUS')).toBe('orders');
    expect(trayVariantForCommand('GUIDE')).toBe('help');
    expect(trayVariantForCommand('LANG')).toBe('language');
    expect(trayVariantForCommand('QUOTE CREATE x')).toBeUndefined();
  });
});

describe('native tray Language / Verify fills', () => {
  const GOLD = '#A97A2B';
  const TEAL_TINT = '#E3F0EE';
  const tileFills = (svg: string) => [...svg.matchAll(/<rect x="\d+" y="\d+"[^>]*fill="(#[A-F0-9]+)"/g)].map(m => m[1]);
  /** Same rules as scripts/generate-rich-menu.mjs tileFill. */
  const tileFill = (id: string, activeId: string | null, lang: 'en' | 'th', sessionOn: boolean) => {
    if (id === activeId) return 'teal';
    if (id === 'verify') return sessionOn ? 'gold' : 'tealTint';
    if (id === 'language') return lang === 'en' ? 'gold' : 'tealTint';
    return 'tealTint';
  };

  it('golds Language on English rest and uses regular teal for Verify', () => {
    const fills = tileFills(readFileSync('assets/rich-menu/menu-en.svg', 'utf8'));
    expect(fills).toHaveLength(6);
    expect(fills[1]).toBe(TEAL_TINT);
    expect(fills[5]).toBe(GOLD);
  });

  it('uses regular teal for Language on Thai rest', () => {
    const fills = tileFills(readFileSync('assets/rich-menu/menu-th.svg', 'utf8'));
    expect(fills[5]).toBe(TEAL_TINT);
    expect(fills[1]).toBe(TEAL_TINT);
  });

  it('keeps Language and Verify independent: tap darkens only that tile', () => {
    // Language: gold (EN) → dark teal tap → light teal (TH) → dark teal tap → gold (EN)
    expect(tileFill('language', null, 'en', false)).toBe('gold');
    expect(tileFill('verify', null, 'en', false)).toBe('tealTint');
    expect(tileFill('language', 'language', 'en', false)).toBe('teal');
    expect(tileFill('verify', 'language', 'en', false)).toBe('tealTint');
    expect(tileFill('language', null, 'th', false)).toBe('tealTint');
    expect(tileFill('verify', null, 'th', false)).toBe('tealTint');
    expect(tileFill('language', 'language', 'th', false)).toBe('teal');
    expect(tileFill('verify', 'language', 'th', false)).toBe('tealTint');
    expect(tileFill('language', null, 'en', false)).toBe('gold');

    // Verify: regular teal → dark teal tap → gold → dark teal tap → light teal
    expect(tileFill('verify', null, 'en', false)).toBe('tealTint');
    expect(tileFill('language', null, 'en', false)).toBe('gold');
    expect(tileFill('verify', 'verify', 'en', false)).toBe('teal');
    expect(tileFill('language', 'verify', 'en', false)).toBe('gold');
    expect(tileFill('verify', null, 'en', true)).toBe('gold');
    expect(tileFill('language', null, 'en', true)).toBe('gold');
    expect(tileFill('verify', 'verify', 'en', true)).toBe('teal');
    expect(tileFill('language', 'verify', 'en', true)).toBe('gold');
    expect(tileFill('verify', null, 'en', false)).toBe('tealTint');
    expect(tileFill('language', null, 'en', false)).toBe('gold');
    expect(richMenuIdForLanguage('en', {
      LINE_RICH_MENU_JSON: JSON.stringify({
        en: { default: 'en-rest', 'default-verified': 'en-gold-verify', verify: 'en-press', language: 'en-lang-press' },
        th: { default: 'th-rest', language: 'th-lang-press' },
      }),
    }, 'default', false)).toBe('en-rest');
    expect(richMenuIdForLanguage('th', {
      LINE_RICH_MENU_JSON: JSON.stringify({
        th: { default: 'th-rest' },
      }),
    }, 'default', false)).toBe('th-rest');
    expect(richMenuIdForLanguage('en', {
      LINE_RICH_MENU_JSON: JSON.stringify({
        en: { default: 'en-rest', 'default-verified': 'en-gold-verify' },
      }),
    }, 'default', true)).toBe('en-gold-verify');
  });

  it('does not use gold/teal fills from Flex NAV HOME', () => {
    expect(readFileSync('tests/templates-nav.test.ts', 'utf8')).toContain('NAV HOME rounded boxes');
  });
});
