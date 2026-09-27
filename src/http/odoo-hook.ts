import { getSaleOrderById } from '../services/odoo';
import { notifyQuoteParties } from '../line/quote-notify';
import { getErpAdapter } from '../erp/registry';
import { t } from '../services/i18n';
import { isShopOrderPaid, notifyShopPaymentSuccess } from '../services/shop-pay';

export type OdooHookEvent = 'picking.done' | 'approval.stage' | 'payment.done';

export const parseOdooHookBody = (body: unknown): { event: OdooHookEvent; orderId: number } | null => {
  if (!body || typeof body !== 'object') return null;
  const event = (body as { event?: unknown }).event;
  const orderId = Number((body as { orderId?: unknown }).orderId);
  if (event !== 'picking.done' && event !== 'approval.stage' && event !== 'payment.done') return null;
  if (!Number.isInteger(orderId) || orderId <= 0) return null;
  return { event, orderId };
};

export const handleOdooHook = async (body: unknown): Promise<{ ok: boolean; status: number; error?: string; salesPushed?: number; customerPushed?: boolean }> => {
  const parsed = parseOdooHookBody(body);
  if (!parsed) return { ok: false, status: 400, error: 'event must be picking.done, approval.stage, or payment.done with a positive orderId' };

  const order = await getSaleOrderById(parsed.orderId);
  if (!order) return { ok: false, status: 404, error: 'order not found' };

  if (parsed.event === 'payment.done') {
    if (!isShopOrderPaid(order)) {
      return { ok: false, status: 409, error: 'order is not paid in Odoo' };
    }
    const pay = await notifyShopPaymentSuccess(order);
    const sales = await notifyQuoteParties({
      order,
      notifyCustomer: false,
      notifySales: true,
      salesIntro: `Payment received for ${order.name}.`,
    });
    return { ok: true, status: 200, customerPushed: pay.customerPushed, salesPushed: sales.salesPushed };
  }

  const salesIntro = parsed.event === 'picking.done'
    ? t('deliveryField', 'en') + `: ${order.name} ${parsed.event}`
    : `Approval update for ${order.name}. Open in Odoo.`;

  const delivery = parsed.event === 'picking.done'
    ? await getErpAdapter().getDeliveryStatus(order.id)
    : null;

  const result = await notifyQuoteParties({
    order,
    notifyCustomer: parsed.event === 'picking.done',
    notifySales: true,
    salesIntro,
    ...(delivery ? { delivery } : {}),
  });

  return { ok: true, status: 200, salesPushed: result.salesPushed };
};
