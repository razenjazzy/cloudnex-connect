import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stills = readFileSync('scripts/export-journey-stills.ts', 'utf8');
const book = readFileSync('documents/USER_JOURNEY.md', 'utf8');

describe('journey studio stills match live UX', () => {
  it('uses Razen/Ashfaq samples, not Demo Partner', () => {
    expect(stills).not.toMatch(/Demo Partner/);
    expect(stills).toContain('getDefaultCustomerName');
    expect(stills).toContain('CUSTOMER_CHANNEL_ID');
    expect(stills).toContain('customerNoPhoneYet');
    expect(stills).toContain('salesVerifyMissActions');
    expect(stills).toContain("shopMode: false");
    expect(stills).toContain('function chips(msg)');
  });

  it('covers Ask admin still in the book', () => {
    expect(book).toContain('a3-ask-admin.png');
    expect(book).toContain('Ask admin');
    expect(book).not.toMatch(/Ten older on-device/);
  });

  it('exports the former on-device screens from builders', () => {
    for (const file of [
      'a3-verify.png',
      'a4-products-quotes.png',
      'b1-quote-product-chips.png',
      'b4-quote-phone.png',
      'b5-quote-optional.png',
      'b6-quote-draft.png',
      'b8-quote-sent-admin.png',
      'c1-customer-approve.png',
      'c2-sales-order-admin.png',
      'c4-invoice-staff.png',
    ]) {
      expect(stills).toContain(file);
    }
  });
});
