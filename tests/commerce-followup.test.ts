import { describe, expect, it } from 'vitest';
import { seedProductCatalogCacheForTests } from '../src/erp/odoo-adapter';
import { commerceFollowUpMessages, noteTrayGeneration, pushDeferredCommerceCatalog } from '../src/line/commerce-followup';
import { getErpAdapter } from '../src/erp/registry';
import type { UserProfile } from '../src/services/firestore';

const guest: UserProfile = {
  language: 'en',
  role: 'user',
  odooVerified: false,
  marketingOptIn: false,
};

describe('commerce tray catalog', () => {
  it('uses a warm cache on NAV commerce and does not hit searchProducts', async () => {
    seedProductCatalogCacheForTests([{ id: 1, name: 'App', price: 10, quantity: 3, currency: 'THB' }]);
    const search = getErpAdapter().searchProducts;
    let called = 0;
    getErpAdapter().searchProducts = async (...args) => {
      called += 1;
      return search.call(getErpAdapter(), ...args);
    };
    const ctx = { userLanguage: 'en' as const, profile: guest, pendingCatalogPush: false };
    const messages = await commerceFollowUpMessages(ctx, 2, { deferCatalogMiss: true });
    expect(called).toBe(0);
    expect(ctx.pendingCatalogPush).toBe(false);
    expect(messages.length).toBeGreaterThan(0);
    getErpAdapter().searchProducts = search;
  });

  it('defers Odoo on a cold cache instead of blocking the tray reply', async () => {
    seedProductCatalogCacheForTests([], Date.now() - 120_000);
    const ctx = { userLanguage: 'en' as const, profile: guest, pendingCatalogPush: false };
    const search = getErpAdapter().searchProducts;
    let called = 0;
    getErpAdapter().searchProducts = async () => {
      called += 1;
      return [];
    };
    const messages = await commerceFollowUpMessages(ctx, 2, { deferCatalogMiss: true });
    expect(called).toBe(0);
    expect(ctx.pendingCatalogPush).toBe(true);
    expect(messages.length).toBe(1);
    getErpAdapter().searchProducts = search;
  });

  it('skips a stale deferred catalog push after a newer tray tap', async () => {
    noteTrayGeneration('U-nav', 'gen-2');
    const search = getErpAdapter().searchProducts;
    let called = 0;
    getErpAdapter().searchProducts = async () => {
      called += 1;
      return [];
    };
    await pushDeferredCommerceCatalog({ userId: 'U-nav', generation: 'gen-1', userLanguage: 'en' });
    expect(called).toBe(0);
    getErpAdapter().searchProducts = search;
  });
});
