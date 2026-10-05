import type { CommandReplyContext } from './command-router';
import { createBotTextFlexMessage } from './templates';
import { getAgentSpeakPrefix, salesNotifyChannelId } from './channels';
import { sendTargetedFlexMessage } from './messaging';
import { getEffectiveAdminUserIds } from '../services/runtime-settings';
import { recordAuditEvent } from '../services/firestore';
import { tFill, t } from '../services/i18n';
import type { UserLanguage } from '../services/firestore';
import { appLogger } from '../services/logger';
import { isValidPhone } from './command-validators';

export type SalesAccessRequestOutcome = 'sent' | 'already' | 'no_admin' | 'failed';

const DEBOUNCE_MS = 60_000;
const lastRequestAt = new Map<string, number>();

const pruneSalesAccessDebounce = (now: number): void => {
  for (const [userId, at] of lastRequestAt) {
    if (now - at >= DEBOUNCE_MS) lastRequestAt.delete(userId);
  }
};

export const resetSalesAccessRequestsForTests = (): void => lastRequestAt.clear();
export const salesAccessDebounceSizeForTests = (): number => lastRequestAt.size;

/** Digits/+ from VERIFY ASK ADMIN text or the saved profile phone. Empty when neither is a usable number. */
export const salesAskAdminPhone = (text: string, profilePhone?: string): string => {
  const typed = text.trim().replace(/^VERIFY ASK ADMIN\s*/i, '').replace(/[^0-9+]/g, '').slice(0, 20);
  const saved = (profilePhone || '').replace(/[^0-9+]/g, '').slice(0, 20);
  const phone = typed || saved;
  return isValidPhone(phone) ? phone : '';
};

/**
 * Sales OA: a staff member whose phone matches no Odoo Sales User asks the admins to fix it in Odoo. This is a
 * plain notice (who, which phone, what to do). It is not the customer-inbound card (no quote or relay buttons), and
 * it does not escalate the chat to a human, so the user keeps every command (FORM VERIFY MANUAL included).
 * Nothing here grants access: an admin still has to add the phone on the Sales User in Odoo.
 */
export const requestSalesAccessFromAdmins = async (
  ctx: Pick<CommandReplyContext, 'userId' | 'userLanguage' | 'profile' | 'requestId'>,
  phone: string,
  now = Date.now(),
): Promise<SalesAccessRequestOutcome> => {
  const adminIds = [...getEffectiveAdminUserIds()];
  if (!adminIds.length) return 'no_admin';

  pruneSalesAccessDebounce(now);
  const last = lastRequestAt.get(ctx.userId);
  if (last && now - last < DEBOUNCE_MS) return 'already';

  const language = 'en' as const; // admins read English; the requester's own reply is localized separately
  const message = createBotTextFlexMessage({
    title: t('salesAccessRequestTitle', language),
    body: tFill('salesAccessRequestBody', language, {
      name: ctx.profile.displayName || 'LINE user',
      lineId: ctx.userId,
      phone,
    }),
    language,
    tone: 'info',
  });
  const sent = await sendTargetedFlexMessage(adminIds, message, salesNotifyChannelId());
  if (!sent) {
    appLogger.warn('sales_access_request_delivery_failed', { userId: ctx.userId });
    return 'failed';
  }
  lastRequestAt.set(ctx.userId, now);
  appLogger.info('sales_access_request', { userId: ctx.userId, admins: adminIds.length });
  recordAuditEvent({
    action: 'sales_access_request',
    outcome: 'success',
    actorUserId: ctx.userId,
    channelId: salesNotifyChannelId(),
    requestId: ctx.requestId,
    detail: `phone=${phone.replace(/\d(?=\d{3})/g, '*')}`,
  });
  return 'sent';
};

export const salesVerifyMissActions = (phone: string, language: UserLanguage): Array<{ label: string; text: string; style: 'primary' | 'secondary' }> => [
  { label: t('askAdmin', language), text: `VERIFY ASK ADMIN ${phone}`.trim(), style: 'primary' },
  { label: t('anotherPhone', language), text: 'FORM VERIFY MANUAL', style: 'secondary' },
];

export const salesAccessRequestReply = (outcome: SalesAccessRequestOutcome, language: 'th' | 'en'): string => {
  const key = outcome === 'sent' ? 'salesAskAdminSent'
    : outcome === 'already' ? 'salesAskAdminAlready'
      : outcome === 'no_admin' ? 'salesAskAdminNone'
        : 'salesAskAdminFailed';
  return tFill(key, language, { prefix: getAgentSpeakPrefix(language) });
};
