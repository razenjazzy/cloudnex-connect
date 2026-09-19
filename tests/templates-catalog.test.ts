import { describe, expect, it } from 'vitest';
import { createProductCarouselFlexMessage } from '../src/line/templates';
import { checkMessageAgainstLineLimits } from '../src/line/message-limits';

describe('product catalogue carousel', () => {
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
    expect(json).toContain('PRODUCT FIND App Premium');
    expect(json).not.toContain('"text":"NAV HOME"');
    expect(checkMessageAgainstLineLimits(message)).toEqual([]);
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
});
