import type { messagingApi } from '@line/bot-sdk';
import { getPendingOdooVerificationChallenge, type UserProfile } from '../services/firestore';
import { startOdooUserVerification, verificationSuccessMessage } from '../services/user-verification';
import { resolveVerificationPhase, type VerificationPhase } from '../services/verification-lifecycle';
import { CUSTOMER_CHANNEL_ID } from './channels';
import { createBotTextFlexMessage } from './templates';
import { hasActiveSalesSession } from '../services/sales-session';
import { isQuoteStaff } from './quote-access';
import type { CommandReplyContext } from './command-router';

const tr = (language: CommandReplyContext['userLanguage'], th: string, en: string): string => (language === 'en' ? en : th);

const card = (
  ctx: CommandReplyContext,
  body: string,
  tone: 'info' | 'success' | 'warning' | 'error',
  actions?: { label: string; text: string; style?: 'primary' | 'secondary' }[],
): messagingApi.Message => createBotTextFlexMessage({
  title: tr(ctx.userLanguage, 'ยืนยันตัวตน', 'Verify'),
  body,
  language: ctx.userLanguage,
  tone,
  actions,
});

const knownPhone = (profile: UserProfile): string => (profile.phone || '').replace(/[^0-9+]/g, '').trim();

export const resolveVerifyMenuMessages = async (ctx: CommandReplyContext): Promise<messagingApi.Message[]> => {
  const { userLanguage, agentName, profile, userId } = ctx;
  const pending = await getPendingOdooVerificationChallenge(userId);
  const phone = knownPhone(profile) || pending?.phone || '';
  const phase: VerificationPhase = resolveVerificationPhase({
    odooVerified: profile.odooVerified,
    phone,
    pending,
  });

  if (phase === 'VERIFIED') {
    const staff = isQuoteStaff(profile);
    const actions = hasActiveSalesSession(profile)
      ? [
        { label: tr(userLanguage, 'ยืนยันออก', 'Sign out'), text: 'VERIFY SIGNOUT', style: 'primary' as const },
        { label: tr(userLanguage, 'หน้าหลัก', 'Home'), text: 'NAV HOME', style: 'secondary' as const },
      ]
      : [{ label: tr(userLanguage, 'หน้าหลัก', 'Home'), text: 'NAV HOME', style: 'primary' as const }];
    return [card(ctx, verificationSuccessMessage(userLanguage, profile.displayName, profile.salesTier)
      + (staff
        ? tr(userLanguage, '\nเซสชัน Sales ยังใช้งานได้', '\nSales session is active.')
        : ''), 'success', actions)];
  }

  if (phase === 'RATE_LIMITED') {
    const shown = pending?.phone || phone;
    return [card(ctx, tr(userLanguage,
      `${agentName} ส่งรหัสยืนยันไปแล้วสำหรับเบอร์ ${shown}\nพิมพ์ VERIFY OTP ตามด้วยรหัส 6 หลัก หรือแตะลิงก์ที่ยืนยันไว้ก่อนหน้า\nรออย่างน้อย 1 นาทีก่อนขอรหัสใหม่`,
      `${agentName} a verification code was already sent for ${shown}.\nType VERIFY OTP plus the 6-digit code, or use the previous verify link.\nWait at least 1 minute before requesting a new code.`,
    ), 'warning', [
      { label: tr(userLanguage, 'เบอร์อื่น', 'Another phone'), text: 'FORM VERIFY MANUAL', style: 'secondary' },
    ])];
  }

  if (phase === 'CODE_SENT' && (pending?.phone || phone)) {
    const retryPhone = pending?.phone || phone;
    const result = await startOdooUserVerification({
      userId,
      rawPhone: retryPhone,
      language: userLanguage,
      agentName,
      fallbackBaseUrl: ctx.baseUrl,
      channelId: ctx.channel?.channelId,
    });
    return [createBotTextFlexMessage({
      title: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'),
      body: result.message,
      language: userLanguage,
      tone: 'info',
      ...(result.link ? { linkAction: { label: result.linkLabel || 'Verify now', uri: result.link } } : {}),
      actions: [{ label: tr(userLanguage, 'เบอร์อื่น', 'Another phone'), text: 'FORM VERIFY MANUAL', style: 'secondary' }],
    })];
  }

  if (phase === 'EXPIRED' || phase === 'FAILED') {
    const retryPhone = pending?.phone || phone;
    const actions = retryPhone
      ? [
        { label: tr(userLanguage, 'ส่งรหัสอีกครั้ง', 'Resend code'), text: `VERIFY START ${retryPhone}`, style: 'primary' as const },
        { label: tr(userLanguage, 'เบอร์อื่น', 'Another phone'), text: 'FORM VERIFY MANUAL', style: 'secondary' as const },
      ]
      : [{ label: tr(userLanguage, 'ยืนยันตอนนี้', 'Verify now'), text: 'FORM VERIFY MANUAL', style: 'primary' as const }];
    return [card(ctx, tr(userLanguage,
      phase === 'EXPIRED'
        ? `${agentName} รหัสยืนยันหมดอายุแล้ว ส่งรหัสใหม่ได้`
        : `${agentName} รหัสไม่ถูกต้องหรือถูกจำกัด กรุณาส่งรหัสใหม่`,
      phase === 'EXPIRED'
        ? `${agentName} that verification code expired. You can request a new one.`
        : `${agentName} that code was incorrect or locked. Request a new code.`,
    ), 'warning', actions)];
  }

  if (phase === 'VERIFICATION_REQUIRED' && phone) {
    const result = await startOdooUserVerification({
      userId,
      rawPhone: phone,
      language: userLanguage,
      agentName,
      fallbackBaseUrl: ctx.baseUrl,
      channelId: ctx.channel?.channelId,
    });
    if (result.needsRegister) {
      return [card(ctx, result.message, 'warning', [
        { label: tr(userLanguage, 'สมัครลูกค้าใหม่', 'New customer'), text: 'FORM CUSTOMER REGISTER', style: 'primary' },
        { label: tr(userLanguage, 'เบอร์อื่น', 'Another phone'), text: 'FORM VERIFY MANUAL', style: 'secondary' },
      ])];
    }
    return [createBotTextFlexMessage({
      title: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'),
      body: tr(userLanguage,
        `ยืนยันเบอร์ที่มีอยู่แล้ว: ${phone}\n${result.message}`,
        `Verifying your saved number: ${phone}\n${result.message}`,
      ),
      language: userLanguage,
      tone: 'info',
      ...(result.link ? { linkAction: { label: result.linkLabel || 'Verify now', uri: result.link } } : {}),
      actions: [{ label: tr(userLanguage, 'เบอร์อื่น', 'Another phone'), text: 'FORM VERIFY MANUAL', style: 'secondary' }],
    })];
  }

  const onCustomer = ctx.channel?.channelId === CUSTOMER_CHANNEL_ID;
  return [card(ctx, tr(userLanguage,
    `${agentName} ยังไม่มีเบอร์ที่ยืนยัน แตะยืนยันตอนนี้เพื่อผูกบัญชี LINE นี้กับลูกค้า Odoo (ชื่อที่แสดงบน LINE ใช้เป็นชื่อเริ่มต้น) ไม่ต้องยืนยันเพื่อดูสินค้า`,
    `${agentName} no phone is on file yet. Tap Verify now to bind this LINE account to an Odoo customer (your LINE display name is the starting name). You can browse products without verifying.`,
  ), 'info', [
    { label: tr(userLanguage, 'ยืนยันตอนนี้', 'Verify now'), text: onCustomer ? 'FORM CUSTOMER REGISTER' : 'FORM VERIFY MANUAL', style: 'primary' },
    ...(onCustomer
      ? [{ label: tr(userLanguage, 'มีเบอร์แล้ว', 'I have a phone'), text: 'FORM VERIFY MANUAL', style: 'secondary' as const }]
      : []),
  ])];
};
