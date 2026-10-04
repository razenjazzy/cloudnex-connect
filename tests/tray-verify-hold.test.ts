import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let verified = false;
vi.mock('../src/services/firestore', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/services/firestore')>()),
  getUserProfile: async () => ({ odooVerified: verified, language: 'en', role: 'user', marketingOptIn: false }),
}));

import { applyTrayAfterReply, pressTrayAtTap, VERIFY_HOLD_MS } from '../src/line/rich-menu';

const variants = ['default', 'default-verified', 'verify', 'verify-verified'];
const map = (lang: string) => Object.fromEntries(variants.map(v => [v, `${lang}/${v}`]));

describe('Verify press is held while verification is in progress', () => {
  const calls: string[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    calls.length = 0;
    verified = false;
    process.env.LINE_CHANNEL_SECRET = 's'.repeat(32);
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 't'.repeat(40);
    process.env.LINE_RICH_MENU_JSON = JSON.stringify({ en: map('en'), th: map('th') });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(decodeURIComponent(String(url).split('/richmenu/')[1] || ''));
      return new Response('{}', { status: 200 });
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('without a hold the press is replaced by the rest colour after a moment (old behaviour)', async () => {
    applyTrayAfterReply('U1', 'en', 'default', 'verify', { language: 'en', salesSessionActive: false });
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toEqual(['en/verify', 'en/default']);
  });

  it('with a hold the Verify cell stays dark teal; it resets only if the challenge expires unverified', async () => {
    applyTrayAfterReply('U1', 'en', 'default', 'verify', { language: 'en', salesSessionActive: false }, true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toEqual(['en/verify']); // still dark teal a minute later
    await vi.advanceTimersByTimeAsync(VERIFY_HOLD_MS);
    expect(calls).toEqual(['en/verify', 'en/default']); // expired: default colours back
  });

  it('a verification that succeeded in the meantime is left gold', async () => {
    applyTrayAfterReply('U1', 'en', 'default', 'verify', { language: 'en', salesSessionActive: false }, true);
    verified = true; // link success flips the profile (and pushes the gold tray itself)
    await vi.advanceTimersByTimeAsync(VERIFY_HOLD_MS + 1000);
    expect(calls).toEqual(['en/verify']);
  });
});

describe('dark teal at tap time', () => {
  const calls: string[] = [];
  beforeEach(() => {
    calls.length = 0;
    process.env.LINE_CHANNEL_SECRET = 's'.repeat(32);
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 't'.repeat(40);
    process.env.LINE_RICH_MENU_JSON = JSON.stringify({ en: map('en'), th: map('th') });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(decodeURIComponent(String(url).split('/richmenu/')[1] || ''));
      return new Response('{}', { status: 200 });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('presses the tapped cell immediately (button or typed command) and tells the caller what it pressed', async () => {
    expect(pressTrayAtTap('U1', 'en', 'default', 'FORM VERIFY', false)).toBe('verify');
    expect(pressTrayAtTap('U1', 'th', 'default', 'VERIFY SIGNOUT', true)).toBe('verify');
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(calls).toEqual(['en/verify', 'th/verify-verified']);
  });

  it('does nothing for Home (already the rest tray) or for text that is not a tray command', () => {
    expect(pressTrayAtTap('U1', 'en', 'default', 'NAV HOME', false)).toBeUndefined();
    expect(pressTrayAtTap('U1', 'en', 'default', 'hello there', false)).toBeUndefined();
    expect(calls).toEqual([]);
  });

  it('does not press a second time when the tap was already pressed', async () => {
    applyTrayAfterReply('U1', 'en', 'default', 'verify', { language: 'en', salesSessionActive: false }, true, true);
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(calls).toEqual([]);
  });
});
