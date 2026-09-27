import type { Express } from 'express';
import { getSaleOrderById } from '../services/odoo';
import { getSaleOrderPortalLink } from '../services/odoo/sales';
import {
  isShopOrderPaid,
  notifyShopPaymentSuccess,
  parseShopPayQuery,
  shopPayCallerOwnsOrder,
  shopPayReturnUrl,
} from '../services/shop-pay';
import { oaChatDeepLink, CUSTOMER_CHANNEL_ID } from '../line/channels';
import { escapeHtml } from '../utils/html';
import { verifyLinkLimiter } from './middleware';
import { appEnv } from './env';

const usablePortal = (portal: string | null): string | undefined => {
  if (!portal) return undefined;
  if (portal.toLowerCase().startsWith('https://')) return portal;
  if (appEnv === 'development' && /^https?:\/\//i.test(portal)) return portal;
  return undefined;
};

const payPage = (opts: {
  ok: boolean;
  title: string;
  message: string;
  portalUrl?: string;
  returnUrl?: string;
  paid?: boolean;
}) => {
  const chat = oaChatDeepLink(CUSTOMER_CHANNEL_ID);
  const close = chat
    ? `<a class="close" href="${escapeHtml(chat)}" target="_top" rel="noopener" aria-label="Close">×</a>`
    : '';
  const portal = opts.portalUrl
    ? `<a class="btn" href="${escapeHtml(opts.portalUrl)}" target="_top" rel="noopener">Pay in Odoo</a>`
    : '';
  const done = opts.returnUrl && !opts.paid
    ? `<a class="btn secondary" href="${escapeHtml(opts.returnUrl)}" target="_top" rel="noopener">I've paid</a>`
    : '';
  const line = chat
    ? `<a class="btn${opts.portalUrl ? ' secondary' : ''}" href="${escapeHtml(chat)}" target="_top" rel="noopener">Return to LINE</a>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(opts.title)}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f1f4f2;color:#10201e;margin:0;padding:32px}main{position:relative;max-width:640px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;box-shadow:0 8px 24px rgba(11,110,106,.12)}h1{margin:0 0 12px;font-size:24px;color:#0B6E6A}p{line-height:1.6}a.btn{display:inline-block;margin-top:16px;margin-right:8px;padding:12px 24px;background:#0B6E6A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}a.btn.secondary{background:#A97A2B}a.close{position:absolute;top:12px;right:16px;font-size:28px;line-height:1;color:#5B6C69;text-decoration:none}</style></head><body><main>${close}<h1>${escapeHtml(opts.title)}</h1><p>${escapeHtml(opts.message)}</p>${portal}${done}${line}</main></body></html>`;
};

export const registerShopPayRoutes = (app: Express): void => {
  app.get('/shop/pay', verifyLinkLimiter, async (req, res) => {
    const token = parseShopPayQuery(req.query);
    if (!token) {
      return res.status(400).type('html').send(payPage({ ok: false, title: 'Pay link invalid', message: 'This pay link is invalid or expired. Open Pay from LINE again.' }));
    }
    const order = await getSaleOrderById(token.orderId);
    if (!order || !(await shopPayCallerOwnsOrder(token.userId, order))) {
      return res.status(404).type('html').send(payPage({ ok: false, title: 'Order not found', message: 'That order is not available for this account.' }));
    }
    if (isShopOrderPaid(order)) {
      await notifyShopPaymentSuccess(order);
      return res.status(200).type('html').send(payPage({
        ok: true,
        paid: true,
        title: 'Payment successful',
        message: `${order.name} is paid. Return to LINE for Order completed.`,
      }));
    }
    const httpsPortal = usablePortal(await getSaleOrderPortalLink(order.id));
    const returnUrl = shopPayReturnUrl(token.orderId, token.userId, token.exp, String(req.query.sig || '')) || undefined;
    return res.status(200).type('html').send(payPage({
      ok: true,
      title: 'Pay',
      message: `Pay ${order.name} in Odoo. After the provider confirms, tap I've paid — LINE will show Order completed.`,
      portalUrl: httpsPortal,
      returnUrl,
    }));
  });

  app.get('/shop/pay/return', verifyLinkLimiter, async (req, res) => {
    const token = parseShopPayQuery(req.query);
    if (!token) {
      return res.status(400).type('html').send(payPage({ ok: false, title: 'Pay link invalid', message: 'This return link is invalid or expired.' }));
    }
    const order = await getSaleOrderById(token.orderId);
    if (!order || !(await shopPayCallerOwnsOrder(token.userId, order))) {
      return res.status(404).type('html').send(payPage({ ok: false, title: 'Order not found', message: 'That order is not available for this account.' }));
    }
    if (!isShopOrderPaid(order)) {
      const httpsPortal = usablePortal(await getSaleOrderPortalLink(order.id));
      const returnUrl = shopPayReturnUrl(token.orderId, token.userId, token.exp, String(req.query.sig || '')) || undefined;
      return res.status(202).type('html').send(payPage({
        ok: false,
        title: 'Payment pending',
        message: 'Odoo has not marked this order paid yet. Finish Pay in Odoo, then tap I\'ve paid again, or Check payment in LINE.',
        portalUrl: httpsPortal,
        returnUrl,
      }));
    }
    await notifyShopPaymentSuccess(order);
    return res.status(200).type('html').send(payPage({
      ok: true,
      paid: true,
      title: 'Payment successful',
      message: `${order.name} is paid. LINE has Order completed.`,
    }));
  });
};
