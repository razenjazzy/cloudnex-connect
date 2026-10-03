import { messagingApi } from '@line/bot-sdk';

/**
 * LINE Messaging API's documented hard limits. Exceeding any of these fails
 * the send outright — the customer gets nothing, with no local signal unless
 * something checks for it before the message ever reaches LINE's API.
 * Used by tests/message-limits.test.ts to guard every template in
 * src/line/templates.ts, and available to call at runtime around any new
 * dynamic-content message.
 */
export const LINE_LIMITS = {
  ALT_TEXT_MAX_CHARS: 400,
  QUICK_REPLY_MAX_ITEMS: 13,
  TEXT_MESSAGE_MAX_CHARS: 5000,
  MAX_MESSAGES_PER_REPLY: 5,
  ACTION_LABEL_MAX_CHARS: 20,
} as const;

export type LineLimitViolation = {
  field: string;
  limit: number;
  actual: number;
};

const charLen = (value: string | undefined): number => Array.from(value || '').length;

export const checkMessageAgainstLineLimits = (message: messagingApi.Message): LineLimitViolation[] => {
  const violations: LineLimitViolation[] = [];

  if (message.type === 'flex') {
    const altTextLen = charLen(message.altText);
    if (altTextLen > LINE_LIMITS.ALT_TEXT_MAX_CHARS) {
      violations.push({ field: 'flex.altText', limit: LINE_LIMITS.ALT_TEXT_MAX_CHARS, actual: altTextLen });
    }
  }

  if (message.type === 'text') {
    const textLen = charLen(message.text);
    if (textLen > LINE_LIMITS.TEXT_MESSAGE_MAX_CHARS) {
      violations.push({ field: 'text.text', limit: LINE_LIMITS.TEXT_MESSAGE_MAX_CHARS, actual: textLen });
    }
  }

  const quickReplyItems = (message as { quickReply?: { items?: unknown[] } }).quickReply?.items?.length || 0;
  if (quickReplyItems > LINE_LIMITS.QUICK_REPLY_MAX_ITEMS) {
    violations.push({ field: 'quickReply.items', limit: LINE_LIMITS.QUICK_REPLY_MAX_ITEMS, actual: quickReplyItems });
  }

  const items = (message as { quickReply?: { items?: Array<{ action?: { label?: string } }> } }).quickReply?.items || [];
  for (const item of items) {
    const labelLen = charLen(item.action?.label);
    if (labelLen > LINE_LIMITS.ACTION_LABEL_MAX_CHARS) {
      violations.push({ field: 'quickReply.label', limit: LINE_LIMITS.ACTION_LABEL_MAX_CHARS, actual: labelLen });
    }
  }

  return violations;
};

export const checkMessagesAgainstLineLimits = (messages: messagingApi.Message[]): LineLimitViolation[] => {
  const violations: LineLimitViolation[] = [];
  if (messages.length > LINE_LIMITS.MAX_MESSAGES_PER_REPLY) {
    violations.push({ field: 'messages.length', limit: LINE_LIMITS.MAX_MESSAGES_PER_REPLY, actual: messages.length });
  }
  for (const message of messages) {
    violations.push(...checkMessageAgainstLineLimits(message));
  }
  return violations;
};

/** Keep index 0. Drop follow-up from the end. */
export const trimReplyToLimit = (messages: messagingApi.Message[]): messagingApi.Message[] =>
  messages.slice(0, LINE_LIMITS.MAX_MESSAGES_PER_REPLY);

const clampLabel = (label: string): string => {
  const chars = Array.from(label);
  return chars.length > LINE_LIMITS.ACTION_LABEL_MAX_CHARS
    ? `${chars.slice(0, LINE_LIMITS.ACTION_LABEL_MAX_CHARS - 3).join('')}...`
    : label;
};

/**
 * Last line of defence before LINE: a single over-limit label, quick-reply
 * item or sixth message makes LINE reject the whole reply. Clamp instead of
 * letting the customer get nothing. Returns the same array when nothing
 * needed changing.
 */
export const enforceLineLimits = (messages: messagingApi.Message[]): messagingApi.Message[] =>
  trimReplyToLimit(messages).map(message => {
    const quickReply = (message as { quickReply?: { items?: Array<{ type: string; action?: { label?: string } }> } }).quickReply;
    if (!quickReply?.items?.length) return message;
    const items = quickReply.items.slice(0, LINE_LIMITS.QUICK_REPLY_MAX_ITEMS).map(item => (
      item.action?.label
        ? { ...item, action: { ...item.action, label: clampLabel(item.action.label) } }
        : item
    ));
    return { ...message, quickReply: { ...quickReply, items } } as messagingApi.Message;
  });
