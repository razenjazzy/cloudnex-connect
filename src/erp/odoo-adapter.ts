import { createServiceCatalogItem, deleteServiceCatalogItem, findProductsByQuery, getProductById, getServiceByIdentifier, listProducts, listServiceCatalogItems, updateServiceCatalogItem } from '../services/odoo/catalog';
import { addSaleOrderLine, cancelSaleOrder, confirmSaleOrder, createInvoiceForSaleOrder, createQuotationFromLine, findOrderByReference, findPaymentTermByName, getSaleOrderById, getSaleOrderPdfLink, getSaleOrderPortalLink, removeSaleOrderLine, sendQuotationEmail, updateSaleOrderLineQty } from '../services/odoo/sales';
import { createPartnerFromLine, deletePartnerFromLine, getPartnerByName, getPartnerByPhone, updatePartnerFromLine } from '../services/odoo/partners';
import { getDailySalesSnapshot } from '../services/odoo/reporting';
import { getOutgoingPickingForOrder } from '../services/odoo/delivery';
import { postPartnerNote, listCrmQuotations, assignSaleOrderSalesperson } from '../services/odoo';
import type { OdooProduct, OdooSaleOrder } from '../services/odoo/types';
import type { ErpAdapter, ErpCrmQuote, ErpCrmQuoteListOpts, ErpCustomerUpdate, ErpPartner, ErpPermission, ErpProduct, ErpProviderName, ErpQuoteDraft, ErpQuotationOptions, ErpService, ErpServiceUpdate, ErpWriteAction } from './adapter';

const productImageUrl = (productId: number): string | undefined => {
  const base = (process.env.ODOO_URL || '').trim().replace(/\/$/, '');
  if (!base.startsWith('https://')) return undefined;
  return `${base}/web/image/product.product/${productId}/image_128`;
};

const toErpProduct = (product: OdooProduct): ErpProduct => {
  const imageUrl = product.image_url || productImageUrl(product.id);
  return {
    id: product.id,
    name: product.name,
    sku: product.default_code,
    price: product.list_price,
    quantity: product.qty_available,
    currency: 'THB',
    ...(imageUrl ? { imageUrl } : {}),
  };
};

const toErpCrmQuote = (order: OdooSaleOrder): ErpCrmQuote => ({
  id: order.id,
  name: order.name,
  state: order.state,
  amountTotal: order.amount_total,
  ...(order.partner_id?.[1] ? { partnerName: order.partner_id[1] } : {}),
  ...(order.user_id?.[0] ? { salespersonUserId: order.user_id[0] } : {}),
  ...(order.user_id?.[1] ? { salespersonName: order.user_id[1] } : {}),
  ...(order.client_order_ref ? { clientOrderRef: order.client_order_ref } : {}),
  ...(order.date_order ? { dateOrder: order.date_order } : {}),
  ...(order.note ? { note: order.note } : {}),
});

let productCatalogCache: { at: number; items: ErpProduct[] } | null = null;
const PRODUCT_CATALOG_CACHE_MS = Number(process.env.PRODUCT_CATALOG_CACHE_MS || 5 * 60 * 1000);
let catalogRefresh: Promise<void> | null = null;

const refreshProductCatalog = async (limit = 10): Promise<void> => {
  if (catalogRefresh) return catalogRefresh;
  catalogRefresh = (async () => {
    const products = await listProducts(limit);
    productCatalogCache = { at: Date.now(), items: products.map(toErpProduct) };
  })().finally(() => {
    catalogRefresh = null;
  });
  return catalogRefresh;
};

export const warmProductCatalog = (): void => {
  void refreshProductCatalog(10).catch(() => undefined);
};

export const peekCachedProducts = (limit = 10): ErpProduct[] | null => {
  if (!productCatalogCache?.items.length) return null;
  return productCatalogCache.items.slice(0, limit);
};

export const seedProductCatalogCacheForTests = (items: ErpProduct[], at = Date.now()): void => {
  productCatalogCache = { at, items };
};

const permissionForAction = (action: ErpWriteAction): ErpPermission => {
  switch (action) {
    case 'quote.create':
    case 'quote.update':
    case 'quote.cancel':
    case 'order.confirm':
    case 'invoice.create':
      return { role: 'staff', channel: 'line', requiresOtp: true };
    case 'customer.create':
    case 'customer.update':
      return { role: 'admin', channel: 'ops', requiresOtp: true };
    case 'service.create':
    case 'service.update':
      return { role: 'admin', channel: 'admin', requiresOtp: true };
    default:
      return { role: 'customer', channel: 'line' };
  }
};

const toErpService = (service: { id: number; name: string; default_code?: string; list_price: number; qty_available: number }): ErpService => ({
  id: service.id,
  name: service.name,
  sku: service.default_code,
  price: service.list_price,
  quantity: service.qty_available,
});

export const odooAdapter: ErpAdapter = {
  name: 'odoo' as ErpProviderName,
  capabilities: {
    supportsProductSearch: true,
    supportsCustomerLookup: true,
    supportsQuoteCreation: true,
    supportsOrderConfirmation: true,
    supportsInvoiceCreation: true,
    supportsDailyReport: true,
  },
  async searchProducts(query: string, limit = 10): Promise<ErpProduct[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      if (productCatalogCache?.items.length) {
        if (Date.now() - productCatalogCache.at >= PRODUCT_CATALOG_CACHE_MS) {
          void refreshProductCatalog(Math.max(limit, 10)).catch(() => undefined);
        }
        return productCatalogCache.items.slice(0, limit);
      }
      await refreshProductCatalog(Math.max(limit, 10));
      return (productCatalogCache?.items || []).slice(0, limit);
    }
    const products = await findProductsByQuery(normalized, limit);
    return products.map(toErpProduct);
  },
  peekCachedProducts,
  async listServices(limit = 10): Promise<ErpService[]> {
    const services = await listServiceCatalogItems(limit);
    return services.map(toErpService);
  },
  async lookupService(identifier: string): Promise<ErpService | null> {
    const service = await getServiceByIdentifier(identifier);
    return service ? toErpService(service) : null;
  },
  async createService(name: string, sku: string, price: number): Promise<ErpService | null> {
    const service = await createServiceCatalogItem(name, sku, price);
    return service ? toErpService(service) : null;
  },
  async updateService(identifier: string, update: ErpServiceUpdate): Promise<ErpService | null> {
    const service = await updateServiceCatalogItem(identifier, { name: update.name, price: update.price, code: update.sku });
    return service ? toErpService(service) : null;
  },
  async deleteService(identifier: string): Promise<boolean> {
    return deleteServiceCatalogItem(identifier);
  },
  async lookupCustomer(query: string): Promise<ErpPartner | null> {
    const normalized = query.trim();
    if (!normalized) return null;
    const partner = await getPartnerByPhone(normalized);
    return partner ? {
      id: partner.id,
      name: partner.name,
      phone: partner.phone,
      email: partner.email,
    } : null;
  },
  async createCustomer(name: string, phone: string, email?: string): Promise<ErpPartner | null> {
    const partner = await createPartnerFromLine(name, phone, email);
    return partner ? { id: partner.id, name: partner.name, phone: partner.phone, email: partner.email } : null;
  },
  async updateCustomer(id: number, update: ErpCustomerUpdate): Promise<ErpPartner | null> {
    const partner = await updatePartnerFromLine(id, update.name, update.phone, update.email);
    return partner ? { id: partner.id, name: partner.name, phone: partner.phone, email: partner.email } : null;
  },
  async deleteCustomer(id: number): Promise<boolean> {
    return deletePartnerFromLine(id);
  },
  async createQuotation(partnerName: string, phone: string, productName: string, qty: number, options?: ErpQuotationOptions): Promise<ErpQuoteDraft | null> {
    const { partnerId, ...extra } = options || {};
    const result = await createQuotationFromLine(partnerName, phone, productName, qty, partnerId, extra);
    if (!result) return null;
    return {
      id: result.orderId,
      name: result.orderName,
      total: result.total,
      currency: 'THB',
    };
  },
  async confirmOrder(orderId: number): Promise<boolean> {
    return confirmSaleOrder(orderId);
  },
  async createInvoice(orderId: number): Promise<boolean> {
    return createInvoiceForSaleOrder(orderId);
  },
  async addQuoteLine(orderId: number, productId: number, qty: number): Promise<boolean> {
    return addSaleOrderLine(orderId, productId, qty);
  },
  async editQuoteLine(orderId: number, productId: number, qty: number): Promise<boolean> {
    return updateSaleOrderLineQty(orderId, productId, qty);
  },
  async removeQuoteLine(orderId: number, productId: number): Promise<boolean> {
    return removeSaleOrderLine(orderId, productId);
  },
  async cancelQuote(orderId: number): Promise<boolean> {
    return cancelSaleOrder(orderId);
  },
  async sendQuotationEmail(orderId: number, email: string, subject: string, body: string): Promise<boolean> {
    return sendQuotationEmail(orderId, email, subject, body);
  },
  async getOrderStatus(orderRef: string): Promise<{ id: number; name: string; state: string; amountTotal?: number } | null> {
    const order = await findOrderByReference(orderRef);
    return order ? {
      id: order.id,
      name: order.name,
      state: order.state,
      amountTotal: order.amount_total,
    } : null;
  },
  async getDeliveryStatus(orderId: number) {
    try {
      const order = await getSaleOrderById(orderId);
      if (!order?.name) return null;
      return await getOutgoingPickingForOrder(order.name);
    } catch (error) {
      console.warn('getDeliveryStatus failed (non-fatal):', error);
      return null;
    }
  },
  async getDailySnapshot() {
    return getDailySalesSnapshot();
  },
  async getDailySummary(): Promise<string | null> {
    const rows = await this.getDailySnapshot();
    return rows.length
      ? rows.map(row => `${row.product}: ${row.salesYesterday} sold, ${row.stock} in stock, ${row.revenueYesterday} revenue`).join('\n')
      : null;
  },
  async lookupProduct(productId: number): Promise<ErpProduct | null> {
    const product = await getProductById(productId);
    return product ? toErpProduct(product) : null;
  },
  async lookupCustomerByName(name: string): Promise<ErpPartner | null> {
    const partner = await getPartnerByName(name.trim());
    return partner ? { id: partner.id, name: partner.name, phone: partner.phone, email: partner.email } : null;
  },
  async findPaymentTermId(query: string): Promise<number | null> {
    const term = await findPaymentTermByName(query);
    return term?.id ?? null;
  },
  async getOrderLinks(orderId: number): Promise<{ portal?: string; pdf?: string }> {
    const [portal, pdf] = await Promise.all([
      getSaleOrderPortalLink(orderId),
      getSaleOrderPdfLink(orderId),
    ]);
    return {
      ...(portal ? { portal } : {}),
      ...(pdf ? { pdf } : {}),
    };
  },
  postPartnerNote,
  async listQuotations(opts?: ErpCrmQuoteListOpts): Promise<ErpCrmQuote[]> {
    const rows = await listCrmQuotations(opts);
    return rows.map(toErpCrmQuote);
  },
  assignQuotationSalesperson: assignSaleOrderSalesperson,
  permissionFor: permissionForAction,
};

export const odooProviderName: ErpProviderName = 'odoo';
