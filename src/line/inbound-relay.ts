import { createBotTextFlexMessage } from './templates';
import { sendTargetedFlexMessage } from './messaging';
import { SALES_CHANNEL_ID } from './channels';
import {
  getUserProfile,
  listVerifiedSalesLineUserIds,
  setLastInboundSnippet,
  setRelayWaitAt,
  setWaitingSalesUserId,
  setWaitingCustomerUserId,
  recordAuditEvent,
} from '../services/firestore';
import { findOdooUserIdByPartnerId } from '../services/odoo/admin';
import { getEffectiveAdminUserIds } from '../services/runtime-settings';
import { isAuthorizedForAdminRole } from '../services/admin-authorization';
import { t, tFill } from '../services/i18n';
import type { CommandReplyContext } from './command-router';

const snippet = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 200);

export const parseInboundRfq = (raw: string): { productId?: number; qty?: number; text: string } => {
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  let productId: number | undefined;
  let qty: number | undefined;
  const rest: string[] = [];
  for (const line of lines) {
    const product = /^productId=(\d+)$/i.exec(line);
    if (product) {
      productId = Number(product[1]);
      continue;
    }
    const qtyMatch = /^qty=(\d+)$/i.exec(line);
    if (qtyMatch) {
      qty = Number(qtyMatch[1]);
      continue;
    }
    rest.push(line);
  }
  return { text: rest.join('\n').trim() || raw, ...(productId ? { productId } : {}), ...(qty ? { qty } : {}) };
};

/** Canonical Create-quote payload. Prefix stays FORM QUOTE CREATE FROM CARD. */
export const inboundCreateQuoteCommand = (input: {
  customerUserId: string;
  productId?: number;
  qty?: number;
}): string => {
  if (!input.productId) return 'FORM QUOTE CREATE';
  const parts = ['FORM QUOTE CREATE FROM CARD', String(input.productId)];
  if (input.qty && input.qty > 0) parts.push(String(input.qty));
  if (input.customerUserId.startsWith('U')) parts.push(input.customerUserId);
  return parts.join(' ');
};

export const notifyAdminsOfCustomerInbound = async (ctx: CommandReplyContext): Promise<void> => {
  const quoted = ctx.quotedText ? `Re: ${ctx.quotedText}\n` : '';
  const product = ctx.profile.lastProductContext;
  const qty = product?.qty;
  const text = [
    product?.productId ? `productId=${product.productId}` : '',
    qty ? `qty=${qty}` : '',
    snippet(`${quoted}${ctx.text}`),
  ].filter(Boolean).join('\n');
  await setLastInboundSnippet(ctx.userId, text);
  const adminIds = [...getEffectiveAdminUserIds()];
  const salesIds = await listVerifiedSalesLineUserIds();
  const chips: { label: string; text: string }[] = [];
  for (const salesId of salesIds.slice(0, 8)) {
    const profile = await getUserProfile(salesId);
    const label = (profile.displayName || salesId).slice(0, 20);
    chips.push({ label, text: `RELAY TO ${ctx.userId}` });
  }
  const language = ctx.userLanguage;
  const overflow = chips.length > 2;
  const createQuote = inboundCreateQuoteCommand({
    customerUserId: ctx.userId,
    productId: product?.productId,
    qty,
  });
  const actions = [
    { label: t('createQuote', language), text: createQuote, style: 'primary' as const },
    ...chips.slice(0, 2).map(chip => ({ label: chip.label, text: chip.text, style: 'primary' as const })),
    ...(overflow ? [{ label: 'More', text: `STAFF PICK ${ctx.userId}`, style: 'secondary' as const }] : []),
  ];
  const message = createBotTextFlexMessage({
    title: t('inboundLeadTitle', language),
    body: tFill('inboundFromCustomer', language, { text: text || '-' }),
    language,
    tone: 'info',
    actions,
  });
  const assigned = ctx.profile.waitingSalesUserId;
  const notifyIds = [...new Set([...adminIds, ...(assigned ? [assigned] : [])])];
  if (notifyIds.length) {
    await sendTargetedFlexMessage(notifyIds, message, SALES_CHANNEL_ID);
  }
  recordAuditEvent({
    action: 'customer_inbound',
    outcome: 'success',
    actorUserId: ctx.userId,
    channelId: ctx.channel?.channelId,
    requestId: ctx.requestId,
    detail: text,
  });
};

export const completeRelayAssign = async (
  ctx: CommandReplyContext,
  customerUserId: string,
  odooUserId: number,
): Promise<string | null> => {
  const admin = isAuthorizedForAdminRole(ctx.userId, ctx.profile);
  if (!admin.ok || ctx.profile.role !== 'admin') return null;
  const salesIds = await listVerifiedSalesLineUserIds();
  let salesLineId: string | null = null;
  for (const salesId of salesIds) {
    const profile = await getUserProfile(salesId);
    if (!profile.odooPartnerId) continue;
    const id = await findOdooUserIdByPartnerId(profile.odooPartnerId);
    if (id === odooUserId) {
      salesLineId = salesId;
      break;
    }
  }
  if (!salesLineId) return null;
  const customer = await getUserProfile(customerUserId);
  const note = customer.lastInboundSnippet || '';
  const language = ctx.userLanguage;
  const rfq = parseInboundRfq(note);
  const card = createBotTextFlexMessage({
    title: t('inboundLeadTitle', language),
    body: rfq.text || t('inboundAssigned', language),
    language,
    tone: 'info',
    actions: [{
      label: t('createQuote', language),
      text: inboundCreateQuoteCommand({
        customerUserId,
        productId: rfq.productId || customer.lastProductContext?.productId,
        qty: rfq.qty || customer.lastProductContext?.qty,
      }),
      style: 'primary',
    }],
  });
  await sendTargetedFlexMessage([salesLineId], card, SALES_CHANNEL_ID);
  return salesLineId;
};

export const markSalesWaiting = async (salesUserId: string, customerUserId: string): Promise<void> => {
  const at = new Date().toISOString();
  await setRelayWaitAt(salesUserId, at);
  await setWaitingSalesUserId(customerUserId, salesUserId);
  await setWaitingCustomerUserId(salesUserId, customerUserId);
};

export const clearSalesWaiting = async (customerUserId: string): Promise<void> => {
  const customer = await getUserProfile(customerUserId);
  if (customer.waitingSalesUserId) {
    await setRelayWaitAt(customer.waitingSalesUserId, null);
    await setWaitingCustomerUserId(customer.waitingSalesUserId, null);
  }
  await setWaitingSalesUserId(customerUserId, null);
};
