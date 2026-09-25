export type ErpProviderName = 'odoo' | 'sap' | 'quickbooks' | 'oracle';

export type ErpWriteAction =
  | 'customer.create'
  | 'customer.update'
  | 'quote.create'
  | 'quote.update'
  | 'quote.cancel'
  | 'order.confirm'
  | 'invoice.create'
  | 'service.create'
  | 'service.update';

export type ErpPermission = {
  role: 'admin' | 'staff' | 'customer';
  channel: 'line' | 'web' | 'ops' | 'admin';
  requiresOtp?: boolean;
};

export type ErpProduct = {
  id: number;
  name: string;
  sku?: string;
  price?: number;
  quantity?: number;
  currency?: string;
  imageUrl?: string;
};

export type ErpService = {
  id: number;
  name: string;
  sku?: string;
  price: number;
  quantity?: number;
};

export type ErpServiceUpdate = {
  name?: string;
  price?: number;
  sku?: string;
};

export type ErpPartner = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
};

export type ErpQuoteDraft = {
  id: number;
  name: string;
  total: number;
  currency: string;
};

export type ErpQuotationOptions = {
  partnerId?: number;
  customerRef?: string;
  discountPercent?: number;
  validityDate?: string;
  note?: string;
  paymentTermId?: number;
  productId?: number;
  /** false = leave SO unassigned (Customer OA). number = that res.users. */
  salespersonUserId?: number | false;
};

export type ErpCustomerUpdate = {
  name?: string;
  phone?: string;
  email?: string;
};

export type ErpOrderStatus = {
  id: number;
  name: string;
  state: string;
  amountTotal?: number;
};

export type ErpDeliveryStatus = {
  pickingName: string;
  state: string;
  scheduledDate?: string;
  doneDate?: string;
  carrier?: string;
  trackingRef?: string;
  responsible?: string;
};

export type ErpDailySnapshotRow = {
  product: string;
  stock: number;
  salesYesterday: number;
  revenueYesterday: number;
};

export type ErpAdapterCapabilities = {
  supportsProductSearch: boolean;
  supportsCustomerLookup: boolean;
  supportsQuoteCreation: boolean;
  supportsOrderConfirmation: boolean;
  supportsInvoiceCreation: boolean;
  supportsDailyReport: boolean;
};

export type ErpCrmQuote = {
  id: number;
  name: string;
  state: string;
  amountTotal: number;
  partnerName?: string;
  salespersonUserId?: number;
  salespersonName?: string;
  clientOrderRef?: string;
  dateOrder?: string;
  note?: string;
};

export type ErpCrmQuoteListOpts = {
  state?: string;
  unassigned?: boolean;
  limit?: number;
};

export type ErpPartnerPrivileges = {
  configured: boolean;
  odooUserId?: number;
  login?: string;
  name?: string;
  salesTier?: 'salesperson' | 'sales_manager';
  groups: string[];
  canWritePartners?: boolean;
};

export type ErpCommerceStatus = {
  ok: boolean;
  module?: string;
  message: string;
};

export type ErpAdapter = {
  name: ErpProviderName;
  capabilities: ErpAdapterCapabilities;
  searchProducts: (query: string, limit?: number) => Promise<ErpProduct[]>;
  listServices: (limit?: number) => Promise<ErpService[]>;
  lookupService: (identifier: string) => Promise<ErpService | null>;
  createService: (name: string, sku: string, price: number) => Promise<ErpService | null>;
  updateService: (identifier: string, update: ErpServiceUpdate) => Promise<ErpService | null>;
  deleteService: (identifier: string) => Promise<boolean>;
  lookupCustomer: (query: string) => Promise<ErpPartner | null>;
  createCustomer: (name: string, phone: string, email?: string) => Promise<ErpPartner | null>;
  updateCustomer: (id: number, update: ErpCustomerUpdate) => Promise<ErpPartner | null>;
  deleteCustomer: (id: number) => Promise<boolean>;
  createQuotation: (partnerName: string, phone: string, productName: string, qty: number, options?: ErpQuotationOptions) => Promise<ErpQuoteDraft | null>;
  confirmOrder: (orderId: number) => Promise<boolean>;
  createInvoice: (orderId: number) => Promise<boolean>;
  addQuoteLine: (orderId: number, productId: number, qty: number) => Promise<boolean>;
  editQuoteLine: (orderId: number, productId: number, qty: number) => Promise<boolean>;
  removeQuoteLine: (orderId: number, productId: number) => Promise<boolean>;
  cancelQuote: (orderId: number) => Promise<boolean>;
  sendQuotationEmail: (orderId: number, email: string, subject: string, body: string) => Promise<boolean>;
  getOrderStatus: (orderRef: string) => Promise<ErpOrderStatus | null>;
  getDeliveryStatus: (orderId: number) => Promise<ErpDeliveryStatus | null>;
  getDailySnapshot: () => Promise<ErpDailySnapshotRow[]>;
  getDailySummary: () => Promise<string | null>;
  lookupProduct: (productId: number) => Promise<ErpProduct | null>;
  /** Warm catalog for LINE tray replies — never hits Odoo. */
  peekCachedProducts?: (limit?: number) => ErpProduct[] | null;
  lookupCustomerByName: (name: string) => Promise<ErpPartner | null>;
  findPaymentTermId: (query: string) => Promise<number | null>;
  getOrderLinks: (orderId: number) => Promise<{ portal?: string; pdf?: string }>;
  permissionFor: (action: ErpWriteAction) => ErpPermission;
  postPartnerNote?: (partnerId: number, body: string) => Promise<boolean>;
  listQuotations?: (opts?: ErpCrmQuoteListOpts) => Promise<ErpCrmQuote[]>;
  assignQuotationSalesperson?: (orderId: number, salespersonUserId: number | null) => Promise<boolean>;
  describePartnerPrivileges?: (partnerId: number) => Promise<ErpPartnerPrivileges>;
  describeSignatureStatus?: () => Promise<ErpCommerceStatus>;
  describePaymentStatus?: () => Promise<ErpCommerceStatus>;
};
