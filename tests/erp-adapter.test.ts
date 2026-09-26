import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceCatalogItem, deleteServiceCatalogItem, findProductsByQuery, getProductById, getServiceByIdentifier, listProducts, listServiceCatalogItems, updateServiceCatalogItem } from '../src/services/odoo/catalog';
import { addSaleOrderLine, cancelSaleOrder, confirmSaleOrder, createInvoiceForSaleOrder, createQuotationFromLine, findOrderByReference, findPaymentTermByName, getSaleOrderById, getSaleOrderPdfLink, getSaleOrderPortalLink, updateSaleOrderLineQty } from '../src/services/odoo/sales';
import { createPartnerFromLine, deletePartnerFromLine, getPartnerByName, getPartnerByPhone, updatePartnerFromLine } from '../src/services/odoo/partners';
import { getOutgoingPickingForOrder } from '../src/services/odoo/delivery';
import { getDailySalesSnapshot } from '../src/services/odoo/reporting';
import { odooAdapter, seedProductCatalogCacheForTests } from '../src/erp/odoo-adapter';
import { getErpAdapter, isErpImplemented } from '../src/erp/registry';

vi.mock('../src/services/odoo/catalog', () => ({
  createServiceCatalogItem: vi.fn(),
  deleteServiceCatalogItem: vi.fn(),
  findProductsByQuery: vi.fn(),
  getProductById: vi.fn(),
  getServiceByIdentifier: vi.fn(),
  listProducts: vi.fn(),
  listServiceCatalogItems: vi.fn(),
  updateServiceCatalogItem: vi.fn(),
}));
vi.mock('../src/services/odoo/sales', () => ({
  confirmSaleOrder: vi.fn(),
  createInvoiceForSaleOrder: vi.fn(),
  addSaleOrderLine: vi.fn(),
  updateSaleOrderLineQty: vi.fn(),
  cancelSaleOrder: vi.fn(),
  createQuotationFromLine: vi.fn(),
  findOrderByReference: vi.fn(),
  findPaymentTermByName: vi.fn(),
  getSaleOrderById: vi.fn(),
  getSaleOrderPdfLink: vi.fn(),
  getSaleOrderPortalLink: vi.fn(),
  sendQuotationEmail: vi.fn(),
}));
vi.mock('../src/services/odoo/partners', () => ({
  createPartnerFromLine: vi.fn(),
  deletePartnerFromLine: vi.fn(),
  getPartnerByName: vi.fn(),
  getPartnerByPhone: vi.fn(),
  updatePartnerFromLine: vi.fn(),
}));
vi.mock('../src/services/odoo/delivery', () => ({
  getOutgoingPickingForOrder: vi.fn(),
}));
vi.mock('../src/services/odoo/reporting', () => ({
  getDailySalesSnapshot: vi.fn(),
}));

const mockedFindProducts = vi.mocked(findProductsByQuery);
const mockedListProducts = vi.mocked(listProducts);
const mockedListServices = vi.mocked(listServiceCatalogItems);
const mockedGetService = vi.mocked(getServiceByIdentifier);
const mockedCreateService = vi.mocked(createServiceCatalogItem);
const mockedUpdateService = vi.mocked(updateServiceCatalogItem);
const mockedDeleteService = vi.mocked(deleteServiceCatalogItem);
const mockedCreateQuotation = vi.mocked(createQuotationFromLine);
const mockedConfirmOrder = vi.mocked(confirmSaleOrder);
const mockedCreateInvoice = vi.mocked(createInvoiceForSaleOrder);
const mockedAddQuoteLine = vi.mocked(addSaleOrderLine);
const mockedEditQuoteLine = vi.mocked(updateSaleOrderLineQty);
const mockedCancelQuote = vi.mocked(cancelSaleOrder);
const mockedFindOrder = vi.mocked(findOrderByReference);
const mockedGetSaleOrderById = vi.mocked(getSaleOrderById);
const mockedGetPicking = vi.mocked(getOutgoingPickingForOrder);
const mockedGetPartner = vi.mocked(getPartnerByPhone);
const mockedCreateCustomer = vi.mocked(createPartnerFromLine);
const mockedUpdateCustomer = vi.mocked(updatePartnerFromLine);
const mockedDeleteCustomer = vi.mocked(deletePartnerFromLine);
const mockedGetDailySummary = vi.mocked(getDailySalesSnapshot);

describe('Odoo ERP adapter', () => {
  const originalProvider = process.env.ERP_PROVIDER;
  const originalPublicBase = process.env.PUBLIC_BASE_URL;
  const originalAdminBase = process.env.PUBLIC_ADMIN_BASE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ERP_PROVIDER;
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.PUBLIC_ADMIN_BASE;
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.ERP_PROVIDER;
    else process.env.ERP_PROVIDER = originalProvider;
    if (originalPublicBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = originalPublicBase;
    if (originalAdminBase === undefined) delete process.env.PUBLIC_ADMIN_BASE;
    else process.env.PUBLIC_ADMIN_BASE = originalAdminBase;
  });

  it('normalizes product search results and filters by name or SKU', async () => {
    mockedFindProducts.mockResolvedValue([{ id: 1, name: 'Widget Pro', default_code: 'WP-1', list_price: 125, qty_available: 8 }]);

    await expect(odooAdapter.searchProducts(' widget ', 5)).resolves.toEqual([
      { id: 1, name: 'Widget Pro', sku: 'WP-1', price: 125, quantity: 8, currency: 'THB' },
    ]);
    expect(mockedFindProducts).toHaveBeenCalledWith('widget', 5);
    mockedListProducts.mockResolvedValue([]);
    await expect(odooAdapter.searchProducts('   ')).resolves.toEqual([]);
    expect(mockedListProducts).toHaveBeenCalled();
  });

  it('uses the public Admin HTTPS image URL instead of Odoo web/image', async () => {
    const previousBase = process.env.PUBLIC_BASE_URL;
    const previousAdmin = process.env.PUBLIC_ADMIN_BASE;
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    process.env.PUBLIC_ADMIN_BASE = '/admin';
    mockedFindProducts.mockResolvedValue([{ id: 1, name: 'Widget Pro', default_code: 'WP-1', list_price: 125, qty_available: 8 }]);
    await expect(odooAdapter.searchProducts('widget', 5)).resolves.toEqual([
      {
        id: 1,
        name: 'Widget Pro',
        sku: 'WP-1',
        price: 125,
        quantity: 8,
        currency: 'THB',
        imageUrl: 'https://amardhaka.io/cloudnex-connect/admin/catalog/product/1/image',
      },
    ]);
    if (previousBase === undefined) delete process.env.PUBLIC_BASE_URL;
    else process.env.PUBLIC_BASE_URL = previousBase;
    if (previousAdmin === undefined) delete process.env.PUBLIC_ADMIN_BASE;
    else process.env.PUBLIC_ADMIN_BASE = previousAdmin;
  });

  it('peeks the warm catalog cache without a second Odoo list', async () => {
    seedProductCatalogCacheForTests([], Date.now() - 120_000);
    mockedListProducts.mockResolvedValue([{ id: 1, name: 'Widget Pro', default_code: 'WP-1', list_price: 125, qty_available: 8 }]);
    await odooAdapter.searchProducts('', 10);
    mockedListProducts.mockClear();
    expect(odooAdapter.peekCachedProducts?.(10)).toEqual([
      { id: 1, name: 'Widget Pro', sku: 'WP-1', price: 125, quantity: 8, currency: 'THB' },
    ]);
    expect(mockedListProducts).not.toHaveBeenCalled();
  });

  it('returns every match when a search term is ambiguous, instead of only the first', async () => {
    mockedFindProducts.mockResolvedValue([
      { id: 1, name: 'App Premium Plan', list_price: 100, qty_available: 5 },
      { id: 2, name: 'App Premium Plan XL', list_price: 150, qty_available: 2 },
    ]);

    await expect(odooAdapter.searchProducts('app', 5)).resolves.toEqual([
      { id: 1, name: 'App Premium Plan', sku: undefined, price: 100, quantity: 5, currency: 'THB' },
      { id: 2, name: 'App Premium Plan XL', sku: undefined, price: 150, quantity: 2, currency: 'THB' },
    ]);
  });

  it('delegates customer and sales operations through domain facades', async () => {
    mockedGetPartner.mockResolvedValue({ id: 7, name: 'Ada', phone: '081', email: 'ada@example.com' });
    mockedCreateQuotation.mockResolvedValue({ orderId: 12, orderName: 'SO012', total: 250 });
    mockedFindOrder.mockResolvedValue({ id: 12, name: 'SO012', state: 'sale', amount_total: 250 });

    await expect(odooAdapter.lookupCustomer('081')).resolves.toEqual({ id: 7, name: 'Ada', phone: '081', email: 'ada@example.com' });
    await expect(odooAdapter.createQuotation('Ada', '081', 'Widget Pro', 2, { partnerId: 7, discountPercent: 10 })).resolves.toEqual({ id: 12, name: 'SO012', total: 250, currency: 'THB' });
    await expect(odooAdapter.getOrderStatus('SO012')).resolves.toEqual({ id: 12, name: 'SO012', state: 'sale', amountTotal: 250 });
    expect(mockedGetPartner).toHaveBeenCalledWith('081');
    expect(mockedCreateQuotation).toHaveBeenCalledWith('Ada', '081', 'Widget Pro', 2, 7, { discountPercent: 10 });
    expect(mockedFindOrder).toHaveBeenCalledWith('SO012');
  });

  it('delegates customer CRUD operations through the partner facade', async () => {
    mockedCreateCustomer.mockResolvedValue({ id: 7, name: 'Ada', phone: '081', email: 'ada@example.com' });
    mockedUpdateCustomer.mockResolvedValue({ id: 7, name: 'Ada Updated', phone: '082', email: 'ada@example.com' });
    mockedDeleteCustomer.mockResolvedValue(true);

    await expect(odooAdapter.createCustomer('Ada', '081', 'ada@example.com')).resolves.toEqual({ id: 7, name: 'Ada', phone: '081', email: 'ada@example.com' });
    await expect(odooAdapter.updateCustomer(7, { name: 'Ada Updated', phone: '082', email: 'ada@example.com' })).resolves.toEqual({ id: 7, name: 'Ada Updated', phone: '082', email: 'ada@example.com' });
    await expect(odooAdapter.deleteCustomer(7)).resolves.toBe(true);
    expect(mockedCreateCustomer).toHaveBeenCalledWith('Ada', '081', 'ada@example.com');
    expect(mockedUpdateCustomer).toHaveBeenCalledWith(7, 'Ada Updated', '082', 'ada@example.com');
    expect(mockedDeleteCustomer).toHaveBeenCalledWith(7);
  });

  it('normalizes and delegates service catalog operations', async () => {
    const service = { id: 9, name: 'Support', default_code: 'SUP-1', list_price: 99, qty_available: 4 };
    mockedListServices.mockResolvedValue([service]);
    mockedGetService.mockResolvedValue(service);
    mockedCreateService.mockResolvedValue(service);
    mockedUpdateService.mockResolvedValue(service);
    mockedDeleteService.mockResolvedValue(true);

    await expect(odooAdapter.listServices(10)).resolves.toEqual([{ id: 9, name: 'Support', sku: 'SUP-1', price: 99, quantity: 4 }]);
    await expect(odooAdapter.lookupService('SUP-1')).resolves.toEqual({ id: 9, name: 'Support', sku: 'SUP-1', price: 99, quantity: 4 });
    await expect(odooAdapter.createService('Support', 'SUP-1', 99)).resolves.toEqual({ id: 9, name: 'Support', sku: 'SUP-1', price: 99, quantity: 4 });
    await expect(odooAdapter.updateService('SUP-1', { name: 'Premium Support', price: 129, sku: 'SUP-2' })).resolves.toEqual({ id: 9, name: 'Support', sku: 'SUP-1', price: 99, quantity: 4 });
    await expect(odooAdapter.deleteService('SUP-1')).resolves.toBe(true);
    expect(mockedListServices).toHaveBeenCalledWith(10);
    expect(mockedUpdateService).toHaveBeenCalledWith('SUP-1', { name: 'Premium Support', price: 129, code: 'SUP-2' });
  });

  it('returns null for empty or missing records and maps daily summaries', async () => {
    mockedGetPartner.mockResolvedValue(null);
    mockedCreateQuotation.mockResolvedValue(null);
    mockedFindOrder.mockResolvedValue(null);
    mockedGetDailySummary.mockResolvedValue([
      { product: 'Widget Pro', salesYesterday: 3, stock: 8, revenueYesterday: 375 },
    ]);

    await expect(odooAdapter.lookupCustomer('  ')).resolves.toBeNull();
    await expect(odooAdapter.lookupCustomer('081')).resolves.toBeNull();
    await expect(odooAdapter.createQuotation('Ada', '081', 'Widget Pro', 2)).resolves.toBeNull();
    await expect(odooAdapter.getOrderStatus('SO404')).resolves.toBeNull();
    await expect(odooAdapter.getDailySummary()).resolves.toBe('Widget Pro: 3 sold, 8 in stock, 375 revenue');
    expect(mockedGetPartner).toHaveBeenCalledTimes(1);
  });

  it('exposes the structured daily snapshot for reporting callers', async () => {
    const rows = [{ product: 'Widget Pro', salesYesterday: 3, stock: 8, revenueYesterday: 375 }];
    mockedGetDailySummary.mockResolvedValue(rows);

    await expect(odooAdapter.getDailySnapshot()).resolves.toEqual(rows);
  });

  it('exposes capabilities and fail-closed write permissions', () => {
    expect(odooAdapter.capabilities.supportsQuoteCreation).toBe(true);
    expect(odooAdapter.permissionFor('quote.create')).toEqual({ role: 'staff', channel: 'line', requiresOtp: true });
    expect(odooAdapter.permissionFor('customer.update')).toEqual({ role: 'admin', channel: 'ops', requiresOtp: true });
    expect(odooAdapter.permissionFor('service.update')).toEqual({ role: 'admin', channel: 'admin', requiresOtp: true });
  });

  it('delegates order confirmation to the ERP domain facade', async () => {
    mockedConfirmOrder.mockResolvedValue(true);

    await expect(odooAdapter.confirmOrder(42)).resolves.toBe(true);
    expect(mockedConfirmOrder).toHaveBeenCalledWith(42);
  });

  it('delegates invoice creation to the ERP domain facade', async () => {
    mockedCreateInvoice.mockResolvedValue(true);

    await expect(odooAdapter.createInvoice(42)).resolves.toBe(true);
    expect(mockedCreateInvoice).toHaveBeenCalledWith(42);
  });

  it('delegates adding a quote line to the ERP domain facade', async () => {
    mockedAddQuoteLine.mockResolvedValue(true);

    await expect(odooAdapter.addQuoteLine(42, 7, 2)).resolves.toBe(true);
    expect(mockedAddQuoteLine).toHaveBeenCalledWith(42, 7, 2);
  });

  it('delegates editing a quote line to the ERP domain facade', async () => {
    mockedEditQuoteLine.mockResolvedValue(true);

    await expect(odooAdapter.editQuoteLine(42, 7, 3)).resolves.toBe(true);
    expect(mockedEditQuoteLine).toHaveBeenCalledWith(42, 7, 3);
  });

  it('delegates cancelling a quote to the ERP domain facade', async () => {
    mockedCancelQuote.mockResolvedValue(true);

    await expect(odooAdapter.cancelQuote(42)).resolves.toBe(true);
    expect(mockedCancelQuote).toHaveBeenCalledWith(42);
  });

  it('loads outgoing picking by sale order name', async () => {
    mockedGetSaleOrderById.mockResolvedValue({ id: 42, name: 'S0042' } as never);
    mockedGetPicking.mockResolvedValue({ pickingName: 'WH/OUT/1', state: 'done' });

    await expect(odooAdapter.getDeliveryStatus(42)).resolves.toEqual({ pickingName: 'WH/OUT/1', state: 'done' });
    expect(mockedGetPicking).toHaveBeenCalledWith('S0042');
  });

  it('looks up products, named partners, payment terms, and order links through the adapter', async () => {
    vi.mocked(getProductById).mockResolvedValue({ id: 9, name: 'App', default_code: 'A1', list_price: 10, qty_available: 2 });
    vi.mocked(getPartnerByName).mockResolvedValue({ id: 3, name: 'Somchai', phone: '081', email: 'a@b.c' });
    vi.mocked(findPaymentTermByName).mockResolvedValue({ id: 7, name: 'Immediate' });
    vi.mocked(getSaleOrderPortalLink).mockResolvedValue('https://odoo/portal');
    vi.mocked(getSaleOrderPdfLink).mockResolvedValue('https://odoo/pdf');

    await expect(odooAdapter.lookupProduct(9)).resolves.toEqual({
      id: 9, name: 'App', sku: 'A1', price: 10, quantity: 2, currency: 'THB',
    });
    await expect(odooAdapter.lookupCustomerByName('Somchai')).resolves.toEqual({
      id: 3, name: 'Somchai', phone: '081', email: 'a@b.c',
    });
    await expect(odooAdapter.findPaymentTermId('Immediate')).resolves.toBe(7);
    await expect(odooAdapter.getOrderLinks(42)).resolves.toEqual({ portal: 'https://odoo/portal', pdf: 'https://odoo/pdf' });
  });

  it('exposes CRM quotation list/assign on the adapter', () => {
    expect(typeof odooAdapter.listQuotations).toBe('function');
    expect(typeof odooAdapter.assignQuotationSalesperson).toBe('function');
  });

  it('selects Odoo by default and uses a placeholder for reserved ERP names', () => {
    expect(getErpAdapter()).toBe(odooAdapter);
    process.env.ERP_PROVIDER = 'sap';
    const adapter = getErpAdapter();
    expect(adapter.name).toBe('sap');
    expect(adapter.capabilities.supportsQuoteCreation).toBe(false);
    expect(isErpImplemented()).toBe(false);
  });
});
