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

export const notifyAdminsOfCustomerInbound = async (ctx: CommandReplyContext): Promise<void> => {
  const quoted = ctx.quotedText ? `Re: ${ctx.quotedText}\n` : '';
  const text = snippet(`${quoted}${ctx.text}`);
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
  const overflow = chips.length > 4;
  const actions = [
    ...chips.slice(0, 4).map(chip => ({ label: chip.label, text: chip.text, style: 'primary' as const })),
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
  const card = createBotTextFlexMessage({
    title: t('inboundLeadTitle', language),
    body: note || t('inboundAssigned', language),
    language,
    tone: 'info',
    actions: [{ label: t('createQuote', language), text: 'FORM QUOTE CREATE', style: 'primary' }],
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
