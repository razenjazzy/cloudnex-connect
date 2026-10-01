import { getErpAdapter } from '../erp/registry';
import type { ErpProduct } from '../erp/adapter';
import { getRuntime } from '../services/runtime-settings';
import { probeOdooSaleModules } from '../services/odoo/modules';

export type CustomerCommerceMode = 'quote' | 'shop';
export type CustomerCommerceDegradeReason = 'module' | 'website_id' | 'odoo';

export type CustomerCommerceSnapshot = {
  requested: CustomerCommerceMode;
  effective: CustomerCommerceMode;
  websiteSaleInstalled: boolean;
  saleInstalled: boolean;
  websiteIdSet: boolean;
  websiteId: number | null;
  degraded: boolean;
  degradeReason?: CustomerCommerceDegradeReason;
};

export const parseRequestedCustomerCommerce = (raw: string | undefined): CustomerCommerceMode => {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'shop' ? 'shop' : 'quote';
};

export const parseOdooWebsiteId = (raw: string | undefined): number | null => {
  const n = Number.parseInt(String(raw || '').trim(), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const resolveCustomerCommerceFrom = (input: {
  requested: CustomerCommerceMode;
  websiteSaleInstalled: boolean;
  saleInstalled?: boolean;
  websiteId: number | null;
  odooOk?: boolean;
}): CustomerCommerceSnapshot => {
  const saleInstalled = input.saleInstalled ?? false;
  const websiteIdSet = input.websiteId != null;
  const base = {
    requested: input.requested,
    websiteSaleInstalled: input.websiteSaleInstalled,
    saleInstalled,
    websiteIdSet,
    websiteId: input.websiteId,
  };
  if (input.requested !== 'shop') {
    return { ...base, requested: 'quote', effective: 'quote', degraded: false };
  }
  if (input.odooOk === false) {
    return { ...base, effective: 'quote', degraded: true, degradeReason: 'odoo' };
  }
  if (!input.websiteSaleInstalled) {
    return { ...base, effective: 'quote', degraded: true, degradeReason: 'module' };
  }
  if (!websiteIdSet) {
    return { ...base, effective: 'quote', degraded: true, degradeReason: 'website_id' };
  }
  return { ...base, effective: 'shop', degraded: false };
};

export const resolveCustomerCommerce = async (): Promise<CustomerCommerceSnapshot> => {
  const requested = parseRequestedCustomerCommerce(getRuntime('CUSTOMER_COMMERCE'));
  const websiteId = parseOdooWebsiteId(getRuntime('ODOO_WEBSITE_ID'));
  const probe = await probeOdooSaleModules();
  return resolveCustomerCommerceFrom({
    requested,
    websiteSaleInstalled: probe.websiteSaleInstalled,
    saleInstalled: probe.saleInstalled,
    websiteId,
    odooOk: probe.odooOk,
  });
};

export const isCustomerShopEffective = async (): Promise<boolean> =>
  (await resolveCustomerCommerce()).effective === 'shop';

export const attachShopJourney = async <T extends { role?: string }>(opts: T): Promise<T & { shopMode?: boolean }> => {
  if (opts.role !== 'customer') return opts;
  return { ...opts, shopMode: await isCustomerShopEffective() };
};

export const searchAudienceProducts = async (query: string, limit = 10): Promise<ErpProduct[]> => {
  const erp = getErpAdapter();
  if (await isCustomerShopEffective()) {
    const published = await erp.listShopProducts?.(query, limit) || [];
    if (published.length) return published;
  }
  return erp.searchProducts(query, limit);
};
