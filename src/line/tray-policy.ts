import type { messagingApi } from '@line/bot-sdk';

export const replyExpectsKeyboard = (messages: messagingApi.Message[]): boolean =>
  messages.some(message => Boolean((message as { quickReply?: { items?: unknown[] } }).quickReply?.items?.length));

export const shouldApplyTrayAfterReply = (input: {
  isGroupContext?: boolean;
  pendingFlow?: boolean;
  expectsKeyboard?: boolean;
  relayWait?: boolean;
}): boolean => {
  if (input.isGroupContext) return false;
  if (input.pendingFlow) return false;
  if (input.expectsKeyboard) return false;
  if (input.relayWait) return false;
  return true;
};
