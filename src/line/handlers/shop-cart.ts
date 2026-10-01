import type { CommandHandler } from './index';
import type { CommandReplyContext } from '../command-router';
import { createBotTextFlexMessage, createShopCartFlexMessage, shopCartHasItems } from '../templates';
import { getSaleOrderById } from '../../services/odoo/sales';
import { recordAuditEvent } from '../../services/firestore';
import type { UserLanguage } from '../../services/firestore';
import { t } from '../../services/i18n';
import { isQuoteStaff } from '../quote-access';
import { getErpAdapter } from '../../erp/registry';
import { isCustomerShopEffective, parseOdooWebsiteId } from '../../platform/customer-commerce';
import { getRuntime } from '../../services/runtime-settings';
import { isShopOrderPaid, notifyShopPaymentSuccess, shopPayPageUrl } from '../../services/shop-pay';
import type { OdooSaleOrder } from '../../services/odoo/types';
import type { ShopCartStage } from '../templates/shop-cart';

const tr = (language: UserLanguage, th: string, en: string): string => (language === 'en' ? en : th);

const botText = (value: string, language: UserLanguage, actions?: Array<{ label: string; text: string; style?: 'primary' | 'secondary' }>) =>
    createBotTextFlexMessage({ title: language === 'en' ? 'My Cart' : 'ตะกร้าของฉัน', body: value, language, actions });

export const parseCartAdd = (text: string): { productId: number; qty: number } | null => {
  const raw = text.trim().replace(/^CART ADD\s*/i, '').trim();
  const match = /^(?:id:)?(\d+)(?:\s+(\d+(?:\.\d+)?))?$/i.exec(raw);
  if (!match) return null;
  const productId = Number(match[1]);
  const qty = match[2] ? Number(match[2]) : 1;
  if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(qty) || qty <= 0) return null;
  return { productId, qty };
};

export const parseCartCoupon = (text: string): string | null => {
  const code = text.trim().replace(/^CART COUPON\s*/i, '').trim();
  return code ? code.slice(0, 64) : null;
};

export const parseCartRemove = (text: string): number | null => {
  const raw = text.trim().replace(/^CART REMOVE\s*/i, '').trim();
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const shopNotApplicable = (language: UserLanguage) =>
  [botText(t('shopCartQuoteMode', language), language, [{ label: tr(language, 'หน้าแรก', 'Home'), text: 'NAV HOME', style: 'primary' }])];

const verifyFirst = (language: UserLanguage) =>
  [botText(tr(language, 'ยืนยันตัวตนก่อนใช้ตะกร้า', 'Verify your account before using the cart.'), language, [
    { label: tr(language, 'ยืนยันตัวตน', 'Verify'), text: 'FORM VERIFY', style: 'primary' },
  ])];

export const shopCartFlexForOrder = async (
  order: OdooSaleOrder,
  language: UserLanguage,
  stage: ShopCartStage,
  userId?: string,
) => {
  const resolved: ShopCartStage = isShopOrderPaid(order) && stage !== 'cart' ? 'completed' : stage;
  const erp = getErpAdapter();
  const [portal, web] = await Promise.all([
    erp.getCheckoutLink?.(order.id) ?? Promise.resolve(null),
    erp.getShopWebLinks?.() ?? Promise.resolve({} as { shop?: string; cart?: string }),
  ]);
  const payUrl = (userId ? shopPayPageUrl(order.id, userId) : null) || portal || undefined;
  return createShopCartFlexMessage(order, {
    stage: resolved,
    payUrl: resolved === 'pay' ? payUrl : undefined,
    shopUrl: web.shop,
    cartPageUrl: web.cart,
  }, language);
};

const websiteIdOrNull = () => parseOdooWebsiteId(getRuntime('ODOO_WEBSITE_ID'));

export const loadPartnerCart = async (partnerId: number): Promise<OdooSaleOrder | null> => {
  const websiteId = websiteIdOrNull();
  if (!websiteId) return null;
  const cartId = await getErpAdapter().findOpenShopCart?.(partnerId, websiteId);
  if (!cartId) return null;
  return getSaleOrderById(cartId);
};

export const cartProductIdsForPartner = async (partnerId?: number): Promise<Set<number>> => {
  if (!partnerId) return new Set();
  const order = await loadPartnerCart(partnerId);
  return new Set(
    (order?.lines || [])
      .filter(line => !line.optional && !line.isDelivery && line.qty > 0 && line.productId)
      .map(line => line.productId as number),
  );
};

const loadPartnerShopOrder = async (partnerId: number): Promise<OdooSaleOrder | null> => {
  const cart = await loadPartnerCart(partnerId);
  if (cart) return cart;
  const websiteId = websiteIdOrNull();
  if (!websiteId) return null;
  const latestId = await getErpAdapter().findLatestShopOrder?.(partnerId, websiteId);
  if (!latestId) return null;
  return getSaleOrderById(latestId);
};

const requireShopCustomer = async (ctx: CommandReplyContext) => {
  if (isQuoteStaff(ctx.profile)) {
    return shopNotApplicable(ctx.userLanguage);
  }
  if (!(await isCustomerShopEffective())) return shopNotApplicable(ctx.userLanguage);
  if (!ctx.profile.odooVerified || !ctx.profile.odooPartnerId) return verifyFirst(ctx.userLanguage);
  return null;
};

const cartViewHandler: CommandHandler = {
  name: 'shop-cart-view',
  match: (u) => u === 'CART' || u === 'CART VIEW',
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const order = await loadPartnerCart(ctx.profile.odooPartnerId!);
    if (!order) {
      return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage, [
        { label: tr(ctx.userLanguage, 'หน้าแรก', 'Home'), text: 'NAV HOME', style: 'primary' },
      ])];
    }
    return [await shopCartFlexForOrder(order, ctx.userLanguage, 'cart', ctx.userId)];
  },
};

const cartCheckoutHandler: CommandHandler = {
  name: 'shop-cart-checkout',
  match: (u) => u === 'CART CHECKOUT',
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const order = await loadPartnerCart(ctx.profile.odooPartnerId!);
    if (!order || !(order.lines || []).length) {
      return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage, [
        { label: tr(ctx.userLanguage, 'หน้าแรก', 'Home'), text: 'NAV HOME', style: 'primary' },
      ])];
    }
    return [await shopCartFlexForOrder(order, ctx.userLanguage, 'checkout', ctx.userId)];
  },
};

const cartStatusHandler: CommandHandler = {
  name: 'shop-cart-status',
  match: (u) => u === 'CART STATUS',
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const order = await loadPartnerShopOrder(ctx.profile.odooPartnerId!);
    if (!order) {
      return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage, [
        { label: tr(ctx.userLanguage, 'หน้าแรก', 'Home'), text: 'NAV HOME', style: 'primary' },
      ])];
    }
    if (isShopOrderPaid(order)) {
      await notifyShopPaymentSuccess(order);
      return [await shopCartFlexForOrder(order, ctx.userLanguage, 'completed', ctx.userId)];
    }
    if (!(order.lines || []).length) {
      return [await shopCartFlexForOrder(order, ctx.userLanguage, 'cart', ctx.userId)];
    }
    return [await shopCartFlexForOrder(order, ctx.userLanguage, 'pay', ctx.userId)];
  },
};

const cartPayHandler: CommandHandler = {
  name: 'shop-cart-pay',
  match: (u) => u === 'CART PAY',
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const order = await loadPartnerShopOrder(ctx.profile.odooPartnerId!);
    if (!order || !(order.lines || []).length) {
      return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage)];
    }
    if (isShopOrderPaid(order)) {
      await notifyShopPaymentSuccess(order);
      return [await shopCartFlexForOrder(order, ctx.userLanguage, 'completed', ctx.userId)];
    }
    const payUrl = shopPayPageUrl(order.id, ctx.userId) || await getErpAdapter().getCheckoutLink?.(order.id);
    if (!payUrl) {
      return [botText(t('shopPayMissing', ctx.userLanguage), ctx.userLanguage, [
        { label: t('shopCheckoutCta', ctx.userLanguage), text: 'CART CHECKOUT', style: 'primary' },
      ])];
    }
    return [await shopCartFlexForOrder(order, ctx.userLanguage, 'pay', ctx.userId)];
  },
};

const cartCouponHandler: CommandHandler = {
  name: 'shop-cart-coupon',
  match: (u) => u === 'CART COUPON' || u.startsWith('CART COUPON '),
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const code = parseCartCoupon(ctx.text);
    if (!code) {
      const { resolveCommandReply } = await import('../command-router');
      return resolveCommandReply({ ...ctx, text: 'FORM CART COUPON' });
    }
    const order = await loadPartnerCart(ctx.profile.odooPartnerId!);
    if (!order) return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage)];
    const applied = await getErpAdapter().applyShopCoupon?.(order.id, code);
    recordAuditEvent({
      action: 'shop_coupon',
      outcome: applied?.ok ? 'success' : 'failure',
      actorUserId: ctx.userId,
      channelId: ctx.channel?.channelId,
      targetId: String(order.id),
    });
    if (!applied?.ok) {
      return [botText(t('shopCouponFailed', ctx.userLanguage), ctx.userLanguage, [
        { label: t('shopCoupon', ctx.userLanguage), text: 'FORM CART COUPON', style: 'primary' },
      ])];
    }
    const refreshed = (await getSaleOrderById(order.id)) || order;
    return [
      botText(t('shopCouponApplied', ctx.userLanguage), ctx.userLanguage),
      await shopCartFlexForOrder(refreshed, ctx.userLanguage, 'checkout', ctx.userId),
    ];
  },
};

const cartAddHandler: CommandHandler = {
  name: 'shop-cart-add',
  match: (u) => u === 'CART ADD' || u.startsWith('CART ADD '),
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const parsed = parseCartAdd(ctx.text);
    if (!parsed) {
      return [botText(tr(ctx.userLanguage, 'ใช้ CART ADD <id> <จำนวน>', 'Use CART ADD <id> <qty>.'), ctx.userLanguage)];
    }
    const websiteId = websiteIdOrNull();
    if (!websiteId) return shopNotApplicable(ctx.userLanguage);
    const identity = {
      name: ctx.profile.displayName || 'Customer',
      phone: ctx.profile.phone || '',
    };
    if (!identity.phone) {
      return verifyFirst(ctx.userLanguage);
    }
    const draft = await getErpAdapter().addToShopCart?.({
      partnerId: ctx.profile.odooPartnerId!,
      customerName: identity.name,
      phone: identity.phone,
      productId: parsed.productId,
      qty: parsed.qty,
      websiteId,
    });
    if (!draft) {
      return [botText(tr(ctx.userLanguage, 'เพิ่มสินค้าในตะกร้าไม่สำเร็จ', 'Could not add that item to the cart.'), ctx.userLanguage)];
    }
    const order = await getSaleOrderById(draft.id);
    if (!order) {
      return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage)];
    }
    recordAuditEvent({ action: 'shop_cart_add', outcome: 'success', actorUserId: ctx.userId, channelId: ctx.channel?.channelId, targetId: draft.name });
    return [await shopCartFlexForOrder(order, ctx.userLanguage, 'cart', ctx.userId)];
  },
};

const cartRemoveHandler: CommandHandler = {
  name: 'shop-cart-remove',
  match: (u) => u.startsWith('CART REMOVE'),
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const productId = parseCartRemove(ctx.text);
    const order = await loadPartnerCart(ctx.profile.odooPartnerId!);
    if (!productId || !order) {
      return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage)];
    }
    const ok = await getErpAdapter().removeQuoteLine(order.id, productId);
    const refreshed = (await getSaleOrderById(order.id)) || order;
    if (!ok) {
      return [botText(tr(ctx.userLanguage, 'ลบรายการไม่สำเร็จ', 'Could not remove that line.'), ctx.userLanguage), await shopCartFlexForOrder(refreshed, ctx.userLanguage, 'cart', ctx.userId)];
    }
    if (!shopCartHasItems(refreshed)) {
      const { resolveCommandReply } = await import('../command-router');
      return resolveCommandReply({ ...ctx, text: 'NAV HOME' });
    }
    return [await shopCartFlexForOrder(refreshed, ctx.userLanguage, 'cart', ctx.userId)];
  },
};

const cartClearHandler: CommandHandler = {
  name: 'shop-cart-clear',
  match: (u) => u === 'CART CLEAR',
  handle: async (ctx) => {
    const blocked = await requireShopCustomer(ctx);
    if (blocked) return blocked;
    const order = await loadPartnerCart(ctx.profile.odooPartnerId!);
    if (!order) return [botText(t('shopCartEmpty', ctx.userLanguage), ctx.userLanguage)];
    const ok = await getErpAdapter().cancelQuote(order.id);
    if (!ok) {
      return [botText(tr(ctx.userLanguage, 'ล้างตะกร้าไม่สำเร็จ', 'Could not clear the cart.'), ctx.userLanguage)];
    }
    const { resolveCommandReply } = await import('../command-router');
    return resolveCommandReply({ ...ctx, text: 'NAV HOME' });
  },
};

export const shopCartHandlers: CommandHandler[] = [
  cartCheckoutHandler,
  cartPayHandler,
  cartStatusHandler,
  cartCouponHandler,
  cartAddHandler,
  cartRemoveHandler,
  cartClearHandler,
  cartViewHandler,
];
