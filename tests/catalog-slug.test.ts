import { describe, expect, it } from 'vitest';
import { catalogContextSlug } from '../src/line/catalog-slug';

describe('catalogContextSlug', () => {
  it('uses the last website_url path segment', () => {
    expect(catalogContextSlug({
      name: 'App Premium Plan',
      sku: 'APP-PREMIUM',
      websiteUrl: '/shop/app-premium',
    })).toBe('app-premium');
  });

  it('slugifies Internal Reference when there is no website path', () => {
    expect(catalogContextSlug({ name: 'App Premium Plan', sku: 'APP-PREMIUM' })).toBe('app-premium');
  });

  it('slugifies the product name when SKU is missing', () => {
    expect(catalogContextSlug({ name: 'App Premium Plan' })).toBe('app-premium-plan');
    expect(catalogContextSlug({ name: 'นอร์มอล (Normal)' })).toBe('นอร์มอล-normal');
  });
});
