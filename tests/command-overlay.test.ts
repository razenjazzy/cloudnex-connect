import { afterEach, describe, expect, it } from 'vitest';
import { evaluateCommandGrid, COMMAND_GRID } from '../src/line/command-grid';
import { mergeCommandGridEntry, overlayLabelForText, sanitizeCommandOverlay, setCommandOverlayCacheForTests } from '../src/line/command-overlay';

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
    expect(overlayLabelForText('NAV HOME', 'en', 'Home')).toBe('HQ Home');
  });

  it('keeps caller fallback when no overlay label is set', () => {
    expect(overlayLabelForText('NAV COMMERCE', 'en', 'Products & Orders')).toBe('Products & Orders');
  });

  it('keeps catalog UI rows overlayable without matching typed commands', () => {
    expect(COMMAND_GRID.some(entry => entry.id === 'ui-catalog-stock' && entry.uiOnly)).toBe(true);
    expect(evaluateCommandGrid('PRODUCT FIND App', { profile: verifiedAdmin, channel: { channelId: 'customer' } })).toEqual({ ok: true });
    const stock = COMMAND_GRID.find(entry => entry.id === 'ui-catalog-stock')!;
    setCommandOverlayCacheForTests({ 'ui-catalog-stock': { enabled: true, channels: ['customer'] } });
    expect(mergeCommandGridEntry(stock).enabled).toBe(true);
    expect(mergeCommandGridEntry(stock).channels).toEqual(['customer']);
  });
});
