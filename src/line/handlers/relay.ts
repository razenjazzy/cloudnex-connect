import type { CommandHandler } from './index';
import { createBotTextFlexMessage } from '../templates';
import { getErpAdapter } from '../../erp/registry';
import { isAuthorizedForAdminRole } from '../../services/admin-authorization';
import { listVerifiedSalesLineUserIds, getUserProfile, recordAuditEvent } from '../../services/firestore';
import { findOdooUserIdByPartnerId } from '../../services/odoo/admin';
import { t } from '../../services/i18n';
import { completeRelayAssign, markSalesWaiting } from '../inbound-relay';
import { isQuoteStaff } from '../quote-access';

const bot = (body: string, language: 'th' | 'en', tone: 'info' | 'success' | 'warning' | 'error' = 'info') =>
  createBotTextFlexMessage({ title: t('assignSalesperson', language), body, language, tone });

const quoteAssignHandler: CommandHandler = {
  name: 'quote-assign',
  match: (u) => u.startsWith('QUOTE ASSIGN'),
  handle: async (ctx) => {
    const { userLanguage, userId, text, profile } = ctx;
    const auth = isAuthorizedForAdminRole(userId, profile);
    if (!auth.ok || profile.role !== 'admin') {
      return [bot(t('quoteNotLinked', userLanguage), userLanguage, 'error')];
    }
    const parts = text.trim().split(/\s+/);
    const orderId = Number(parts[2]);
    const salespersonUserId = parts[3] ? Number(parts[3]) : NaN;
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return [bot('QUOTE ASSIGN <orderId> <odooUserId>', userLanguage, 'error')];
    }
    if (!Number.isInteger(salespersonUserId) || salespersonUserId <= 0) {
      const salesIds = await listVerifiedSalesLineUserIds();
      const actions: { label: string; text: string; style: 'primary' | 'secondary' }[] = [];
      for (const salesId of salesIds.slice(0, 8)) {
        const salesProfile = await getUserProfile(salesId);
        if (!salesProfile.odooPartnerId) continue;
        const odooId = await findOdooUserIdByPartnerId(salesProfile.odooPartnerId);
        if (!odooId) continue;
        actions.push({
          label: (salesProfile.displayName || salesId).slice(0, 20),
          text: `QUOTE ASSIGN ${orderId} ${odooId}`,
          style: 'primary',
        });
      }
      return [createBotTextFlexMessage({
        title: t('assignSalesperson', userLanguage),
        body: String(orderId),
        language: userLanguage,
        actions: actions.slice(0, 4),
      })];
    }
    const assign = getErpAdapter().assignQuotationSalesperson;
    if (!assign) return [bot('Assign is not supported.', userLanguage, 'error')];
    const ok = await assign(orderId, salespersonUserId);
    recordAuditEvent({
      action: 'crm_quote_assign',
      outcome: ok ? 'success' : 'failure',
      actorUserId: userId,
      detail: String(orderId),
    });
    return [bot(ok ? t('inboundAssigned', userLanguage) : 'Assign failed', userLanguage, ok ? 'success' : 'error')];
  },
};

const relayAssignHandler: CommandHandler = {
  name: 'relay-assign',
  match: (u) => u.startsWith('RELAY ASSIGN'),
  handle: async (ctx) => {
    const { userLanguage, userId, text, profile } = ctx;
    const auth = isAuthorizedForAdminRole(userId, profile);
    if (!auth.ok || profile.role !== 'admin') {
      return [bot(t('quoteNotLinked', userLanguage), userLanguage, 'error')];
    }
    const parts = text.trim().split(/\s+/);
    const customerUserId = parts[2] || '';
    const odooUserId = Number(parts[3]);
    if (!customerUserId.startsWith('U') || !Number.isInteger(odooUserId)) {
      return [bot('RELAY ASSIGN <lineUserId> <odooUserId>', userLanguage, 'error')];
    }
    const salesLineId = await completeRelayAssign(ctx, customerUserId, odooUserId);
    if (!salesLineId) return [bot('Assign failed', userLanguage, 'error')];
    return [bot(t('inboundAssigned', userLanguage), userLanguage, 'success')];
  },
};

const relayToHandler: CommandHandler = {
  name: 'relay-to',
  match: (u) => u.startsWith('RELAY TO'),
  handle: async (ctx) => {
    const { userLanguage, userId, text, profile } = ctx;
    if (!isQuoteStaff(profile) && profile.role !== 'admin') {
      return [bot(t('quoteNotLinked', userLanguage), userLanguage, 'error')];
    }
    const customerUserId = text.trim().split(/\s+/)[2] || '';
    if (!customerUserId.startsWith('U')) {
      return [bot('RELAY TO U<lineUserId>', userLanguage, 'error')];
    }
    await markSalesWaiting(userId, customerUserId);
    return [bot(t('waitingForCustomerReply', userLanguage), userLanguage, 'success')];
  },
};

const staffPickHandler: CommandHandler = {
  name: 'staff-pick',
  match: (u) => u.startsWith('STAFF PICK'),
  handle: async (ctx) => {
    const { userLanguage, userId, text, profile } = ctx;
    const auth = isAuthorizedForAdminRole(userId, profile);
    if (!auth.ok || profile.role !== 'admin') {
      return [bot(t('quoteNotLinked', userLanguage), userLanguage, 'error')];
    }
    const customerUserId = text.trim().split(/\s+/)[2] || '';
    const salesIds = await listVerifiedSalesLineUserIds();
    const actions: { label: string; text: string; style: 'primary' | 'secondary' }[] = [];
    for (const salesId of salesIds.slice(4, 12)) {
      const salesProfile = await getUserProfile(salesId);
      if (!salesProfile.odooPartnerId) continue;
      const odooId = await findOdooUserIdByPartnerId(salesProfile.odooPartnerId);
      if (!odooId) continue;
      actions.push({
        label: (salesProfile.displayName || salesId).slice(0, 20),
        text: `RELAY ASSIGN ${customerUserId} ${odooId}`,
        style: 'primary',
      });
    }
    return [createBotTextFlexMessage({
      title: t('assignSalesperson', userLanguage),
      body: customerUserId || '—',
      language: userLanguage,
      actions: actions.slice(0, 4),
    })];
  },
};

export const relayHandlers: CommandHandler[] = [quoteAssignHandler, relayAssignHandler, relayToHandler, staffPickHandler];
