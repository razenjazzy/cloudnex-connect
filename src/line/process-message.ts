import { messagingApi, webhook } from '@line/bot-sdk';
import type { Readable } from 'node:stream';
import { classifyIntent, transcribeAudioToText } from '../services/vertexai';
import { resolveCommandReply, type CommandReplyContext } from './command-router';
import { resolvePostbackToText } from './postback';
import { getEscalationState, getUserLanguage, getUserProfile, setLastChannelId, setUserDisplayName, updateUserScore } from '../services/firestore';
import { ChannelConfig, getAgentName } from './channels';
import type { ChannelContext } from './channels';
import { appLogger } from '../services/logger';
import { withSpan } from '../observability/tracing';
import { createBotTextFlexMessage } from './templates';

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const isProduction = process.env.NODE_ENV === 'production';

const toSafeLogText = (text: string): string => {
  if (!isProduction) return text;
  const compact = text.replace(/\s+/g, ' ').trim();
  const clipped = compact.slice(0, 32);
  return `${clipped}${compact.length > 32 ? '...' : ''}`;
};

const isAiOff = (): boolean => /^(1|true|yes|on)$/i.test(process.env.AI_OFF || '');

type UiLanguage = 'th' | 'en';
const tr = (language: UiLanguage, th: string, en: string): string => (language === 'en' ? en : th);

const REPLY_TOKEN_TTL_MS = 25_000;

export type LineMessageJobInput = {
  channelConfig: ChannelConfig;
  channel: ChannelContext;
  baseUrl: string;
  requestId?: string;
  replyToken: string;
  conversationId: string;
  sourceType?: string;
  text?: string;
  audioMessageId?: string;
  quotedText?: string;
  quotedMessageId?: string;
  imageMessageId?: string;
  fileMessageId?: string;
  fileName?: string;
  videoMessageId?: string;
  receivedAt: number;
  isGroupContext?: boolean;
};

export type ExtractedLineMessageJob = {
  replyToken: string;
  conversationId: string;
  sourceType?: string;
  text?: string;
  audioMessageId?: string;
  quotedText?: string;
  quotedMessageId?: string;
  imageMessageId?: string;
  fileMessageId?: string;
  fileName?: string;
  videoMessageId?: string;
  webhookEventId?: string;
  isGroupContext?: boolean;
};

export const extractLineMessageJobs = (events: webhook.Event[]): ExtractedLineMessageJob[] => {
  const jobs: ExtractedLineMessageJob[] = [];
  const groupRooms = /^(1|true|yes|on)$/i.test(process.env.LINE_GROUP_ROOMS || '');

  for (const event of events) {
    if (event.type === 'postback') {
      const replyToken = (event as { replyToken?: string }).replyToken;
      const source = (event as { source?: { userId?: string; groupId?: string; roomId?: string; type?: string } }).source;
      const conversationId = source?.userId || source?.groupId || source?.roomId;
      const postback = (event as { postback?: { data?: string; params?: { date?: string; datetime?: string } } }).postback;
      const text = resolvePostbackToText(postback?.data || '', postback?.params?.date || postback?.params?.datetime, conversationId);
      if (!replyToken || !conversationId || !text) continue;
      jobs.push({
        replyToken,
        conversationId,
        sourceType: source?.type,
        text,
        webhookEventId: (event as { webhookEventId?: string }).webhookEventId,
        isGroupContext: source?.type === 'group' || source?.type === 'room',
      });
      continue;
    }
    if (event.type !== 'message') continue;
    const replyToken = (event as { replyToken?: string }).replyToken;
    const source = (event as { source?: { userId?: string; groupId?: string; roomId?: string; type?: string } }).source;
    const conversationId = source?.userId || source?.groupId || source?.roomId;
    if (!replyToken || !conversationId) continue;
    const isGroupContext = source?.type === 'group' || source?.type === 'room';
    const message = event.message as {
      type: string;
      id?: string;
      text?: string;
      fileName?: string;
      quotedMessageId?: string;
      quotedMessage?: { text?: string; type?: string };
    };
    const quotedText = typeof message.quotedMessage?.text === 'string' ? message.quotedMessage.text : undefined;
    const quotedMessageId = typeof message.quotedMessageId === 'string' ? message.quotedMessageId : undefined;
    const base = {
      replyToken,
      conversationId,
      sourceType: source?.type,
      webhookEventId: (event as { webhookEventId?: string }).webhookEventId,
      isGroupContext,
      quotedText,
      quotedMessageId,
    };

    if (message.type === 'text' || message.type === 'audio') {
      jobs.push({
        ...base,
        text: message.type === 'text' ? message.text : undefined,
        audioMessageId: message.type === 'audio' ? message.id : undefined,
      });
      continue;
    }
    if (isGroupContext && !groupRooms) continue;
    if (message.type === 'image' && message.id) {
      jobs.push({ ...base, imageMessageId: message.id });
      continue;
    }
    if (message.type === 'video' && message.id) {
      jobs.push({ ...base, videoMessageId: message.id });
      continue;
    }
    if (message.type === 'file' && message.id) {
      jobs.push({ ...base, fileMessageId: message.id, fileName: message.fileName });
    }
  }
  return jobs;
};

const deliverMessages = async (
  client: messagingApi.MessagingApiClient,
  input: LineMessageJobInput,
  messages: messagingApi.Message[],
): Promise<unknown> => {
  const tokenAge = Date.now() - input.receivedAt;
  if (tokenAge < REPLY_TOKEN_TTL_MS) {
    return client.replyMessage({ replyToken: input.replyToken, messages });
  }
  appLogger.warn('line_reply_token_expired_using_push', {
    conversationId: input.conversationId,
    requestId: input.requestId,
    tokenAge,
  });
  return client.pushMessage({ to: input.conversationId, messages });
};

export const processLineMessageJob = async (input: LineMessageJobInput): Promise<unknown> => {
  return withSpan('line.processMessage', { 'line.user_id': input.conversationId, 'http.request_id': input.requestId || '' }, async () => {
    const client = new messagingApi.MessagingApiClient({ channelAccessToken: input.channelConfig.channelAccessToken });
    const [userLanguage, profile] = await Promise.all([
      getUserLanguage(input.conversationId),
      getUserProfile(input.conversationId),
    ]);
    if (!profile.displayName) {
      try {
        const lineProfile = await client.getProfile(input.conversationId);
        if (lineProfile.displayName) {
          await setUserDisplayName(input.conversationId, lineProfile.displayName);
          profile.displayName = lineProfile.displayName;
        }
      } catch (error) {
        appLogger.warn('line_profile_fetch_failed', { error: String(error), requestId: input.requestId });
      }
    }
    if (profile.lastChannelId !== input.channelConfig.channelId) {
      await setLastChannelId(input.conversationId, input.channelConfig.channelId);
    }
    const agentName = getAgentName(userLanguage);

    let inputText = input.text?.trim() || '';
    if (!inputText && input.audioMessageId) {
      try {
        const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: input.channelConfig.channelAccessToken });
        const audioBuffer = await streamToBuffer(await blobClient.getMessageContent(input.audioMessageId));
        inputText = (await transcribeAudioToText(audioBuffer, 'audio/m4a')) || '';
      } catch (err) {
        appLogger.error('voice_transcribe_failed', { error: String(err), requestId: input.requestId });
      }
      if (!inputText) {
        return deliverMessages(client, input, [createBotTextFlexMessage({
          title: agentName,
          body: tr(userLanguage, `${agentName} ไม่สามารถแปลงข้อความเสียงได้`, `${agentName} could not understand that voice message.`),
          language: userLanguage,
          tone: 'warning',
          actions: [{ label: tr(userLanguage, 'หน้าหลัก', 'Home'), text: 'NAV HOME' }],
        })]);
      }
    }

    if (!inputText && (input.imageMessageId || input.fileMessageId || input.videoMessageId)) {
      const { assertInboundMediaAllowed, scanBufferIfRequired } = await import('./media');
      const kind = input.imageMessageId ? 'image' : input.videoMessageId ? 'video' : 'file';
      const allowed = assertInboundMediaAllowed({ fileName: input.fileName });
      if (!allowed.ok) {
        return deliverMessages(client, input, [createBotTextFlexMessage({
          title: agentName,
          body: allowed.error,
          language: userLanguage,
          tone: 'warning',
        })]);
      }
      try {
        const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: input.channelConfig.channelAccessToken });
        const mediaId = input.imageMessageId || input.videoMessageId || input.fileMessageId || '';
        const buffer = await streamToBuffer(await blobClient.getMessageContent(mediaId));
        appLogger.info('line_media_received', { kind, bytes: buffer.length, requestId: input.requestId });
        const sized = assertInboundMediaAllowed({ fileName: input.fileName, sizeBytes: buffer.length });
        if (!sized.ok) {
          return deliverMessages(client, input, [createBotTextFlexMessage({
            title: agentName, body: sized.error, language: userLanguage, tone: 'warning',
          })]);
        }
        const scanned = await scanBufferIfRequired(buffer);
        if (!scanned.ok) {
          return deliverMessages(client, input, [createBotTextFlexMessage({
            title: agentName, body: scanned.error, language: userLanguage, tone: 'warning',
          })]);
        }
        const { signedMediaUrlOrNull } = await import('./media');
        if (!signedMediaUrlOrNull()) {
          return deliverMessages(client, input, [createBotTextFlexMessage({
            title: agentName,
            body: tr(userLanguage, 'รับไฟล์แล้ว แต่ยังไม่ได้เก็บหรือส่งต่อ', 'File received. It was not stored or relayed.'),
            language: userLanguage,
            tone: 'info',
          })]);
        }
      } catch (error) {
        appLogger.warn('line_media_fetch_failed', { error: String(error), requestId: input.requestId });
        return deliverMessages(client, input, [createBotTextFlexMessage({
          title: agentName,
          body: tr(userLanguage, 'รับไฟล์แล้ว แต่ยังส่งต่อไม่ได้', 'File received. It could not be relayed.'),
          language: userLanguage,
          tone: 'warning',
        })]);
      }
    }

    if (!inputText) return null;

    appLogger.info('line_message', {
      source: input.sourceType || 'unknown',
      conversationId: input.conversationId,
      text: toSafeLogText(inputText),
      requestId: input.requestId,
    });

    if (!isAiOff()) {
      classifyIntent(inputText).then((classification) => {
        updateUserScore(input.conversationId, classification.intent).catch(err => {
          appLogger.error('user_score_failed', { error: String(err) });
        });
      }).catch(err => appLogger.error('intent_classification_failed', { error: String(err) }));
    }

    const isEscalated = await getEscalationState(input.conversationId);
    if (isEscalated) {
      return deliverMessages(client, input, [{
        type: 'text',
        text: tr(userLanguage, `ตอนนี้คุณกำลังคุยกับแอดมินแล้วค่ะ - ${agentName}`, `You are currently connected with a human agent - ${agentName}`),
      }]);
    }

    const ctx: CommandReplyContext = {
      text: inputText,
      userId: input.conversationId,
      userLanguage,
      profile,
      agentName,
      baseUrl: input.baseUrl,
      requestId: input.requestId,
      channel: input.channel,
      isGroupContext: input.isGroupContext,
      quotedText: input.quotedText,
      quotedMessageId: input.quotedMessageId,
    };
    const trayGeneration = `${input.receivedAt}:${input.requestId || ''}`;
    ctx.trayGeneration = trayGeneration;
    const { noteTrayGeneration, pushDeferredCommerceCatalog } = await import('./commerce-followup');
    noteTrayGeneration(input.conversationId, trayGeneration);
    const messages = await resolveCommandReply(ctx);
    let delivered: unknown;
    try {
      delivered = await deliverMessages(client, input, messages);
    } catch (error) {
      appLogger.error('line_reply_failed', { error: String(error), requestId: input.requestId });
      const { outcomeFlex } = await import('./outcome-reply');
      const { t } = await import('../services/i18n');
      const fallback = [outcomeFlex({
        language: userLanguage,
        tone: 'warning',
        title: t('replyDeliverFailed', userLanguage),
        body: t('replyDeliverFailedBody', userLanguage),
        actions: [{ label: t('myQuotations', userLanguage), text: 'QUOTE LIST', style: 'primary' }],
      })];
      delivered = await client.pushMessage({ to: input.conversationId, messages: fallback });
    }
    const { applyTrayAfterReply, unlinkUserRichMenu } = await import('./rich-menu');
    const { shouldApplyTrayAfterReply, replyExpectsKeyboard } = await import('./tray-policy');
    const { setLastTerminalAt } = await import('../services/firestore');
    const afterProfile = await getUserProfile(input.conversationId);
    const applyTray = shouldApplyTrayAfterReply({
      isGroupContext: input.isGroupContext,
      pendingFlow: Boolean(afterProfile.pendingFlow),
      expectsKeyboard: replyExpectsKeyboard(messages),
      relayWait: Boolean(afterProfile.relayWaitAt),
    });
    if (!input.isGroupContext && applyTray) {
      applyTrayAfterReply(
        input.conversationId,
        ctx.userLanguage,
        input.channelConfig.channelId,
        ctx.trayHighlight,
        ctx.trayRest,
      );
      await setLastTerminalAt(input.conversationId, new Date().toISOString());
    } else if (!input.isGroupContext && (afterProfile.pendingFlow || replyExpectsKeyboard(messages))) {
      void unlinkUserRichMenu(input.conversationId, input.channelConfig.channelId);
    }
    if (ctx.pendingCatalogPush && !input.isGroupContext) {
      void pushDeferredCommerceCatalog({
        userId: input.conversationId,
        generation: trayGeneration,
        userLanguage: ctx.userLanguage,
        channelId: input.channelConfig.channelId,
      });
    }
    return delivered;
  });
};

export const extractLineLifecycleEvents = (events: webhook.Event[]): Array<{
  type: 'follow' | 'unfollow';
  userId: string;
  replyToken?: string;
}> => {
  const jobs: Array<{ type: 'follow' | 'unfollow'; userId: string; replyToken?: string }> = [];
  for (const event of events) {
    if (event.type !== 'follow' && event.type !== 'unfollow') continue;
    const userId = (event as { source?: { userId?: string } }).source?.userId;
    if (!userId) continue;
    jobs.push({
      type: event.type,
      userId,
      replyToken: (event as { replyToken?: string }).replyToken,
    });
  }
  return jobs;
};

export const processLineLifecycleEvent = async (input: {
  type: 'follow' | 'unfollow';
  userId: string;
  channelId: string;
}): Promise<void> => {
  if (input.type === 'unfollow') {
    const { clearSalesLogin } = await import('../services/sales-session');
    await clearSalesLogin(input.userId);
    return;
  }
  const { deliverPendingQuoteInvites } = await import('./quote-notify');
  await deliverPendingQuoteInvites(input.userId, input.channelId);
};
