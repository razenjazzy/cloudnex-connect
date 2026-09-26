import { afterEach, describe, expect, it } from 'vitest';
import { evaluateCommandGrid, COMMAND_GRID } from '../src/line/command-grid';
import { mergeCommandGridEntry, sanitizeCommandOverlay, setCommandOverlayCacheForTests } from '../src/line/command-overlay';

const verifiedAdmin = {
  language: 'en' as const,
  role: 'admin' as const,
  odooVerified: true,
  marketingOptIn: false,
};

describe('command overlay', () => {
  afterEach(() => setCommandOverlayCacheForTests({}));

  it('rejects unknown command ids', () => {
    const result = sanitizeCommandOverlay({ 'not-a-command': { enabled: true } });
    expect(result.ok).toBe(false);
  });

  it('disables a known command in evaluateCommandGrid', () => {
    setCommandOverlayCacheForTests({ 'nav-home': { enabled: false } });
    expect(evaluateCommandGrid('NAV HOME', { profile: verifiedAdmin, channel: { channelId: 'sales' } })).toEqual({
      ok: false,
      reason: 'disabled',
    });
  });

  it('cannot enable a command when ENABLED_SERVICES omits its service', () => {
    const previous = process.env.ENABLED_SERVICES;
    process.env.ENABLED_SERVICES = 'directory';
    const result = sanitizeCommandOverlay({ 'product-find': { enabled: true } });
    if (previous === undefined) delete process.env.ENABLED_SERVICES;
    else process.env.ENABLED_SERVICES = previous;
    expect(result.ok).toBe(false);
  });

  it('overlay labels win over command-grid defaults', () => {
    const navHome = COMMAND_GRID.find(entry => entry.id === 'nav-home');
    expect(navHome).toBeTruthy();
    setCommandOverlayCacheForTests({ 'nav-home': { labelEn: 'HQ Home', labelTh: 'หน้าแรก HQ' } });
    const merged = mergeCommandGridEntry(navHome!);
    expect(merged.labelEn).toBe('HQ Home');
    expect(merged.labelTh).toBe('หน้าแรก HQ');
  });
});
