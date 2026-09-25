import { messagingApi } from '@line/bot-sdk';
import { createBotTextFlexMessage } from './templates';
import { checkMessagesAgainstLineLimits, trimReplyToLimit } from './message-limits';
import { t, type Lang } from '../services/i18n';

export const outcomeFlex = (params: {
  language: Lang;
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  actions?: { label: string; text: string; style?: 'primary' | 'secondary' }[];
  linkAction?: { label: string; uri: string };
}): messagingApi.FlexMessage => createBotTextFlexMessage({
  title: params.title,
  body: params.body,
  language: params.language,
  tone: params.tone,
  actions: params.actions,
  ...(params.linkAction ? { linkAction: params.linkAction } : {}),
});

/** Never return a pack LINE would reject. Keep the outcome (index 0). */
export const fitReply = (messages: messagingApi.Message[], language: Lang): messagingApi.Message[] => {
  const packed = trimReplyToLimit(messages);
  if (!packed.length) return packed;
  if (checkMessagesAgainstLineLimits(packed).length === 0) return packed;
  return [outcomeFlex({
    language,
    tone: 'warning',
    title: t('replyDroppedLimit', language),
    body: t('replyDroppedLimitBody', language),
    actions: [{ label: t('myQuotations', language), text: 'QUOTE LIST', style: 'primary' }],
  })];
};

export const withOutcome = (
  language: Lang,
  outcome: messagingApi.Message,
  rest: messagingApi.Message[],
): messagingApi.Message[] => fitReply([outcome, ...rest], language);
