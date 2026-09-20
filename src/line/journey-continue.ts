import type { messagingApi } from '@line/bot-sdk';
import { LINE_LIMITS } from './message-limits';

type JourneyCtx = {
  text: string;
  profile: { pendingFlow?: unknown };
};

const IDLE_COMMANDS = new Set([
  'NAV HOME',
  'NAV',
  'BACK',
  'VERIFY SIGNOUT',
  'START',
  'HELP',
  'OPTIONS',
]);

const walk = (node: unknown, visit: (value: Record<string, unknown>) => void): void => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  const record = node as Record<string, unknown>;
  visit(record);
  for (const value of Object.values(record)) walk(value, visit);
};

export const isHomeFlex = (message: messagingApi.Message): boolean => {
  if (message.type !== 'flex' || !message.altText) return false;
  const alt = message.altText.toLowerCase();
  return alt.includes(' menu') || alt.startsWith('เมนู ');
};

const collectContinueTexts = (messages: messagingApi.Message[]): string[] => {
  const texts: string[] = [];
  for (const message of messages) {
    const quick = (message as { quickReply?: { items?: unknown[] } }).quickReply;
    if (quick?.items?.length) texts.push('__quickReply__');
    walk(message, (node) => {
      if (node.type === 'carousel') texts.push('__carousel__');
      if (node.type === 'uri' && node.uri) texts.push('__uri__');
      if (node.type === 'postback') texts.push('__postback__');
      if (node.type === 'message' && typeof node.text === 'string' && node.text.trim()) {
        texts.push(node.text.trim().toUpperCase());
      }
    });
  }
  return texts;
};

export const hasNextInputWindow = (messages: messagingApi.Message[]): boolean => {
  const texts = collectContinueTexts(messages);
  if (texts.some(text => text === '__quickReply__' || text === '__carousel__' || text === '__uri__' || text === '__postback__')) {
    return true;
  }
  return texts.some(text => !IDLE_COMMANDS.has(text) && !text.startsWith('NAV HOME'));
};

const isNavIndexCommand = (text: string): boolean => {
  const upper = text.trim().toUpperCase();
  return upper === 'NAV HOME' || upper === 'NAV' || upper === 'BACK'
    || upper === 'NAV COMMERCE' || upper === 'NAV CATALOG'
    || upper.startsWith('GUIDE');
};

/** If the reply has no next input window, append Home. Prefer keeping an existing next step over Home when at the 5-message cap. */
export const ensureNextWindowOrHome = (
  ctx: JourneyCtx,
  messages: messagingApi.Message[],
  buildHome: () => messagingApi.Message,
): messagingApi.Message[] => {
  if (!messages.length) return [buildHome()];
  if (messages.some(isHomeFlex)) return messages;
  if (ctx.profile.pendingFlow) return messages;
  if (isNavIndexCommand(ctx.text)) return messages;
  if (hasNextInputWindow(messages)) return messages;
  if (messages.length >= LINE_LIMITS.MAX_MESSAGES_PER_REPLY) return messages;
  return [...messages, buildHome()];
};
