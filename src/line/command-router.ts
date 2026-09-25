/**
 * Command router — single source of truth for LINE command dispatch.
 *
 * Shared by:
 *   - src/line/webhook.ts  (real LINE traffic, per-channel signature validated)
 *   - src/index.ts         (/webhook-test, signature-free dev harness)
 *
 * Architecture (refactored):
 *   The original 637-line if/else chain is replaced by a modular
 *   CommandHandler registry (src/line/handlers/index.ts). Each domain
 *   is a self-contained file. Adding a new command = add one file.
 *
 * Dispatch order:
 *   1. Guided-form intercept  (unchanged)
 *   2. First-contact menu     (unchanged)
 *   3. Service channel gate   (unchanged)
 *   4. Guided FORM * handler  (unchanged)
 *   5. Handler registry       (NEW — replaces the if/else chain)
 *   6. Keyword guidance       (near-miss suggestions)
 *   7. AI chat fallback       (Gemini → ClawBridge → heuristic)
 */

import { messagingApi } from '@line/bot-sdk';
import {
  markConsentNoticeShown,
  markUserFirstContact,
  setUserPendingFlow,
  setLastProductContext,
  getUserProfile,
  UserLanguage,
  UserProfile,
} from '../services/firestore';
import { isServiceConfigured, isServiceEnabledForChannel, isCommandDisabled } from '../services/service-catalog';
import { resolveServiceForCommand } from '../services/service-catalog';
import { FLOW_SPECS, getFlowByStartCommand, nextLinearFieldIndex } from '../services/guided-forms';
import { createBotTextFlexMessage, createFormPromptFlexMessage, createOptionalSummaryFlexMessage, createRequiredResumeFlexMessage, createServiceHomeFlexMessage, createProductCarouselFlexMessage, createIdentityStripFlexMessage } from './templates';
import { getAvailableServices } from '../services/service-catalog';
import { ChannelContext, CUSTOMER_CHANNEL_ID, getBrandTitle } from './channels';
import { trayVariantForCommand } from './rich-menu';
import { clearSalesLogin, hasActiveSalesSession, salesSessionExpired } from '../services/sales-session';
import type { FlowSpec } from '../services/guided-forms';
import { COMMAND_HANDLERS } from './handlers/index';
import { buildKeywordGuidanceMessages } from './handlers/help';
import { handleChatFallback } from './handlers/chat-fallback';
import { checkMessagesAgainstLineLimits } from './message-limits';
import { fitReply } from './outcome-reply';
import { ensureNextWindowOrHome } from './journey-continue';
import { bindPostbackData } from './postback';
import { withSpan } from '../observability/tracing';
import { appLogger } from '../services/logger';
import { applyChannelPersona, isQuoteStaff, selfQuoteIdentity, customerQuoteFormStepCount, customerQuoteSkipsOptionalSummary } from './quote-access';
import { evaluateCommandGrid, isGuestAllowedCommand, matchCommandGrid } from './command-grid';
import { loadCommandOverlay } from './command-overlay';
import { getErpAdapter } from '../erp/registry';
import { guidedFormTtlMinutes, shouldIdleHome } from './idle-home';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandReplyContext = {
  text: string;
  userId: string;
  userLanguage: UserLanguage;
  profile: UserProfile;
  agentName: string;
  baseUrl: string;
  requestId?: string;
  channel?: ChannelContext;
  isGroupContext?: boolean;
  /** Set only after ACTION VERIFY so the original CUD can run once. */
  actionOtpReplay?: boolean;
  /** Set by Language/Verify success handlers; linked after LINE reply so tap can show dark teal first. */
  trayRest?: { language: UserLanguage; salesSessionActive: boolean };
  /** Native tray cell to highlight after the LINE reply is sent — never block the reply on this. */
  trayHighlight?: import('./rich-menu').RichMenuVariant;
  /** Push Odoo product carousel after reply when the catalog cache was cold. */
  pendingCatalogPush?: boolean;
  trayGeneration?: string;
  /** Internal: staff Home re-enters QUOTE LIST without looping on idle-home. */
  /** LINE quotedMessage text when the user swipe-replied. */
  quotedText?: string;
  quotedMessageId?: string;
  skipIdleHome?: boolean;
};

// ---------------------------------------------------------------------------
// Shared helpers (used by handler modules via import)
// ---------------------------------------------------------------------------

const tr = (language: UserLanguage, th: string, en: string): string => (language === 'en' ? en : th);

const inferTone = (value: string): 'info' | 'success' | 'warning' | 'error' => {
  const lower = value.toLowerCase();
  if (/failed|fail|error|unauthorized|invalid|not found|ไม่สำเร็จ|ไม่พบ|ล้มเหลว|ไม่ได้|ผิด/.test(lower)) return 'error';
  if (/warning|notice|รอสักครู่|กำลัง|ตรวจสอบ/.test(lower)) return 'warning';
  if (/success|created|updated|deleted|enabled|disabled|complete|สำเร็จ|เรียบร้อย|แล้ว/.test(lower)) return 'success';
  return 'info';
};

export const text = (
  value: string,
  language: UserLanguage = 'en',
  title?: string,
  actions?: { label: string; text: string; style?: 'primary' | 'secondary' }[],
): messagingApi.Message =>
  createBotTextFlexMessage({
    title: title || getBrandTitle(language),
    body: value,
    language,
    tone: inferTone(value),
    actions,
  });

export const buildHomeMenuMessage = (
  language: UserLanguage,
  agentName: string,
  channel: ChannelContext | undefined,
  isAdmin: boolean,
  salesSessionActive = false,
  identity?: { name?: string; phone?: string },
  isStaff = isAdmin,
): messagingApi.Message => {
  const availableServices = getAvailableServices(channel, isAdmin, isStaff);
  const menuItems = [
    ...(!salesSessionActive && !identity ? [{ key: 'VERIFY', label: tr(language, 'ยืนยันตัวตน', 'Verify account') }] : []),
    ...availableServices.map(svc => ({ key: svc.key, label: language === 'en' ? svc.labelEn : svc.labelTh })),
  ];
  return createServiceHomeFlexMessage(menuItems, language, agentName, salesSessionActive, identity);
};

export const homeMenuFromContext = (ctx: Pick<CommandReplyContext, 'userLanguage' | 'agentName' | 'channel' | 'profile'>): messagingApi.Message => {
  const profile = applyChannelPersona(ctx.profile, ctx.channel?.channelId);
  const staff = isQuoteStaff(profile);
  if (ctx.channel?.channelId === CUSTOMER_CHANNEL_ID) {
    const cached = getErpAdapter().peekCachedProducts?.(10) || [];
    if (cached.length) return createProductCarouselFlexMessage(cached, ctx.userLanguage);
  }
  const identity = !staff && profile.odooVerified && (profile.displayName || profile.phone)
    ? { name: profile.displayName, phone: profile.phone }
    : undefined;
  return buildHomeMenuMessage(
    ctx.userLanguage,
    ctx.agentName,
    ctx.channel,
    profile.role === 'admin',
    hasActiveSalesSession(profile) || profile.odooVerified,
    identity,
    staff,
  );
};

export const homeReplyFromContext = async (ctx: CommandReplyContext): Promise<messagingApi.Message[]> => {
  if (ctx.channel?.channelId === CUSTOMER_CHANNEL_ID) {
    const { commerceFollowUpMessages } = await import('./commerce-followup');
    const follow = await commerceFollowUpMessages(ctx, 2, { deferCatalogMiss: true });
    const profile = applyChannelPersona(ctx.profile, ctx.channel.channelId);
    const staff = isQuoteStaff(profile);
    const identity = !staff && profile.odooVerified && (profile.displayName || profile.phone)
      ? { name: profile.displayName, phone: profile.phone }
      : undefined;
    const prefix = identity ? [createIdentityStripFlexMessage(identity, ctx.userLanguage)] : [];
    const messages = [...prefix, ...follow];
    if (messages.length) return messages.slice(0, 5);
  }
  const persona = applyChannelPersona(ctx.profile, ctx.channel?.channelId);
  if (isQuoteStaff(persona)) {
    return resolveCommandReply({ ...ctx, profile: persona, text: 'QUOTE LIST', skipIdleHome: true });
  }
  return [homeMenuFromContext(ctx)];
};

// ---------------------------------------------------------------------------
// Guided form helpers
// ---------------------------------------------------------------------------

const buildFlowExpiry = (): string => new Date(Date.now() + guidedFormTtlMinutes() * 60 * 1000).toISOString();

const buildFormPromptMessage = async (
  language: UserLanguage,
  agentName: string,
  flowSpec: FlowSpec,
  stepIndex: number,
  userId: string,
  promptOverride?: string,
  contextNote?: string,
  collected: Record<string, string> = {},
  profile: UserProfile = { language, role: 'user', odooVerified: false, marketingOptIn: false },
): Promise<messagingApi.Message> => {
  const field = flowSpec.fields[stepIndex];
  const options = field.loadOptions
    ? await field.loadOptions(collected).catch(err => { console.warn('buildFormPromptMessage: loadOptions failed (non-fatal):', err); return []; })
    : undefined;
  const savedPhoneNote = field.key === 'phone' && options?.[0]
    ? tr(language,
      `เบอร์ที่บันทึกไว้: ${options[0]}`,
      `Saved on file: ${options[0]}`,
    )
    : undefined;
  return createFormPromptFlexMessage({
    title: tr(language, `${agentName} ${flowSpec.labelTh}`, `${agentName} ${flowSpec.labelEn}`),
    prompt: promptOverride || tr(language, field.promptTh, field.promptEn),
    stepIndex,
    totalSteps: customerQuoteFormStepCount(flowSpec.key, flowSpec.fields.length, profile),
    language,
    optional: field.optional,
    options,
    contextNote: contextNote || savedPhoneNote,
    datePickerData: field.widget === 'date' ? bindPostbackData(`form.date.${field.key}`, userId) : undefined,
  });
};

/**
 * Runs once, the moment a flow first enters summary mode — fills in any
 * field from FlowSpec.optionalSummaryStartIndex onward that declares a
 * defaultValue and hasn't already been answered (e.g. typed during the
 * flow's earlier linear phase, before summary mode existed for this
 * field range). Never overwrites a value the user already provided.
 */
const applyFieldDefaults = async (flowSpec: FlowSpec, collected: Record<string, string>): Promise<Record<string, string>> => {
  const startIndex = flowSpec.optionalSummaryStartIndex ?? flowSpec.fields.length;
  const withDefaults = { ...collected };
  for (const field of flowSpec.fields.slice(startIndex)) {
    if (withDefaults[field.key]) continue;
    if (field.defaultValue) {
      withDefaults[field.key] = field.defaultValue();
      continue;
    }
    if (field.loadDefault) {
      const loaded = await field.loadDefault().catch(err => {
        console.warn('applyFieldDefaults: loadDefault failed (non-fatal):', err);
        return undefined;
      });
      if (loaded) withDefaults[field.key] = loaded;
    }
  }
  return withDefaults;
};

const skipSelfQuoteIdentityIndex = (flowSpec: FlowSpec, index: number, profile: UserProfile): number => {
  if (flowSpec.key !== 'QUOTE_CREATE' || isQuoteStaff(profile)) return index;
  let i = index;
  while (i < flowSpec.fields.length) {
    const key = flowSpec.fields[i].key;
    if (key !== 'customerName' && key !== 'phone') break;
    i += 1;
  }
  return i;
};

const quoteRequiredEndIndex = (flowSpec: FlowSpec): number =>
  flowSpec.optionalSummaryStartIndex ?? flowSpec.fields.length;

const hasForwardRequiredPrefill = (flowSpec: FlowSpec, collected: Record<string, string>, fromIndex: number): boolean => {
  if (flowSpec.key !== 'QUOTE_CREATE') return false;
  const stop = quoteRequiredEndIndex(flowSpec);
  for (let i = fromIndex; i < stop; i += 1) {
    if (collected[flowSpec.fields[i].key]?.trim()) return true;
  }
  return false;
};

const firstUnfilledRequiredIndex = (flowSpec: FlowSpec, collected: Record<string, string>): number => {
  const stop = quoteRequiredEndIndex(flowSpec);
  for (let i = 0; i < stop; i += 1) {
    if (flowSpec.fields[i].skipWhen?.(collected)) continue;
    if (!collected[flowSpec.fields[i].key]?.trim()) return i;
  }
  return stop;
};

const buildRequiredResumeMessage = (
  language: UserLanguage,
  agentName: string,
  flowSpec: FlowSpec,
  collected: Record<string, string>,
): messagingApi.Message => {
  const stop = quoteRequiredEndIndex(flowSpec);
  const fields = flowSpec.fields.slice(0, stop).map((field, index) => ({
    index,
    label: tr(language, field.summaryLabelTh || field.promptTh, field.summaryLabelEn || field.promptEn),
    value: collected[field.key] || undefined,
  }));
  return createRequiredResumeFlexMessage({
    title: tr(language, `${agentName} ${flowSpec.labelTh}`, `${agentName} ${flowSpec.labelEn}`),
    fields,
    language,
    continueLabel: tr(language, 'ทำต่อ', 'Continue'),
  });
};

const buildOptionalSummaryMessage = (
  language: UserLanguage,
  agentName: string,
  flowSpec: FlowSpec,
  collected: Record<string, string>,
): messagingApi.Message => {
  const startIndex = flowSpec.optionalSummaryStartIndex ?? flowSpec.fields.length;
  const fields = flowSpec.fields.slice(startIndex).map((field, offset) => ({
    index: startIndex + offset,
    label: tr(language, field.summaryLabelTh || field.promptTh, field.summaryLabelEn || field.promptEn),
    value: collected[field.key] || undefined,
  }));
  return createOptionalSummaryFlexMessage({
    title: tr(language, `${agentName} ${flowSpec.labelTh}`, `${agentName} ${flowSpec.labelEn}`),
    fields,
    language,
    finalizeLabel: tr(language, 'สร้างเลย', 'Create now'),
  });
};

// ---------------------------------------------------------------------------
// Guided form step handler
// ---------------------------------------------------------------------------

const handleGuidedFormStep = async (ctx: CommandReplyContext): Promise<messagingApi.Message[]> => {
  const { profile, userId, userLanguage, agentName } = ctx;
  const trimmed = ctx.text.trim();
  const upperText = trimmed.toUpperCase();
  const pendingRaw = profile.pendingFlow!;

  const flowSpec = FLOW_SPECS[pendingRaw.flow as keyof typeof FLOW_SPECS];

  if (!flowSpec) {
    await setUserPendingFlow(userId, null);
    return [];
  }

  // Firestore merge used to keep summaryMode from a previous quote while
  // stepIndex reset to 0 — the first product answer then re-showed optionals.
  const staleSummary = Boolean(
    pendingRaw.summaryMode
    && (flowSpec.optionalSummaryStartIndex === undefined
      || pendingRaw.stepIndex < flowSpec.optionalSummaryStartIndex),
  );
  const pending = staleSummary ? { ...pendingRaw, summaryMode: undefined } : pendingRaw;

  if (upperText === 'CANCEL' || upperText === 'BACK' || upperText === 'NAV HOME' || upperText === 'NAV') {
    await setUserPendingFlow(userId, null);
    return [
      text(tr(userLanguage, `${agentName} ยกเลิกแบบฟอร์มแล้ว`, `${agentName} form cancelled.`)),
      homeMenuFromContext(ctx),
    ];
  }

  const openStaffResume = async (collected: Record<string, string>, stepIndex: number): Promise<messagingApi.Message[]> => {
    await setUserPendingFlow(userId, {
      flow: flowSpec.key,
      stepIndex,
      collected,
      expiresAt: buildFlowExpiry(),
      resumeMode: true,
    });
    return [buildRequiredResumeMessage(userLanguage, agentName, flowSpec, collected)];
  };

  const continueStaffResume = async (collected: Record<string, string>): Promise<messagingApi.Message[]> => {
    const nextIndex = skipSelfQuoteIdentityIndex(flowSpec, firstUnfilledRequiredIndex(flowSpec, collected), profile);
    if (flowSpec.optionalSummaryStartIndex !== undefined && nextIndex >= flowSpec.optionalSummaryStartIndex) {
      const collectedWithDefaults = await applyFieldDefaults(flowSpec, collected);
      if (customerQuoteSkipsOptionalSummary(flowSpec.key, profile)) {
        await setUserPendingFlow(userId, null);
        const finalCommandText = flowSpec.buildFinalCommand(collectedWithDefaults);
        return resolveCommandReply({ ...ctx, text: finalCommandText, profile: { ...profile, pendingFlow: undefined } });
      }
      await setUserPendingFlow(userId, {
        flow: flowSpec.key,
        stepIndex: nextIndex,
        collected: collectedWithDefaults,
        expiresAt: buildFlowExpiry(),
        summaryMode: true,
      });
      return [buildOptionalSummaryMessage(userLanguage, agentName, flowSpec, collectedWithDefaults)];
    }
    await setUserPendingFlow(userId, {
      flow: flowSpec.key,
      stepIndex: nextIndex,
      collected,
      expiresAt: buildFlowExpiry(),
    });
    return [await buildFormPromptMessage(userLanguage, agentName, flowSpec, nextIndex, userId, undefined, undefined, collected, profile)];
  };

  // --- Required-fields resume (staff QUOTE_CREATE prefill) ---
  if (pending.resumeMode && isQuoteStaff(profile) && flowSpec.key === 'QUOTE_CREATE') {
    if (upperText === 'FORM CHANGE') {
      await setUserPendingFlow(userId, null);
      return resolveCommandReply({ ...ctx, text: 'FORM QUOTE CREATE', profile: { ...profile, pendingFlow: undefined } });
    }

    if (upperText === 'FORM CONTINUE') {
      return continueStaffResume(pending.collected);
    }

    const fieldMatch = pending.editingFieldIndex === undefined ? upperText.match(/^FORM FIELD (\d+)$/) : null;
    if (fieldMatch) {
      const idx = Number(fieldMatch[1]);
      if (flowSpec.fields[idx] && idx < quoteRequiredEndIndex(flowSpec)) {
        await setUserPendingFlow(userId, { ...pending, editingFieldIndex: idx, resumeMode: true, expiresAt: buildFlowExpiry() });
        return [await buildFormPromptMessage(userLanguage, agentName, flowSpec, idx, userId, undefined, undefined, pending.collected, profile)];
      }
    }

    if (pending.editingFieldIndex !== undefined) {
      const field = flowSpec.fields[pending.editingFieldIndex];
      const isSkip = Boolean(field.optional) && upperText === 'SKIP';
      const value = isSkip ? '' : trimmed;
      if (!isSkip && !field.validate(value)) {
        return [await buildFormPromptMessage(
          userLanguage, agentName, flowSpec, pending.editingFieldIndex, userId,
          tr(userLanguage,
            `ค่าที่กรอกไม่ถูกต้อง กรุณาลองใหม่\n${field.promptTh}`,
            `That doesn't look right, please try again.\n${field.promptEn}`,
          ),
          undefined,
          pending.collected,
          profile,
        )];
      }
      const collected = { ...pending.collected, [field.key]: value };
      const { editingFieldIndex: _cleared, ...rest } = pending;
      await setUserPendingFlow(userId, { ...rest, collected, resumeMode: true, expiresAt: buildFlowExpiry() });
      return [buildRequiredResumeMessage(userLanguage, agentName, flowSpec, collected)];
    }

    if (upperText === 'FORM FINALIZE') {
      return continueStaffResume(pending.collected);
    }
    return [buildRequiredResumeMessage(userLanguage, agentName, flowSpec, pending.collected)];
  }

  // --- Grouped optional-fields summary mode ---
  if (pending.summaryMode) {
    if (upperText === 'FORM FINALIZE') {
      await setUserPendingFlow(userId, null);
      const finalCommandText = flowSpec.buildFinalCommand(pending.collected);
      return resolveCommandReply({ ...ctx, text: finalCommandText, profile: { ...profile, pendingFlow: undefined } });
    }

    const fieldMatch = pending.editingFieldIndex === undefined ? upperText.match(/^FORM FIELD (\d+)$/) : null;
    if (fieldMatch) {
      const idx = Number(fieldMatch[1]);
      if (flowSpec.fields[idx]) {
        await setUserPendingFlow(userId, { ...pending, editingFieldIndex: idx, expiresAt: buildFlowExpiry() });
        return [await buildFormPromptMessage(userLanguage, agentName, flowSpec, idx, userId, undefined, undefined, pending.collected, profile)];
      }
    }

    if (pending.editingFieldIndex !== undefined) {
      const field = flowSpec.fields[pending.editingFieldIndex];
      const isSkip = Boolean(field.optional) && upperText === 'SKIP';
      const value = isSkip ? '' : trimmed;

      if (!isSkip && !field.validate(value)) {
        return [await buildFormPromptMessage(
          userLanguage, agentName, flowSpec, pending.editingFieldIndex, userId,
          tr(userLanguage,
            `ค่าที่กรอกไม่ถูกต้อง กรุณาลองใหม่\n${field.promptTh}`,
            `That doesn't look right, please try again.\n${field.promptEn}`,
          ),
          undefined,
          pending.collected,
          profile,
        )];
      }

      const collected = { ...pending.collected, [field.key]: value };
      // Omit editingFieldIndex entirely rather than setting it to
      // `undefined` — the Firestore SDK rejects any document field whose
      // value is `undefined` outright (throws, not a no-op), which was
      // silently failing this exact write and rolling the cache back to
      // the pre-edit state, discarding whatever the user just answered.
      const { editingFieldIndex: _clearedFieldIndex, ...pendingWithoutEditingField } = pending;
      await setUserPendingFlow(userId, { ...pendingWithoutEditingField, collected, expiresAt: buildFlowExpiry() });
      return [buildOptionalSummaryMessage(userLanguage, agentName, flowSpec, collected)];
    }

    // Idling at the summary card with unrecognized input — re-show it
    // rather than treating stray text as an error.
    return [buildOptionalSummaryMessage(userLanguage, agentName, flowSpec, pending.collected)];
  }

  // --- Linear one-field-at-a-time mode (existing behavior) ---
  const field = flowSpec.fields[pending.stepIndex];
  const isSkip = Boolean(field.optional) && upperText === 'SKIP';
  const value = isSkip ? '' : trimmed;

  if (!isSkip && !field.validate(value)) {
    return [await buildFormPromptMessage(
      userLanguage, agentName, flowSpec, pending.stepIndex, userId,
      tr(userLanguage,
        `ค่าที่กรอกไม่ถูกต้อง กรุณาลองใหม่\n${field.promptTh}`,
        `That doesn't look right, please try again.\n${field.promptEn}`,
      ),
      undefined,
      pending.collected,
      profile,
    )];
  }

  const collected = { ...pending.collected, [field.key]: value };
  if (isQuoteStaff(profile) && hasForwardRequiredPrefill(flowSpec, collected, pending.stepIndex + 1)) {
    return openStaffResume(collected, pending.stepIndex);
  }

  const nextIndex = skipSelfQuoteIdentityIndex(
    flowSpec,
    nextLinearFieldIndex(flowSpec, collected, pending.stepIndex + 1),
    profile,
  );

  if (flowSpec.optionalSummaryStartIndex !== undefined && nextIndex >= flowSpec.optionalSummaryStartIndex) {
    const collectedWithDefaults = await applyFieldDefaults(flowSpec, collected);
    if (customerQuoteSkipsOptionalSummary(flowSpec.key, profile)) {
      await setUserPendingFlow(userId, null);
      const finalCommandText = flowSpec.buildFinalCommand(collectedWithDefaults);
      return resolveCommandReply({ ...ctx, text: finalCommandText, profile: { ...profile, pendingFlow: undefined } });
    }
    await setUserPendingFlow(userId, {
      flow: flowSpec.key,
      stepIndex: nextIndex,
      collected: collectedWithDefaults,
      expiresAt: buildFlowExpiry(),
      summaryMode: true,
    });
    return [buildOptionalSummaryMessage(userLanguage, agentName, flowSpec, collectedWithDefaults)];
  }

  if (nextIndex >= flowSpec.fields.length) {
    await setUserPendingFlow(userId, null);
    const finalCommandText = flowSpec.buildFinalCommand(collected);
    return resolveCommandReply({ ...ctx, text: finalCommandText, profile: { ...profile, pendingFlow: undefined } });
  }

  await setUserPendingFlow(userId, {
    flow: flowSpec.key,
    stepIndex: nextIndex,
    collected,
    expiresAt: buildFlowExpiry(),
  });
  return [await buildFormPromptMessage(userLanguage, agentName, flowSpec, nextIndex, userId, undefined, undefined, collected, profile)];
};

// ---------------------------------------------------------------------------
// FORM * handler
// ---------------------------------------------------------------------------

const handleFormCommand = async (ctx: CommandReplyContext): Promise<messagingApi.Message[] | null> => {
  const { profile, userId, userLanguage, agentName } = ctx;
  const upperText = ctx.text.trim().toUpperCase();

  if (!upperText.startsWith('FORM ')) return null;

  if (upperText === 'FORM CHANGE') {
    await setUserPendingFlow(userId, null);
    return handleFormCommand({ ...ctx, text: 'FORM QUOTE CREATE', profile: { ...profile, pendingFlow: undefined } });
  }

  if (/^FORM FIELD \d+$/.test(upperText) || upperText === 'FORM CONTINUE') {
    return [text(tr(userLanguage,
      `${agentName} ฟิลด์นี้ไม่ได้เปิดอยู่ กรุณาเริ่มสร้างใบเสนอราคาใหม่`,
      `${agentName} that field is no longer open. Start Create a quote again.`,
    ), userLanguage)];
  }

  if (upperText === 'FORM VERIFY') {
    const { resolveVerifyMenuMessages } = await import('./verify-menu');
    return resolveVerifyMenuMessages(ctx);
  }

  if (upperText === 'FORM VERIFY MANUAL') {
    const flowSpec = FLOW_SPECS.VERIFY;
    const formCollected: Record<string, string> = {
      ...(profile.phone ? { savedPhone: profile.phone } : {}),
      ...(profile.displayName ? { displayName: profile.displayName } : {}),
    };
    await setUserPendingFlow(userId, {
      flow: flowSpec.key,
      stepIndex: 0,
      collected: formCollected,
      expiresAt: buildFlowExpiry(),
    });
    return [await buildFormPromptMessage(userLanguage, agentName, flowSpec, 0, userId, undefined, undefined, formCollected, profile)];
  }

  const messageReq = /^FORM MESSAGE REQUEST(?:\s+(\d+))?$/i.exec(ctx.text.trim());
  if (messageReq) {
    const cardProductId = messageReq[1] ? Number(messageReq[1]) : undefined;
    if (cardProductId && Number.isFinite(cardProductId)) {
      const found = await getErpAdapter().lookupProduct(cardProductId);
      if (found) {
        await setLastProductContext(userId, {
          productId: found.id,
          productName: found.name,
          expiresAt: new Date(Date.now() + (profile.odooVerified ? 10 : 120) * 60 * 1000).toISOString(),
        });
      }
    }
    if (!profile.odooVerified) {
      return [text(tr(userLanguage,
        `${agentName} ยืนยันตัวตนก่อนส่งข้อความถึงฝ่ายขาย`,
        `${agentName} verify your account before messaging sales.`,
      ), userLanguage, undefined, [
        { label: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
      ])];
    }
    const flowSpec = FLOW_SPECS.MESSAGE_REQUEST;
    const product = (await getUserProfile(userId)).lastProductContext;
    const formCollected: Record<string, string> = {
      ...(product?.productId ? { productId: String(product.productId) } : {}),
      ...(product?.productName ? { productName: product.productName } : {}),
    };
    await setUserPendingFlow(userId, {
      flow: flowSpec.key,
      stepIndex: 0,
      collected: formCollected,
      expiresAt: buildFlowExpiry(),
    });
    return [await buildFormPromptMessage(userLanguage, agentName, flowSpec, 0, userId, undefined, product?.productName
      ? tr(userLanguage, `สินค้า: ${product.productName}`, `Product: ${product.productName}`)
      : undefined, formCollected, profile)];
  }

  const addMore = /^FORM QUOTE ADD(?:\s+(\d+))?$/i.exec(ctx.text.trim());
  if (addMore) {
    if (ctx.isGroupContext) {
      return [text(tr(userLanguage,
        `${agentName} แบบฟอร์มทีละขั้นใช้ไม่ได้ในแชทกลุ่ม`,
        `${agentName} step-by-step forms aren't available in group chats.`,
      ), userLanguage)];
    }
    const orderId = addMore[1];
    if (!orderId) {
      return [text(tr(userLanguage,
        `${agentName} เปิดใบเสนอราคาก่อน แล้วแตะ Add More`,
        `${agentName} open a quote first, then tap Add More.`,
      ), userLanguage)];
    }
    const flowSpec = FLOW_SPECS.QUOTE_ADD;
    const formCollected = { orderId };
    await setUserPendingFlow(userId, {
      flow: flowSpec.key,
      stepIndex: 0,
      collected: formCollected,
      expiresAt: buildFlowExpiry(),
    });
    return [await buildFormPromptMessage(userLanguage, agentName, flowSpec, 0, userId, undefined, undefined, formCollected, profile)];
  }

  const fromCard = /^FORM QUOTE CREATE FROM CARD(?:\s+(\d+))?$/i.exec(ctx.text.trim());
  if (fromCard) {
    const cardProductId = fromCard[1] ? Number(fromCard[1]) : undefined;
    let product = profile.lastProductContext;
    const ttlMs = profile.odooVerified ? 10 * 60 * 1000 : 2 * 60 * 60 * 1000;
    if (cardProductId && Number.isFinite(cardProductId)) {
      const erp = getErpAdapter();
      const found = await erp.lookupProduct(cardProductId)
        || await erp.lookupService(String(cardProductId));
      if (found) {
        product = {
          productId: found.id,
          productName: found.name,
          expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        };
        await setLastProductContext(userId, product);
      }
    }
    if (!profile.odooVerified) {
      const using = product?.productName
        ? tr(userLanguage, `ใช้สินค้า: ${product.productName}\n`, `Using: ${product.productName}\n`)
        : '';
      return [text(tr(userLanguage,
        `${using}${agentName} กรุณายืนยันด้วยเบอร์ในบัญชีผู้ใช้ Odoo ก่อนสร้างใบเสนอราคา`,
        `${using}${agentName} verify with the phone on your Odoo user account before creating a quote.`,
      ), userLanguage, undefined, [
        { label: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
      ])];
    }
    const flowSpec = FLOW_SPECS.QUOTE_CREATE;
    if (!product?.productName) {
      return handleFormCommand({ ...ctx, text: 'FORM QUOTE CREATE' });
    }
    if (flowSpec.requiresAdmin && profile.role !== 'admin') {
      return [text(tr(userLanguage, 'คำสั่งนี้สำหรับแอดมินเท่านั้น', 'This command is admin-only.'), userLanguage)];
    }
    if (!isQuoteStaff(profile) && !profile.odooPartnerId) {
      return handleFormCommand({ ...ctx, text: 'FORM QUOTE CREATE' });
    }
    if (ctx.isGroupContext) {
      return [text(tr(userLanguage,
        `${agentName} แบบฟอร์มทีละขั้นใช้ไม่ได้ในแชทกลุ่ม กรุณาใช้คำสั่งบรรทัดเดียวแทน`,
        `${agentName} step-by-step forms aren't available in group chats.`,
      ), userLanguage)];
    }
    const qtyIndex = Math.max(flowSpec.fields.findIndex(field => field.key === 'qty'), 1);
    const identity = isQuoteStaff(profile) ? {} : selfQuoteIdentity(profile);
    const seeded = { productName: product.productName, productId: String(product.productId), ...identity };
    if (isQuoteStaff(profile) && hasForwardRequiredPrefill(flowSpec, seeded, qtyIndex)) {
      await setUserPendingFlow(userId, {
        flow: flowSpec.key,
        stepIndex: qtyIndex,
        collected: seeded,
        expiresAt: buildFlowExpiry(),
        resumeMode: true,
      });
      return [buildRequiredResumeMessage(userLanguage, agentName, flowSpec, seeded)];
    }
    await setUserPendingFlow(userId, {
      flow: flowSpec.key,
      stepIndex: qtyIndex,
      collected: seeded,
      expiresAt: buildFlowExpiry(),
    });
    return [await buildFormPromptMessage(
      userLanguage,
      agentName,
      flowSpec,
      qtyIndex,
      userId,
      undefined,
      tr(userLanguage, `ใช้สินค้า: ${product.productName}`, `Using: ${product.productName}`),
      { productName: product.productName, productId: String(product.productId), ...identity },
      profile,
    )];
  }

  const flowSpec = getFlowByStartCommand(upperText);
  if (!flowSpec) {
    return [text(tr(userLanguage, `${agentName} ไม่พบแบบฟอร์มนี้`, `${agentName} form not found.`), userLanguage)];
  }

  if (flowSpec.requiresAdmin && profile.role !== 'admin') {
    return [text(tr(userLanguage, 'คำสั่งนี้สำหรับแอดมินเท่านั้น', 'This command is admin-only.'), userLanguage)];
  }

  if (ctx.isGroupContext) {
    return [text(tr(userLanguage,
      `${agentName} แบบฟอร์มทีละขั้นใช้ไม่ได้ในแชทกลุ่ม กรุณาใช้คำสั่งบรรทัดเดียวแทน เช่น: ${flowSpec.startCommand.replace('FORM ', '')} ...`,
      `${agentName} step-by-step forms aren't available in group chats. Please use the single-line command instead, e.g.: ${flowSpec.startCommand.replace('FORM ', '')} ...`,
    ), userLanguage)];
  }

  if (flowSpec.key === 'ORDER_STATUS' && !isQuoteStaff(profile)) {
    if (!profile.odooVerified) {
      return [text(tr(userLanguage,
        `${agentName} ยืนยันตัวตนก่อนดูสถานะออเดอร์ของคุณ`,
        `${agentName} verify your account to see your order status.`,
      ), userLanguage, undefined, [
        { label: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
      ])];
    }
    return resolveCommandReply({ ...ctx, text: 'QUOTE LIST' });
  }

  if (flowSpec.key === 'PRODUCT_FIND' && !isQuoteStaff(profile)) {
    return resolveCommandReply({ ...ctx, text: 'PRODUCT FIND' });
  }

  if (flowSpec.key === 'QUOTE_CREATE' && !isQuoteStaff(profile)) {
    if (!profile.odooPartnerId) {
      return [text(tr(userLanguage,
        `${agentName} กรุณายืนยันตัวตนก่อนสร้างใบเสนอราคา`,
        `${agentName} verify your account before creating a quote.`,
      ), userLanguage, undefined, [
        { label: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
      ])];
    }
  }

  const formCollected: Record<string, string> = {
    ...(flowSpec.key === 'QUOTE_CREATE' && !isQuoteStaff(profile) ? selfQuoteIdentity(profile) : {}),
    ...(flowSpec.key !== 'VERIFY' || ctx.channel?.channelId !== CUSTOMER_CHANNEL_ID
      ? {
        ...(profile.phone ? { savedPhone: profile.phone } : {}),
        ...(profile.displayName ? { displayName: profile.displayName } : {}),
      }
      : {}),
  };
  await setUserPendingFlow(userId, {
    flow: flowSpec.key,
    stepIndex: 0,
    collected: formCollected,
    expiresAt: buildFlowExpiry(),
  });
  const prompt = await buildFormPromptMessage(userLanguage, agentName, flowSpec, 0, userId, undefined, undefined, formCollected, profile);
  if (flowSpec.key === 'VERIFY' && profile.odooVerified) {
    return [
      text(tr(userLanguage,
        `${agentName} คุณยืนยันตัวตนแล้ว หากยืนยันอีกครั้ง ระบบจะยกเลิกเซสชันเดิมแล้วเริ่มใหม่`,
        `${agentName} you are already verified. Verify again to replace the previous session and start over.`,
      ), userLanguage),
      prompt,
    ];
  }
  return [prompt];
};

export const resumeQuoteFromLastProduct = async (ctx: CommandReplyContext): Promise<messagingApi.Message[] | null> => {
  const profile = await getUserProfile(ctx.userId);
  const product = profile.lastProductContext;
  if (!profile.odooVerified || !product?.productName) return null;
  if (product.expiresAt && Date.parse(product.expiresAt) <= Date.now()) return null;
  const command = product.productId
    ? `FORM QUOTE CREATE FROM CARD ${product.productId}`
    : 'FORM QUOTE CREATE FROM CARD';
  return handleFormCommand({ ...ctx, profile: { ...profile, odooVerified: true }, text: command });
};

// ---------------------------------------------------------------------------
// Main dispatch — resolveCommandReply
// ---------------------------------------------------------------------------

export { isGuestAllowedCommand } from './command-grid';

const dispatchCommandReply = async (ctx: CommandReplyContext): Promise<messagingApi.Message[]> => {
  const { userId, userLanguage, agentName } = ctx;
  if (salesSessionExpired(ctx.profile)) {
    await clearSalesLogin(userId);
    ctx.profile = { ...ctx.profile, odooVerified: false, salesSessionExpiresAt: undefined };
  }
  ctx.profile = applyChannelPersona(ctx.profile, ctx.channel?.channelId);
  const { profile } = ctx;
  const trimmed = ctx.text.trim();
  const upperText = trimmed.toUpperCase();
  const sessionOn = hasActiveSalesSession(profile);
  const trayVariant = trayVariantForCommand(trimmed);
  if (trayVariant && !ctx.isGroupContext) {
    ctx.trayHighlight = trayVariant;
    ctx.trayRest = ctx.trayRest || { language: userLanguage, salesSessionActive: sessionOn };
  }

  // Step 1: Guided form intercept
  if (profile.pendingFlow) {
    if (!profile.odooVerified && profile.pendingFlow.flow !== 'VERIFY' && profile.pendingFlow.flow !== 'PRODUCT_FIND' && profile.pendingFlow.flow !== 'CUSTOMER_REGISTER') {
      await setUserPendingFlow(userId, null);
    } else {
      const result = await handleGuidedFormStep(ctx);
      if (result.length > 0) return result;
    }
  }

  if (!ctx.skipIdleHome && !ctx.isGroupContext && shouldIdleHome(profile) && upperText !== 'NAV HOME' && upperText !== 'NAV' && upperText !== 'BACK') {
    return homeReplyFromContext(ctx);
  }

  // Step 2: First-contact → PDPA data-collection notice (once, informational —
  // does not block any feature) + show home menu immediately
  if (!profile.firstMessageAt && !ctx.isGroupContext) {
    await markUserFirstContact(userId);
    await markConsentNoticeShown(userId);
    return [
      text(tr(userLanguage,
        `ก่อนเริ่มใช้งาน ${agentName} ขอเก็บข้อมูลที่คุณให้ไว้ (เช่น เบอร์โทร ชื่อ) เพื่อยืนยันตัวตนและให้บริการเท่านั้น`,
        `Before we begin: ${agentName} stores what you share (like your phone number and name) only to verify your identity and provide service.`,
      ), userLanguage, undefined, [
        { label: tr(userLanguage, 'ข้อมูลของฉัน', 'My data'), text: 'MY DATA', style: 'primary' },
        { label: tr(userLanguage, 'ลบข้อมูล', 'Delete my data'), text: 'DELETE MY DATA', style: 'secondary' },
      ]),
      ...(await homeReplyFromContext(ctx)),
    ];
  }

  if (!profile.odooVerified && !isGuestAllowedCommand(upperText, profile.pendingFlow)) {
    if (ctx.channel?.channelId === CUSTOMER_CHANNEL_ID && !matchCommandGrid(upperText) && !upperText.startsWith('FORM ')) {
      const { notifyAdminsOfCustomerInbound } = await import('./inbound-relay');
      await notifyAdminsOfCustomerInbound(ctx);
    }
    return [text(tr(userLanguage,
      `${agentName} กรุณายืนยันด้วยเบอร์ในบัญชีผู้ใช้ Odoo ก่อนใช้บริการ ลูกค้าที่ไม่ได้ยืนยันจะเห็นเฉพาะข้อความที่ผู้ใช้ Odoo ส่งมา`,
      `${agentName} verify with the phone on your Odoo user account before using services. Unverified customers only see messages a verified Odoo user sends.`,
    ), userLanguage, undefined, [
      { label: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
    ])];
  }

  // Step 3: Service channel gate
  const gatedService = resolveServiceForCommand(upperText);
  if (gatedService && (!isServiceConfigured(gatedService) || !isServiceEnabledForChannel(gatedService, ctx.channel))) {
    return [text(tr(userLanguage,
      `${agentName} บริการนี้ไม่เปิดใช้งานสำหรับช่องทางนี้`,
      `${agentName} this service is not available on this channel.`,
    ), userLanguage)];
  }

  if (isCommandDisabled(upperText)) {
    return [text(tr(userLanguage,
      `${agentName} คำสั่งนี้ถูกปิดใช้งาน`,
      `${agentName} this command is disabled.`,
    ), userLanguage)];
  }

  await loadCommandOverlay();
  const grid = evaluateCommandGrid(upperText, ctx);
  if (!grid.ok) {
    const channelDenied = grid.reason === 'channel';
    const disabled = grid.reason === 'disabled';
    return [text(tr(userLanguage,
       disabled
         ? `${agentName} คำสั่งนี้ถูกปิดใช้งาน`
         : channelDenied
         ? `${agentName} คำสั่งนี้ใช้ไม่ได้บน Official Account นี้`
         : `${agentName} คำสั่งนี้ต้องการสิทธิ์ที่สูงกว่า`,
       disabled
         ? `${agentName} this command is disabled.`
         : channelDenied
         ? `${agentName} this command is not available on this Official Account.`
         : `${agentName} you do not have permission for this command.`,
    ), userLanguage)];
  }

  // Step 4: FORM * guided form start
  const formResult = await handleFormCommand(ctx);
  if (formResult !== null) return formResult;

  // Step 5: Handler registry (skill-based dispatch)
  for (const handler of COMMAND_HANDLERS) {
    if (handler.match(upperText, ctx)) {
      return handler.handle(ctx);
    }
  }

  // Step 6: Keyword proximity guidance (near-miss suggestions)
  const guidanceMessages = buildKeywordGuidanceMessages({
    text: trimmed,
    userLanguage,
    agentName,
    channel: ctx.channel,
    profile,
  });
  if (guidanceMessages) return guidanceMessages;

  if (ctx.channel?.channelId === CUSTOMER_CHANNEL_ID) {
    const { notifyAdminsOfCustomerInbound, clearSalesWaiting } = await import('./inbound-relay');
    await notifyAdminsOfCustomerInbound(ctx);
    await clearSalesWaiting(userId);
    return [
      text(tr(userLanguage, 'รับข้อความแล้ว ทีมขายจะติดต่อกลับ', 'Message received. Sales will follow up.'), userLanguage),
      ...(await homeReplyFromContext(ctx)).slice(0, 4),
    ];
  }

  if (isQuoteStaff(profile) && profile.waitingCustomerUserId && !matchCommandGrid(upperText) && !upperText.startsWith('NAV') && !upperText.startsWith('QUOTE') && !upperText.startsWith('FORM')) {
    const { sendTargetedFlexMessage } = await import('./messaging');
    const { customerNotifyChannelId } = await import('./channels');
    const customerId = profile.waitingCustomerUserId;
    const card = createBotTextFlexMessage({
      title: getBrandTitle(userLanguage),
      body: trimmed,
      language: userLanguage,
      tone: 'info',
    });
    await sendTargetedFlexMessage(
      [customerId],
      card,
      customerNotifyChannelId(),
    );
    return [text(tr(userLanguage, 'ส่งถึงลูกค้าแล้ว', 'Sent to the customer.'), userLanguage)];
  }

  // Step 7: AI chat fallback (Gemini → ClawBridge → Odoo heuristic)
  return handleChatFallback(ctx);
};

/**
 * Thin wrapper around the dispatch logic above — the single choke point both
 * webhook.ts and index.ts's /webhook-test send through, so every outgoing
 * message set gets checked against LINE's hard limits (src/line/message-limits.ts)
 * in one place instead of duplicating the check at each call site. A
 * violation here means the send is about to fail with the customer getting
 * nothing — logged loudly rather than discovered from a support ticket.
 */
export const resolveCommandReply = async (ctx: CommandReplyContext): Promise<messagingApi.Message[]> => {
  return withSpan('line.resolveCommandReply', { 'line.user_id': ctx.userId, 'http.request_id': ctx.requestId || '' }, async () => {
    const raw = ensureNextWindowOrHome(ctx, await dispatchCommandReply(ctx), () => homeMenuFromContext(ctx));
    const messages = fitReply(raw, ctx.userLanguage);
    const violations = checkMessagesAgainstLineLimits(messages);
    if (violations.length) {
      appLogger.error('line_limits_violation', { requestId: ctx.requestId, violations });
    }
    return messages;
  });
};
