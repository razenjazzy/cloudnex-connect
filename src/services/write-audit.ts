import { recordAuditEvent } from './firestore';
import type { AuditAction, AuditOutcome } from './firestore';

/** Redact emails/phones and cap length so write-approval audits never store OTP or raw PII. */
export const commandPrefixForAudit = (text: string): string => {
  const redacted = text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\S+@\S+/g, '[email]')
    .replace(/\b0\d{8,}\b/g, '[phone]');
  return redacted.slice(0, 80);
};

export const auditWrite = (params: {
  action: AuditAction;
  outcome: AuditOutcome;
  actorUserId: string;
  channelId?: string;
  requestId?: string;
  targetId?: string;
  detail?: string;
}): void => {
  recordAuditEvent({
    ...params,
    detail: params.detail ? commandPrefixForAudit(params.detail) : undefined,
  });
};
