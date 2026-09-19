import { describe, expect, it } from 'vitest';
import { createServiceActionFlexMessage, createServiceHomeFlexMessage } from '../src/line/templates';
import { BRAND } from '../src/line/templates/shared';

describe('NAV HOME rounded boxes', () => {
  it('keeps the committed tap-row box at lg without bold', () => {
    const message = createServiceHomeFlexMessage([{ key: 'commerce', label: 'Products & Quotes' }], 'en', 'Sora');
    const bubble = message.contents as { body?: { contents?: Array<Record<string, unknown>> } };
    const row = bubble.body?.contents?.[0];
    expect(row?.type).toBe('box');
    expect(row?.cornerRadius).toBe(BRAND.radius);
    expect(row?.backgroundColor).toBe(BRAND.teal);
    expect(row?.style).toBeUndefined();
    const contents = row?.contents as Array<{ text?: string; size?: string; weight?: string }>;
    expect(contents[0]?.text).toBe('🛍️ Products & Quotes');
    expect(contents[0]?.size).toBe('lg');
    expect(contents[0]?.weight).toBeUndefined();
  });

  it('uses the same tap-row box on service action lists', () => {
    const message = createServiceActionFlexMessage('Commerce', [{ text: 'QUOTE LIST', label: 'Quotes' }], 'en');
    const bubble = message.contents as { body?: { contents?: Array<{ type?: string; cornerRadius?: string; contents?: Array<{ size?: string; weight?: string }> }> } };
    const row = bubble.body?.contents?.[0];
    expect(row?.type).toBe('box');
    expect(row?.cornerRadius).toBe(BRAND.radius);
    expect(row?.contents?.[0]?.size).toBe('lg');
    expect(row?.contents?.[0]?.weight).toBeUndefined();
  });

  it('uses tealTint for the service-action Home row, not gold', () => {
    const message = createServiceActionFlexMessage('Commerce', [{ text: 'QUOTE LIST', label: 'Quotes' }], 'en');
    const bubble = message.contents as { footer?: { contents?: Array<{ backgroundColor?: string; action?: { text?: string } }> } };
    expect(bubble.footer?.contents?.[0]?.backgroundColor).toBe(BRAND.tealTint);
    expect(bubble.footer?.contents?.[0]?.action?.text).toBe('NAV HOME');
  });

  it('keeps Flex NAV HOME Verify and Language on the same teal as other buttons', () => {
    const on = createServiceHomeFlexMessage(
      [{ key: 'VERIFY', label: 'Verify account' }, { key: 'commerce', label: 'Products & Quotes' }],
      'en',
      'Sora',
      true,
    );
    const off = createServiceHomeFlexMessage(
      [{ key: 'VERIFY', label: 'Verify account' }, { key: 'commerce', label: 'Products & Quotes' }],
      'en',
      'Sora',
      false,
    );
    const onBody = on.contents as { body?: { contents?: Array<Record<string, unknown>> }; footer?: { contents?: Array<Record<string, unknown>> } };
    const offBody = off.contents as { body?: { contents?: Array<Record<string, unknown>> } };
    expect(onBody.body?.contents?.[0]?.backgroundColor).toBe(BRAND.teal);
    expect(onBody.body?.contents?.[1]?.backgroundColor).toBe(BRAND.teal);
    expect(offBody.body?.contents?.[0]?.backgroundColor).toBe(BRAND.teal);
    expect(onBody.footer?.contents?.[0]?.backgroundColor).toBe(BRAND.tealTint);
    expect(onBody.footer?.contents?.[1]?.backgroundColor).toBe(BRAND.tealTint);
  });

  it('uses the same Language fill on the Thai home footer', () => {
    const message = createServiceHomeFlexMessage([{ key: 'commerce', label: 'สินค้าและใบเสนอราคา' }], 'th', 'โซระ');
    const bubble = message.contents as { footer?: { contents?: Array<Record<string, unknown>> } };
    expect(bubble.footer?.contents?.[0]?.backgroundColor).toBe(BRAND.tealTint);
  });

  it('puts Language and Guide in the same tap-row type as the service list', () => {
    const message = createServiceHomeFlexMessage([{ key: 'commerce', label: 'Products & Quotes' }], 'en', 'Sora');
    const bubble = message.contents as { footer?: { layout?: string; contents?: Array<Record<string, unknown>> } };
    expect(bubble.footer?.layout).toBe('horizontal');
    const tiles = bubble.footer?.contents || [];
    expect(tiles).toHaveLength(2);
    expect(tiles.every(tile => tile.type === 'box' && tile.cornerRadius === BRAND.radius && tile.style === undefined)).toBe(true);
    const first = tiles[0]?.contents as Array<{ text?: string; size?: string; weight?: string }>;
    expect(first[0]?.text).toBe('🌐 Language');
    expect(first[0]?.size).toBe('lg');
    expect(first[0]?.weight).toBeUndefined();
  });

  it('shows customer identity on paper, not the white card surface', () => {
    const message = createServiceHomeFlexMessage(
      [{ key: 'commerce', label: 'Products & Quotes' }],
      'en',
      'Sora',
      false,
      { name: 'Somchai', phone: '0812345678' },
    );
    const bubble = message.contents as { body?: { paddingAll?: string; contents?: Array<Record<string, unknown>> } };
    expect(bubble.body?.paddingAll).toBe('lg');
    expect(bubble.body?.contents?.[0]?.backgroundColor).toBe(BRAND.paper);
    expect(JSON.stringify(bubble.body?.contents?.[0])).toContain('Somchai');
    expect(bubble.body?.contents?.[1]?.backgroundColor).toBe(BRAND.teal);
  });
});

describe('customer home after VERIFY', () => {
  it('prints the bound Odoo name and phone on the home card', async () => {
    const { homeMenuFromContext } = await import('../src/line/command-router');
    const message = homeMenuFromContext({
      userLanguage: 'en',
      agentName: 'Sora',
      profile: {
        language: 'en',
        role: 'user',
        odooVerified: true,
        marketingOptIn: false,
        displayName: 'Somchai',
        phone: '0812345678',
      },
    });
    const json = JSON.stringify(message);
    expect(json).toContain('Somchai');
    expect(json).toContain('0812345678');
  });

  it('does not print LINE displayName before VERIFY (C0)', async () => {
    const { homeMenuFromContext } = await import('../src/line/command-router');
    const message = homeMenuFromContext({
      userLanguage: 'en',
      agentName: 'Sora',
      profile: {
        language: 'en',
        role: 'user',
        odooVerified: false,
        marketingOptIn: false,
        displayName: 'LINE Guest',
        phone: '0810000000',
      },
    });
    const json = JSON.stringify(message);
    expect(json).not.toContain('LINE Guest');
    expect(json).not.toContain('0810000000');
  });

  it('does not treat a sales-admin login as staff on Customer OA', async () => {
    const { homeMenuFromContext } = await import('../src/line/command-router');
    const message = homeMenuFromContext({
      userLanguage: 'en',
      agentName: 'Sora',
      channel: { channelId: 'customer', enabledServices: null },
      profile: {
        language: 'en',
        role: 'admin',
        odooVerified: true,
        marketingOptIn: false,
        salesTier: 'sales_manager',
        displayName: 'Somchai',
        phone: '0812345678',
      },
    });
    const json = JSON.stringify(message);
    expect(json).toContain('Somchai');
    expect(json).toContain('0812345678');
  });
});
