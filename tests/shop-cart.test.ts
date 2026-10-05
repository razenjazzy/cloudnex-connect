import { describe, expect, it } from 'vitest';
import { parseCartAdd, parseCartCoupon, parseCartRemove } from '../src/line/handlers/shop-cart';
import { createShopCartFlexMessage } from '../src/line/templates/shop-cart';
import { getVisibleCommands, SERVICE_CATALOG } from '../src/services/service-catalog';

describe('shop cart parsers', () => {
  it('parses CART ADD id and qty', () => {
    expect(parseCartAdd('CART ADD 12 3')).toEqual({ productId: 12, qty: 3 });
    expect(parseCartAdd('CART ADD id:9')).toEqual({ productId: 9, qty: 1 });
    expect(parseCartAdd('CART ADD')).toBeNull();
  });

  it('parses coupon codes and remove ids', () => {
    expect(parseCartCoupon('CART COUPON SAVE10')).toBe('SAVE10');
    expect(parseCartCoupon('CART COUPON')).toBeNull();
    expect(parseCartRemove('CART REMOVE 44')).toBe(44);
  });
});

describe('shop cart Flex', () => {
  const order = {
    id: 9,
    name: 'S0009',
    state: 'draft',
    amount_total: 1090,
    partner_id: [1, 'Razen'] as [number, string],
    note: '<p>Terms &amp; Conditions</p><p>See <a href="https://example.com/terms">the policy</a>.</p>',
    lines: [
      { productId: 2, productName: 'DualForth', qty: 10, priceUnit: 99, subtotal: 990 },
      { productId: 80, productName: 'Delivery_007 Standard Delivery', qty: 1, priceUnit: 100, subtotal: 100, isDelivery: true },
      { productId: 91, productName: 'Optional wrap', qty: 1, priceUnit: 0, subtotal: 0, optional: true },
    ],
  };

  it('shows qty × product with price, delivery as a rate, and strip T&C html', () => {
    const cart = JSON.stringify(createShopCartFlexMessage(order, { stage: 'cart' }, 'en'));
    expect(cart).toContain('10 × DualForth');
    expect(cart).not.toContain('× 10');
    expect(cart).toContain('Standard Delivery');
    expect(cart).not.toContain('× 1');
    expect(cart).not.toContain('Delivery_007');
    expect(cart).not.toContain('Optional wrap');
    expect(cart).not.toContain('<p>');
    expect(cart).not.toContain('&amp;');
    expect(cart).not.toContain('href=');
    expect(cart).toContain('Terms & Conditions');
    expect(cart).toContain('the policy');
    expect(cart).toContain('CART REMOVE 2');
    expect(cart).not.toContain('CART REMOVE 80');
    expect(cart).toContain('My Cart');
  });

  it('pairs cart actions two-up like other Flex pages', () => {
    const cart = JSON.stringify(createShopCartFlexMessage(order, {
      stage: 'cart',
      cartPageUrl: 'https://shop.example/shop/cart',
      shopUrl: 'https://shop.example/shop',
    }, 'en'));
    expect(cart).toContain('"layout":"horizontal"');
    expect(cart).toContain('CART CHECKOUT');
    expect(cart).toContain('CART COUPON');
    expect(cart).toContain('https://shop.example/shop/cart');
    expect(cart).toContain('Website cart');
    expect(cart).not.toContain('QUOTE APPROVE');

    const checkout = JSON.stringify(createShopCartFlexMessage(order, {
      stage: 'checkout',
      payUrl: 'https://shop.example/my/orders/9',
      cartPageUrl: 'https://shop.example/shop/cart',
    }, 'en'));
    expect(checkout).toContain('CART PAY');
    expect(checkout).toContain('CART COUPON');
    expect(checkout).toContain('CART');
    expect(checkout).toContain('/shop/cart');
    expect(checkout).toContain('Order process');

    const pay = JSON.stringify(createShopCartFlexMessage(order, {
      stage: 'pay',
      payUrl: 'https://example.test/shop/pay?orderId=9',
    }, 'en'));
    expect(pay).toContain('Open pay page');
    expect(pay).toContain('CART STATUS');
    expect(pay).not.toContain('CART COUPON ');

    const done = JSON.stringify(createShopCartFlexMessage({ ...order, state: 'sale' }, { stage: 'completed' }, 'en'));
    expect(done).toContain('Order completed');
    expect(done).not.toContain('CART PAY');
    expect(done).not.toContain('CART COUPON');
  });
});

describe('shop menu XOR', () => {
  it('swaps Ask for Quotations for Cart in shop mode only', () => {
    const commerce = SERVICE_CATALOG.find(s => s.key === 'commerce')!;
    expect(getVisibleCommands(commerce, false, false).map(c => c.text)).toContain('QUOTE ASK');
    expect(getVisibleCommands(commerce, false, false, { shopMode: true }).map(c => c.text)).toContain('CART');
    expect(getVisibleCommands(commerce, false, false, { shopMode: true }).find(c => c.text === 'CART')?.labelEn).toBe('My Cart');
    expect(getVisibleCommands(commerce, false, false, { shopMode: true }).map(c => c.text)).not.toContain('CART VIEW');
    expect(getVisibleCommands(commerce, false, false, { shopMode: true }).map(c => c.text)).not.toContain('QUOTE ASK');
  });
});
