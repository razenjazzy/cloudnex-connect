import { afterEach, describe, expect, it, vi } from 'vitest';
import { isShopOrderPaid, parseShopPayQuery, shopPayPageUrl } from '../src/services/shop-pay';

describe('isShopOrderPaid', () => {
  it('uses Odoo sale.order state and invoiced amounts', () => {
    expect(isShopOrderPaid({ state: 'sale', amount_total: 100 })).toBe(true);
    expect(isShopOrderPaid({ state: 'done', amount_total: 100 })).toBe(true);
    expect(isShopOrderPaid({ state: 'draft', amount_total: 100 })).toBe(false);
    expect(isShopOrderPaid({
      state: 'draft',
      invoice_status: 'invoiced',
      amount_invoiced: 100,
      amount_total: 100,
    })).toBe(true);
  });
});

describe('shop pay token', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('signs GET /shop/pay and verifies the query', () => {
    vi.stubEnv('LINE_CHANNEL_CUSTOMER_SECRET', 'unit-test-shop-pay-secret');
    vi.stubEnv('PUBLIC_BASE_URL', 'https://pay.example.test');
    const url = shopPayPageUrl(9, 'Ushopuser');
    expect(url).toContain('https://pay.example.test/shop/pay');
    const parsed = new URL(url!);
    expect(parseShopPayQuery({
      orderId: parsed.searchParams.get('orderId'),
      uid: parsed.searchParams.get('uid'),
      exp: parsed.searchParams.get('exp'),
      sig: parsed.searchParams.get('sig'),
    })).toMatchObject({ orderId: 9, userId: 'Ushopuser' });
    expect(parseShopPayQuery({
      orderId: parsed.searchParams.get('orderId'),
      uid: parsed.searchParams.get('uid'),
      exp: parsed.searchParams.get('exp'),
      sig: 'tampered',
    })).toBeNull();
  });
});
