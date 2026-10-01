import { describe, expect, it } from 'vitest';
import { createOrderSummaryFlexMessage, createProductCardFlexMessage, createProductCarouselFlexMessage, stripFlexHeroImages } from '../src/line/templates';
import { amountHighlightBox, BRAND, formatMoney, mutedNoteBox } from '../src/line/templates/shared';
import { t } from '../src/services/i18n';
import { checkMessageAgainstLineLimits } from '../src/line/message-limits';

type FlexNode = { type?: string; layout?: string; backgroundColor?: string; cornerRadius?: string; paddingAll?: string; contents?: FlexNode[]; text?: string; size?: string; color?: string; weight?: string; wrap?: boolean };

const amountHeroBox = (label: string, amount: string) => {
  const expected = amountHighlightBox(label, amount);
  return {
    type: expected.type,
    layout: expected.layout,
    backgroundColor: expected.backgroundColor,
    cornerRadius: expected.cornerRadius,
    paddingAll: expected.paddingAll,
    label: { size: 'xs', color: BRAND.inkSoft },
    amount: { size: 'xl', color: BRAND.tealStrong, weight: 'bold', wrap: true },
  };
};

const findAmountHeroBoxes = (node: unknown, acc: FlexNode[] = []): FlexNode[] => {
  if (!node || typeof node !== 'object') return acc;
  const box = node as FlexNode;
  if (box.type === 'box' && box.layout === 'vertical' && box.backgroundColor === BRAND.tealTint && Array.isArray(box.contents) && box.contents.some(child => child.size === 'xl')) {
    acc.push(box);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => findAmountHeroBoxes(child, acc));
    else findAmountHeroBoxes(value, acc);
  }
  return acc;
};

const expectAmountHero = (box: FlexNode | undefined, label: string, amount: string) => {
  const pattern = amountHeroBox(label, amount);
  expect(box).toMatchObject({
    type: pattern.type,
    layout: pattern.layout,
    backgroundColor: pattern.backgroundColor,
    cornerRadius: pattern.cornerRadius,
    paddingAll: pattern.paddingAll,
  });
  expect(box?.contents?.[0]).toMatchObject({ type: 'text', text: label, ...pattern.label });
  expect(box?.contents?.[1]).toMatchObject({ type: 'text', text: amount, ...pattern.amount });
};

describe('product catalogue carousel', () => {
  it('shows a shop slug under the name, not the Catalog label', () => {
    const withSku = JSON.stringify(createProductCarouselFlexMessage(
      [{ id: 11, name: 'App Premium Plan', sku: 'APP-PREMIUM', price: 990, quantity: 4 }],
      'en',
    ));
    expect(withSku).toContain('app-premium');
    expect(withSku).not.toContain('"text":"Catalog"');
    const fromName = JSON.stringify(createProductCarouselFlexMessage(
      [{ id: 12, name: 'App Premium Plan', price: 990, quantity: 4 }],
      'en',
    ));
    expect(fromName).toContain('app-premium-plan');
    expect(fromName).not.toContain('"text":"Catalog"');
  });

  it('uses kilo bubbles with quote-by-id and view, not a home button on every slide', () => {
    const message = createProductCarouselFlexMessage([
      { id: 11, name: 'App Premium', sku: 'APP-PREMIUM', price: 990, quantity: 4 },
      { id: 12, name: 'App Support', sku: 'APP-SUPPORT', price: 490, quantity: 8 },
    ], 'en');
    expect(message.contents).toMatchObject({ type: 'carousel' });
    const json = JSON.stringify(message);
    expect(json).toContain('"size":"kilo"');
    expect(json).toContain('FORM QUOTE CREATE FROM CARD 11');
    expect(json).toContain('FORM QUOTE CREATE FROM CARD 12');
    expect(json).toContain('FORM MESSAGE REQUEST 11');
    expect(json).toContain('PRODUCT FIND id:11');
    expect(json).not.toContain('"text":"NAV HOME"');
    expect(checkMessageAgainstLineLimits(message)).toEqual([]);
  });

  it('hides stock on Cloudnex Customer and uses Order Now / View Details', () => {
    const message = createProductCarouselFlexMessage([
      { id: 11, name: 'App Premium', sku: 'APP-PREMIUM', price: 990, quantity: 4 },
    ], 'en', undefined, 'customer');
    const json = JSON.stringify(message);
    expect(json).toContain('Order Now');
    expect(json).toContain('View Details');
    expect(json).not.toContain('"text":"Stock"');
    const priceBox = findAmountHeroBoxes(message)[0];
    expectAmountHero(priceBox, 'Price', formatMoney(990, 'en'));
    const totalBox = findAmountHeroBoxes(createOrderSummaryFlexMessage(990, 'en'))[0];
    expectAmountHero(totalBox, 'Total', formatMoney(990, 'en'));
    expect({ ...priceBox, contents: priceBox.contents?.map((row, i) => i === 0 ? { ...row, text: 'Total' } : row) }).toEqual(totalBox);
  });

  it('uses the same Total highlight box for Customer product details, not the Sales stock pair', () => {
    const detail = createProductCardFlexMessage('App Premium', 990, 4, 'en', 11, undefined, { channelId: 'customer' });
    const sales = createProductCardFlexMessage('App Premium', 990, 4, 'en', 11, undefined, { channelId: 'sales' });
    const customerPrice = findAmountHeroBoxes(detail);
    const salesHero = findAmountHeroBoxes(sales);
    expect(customerPrice).toHaveLength(1);
    expect(salesHero).toHaveLength(0);
    expectAmountHero(customerPrice[0], 'Price', formatMoney(990, 'en'));
    expect(JSON.stringify(sales)).toContain('"text":"Stock"');
    expect(JSON.stringify(sales)).toContain('"size":"sm"');
    expect(JSON.stringify(sales)).not.toMatch(/"backgroundColor":"#E3F0EE"[^]*"size":"xl"/);
  });

  it('uses the quote-waiting paper note for Customer product short description', () => {
    const description = 'Short catalog copy for the shopper.';
    const waiting = mutedNoteBox(t('quoteWaitingForSales', 'en'));
    const detail = createProductCardFlexMessage('App Premium', 990, 4, 'en', 11, undefined, {
      channelId: 'customer',
      description,
    });
    const carousel = createProductCarouselFlexMessage(
      [{ id: 11, name: 'App Premium', sku: 'APP-PREMIUM', price: 990, quantity: 4, description }],
      'en',
      undefined,
      'customer',
    );
    const note = mutedNoteBox(description);
    expect(waiting).toMatchObject({
      type: 'box',
      layout: 'vertical',
      backgroundColor: BRAND.paper,
      cornerRadius: BRAND.radius,
      paddingAll: 'sm',
    });
    expect(waiting.contents[0]).toMatchObject({ type: 'text', size: 'xs', color: BRAND.inkSoft, wrap: true });
    expect(JSON.stringify(detail)).toContain(JSON.stringify(note));
    expect(JSON.stringify(carousel)).toContain(JSON.stringify(note));
    expect(JSON.stringify(createProductCarouselFlexMessage(
      [{ id: 11, name: 'App Premium', sku: 'APP-PREMIUM', price: 990, quantity: 4, description }],
      'en',
      undefined,
      'sales',
    ))).not.toContain(JSON.stringify(note));
  });

  it('puts https product images on the hero and can strip them for LINE retry', () => {
    const message = createProductCarouselFlexMessage([
      { id: 11, name: 'App Premium', price: 990, quantity: 4, imageUrl: 'https://amardhaka.io/cloudnex-connect/catalog/product/11/image' },
      { id: 12, name: 'App Support', price: 490, quantity: 8, imageUrl: 'http://odoo.local/web/image/product.product/12/image_128' },
    ], 'en');
    const json = JSON.stringify(message);
    expect(json).toContain('/catalog/product/11/image');
    expect(json).not.toContain('odoo.local');
    const stripped = stripFlexHeroImages([message]);
    expect(JSON.stringify(stripped)).not.toContain('"type":"image"');
    expect(JSON.stringify(stripped)).toContain('FORM QUOTE CREATE FROM CARD 11');
  });

  it('puts the same public catalog hero on Sales and Customer carousels', () => {
    const previousBase = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    const products = [{ id: 11, name: 'App Premium', price: 990, quantity: 4 }];
    const sales = JSON.stringify(createProductCarouselFlexMessage(products, 'en', undefined, 'sales'));
    const customer = JSON.stringify(createProductCarouselFlexMessage(products, 'en', undefined, 'customer'));
    expect(sales).toContain('https://amardhaka.io/cloudnex-connect/catalog/product/11/image');
    expect(customer).toContain('https://amardhaka.io/cloudnex-connect/catalog/product/11/image');
    if (previousBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousBase;
  });

  it('can browse services with SERVICE READ as the view action', () => {
    const message = createProductCarouselFlexMessage(
      [{ id: 21, name: 'Premium Support', sku: 'SVC-PREMIUM', price: 990, quantity: 1 }],
      'en',
      item => `SERVICE READ ${item.sku || item.name}`,
    );
    const json = JSON.stringify(message);
    expect(json).toContain('SERVICE READ SVC-PREMIUM');
    expect(json).toContain('FORM QUOTE CREATE FROM CARD 21');
  });

  it('caps the carousel at 10 slides', () => {
    const products = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}`, price: 1, quantity: 1 }));
    const message = createProductCarouselFlexMessage(products, 'en');
    const contents = message.contents as { contents?: unknown[] };
    expect(contents.contents).toHaveLength(10);
  });

  it('shows Order Now until the SKU is in the cart; carousel Remove only for in-cart items', () => {
    const card = JSON.stringify(createProductCardFlexMessage('DualForth', 990, 4, 'en', 2, undefined, {
      channelId: 'customer',
      shopMode: true,
    }));
    expect(card).toContain('Order Now');
    expect(card).toContain('FORM QUOTE CREATE FROM CARD 2');
    expect(card).not.toContain('CART REMOVE');
    const inCart = JSON.stringify(createProductCardFlexMessage('DualForth', 990, 4, 'en', 2, undefined, {
      channelId: 'customer',
      shopMode: true,
      inCart: true,
    }));
    expect(inCart).toContain('CART REMOVE 2');
    expect(inCart).toContain('Remove');
    expect(inCart).not.toContain('Order Now');
    const carousel = JSON.stringify(createProductCarouselFlexMessage(
      [{ id: 2, name: 'DualForth', price: 990, quantity: 4 }],
      'en',
      undefined,
      'customer',
      true,
    ));
    expect(carousel).toContain('Add to Cart');
    expect(carousel).toContain('FORM CART ADD FROM CARD 2');
    expect(carousel).toContain('View Details');
    expect(carousel).not.toContain('CART REMOVE');
    const withCart = JSON.stringify(createProductCarouselFlexMessage(
      [{ id: 2, name: 'DualForth', price: 990, quantity: 4 }],
      'en',
      undefined,
      'customer',
      true,
      new Set([2]),
    ));
    expect(withCart).toContain('CART REMOVE 2');
    expect(withCart).toContain('"layout":"horizontal"');
  });
});
