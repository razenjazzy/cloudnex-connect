import type { CommandHandler } from './index';
import { startOdooUserVerification, verificationSuccessMessage, verifyOdooUserByOtp } from '../../services/user-verification';
import { createBotTextFlexMessage } from '../templates';
import { getUserProfile, setUserOdooPartner, type UserLanguage } from '../../services/firestore';
import { syncStaffProfile } from '../quote-access';
import { homeMenuFromContext, resumeQuoteFromLastProduct } from '../command-router';
import { clearSalesLogin } from '../../services/sales-session';
import { parseUserCreatePayload } from '../command-validators';
import { getErpAdapter } from '../../erp/registry';
import { getPartnerByPhone } from '../../services/odoo/partners';
import { CUSTOMER_CHANNEL_ID } from '../channels';

const tr = (language: UserLanguage, th: string, en: string): string => (language === 'en' ? en : th);

const inferTone = (value: string): 'info' | 'success' | 'warning' | 'error' => {
  const lower = value.toLowerCase();
  if (/failed|error|invalid|ไม่สำเร็จ|ไม่พบ/.test(lower)) return 'error';
  if (/success|สำเร็จ/.test(lower)) return 'success';
  return 'info';
};

const botText = (value: string, language: UserLanguage) =>
  createBotTextFlexMessage({
    title: tr(language, 'ผู้ช่วย Cloudnex', 'Cloudnex assistant'),
    body: value,
    language,
    tone: inferTone(value),
  });

// VERIFY START <phone> — initiate OTP + magic-link verification challenge
const verifyStartHandler: CommandHandler = {
  name: 'verify-start',
  match: (u) => u.startsWith('VERIFY START'),
  handle: async (ctx) => {
    const { userLanguage, userId, agentName, baseUrl, text, channel } = ctx;
    const phone = text.trim().replace(/^VERIFY START\s*/i, '').trim();
    const result = await startOdooUserVerification({
      userId,
      rawPhone: phone,
      language: userLanguage,
      agentName,
      fallbackBaseUrl: baseUrl,
      channelId: channel?.channelId,
    });
    if (result.needsRegister) {
      return [createBotTextFlexMessage({
        title: tr(userLanguage, 'ผู้ช่วย Cloudnex', 'Cloudnex assistant'),
        body: result.message,
        language: userLanguage,
        tone: 'warning',
        actions: [
          { label: tr(userLanguage, 'สมัครลูกค้าใหม่', 'New customer'), text: 'FORM CUSTOMER REGISTER', style: 'primary' },
          { label: tr(userLanguage, 'เบอร์อื่น', 'Another phone'), text: 'FORM VERIFY', style: 'secondary' },
        ],
      })];
    }
    // The link (when present) must render as a real uri-action button —
    // Flex text isn't auto-linkified or selectable, so a raw URL in the
    // body was previously an inert, uncopyable string.
    return [createBotTextFlexMessage({
      title: tr(userLanguage, 'ผู้ช่วย Cloudnex', 'Cloudnex assistant'),
      body: result.message,
      language: userLanguage,
      tone: inferTone(result.message),
      ...(result.link ? { linkAction: { label: result.linkLabel || 'Open link', uri: result.link } } : {}),
    })];
  },
};

// VERIFY OTP <6-digit-code> — submit OTP to complete verification
const verifyOtpHandler: CommandHandler = {
  name: 'verify-otp',
  match: (u) => u.startsWith('VERIFY OTP'),
  handle: async (ctx) => {
    const { userLanguage, userId, agentName, text } = ctx;
    const otpCode = text.trim().replace(/^VERIFY OTP\s*/i, '').trim();
    const message = await verifyOdooUserByOtp({ userId, otpCode, language: userLanguage, agentName });
    const card = botText(message, userLanguage);
    if (!/✅/.test(message)) return [card];
    ctx.trayRest = { language: userLanguage, salesSessionActive: true };
    const verified = { ...(await getUserProfile(userId)), odooVerified: true as const };
    const resume = await resumeQuoteFromLastProduct({ ...ctx, profile: verified });
    if (resume?.length) return [card, ...resume];
    return [card, homeMenuFromContext({ ...ctx, profile: verified })];
  },
};

// VERIFY STATUS — show current Odoo verification status
const verifyStatusHandler: CommandHandler = {
  name: 'verify-status',
  match: (u) => u === 'VERIFY STATUS',
  handle: async (ctx) => {
    const { userLanguage, profile, agentName, userId } = ctx;
    const synced = await syncStaffProfile(userId, profile, ctx.channel?.channelId);
    return [createBotTextFlexMessage({
      title: tr(userLanguage, 'ผู้ช่วย Cloudnex', 'Cloudnex assistant'),
      body: profile.odooVerified
        ? verificationSuccessMessage(userLanguage, synced.displayName, synced.salesTier)
        : tr(userLanguage, `${agentName} บัญชียังไม่ยืนยัน`, `${agentName} your account is not verified yet`),
      language: userLanguage,
      tone: profile.odooVerified ? 'success' : 'info',
      actions: [{ label: tr(userLanguage, 'ยืนยันอีกครั้ง', 'Verify again'), text: 'FORM VERIFY' }],
    })];
  },
};

const customerRegisterHandler: CommandHandler = {
  name: 'customer-register',
  match: (u) => u.startsWith('CUSTOMER REGISTER'),
  handle: async (ctx) => {
    const { userLanguage, userId, text, channel } = ctx;
    if (channel?.channelId !== CUSTOMER_CHANNEL_ID) {
      return [botText(tr(userLanguage,
        'สมัครลูกค้าบน Cloudnex Customer ฝ่ายขายเพิ่มผู้ติดต่อด้วย USER CREATE',
        'Register as a customer on Cloudnex Customer. Staff add contacts with USER CREATE on Sales.',
      ), userLanguage)];
    }
    const payload = text.trim().replace(/^CUSTOMER REGISTER\s*/i, '').trim();
    const parsed = parseUserCreatePayload(payload);
    if (!parsed) {
      const { resolveCommandReply } = await import('../command-router');
      return resolveCommandReply({ ...ctx, text: 'FORM CUSTOMER REGISTER' });
    }
    const existing = await getPartnerByPhone(parsed.phone).catch(() => null);
    const partner = existing || await getErpAdapter().createCustomer(parsed.name, parsed.phone, parsed.email);
    if (!partner) {
      return [botText(tr(userLanguage, 'บันทึกลูกค้าใน Odoo ไม่สำเร็จ', 'Could not save this customer in Odoo.'), userLanguage)];
    }
    await setUserOdooPartner(userId, partner.id, partner.name, partner.phone || parsed.phone);
    const { resolveCommandReply } = await import('../command-router');
    return resolveCommandReply({ ...ctx, text: `VERIFY START ${parsed.phone}` });
  },
};

const verifySignoutHandler: CommandHandler = {
  name: 'verify-signout',
  match: (u) => u === 'VERIFY SIGNOUT',
  handle: async (ctx) => {
    const { userLanguage, userId, agentName, profile } = ctx;
    await clearSalesLogin(userId);
    ctx.trayRest = { language: userLanguage, salesSessionActive: false };
    return [
      createBotTextFlexMessage({
        title: tr(userLanguage, 'ออกจากระบบแล้ว', 'Signed out'),
        body: tr(userLanguage, `${agentName} ยกเลิกการยืนยันแล้ว แตะ Verify เพื่อเข้าอีกครั้ง`, `${agentName} verification is off. Tap Verify to sign in again.`),
        language: userLanguage,
        tone: 'success',
      }),
      homeMenuFromContext({ ...ctx, profile: { ...profile, odooVerified: false, salesSessionExpiresAt: undefined } }),
    ];
  },
};

export const verificationHandlers: CommandHandler[] = [
  customerRegisterHandler,
  verifySignoutHandler,
  verifyStartHandler,
  verifyOtpHandler,
  verifyStatusHandler,
];
