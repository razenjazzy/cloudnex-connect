import type { CommandHandler } from './index';
import {
  createProductCardFlexMessage,
  createProductCarouselFlexMessage,
  createQuotationJourneyFlexMessage,
  createBotTextFlexMessage,
  formatMoney,
} from '../templates';
import { parseDemoQuotePayload, parseSelfQuotePayload, parseQtyProductUtterance } from '../command-validators';
import { seedOdooSampleSalesDataWithAudit } from '../../services/seed-odoo';
import { getSaleOrderById } from '../../services/odoo/sales';
import { recordAuditEvent, setLastProductContext, listVerifiedSalesLineUserIds } from '../../services/firestore';
import type { UserLanguage } from '../../services/firestore';
import { t } from '../../services/i18n';
import { canManageQuoteLines, canViewOrderAsCustomer, isQuoteStaff, quoteJourneyRole, selfQuoteIdentity, syncStaffProfile } from '../quote-access';
import { notifyQuoteParties } from '../quote-notify';
import { commerceFollowUpMessages } from '../commerce-followup';
import { LINE_LIMITS } from '../message-limits';
import { getErpAdapter } from '../../erp/registry';
import { getPlatformStatus } from '../../platform/status';
import { CUSTOMER_CHANNEL_ID, salesNotifyChannelId } from '../channels';
import { findOdooUserIdByPartnerId } from '../../services/odoo/admin';
import { sendTargetedFlexMessage } from '../messaging';
import { beginQuoteCreate, completeQuoteCreate, failQuoteCreate, quoteCreateLockKey } from '../../services/quote-idempotency';

const tr = (language: UserLanguage, th: string, en: string): string => (language === 'en' ? en : th);

const inferTone = (value: string): 'info' | 'success' | 'warning' | 'error' => {
  const lower = value.toLowerCase();
  if (/failed|ไม่สำเร็จ|ไม่พบ/.test(lower)) return 'error';
  if (/success|สำเร็จ/.test(lower)) return 'success';
  return 'info';
};

const botText = (value: string, language: UserLanguage, actions?: { label: string; text: string; style?: 'primary' | 'secondary' }[]) =>
  createBotTextFlexMessage({
    title: tr(language, 'ผู้ช่วย Cloudnex', 'Cloudnex assistant'),
    body: value,
    language,
    tone: inferTone(value),
    actions,
  });

// PRODUCT FIND [query] — lookup product in Odoo; no query → guided form
const demoProductHandler: CommandHandler = {
  name: 'commerce-product-find',
  match: (u) => u === 'PRODUCT FIND' || u.startsWith('PRODUCT FIND '),
  handle: async (ctx) => {
    const { userLanguage, text, userId } = ctx;
    const query = text.trim().replace(/^PRODUCT FIND\s*/i, '').trim();
    if (!query) {
      if (!isQuoteStaff(ctx.profile)) {
        try {
          const catalog = await getErpAdapter().searchProducts('', 10);
          if (catalog.length) return [createProductCarouselFlexMessage(catalog, userLanguage)];
          return [botText(tr(userLanguage, 'ยังไม่มีสินค้าให้แสดง กรุณาค้นหาด้วยชื่อสินค้า', 'No products to show yet. Search by product name.'), userLanguage, [
            { label: tr(userLanguage, 'ค้นหาสินค้า', 'Search products'), text: 'FORM PRODUCT FIND', style: 'primary' },
          ])];
        } catch {
          return [botText(tr(userLanguage, 'โหลดสินค้าจาก Odoo ไม่สำเร็จ กรุณาลองใหม่', 'Could not load products from Odoo. Please try again.'), userLanguage, [
            { label: tr(userLanguage, 'ลองอีกครั้ง', 'Try again'), text: 'PRODUCT FIND', style: 'primary' },
          ])];
        }
      }
      const { resolveCommandReply } = await import('../command-router');
      return resolveCommandReply({ ...ctx, text: 'FORM PRODUCT FIND' });
    }
    const products = await getErpAdapter().searchProducts(query, 10);
    if (!products.length) {
      return [botText(tr(userLanguage, `ไม่พบสินค้าที่ตรงกับ "${query}"`, `No product matched "${query}".`), userLanguage, [
        { label: tr(userLanguage, 'ค้นหาอีกครั้ง', 'Search again'), text: 'FORM PRODUCT FIND', style: 'primary' },
      ])];
    }
    if (products.length > 1) {
      return [createProductCarouselFlexMessage(products, userLanguage)];
    }
    const product = products[0];
    await setLastProductContext(userId, {
      productId: product.id,
      productName: product.name,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    return [createProductCardFlexMessage(product.name, product.price || 0, product.quantity || 0, userLanguage, product.id)];
  },
};

// ORDER STATUS [ref] — check order status; no ref → guided form
const demoOrderHandler: CommandHandler = {
  name: 'commerce-order-status',
  match: (u) => u === 'ORDER STATUS' || u.startsWith('ORDER STATUS '),
  handle: async (ctx) => {
    const { userLanguage, text } = ctx;
    const orderRef = text.trim().replace(/^ORDER STATUS\s*/i, '').trim();
    if (!orderRef) {
      const { resolveCommandReply } = await import('../command-router');
      if (!isQuoteStaff(ctx.profile)) return resolveCommandReply({ ...ctx, text: 'QUOTE LIST' });
      return resolveCommandReply({ ...ctx, text: 'FORM ORDER STATUS' });
    }
    const found = await getErpAdapter().getOrderStatus(orderRef);
    if (!found) {
      return [botText(tr(userLanguage, `ไม่พบออเดอร์เลขที่ ${orderRef} กรุณาตรวจสอบเลขที่อ้างอิงอีกครั้งค่ะ`, `We couldn't find an order with reference ${orderRef}. Please double-check the reference number.`), userLanguage)];
    }

    // Re-fetch by id for the full card (line items, invoice status, note) —
    // findOrderByReference only resolves the reference to an id, same as
    // every other "look up then render the rich card" path in this app
    // (quoteStatusHandler etc.) — one consistent card design, not a
    // separate plain-text summary for this one entry point.
    const order = (await getSaleOrderById(found.id)) || {
      id: found.id,
      name: found.name,
      state: found.state,
      amount_total: found.amountTotal || 0,
    };
    const [links, delivery] = await Promise.all([
      getErpAdapter().getOrderLinks(order.id),
      getErpAdapter().getDeliveryStatus(found.id),
    ]);
    const profile = await syncStaffProfile(ctx.userId, ctx.profile, ctx.channel?.channelId);
    const role = quoteJourneyRole(profile);
    const orderPartnerId = Array.isArray(order.partner_id) ? order.partner_id[0] : undefined;
    if (!canViewOrderAsCustomer(profile, orderPartnerId)) {
      return [botText(t('quoteNotYours', userLanguage), userLanguage)];
    }
    return [createQuotationJourneyFlexMessage(order, {
      role,
      salesTier: profile.salesTier,
      canManageLines: canManageQuoteLines(profile),
      portalLink: links.portal,
      pdfLink: links.pdf,
      ...(delivery ? { delivery } : {}),
    }, userLanguage)];
  },
};

// QUOTE CREATE [product,qty,customer,phone] — create Odoo quotation; no payload → guided form
const demoQuoteHandler: CommandHandler = {
  name: 'commerce-quote-create',
  match: (u) => u === 'QUOTE CREATE' || (u.startsWith('QUOTE CREATE ') && !u.startsWith('QUOTE CREATE MORE')),
  handle: async (ctx) => {
    const { userLanguage, text, userId, channel, requestId } = ctx;
    const profile = await syncStaffProfile(userId, ctx.profile, ctx.channel?.channelId);
    const payload = text.trim().replace(/^QUOTE CREATE\s*/i, '').trim();
    const identity = selfQuoteIdentity(profile);
    const parsed = isQuoteStaff(profile)
      ? parseDemoQuotePayload(payload)
      : parseSelfQuotePayload(payload, identity);
    if (!parsed) {
      const { resolveCommandReply } = await import('../command-router');
      return resolveCommandReply({ ...ctx, text: 'FORM QUOTE CREATE' });
    }

    if (!isQuoteStaff(profile) && !profile.odooPartnerId) {
      return [botText(tr(userLanguage,
        'กรุณายืนยันตัวตนก่อนสร้างใบเสนอราคา',
        'Verify your account before creating a quote.',
      ), userLanguage, [
        { label: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
      ])];
    }

    const { productName, qty, customerName, phone, customerReference, discountPercent, validityDate, note, paymentTerm, productId: parsedProductId } = parsed;

    const erp = getErpAdapter();
    const product = parsedProductId
      ? await erp.lookupProduct(parsedProductId)
      : (await erp.searchProducts(productName, 1))[0];
    if (!product) {
      return [botText(tr(userLanguage,
        `ไม่พบสินค้าที่ตรงกับ "${productName}"`,
        `No product matched "${productName}".`,
      ), userLanguage, [
        { label: tr(userLanguage, 'ค้นหาสินค้า', 'Find product'), text: 'FORM PRODUCT FIND', style: 'primary' },
      ])];
    }

    // If an admin is quoting for a phone that's already a real Odoo
    // contact, attach the quote to that exact partner instead of letting
    // createQuotationFromLine's findOrCreatePartner blindly create/match a
    // bystander contact by name+phone. Unverified/new customers (the
    // common case) fall through to today's behavior unchanged.
    const namedPartner = isQuoteStaff(profile) ? await getErpAdapter().lookupCustomerByName(customerName) : null;
    if (namedPartner && phone && namedPartner.phone !== phone) {
      await getErpAdapter().updateCustomer(namedPartner.id, { phone });
    }
    const existingPartner = isQuoteStaff(profile)
      ? (namedPartner || await getErpAdapter().lookupCustomer(phone))
      : null;
    const partnerId = isQuoteStaff(profile) ? existingPartner?.id : profile.odooPartnerId;
    const lockKey = quoteCreateLockKey({ userId, productId: product.id, qty, requestId });
    const lock = await beginQuoteCreate(lockKey);
    if (!lock.ok) {
      return [botText(tr(userLanguage,
        lock.orderName
          ? `ใบเสนอราคานี้กำลังถูกสร้างหรือสร้างแล้ว (${lock.orderName})`
          : 'กำลังสร้างใบเสนอราคาอยู่ กรุณารอสักครู่ ไม่ต้องแตะซ้ำ',
        lock.orderName
          ? `This quote is already being created (${lock.orderName}).`
          : 'A quote is already being created. Please wait — do not tap again.',
      ), userLanguage)];
    }

    // Optional field, resolved (not just validated) here — a miss never
    // blocks the quote, it just proceeds without a payment term set
    // (Odoo's own default applies, same as leaving it blank in Odoo web).
    let paymentTermId: number | undefined;
    let paymentTermNotFound = false;
    if (paymentTerm) {
      const termId = await getErpAdapter().findPaymentTermId(paymentTerm);
      if (termId) paymentTermId = termId;
      else paymentTermNotFound = true;
    }

    let salespersonUserId: number | false | undefined;
    if (channel?.channelId === CUSTOMER_CHANNEL_ID || !isQuoteStaff(profile)) {
      salespersonUserId = false;
    } else if (profile.odooPartnerId) {
      salespersonUserId = await findOdooUserIdByPartnerId(profile.odooPartnerId);
    }

    const quotation = await getErpAdapter().createQuotation(customerName, phone, product.name, qty, {
      partnerId,
      customerRef: customerReference,
      discountPercent,
      validityDate,
      note,
      paymentTermId,
      productId: product.id,
      ...(salespersonUserId !== undefined ? { salespersonUserId } : {}),
    });
    if (!quotation) {
      failQuoteCreate(lockKey);
      // Product genuinely exists, so this is a real failure (partner
      // creation, sale.order create, etc.) — logged server-side by
      // createQuotationFromLine itself; tell the user it's not their input.
      recordAuditEvent({ action: 'quote_create', outcome: 'failure', actorUserId: userId, channelId: channel?.channelId, requestId, detail: `product=${product.id}` });
      return [botText(tr(userLanguage,
        'พบสินค้าแล้ว แต่สร้างใบเสนอราคาไม่สำเร็จเนื่องจากข้อผิดพลาดของระบบ กรุณาลองใหม่ หรือแจ้งแอดมินหากยังไม่สำเร็จ',
        "Found the product, but couldn't create the quote due to a system error. Please try again, or contact an admin if it keeps happening.",
      ), userLanguage)];
    }

    completeQuoteCreate(lockKey, quotation.name);

    recordAuditEvent({ action: 'quote_create', outcome: 'success', actorUserId: userId, channelId: channel?.channelId, requestId, targetId: quotation.name });

    const order = await getSaleOrderById(quotation.id);
    if (!order) {
      // Created successfully but the immediate re-read failed — extremely
      // unlikely, but don't leave the requester without any confirmation.
      return [botText(tr(userLanguage,
        `สร้างใบเสนอราคา ${quotation.name} สำเร็จแล้ว (${formatMoney(quotation.total, 'th')})`,
        `Created quotation ${quotation.name} (${formatMoney(quotation.total, 'en')}).`,
      ), userLanguage, [
        { label: tr(userLanguage, 'เช็คสถานะ', 'Check status'), text: `QUOTE STATUS ${quotation.id}`, style: 'primary' },
      ])];
    }

    const links = await getErpAdapter().getOrderLinks(quotation.id);
    const role = quoteJourneyRole(profile);
    const card = createQuotationJourneyFlexMessage(order, {
      role,
      salesTier: profile.salesTier,
      canManageLines: canManageQuoteLines(profile),
      portalLink: links.portal,
      pdfLink: links.pdf,
    }, userLanguage);

    notifyQuoteParties({ order, channelId: channel?.channelId, actorUserId: userId, notifyCustomer: false })
      .catch(err => console.warn('quote-create: sales notify failed (non-fatal):', err));

    if (!isQuoteStaff(profile)) {
      return paymentTermNotFound
        ? [
            botText(tr(userLanguage,
              `ไม่พบเงื่อนไขการชำระเงิน "${paymentTerm}" สร้างใบเสนอราคาแล้วโดยใช้เงื่อนไขเริ่มต้น`,
              `Payment term "${paymentTerm}" not found — created the quote with Odoo's default payment term instead.`,
            ), userLanguage),
            card,
          ]
        : [card];
    }

    if (paymentTermNotFound) {
      return [
        botText(tr(userLanguage,
          `ไม่พบเงื่อนไขการชำระเงิน "${paymentTerm}" สร้างใบเสนอราคาแล้วโดยใช้เงื่อนไขเริ่มต้น`,
          `Payment term "${paymentTerm}" not found — created the quote with Odoo's default payment term instead.`,
        ), userLanguage),
        card,
        ...(await commerceFollowUpMessages(ctx, LINE_LIMITS.MAX_MESSAGES_PER_REPLY - 2)),
      ];
    }

    return [card, ...(await commerceFollowUpMessages(ctx, LINE_LIMITS.MAX_MESSAGES_PER_REPLY - 1))];
  },
};

// SYSTEM STATUS — ping Odoo connectivity
const demoOdooHandler: CommandHandler = {
  name: 'commerce-system-status',
  match: (u) => u === 'SYSTEM STATUS',
  handle: async (ctx) => {
    const { userLanguage } = ctx;
    try {
      const status = await getPlatformStatus();
      const failed = status.checks.filter(check => !check.ok).map(check => `${check.name}=${check.message}`);
      const body = [
        tr(userLanguage, `พร้อมใช้: ${status.ready ? 'ใช่' : 'ไม่'}`, `Ready: ${status.ready ? 'yes' : 'no'}`),
        ...status.checks.filter(check => check.required).map(check => `${check.name}: ${check.message}`),
        failed.length
          ? tr(userLanguage, `ปัญหา: ${failed.join(' | ')}`, `Issues: ${failed.join(' | ')}`)
          : tr(userLanguage, 'ไม่มีปัญหาที่ต้องแก้', 'No blocking issues'),
      ].join('\n');
      return [botText(body, userLanguage)];
    } catch (err) {
      console.error('Platform status error:', err);
      return [botText(tr(userLanguage,
        'ตรวจสอบสถานะไม่สำเร็จ',
        'Platform status check failed.',
      ), userLanguage)];
    }
  },
};

// SEED SAMPLE DATA — seed sample data (admin only)
const demoSeedHandler: CommandHandler = {
  name: 'commerce-seed-sample-data',
  match: (u) => u === 'SEED SAMPLE DATA',
  handle: async (ctx) => {
    const { userLanguage, profile, userId } = ctx;
    if (profile.role !== 'admin') {
      return [botText(tr(userLanguage,
        'คำสั่งนี้สำหรับแอดมินเท่านั้น กรุณาใช้ ADMIN VERIFY และ ADMIN ENABLE ก่อน',
        'This command is admin-only. Run ADMIN VERIFY and ADMIN ENABLE first.',
      ), userLanguage)];
    }
    const status = await seedOdooSampleSalesDataWithAudit(userId, ctx.channel?.channelId, ctx.requestId);
    return [botText(status, userLanguage)];
  },
};

const adminOnlyCommerceReply = (language: UserLanguage) =>
  botText(tr(language,
    'คำสั่งนี้สำหรับแอดมินเท่านั้น กรุณาใช้ ADMIN VERIFY และ ADMIN ENABLE ก่อน',
    'This command is admin-only. Run ADMIN VERIFY and ADMIN ENABLE first.',
  ), language);

// DAILY REPORT — trigger daily report (async, non-blocking). Admin-only:
// this was missing its role check (unlike its sibling SEED SAMPLE DATA
// below), which meant any LINE user could force an internal-data report
// generation — closed as a real authorization gap, not a style nit.
const demoReportHandler: CommandHandler = {
  name: 'commerce-daily-report',
  match: (u) => u === 'DAILY REPORT',
  handle: async (ctx) => {
    const { userLanguage, profile, userId, channel, requestId } = ctx;
    if (profile.role !== 'admin') return [adminOnlyCommerceReply(userLanguage)];

    recordAuditEvent({ action: 'daily_report_trigger', outcome: 'success', actorUserId: userId, channelId: channel?.channelId, requestId });
    import('../../jobs/daily-report')
      .then(({ runDailyReport }) => runDailyReport(userLanguage))
      .catch(err => console.error('Demo report error:', err));
    return [botText(tr(userLanguage,
      'กำลังสร้างรายงานจากข้อมูล Odoo และจะส่งไปยังแอดมินทันทีค่ะ',
      'Generating report from Odoo data and sending it to admin now.',
    ), userLanguage)];
  },
};

// SEGMENT CUSTOMERS — trigger segmentation job. Admin-only: same missing
// role-check gap as DAILY REPORT above — this one is higher-stakes since it
// triggers a real bulk marketing multicast to customers, not just an
// internal report.
const demoSegmentHandler: CommandHandler = {
  name: 'commerce-segment-customers',
  match: (u) => u === 'SEGMENT CUSTOMERS',
  handle: async (ctx) => {
    const { userLanguage, profile, userId, channel, requestId } = ctx;
    if (profile.role !== 'admin') return [adminOnlyCommerceReply(userLanguage)];

    const { runSegmentationJob } = await import('../../jobs/segmentation');
    await runSegmentationJob();
    recordAuditEvent({ action: 'segment_customers_trigger', outcome: 'success', actorUserId: userId, channelId: channel?.channelId, requestId });
    return [botText(tr(userLanguage,
      'จัดกลุ่มลูกค้าเสร็จแล้ว พร้อมส่งข้อความตามเซกเมนต์เรียบร้อยค่ะ',
      'Segmentation complete. Targeted segment messages have been dispatched.',
    ), userLanguage)];
  },
};

const messageRequestConfirmHandler: CommandHandler = {
  name: 'commerce-message-request',
  match: (u) => u.startsWith('MESSAGE REQUEST CONFIRM'),
  handle: async (ctx) => {
    const { userLanguage, profile, userId, channel } = ctx;
    if (!profile.odooVerified || !profile.odooPartnerId) {
      return [botText(tr(userLanguage, 'ยืนยันตัวตนก่อนส่งข้อความ', 'Verify your account before messaging sales.'), userLanguage, [
        { label: tr(userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
      ])];
    }
    const raw = ctx.text.replace(/^MESSAGE REQUEST CONFIRM\s*/i, '');
    const split = raw.indexOf('|');
    const productToken = (split === -1 ? raw : raw.slice(0, split)).trim();
    const body = (split === -1 ? '' : raw.slice(split + 1)).trim();
    if (!body) {
      return [botText(tr(userLanguage, 'พิมพ์ข้อความก่อนส่ง', 'Type a message first.'), userLanguage, [
        { label: tr(userLanguage, 'ส่งข้อความ', 'Send Message'), text: 'FORM MESSAGE REQUEST', style: 'primary' },
      ])];
    }
    const note = [productToken && /^\d+$/.test(productToken) ? `productId=${productToken}` : productToken, body].filter(Boolean).join('\n');
    const posted = await getErpAdapter().postPartnerNote?.(profile.odooPartnerId, note);
    if (!posted) {
      return [botText(tr(userLanguage, 'ส่งข้อความไม่สำเร็จ กรุณาลองใหม่', 'Could not send the message. Please try again.'), userLanguage, [
        { label: tr(userLanguage, 'ลองอีกครั้ง', 'Try again'), text: 'FORM MESSAGE REQUEST', style: 'primary' },
        { label: tr(userLanguage, 'คู่มือ', 'Guide'), text: 'GUIDE', style: 'secondary' },
      ])];
    }
    const salesIds = await listVerifiedSalesLineUserIds();
    if (salesIds.length) {
      const ping = botText(tr(userLanguage,
        `ข้อความจากลูกค้า ${profile.displayName || userId}: ${body}`,
        `Customer message from ${profile.displayName || userId}: ${body}`,
      ), userLanguage);
      sendTargetedFlexMessage(salesIds, ping, salesNotifyChannelId()).catch(() => undefined);
    }
    recordAuditEvent({ action: 'quote_message', outcome: 'success', actorUserId: userId, channelId: channel?.channelId, detail: String(profile.odooPartnerId) });
    return [botText(tr(userLanguage, 'ส่งข้อความถึงฝ่ายขายแล้ว', 'Message sent to sales.'), userLanguage, [
      { label: tr(userLanguage, 'หน้าแรก', 'Home'), text: 'NAV HOME', style: 'primary' },
    ])];
  },
};

const qtyProductUtteranceHandler: CommandHandler = {
  name: 'commerce-qty-utterance',
  match: (u, ctx) => ctx.channel?.channelId === CUSTOMER_CHANNEL_ID && Boolean(parseQtyProductUtterance(ctx.text)),
  handle: async (ctx) => {
    const parsed = parseQtyProductUtterance(ctx.text)!;
    if (!ctx.profile.odooVerified) {
      const found = (await getErpAdapter().searchProducts(parsed.productName, 1))[0];
      if (found) {
        await setLastProductContext(ctx.userId, {
          productId: found.id,
          productName: found.name,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        });
      }
      return [botText(tr(ctx.userLanguage,
        'ยืนยันตัวตนก่อนสร้างใบเสนอราคา',
        'Verify your account before creating a quote.',
      ), ctx.userLanguage, [
        { label: tr(ctx.userLanguage, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
      ])];
    }
    const { resolveCommandReply } = await import('../command-router');
    return resolveCommandReply({ ...ctx, text: `QUOTE CREATE ${parsed.productName},${parsed.qty}` });
  },
};

export const commerceHandlers: CommandHandler[] = [
  demoProductHandler,
  demoOrderHandler,
  demoQuoteHandler,
  messageRequestConfirmHandler,
  qtyProductUtteranceHandler,
  demoOdooHandler,
  demoSeedHandler,
  demoReportHandler,
  demoSegmentHandler,
];
