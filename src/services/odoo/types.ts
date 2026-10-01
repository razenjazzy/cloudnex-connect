export type OdooProduct = {
  id: number;
  name: string;
  list_price: number;
  qty_available: number;
  default_code?: string;
  website_url?: string;
  image_url?: string;
  description?: string;
};

export type OdooSaleOrderLine = {
  productId?: number;
  productName: string;
  qty: number;
  priceUnit: number;
  subtotal: number;
  isDelivery?: boolean;
  optional?: boolean;
};

export type OdooSaleOrder = {
  id: number;
  name: string;
  state: string;
  amount_total: number;
  partner_id?: [number, string];
  user_id?: [number, string];
  date_order?: string;
  client_order_ref?: string;
  access_token?: string;
  lines?: OdooSaleOrderLine[];
  invoice_status?: string;
  amount_invoiced?: number;
  note?: string;
};

export type OdooDailySalesItem = {
  product: string;
  stock: number;
  salesYesterday: number;
  revenueYesterday: number;
};

export type OdooServiceItem = {
  id: number;
  name: string;
  default_code?: string;
  list_price: number;
  qty_available: number;
};

export type OdooPartner = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
};
