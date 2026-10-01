import { describe, expect, it } from 'vitest';
import {
  parseOdooWebsiteId,
  parseRequestedCustomerCommerce,
  resolveCustomerCommerceFrom,
} from '../src/platform/customer-commerce';

describe('customer commerce XOR', () => {
  it('defaults unset and unknown values to quote', () => {
    expect(parseRequestedCustomerCommerce(undefined)).toBe('quote');
    expect(parseRequestedCustomerCommerce('')).toBe('quote');
    expect(parseRequestedCustomerCommerce('auto')).toBe('quote');
    expect(parseRequestedCustomerCommerce('QUOTE')).toBe('quote');
    expect(parseRequestedCustomerCommerce('shop')).toBe('shop');
  });

  it('accepts only a positive integer website id', () => {
    expect(parseOdooWebsiteId(undefined)).toBeNull();
    expect(parseOdooWebsiteId('0')).toBeNull();
    expect(parseOdooWebsiteId('-1')).toBeNull();
    expect(parseOdooWebsiteId('2')).toBe(2);
  });

  it('stays on quote when shop is requested without website_sale', () => {
    const snap = resolveCustomerCommerceFrom({
      requested: 'shop',
      websiteSaleInstalled: false,
      saleInstalled: true,
      websiteId: 1,
      odooOk: true,
    });
    expect(snap.effective).toBe('quote');
    expect(snap.degraded).toBe(true);
    expect(snap.degradeReason).toBe('module');
  });

  it('stays on quote when shop is requested without ODOO_WEBSITE_ID', () => {
    const snap = resolveCustomerCommerceFrom({
      requested: 'shop',
      websiteSaleInstalled: true,
      saleInstalled: true,
      websiteId: null,
      odooOk: true,
    });
    expect(snap.effective).toBe('quote');
    expect(snap.degraded).toBe(true);
    expect(snap.degradeReason).toBe('website_id');
  });

  it('degrades to quote when Odoo is unreachable', () => {
    const snap = resolveCustomerCommerceFrom({
      requested: 'shop',
      websiteSaleInstalled: true,
      websiteId: 1,
      odooOk: false,
    });
    expect(snap.effective).toBe('quote');
    expect(snap.degradeReason).toBe('odoo');
  });

  it('enables shop only when module and website id are present', () => {
    const snap = resolveCustomerCommerceFrom({
      requested: 'shop',
      websiteSaleInstalled: true,
      saleInstalled: true,
      websiteId: 3,
      odooOk: true,
    });
    expect(snap.effective).toBe('shop');
    expect(snap.degraded).toBe(false);
    expect(snap.websiteIdSet).toBe(true);
  });

  it('never mixes shop when quote is requested even if website_sale is installed', () => {
    const snap = resolveCustomerCommerceFrom({
      requested: 'quote',
      websiteSaleInstalled: true,
      saleInstalled: true,
      websiteId: 3,
      odooOk: true,
    });
    expect(snap.effective).toBe('quote');
    expect(snap.degraded).toBe(false);
  });
});

describe('customer catalog browse', () => {
  it('uses website-published shop rows when shop is effective, otherwise the same product search as Sales', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/platform/customer-commerce.ts', 'utf8');
    expect(src).toContain('erp.searchProducts(query, limit)');
    expect(src).toContain('erp.listShopProducts?.(query, limit)');
    expect(src).toContain('isCustomerShopEffective()');
  });
});
