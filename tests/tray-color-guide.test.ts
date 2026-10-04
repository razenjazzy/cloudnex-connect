import { describe, expect, it } from 'vitest';
import { richMenuIdForLanguage, trayAfterReplyPlan, trayVariantForCommand } from '../src/line/rich-menu';

// One distinct id per (language, variant) so each assertion names the image that LINE will show.
const variants = ['default', 'default-verified', 'home', 'home-verified', 'verify', 'verify-verified', 'language', 'language-verified', 'commerce', 'commerce-verified', 'orders', 'orders-verified', 'help', 'help-verified'];
const map = (lang: string) => Object.fromEntries(variants.map(v => [v, `${lang}/${v}`]));
const env = { LINE_RICH_MENU_JSON: JSON.stringify({ en: map('en'), th: map('th') }) } as NodeJS.ProcessEnv;
const tray = (language: 'en' | 'th', variant: Parameters<typeof richMenuIdForLanguage>[2], verified: boolean) =>
  richMenuIdForLanguage(language, env, variant, verified);

describe('native menu colour guide (Sales and Customer OA)', () => {
  it('default: English tray (Language gold), not verified (Verify white)', () => {
    expect(tray('en', 'default', false)).toBe('en/default');
    expect(tray('th', 'default', false)).toBe('th/default'); // Thai: Language white too
  });

  it('a tap shows the dark pressed cell, then the tray rests on the state colour', () => {
    // Verify tap while signed out: dark Verify, Language keeps its colour; plan = press now, rest later.
    expect(trayVariantForCommand('FORM VERIFY')).toBe('verify');
    expect(trayAfterReplyPlan('verify')).toEqual({ press: 'verify', restDelayed: true });
    expect(tray('en', 'verify', false)).toBe('en/verify');
    // Verify success: rest = default-verified (Verify gold).
    expect(tray('en', 'default', true)).toBe('en/default-verified');
    expect(tray('th', 'default', true)).toBe('th/default-verified');
  });

  it('language: tap shows dark Language, then Thai rests white and English rests gold', () => {
    expect(trayVariantForCommand('LANG TH')).toBe('language');
    expect(tray('en', 'language', false)).toBe('en/language'); // pressed while still English
    expect(tray('th', 'default', false)).toBe('th/default');   // rest after switching to Thai
    expect(tray('th', 'language', false)).toBe('th/language'); // pressed while Thai
    expect(tray('en', 'default', false)).toBe('en/default');   // rest after switching back
  });

  it('verified staff keep gold Verify through a language change; signing out returns to the default', () => {
    expect(tray('th', 'default', true)).toBe('th/default-verified');
    expect(trayVariantForCommand('VERIFY SIGNOUT')).toBe('verify');
    expect(tray('en', 'verify', true)).toBe('en/verify-verified'); // pressed while verified
    expect(tray('en', 'default', false)).toBe('en/default');       // rest after Sign out
  });

  it('Home is already the rest tray (no press-then-rest flicker)', () => {
    expect(trayAfterReplyPlan('home')).toEqual({ press: 'default', restDelayed: false });
  });
});
