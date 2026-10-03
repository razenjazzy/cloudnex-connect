import { createHmac, timingSafeEqual } from 'node:crypto';
import { originFromPublicBaseUrl, publicSiteUrl } from '../http/public-bases';
import { appEnv } from '../http/env';
import { customerNotifyChannelId } from '../line/channels';
import { sendTargetedFlexMessage } from '../line/messaging';
import { createShopCartFlexMessage } from '../line/templates';
import { resolveCustomerLineUserId } from '../line/quote-notify';
import { getPartnerById } from './odoo';
import { recordAuditEvent, getUserLanguage, getUserProfile } from './firestore';
import type { OdooSaleOrder } from './odoo/types';

const PAY_TTL_MS = 2 * 60 * 60 * 1000;
const notifiedPaidOrders = new Set<number>();

const paySecret = (): string =>
  (process.env.LINE_CHANNEL_CUSTOMER_SECRET || process.env.LINE_CHANNEL_SECRET || '').trim();

export const isShopOrderPaid = (order: Pick<OdooSaleOrder, 'state' | 'invoice_status' | 'amount_invoiced' | 'amount_total'>): boolean => {
  if (order.state === 'sale' || order.state === 'done') return true;
  if (order.invoice_status === 'invoiced' && (order.amount_invoiced || 0) > 0) return true;
  return false;
};

export const signShopPayToken = (orderId: number, userId: string, exp: number): string =>
  createHmac('sha256', paySecret()).update(`${orderId}.${userId}.${exp}`).digest('base64url');

export const parseShopPayQuery = (query: {
  orderId?: unknown;
  uid?: unknown;
  exp?: unknown;
  sig?: unknown;
}): { orderId: number; userId: string; exp: number } | null => {
  if (!paySecret()) return null;
  const orderId = Number(query.orderId);
  const userId = String(query.uid || '');
  const exp = Number(query.exp);
  const sig = String(query.sig || '');
  if (!Number.isInteger(orderId) || orderId <= 0 || !userId.startsWith('U') || !Number.isFinite(exp) || exp < Date.now()) {
    return null;
  }
  const expected = signShopPayToken(orderId, userId, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { orderId, userId, exp };
};

const originAllowed = (origin: string): boolean => {
  if (/^https:\/\//i.test(origin)) return true;
  return appEnv === 'development' && /^http:\/\/localhost(?::\d+)?$/i.test(origin);
};

export const shopPayPageUrl = (orderId: number, userId: string, publicBase = process.env.PUBLIC_BASE_URL): string | null => {
  if (!paySecret() || !Number.isInteger(orderId) || orderId <= 0 || !userId.startsWith('U')) return null;
  const origin = originFromPublicBaseUrl(publicBase);
  if (!origin || !originAllowed(origin)) return null;
  const exp = Date.now() + PAY_TTL_MS;
  const url = new URL(`${publicSiteUrl(publicBase)}/shop/pay`);
  url.searchParams.set('orderId', String(orderId));
  url.searchParams.set('uid', userId);
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', signShopPayToken(orderId, userId, exp));
  return url.toString();
};

export const shopPayReturnUrl = (orderId: number, userId: string, exp: number, sig: string, publicBase = process.env.PUBLIC_BASE_URL): string | null => {
  const origin = originFromPublicBaseUrl(publicBase);
  if (!origin || !originAllowed(origin)) return null;
  const url = new URL(`${publicSiteUrl(publicBase)}/shop/pay/return`);
  url.searchParams.set('orderId', String(orderId));
  url.searchParams.set('uid', userId);
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);
  return url.toString();
};

export const shopPayCallerOwnsOrder = async (userId: string, order: OdooSaleOrder): Promise<boolean> => {
  const profile = await getUserProfile(userId);
  const partnerId = order.partner_id?.[0];
  return Boolean(profile.odooVerified && partnerId && profile.odooPartnerId === partnerId);
};

export const notifyShopPaymentSuccess = async (order: OdooSaleOrder): Promise<{ customerPushed: boolean; already?: boolean }> => {
  if (!isShopOrderPaid(order)) return { customerPushed: false };
  if (notifiedPaidOrders.has(order.id)) return { customerPushed: false, already: true };
  const partner = order.partner_id ? await getPartnerById(order.partner_id[0]) : null;
  const lineId = await resolveCustomerLineUserId(partner);
  if (!lineId) return { customerPushed: false };
  const language = await getUserLanguage(lineId);
  const pushed = await sendTargetedFlexMessage(
    [lineId],
    createShopCartFlexMessage(order, { stage: 'completed' }, language),
    customerNotifyChannelId(),
  );
  if (pushed) {
    notifiedPaidOrders.add(order.id);
    recordAuditEvent({ action: 'shop_pay_success', outcome: 'success', actorUserId: lineId, targetId: String(order.id) });
  }
  return { customerPushed: Boolean(pushed) };
};
