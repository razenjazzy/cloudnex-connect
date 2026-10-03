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
    expect(overlayLabelForText('QUOTE LIST', 'en', 'My Orders')).toBe('My Orders');
    expect(overlayLabelForText('QUOTE LIST', 'en', 'My Orders', 'customer')).toBe('Order History');
    expect(overlayLabelForText('QUOTE LIST', 'th', 'ออเดอร์', 'customer')).toBe('ประวัติคำสั่งซื้อ');
  });

  it('uses the customer glossary row for QUOTE LIST, not a sales overlay', () => {
    setCommandOverlayCacheForTests({
      'quote-list-customer': { labelEn: 'Past orders' },
      'nav-commerce': { labelEn: 'Shop floor' },
    });
    expect(overlayLabelForText('QUOTE LIST', 'en', 'My Orders', 'customer')).toBe('Past orders');
    expect(overlayLabelForText('QUOTE LIST', 'en', 'My Orders', 'sales')).toBe('My Orders');
    expect(overlayLabelForText('NAV COMMERCE', 'en', 'Products & Orders', 'customer')).toBe('Shop floor');
  });

  it('keeps catalog UI rows overlayable without matching typed commands', () => {
    expect(COMMAND_GRID.some(entry => entry.id === 'ui-catalog-stock' && entry.uiOnly)).toBe(true);
    expect(evaluateCommandGrid('PRODUCT FIND App', { profile: verifiedAdmin, channel: { channelId: 'customer' } })).toEqual({ ok: true });
    const stock = COMMAND_GRID.find(entry => entry.id === 'ui-catalog-stock')!;
    setCommandOverlayCacheForTests({ 'ui-catalog-stock': { enabled: true, channels: ['customer'] } });
    expect(mergeCommandGridEntry(stock).enabled).toBe(true);
    expect(mergeCommandGridEntry(stock).channels).toEqual(['customer']);
  });

  it('rejects EN/TH labels over the 20-character LINE button limit instead of truncating', () => {
    const tooLong = sanitizeCommandOverlay({ 'product-find': { labelEn: 'x'.repeat(21) } });
    expect(tooLong.ok).toBe(false);
    const ok = sanitizeCommandOverlay({ 'product-find': { labelEn: 'x'.repeat(20) } });
    expect(ok.ok).toBe(true);
  });
});
