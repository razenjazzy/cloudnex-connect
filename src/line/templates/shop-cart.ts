import { messagingApi } from '@line/bot-sdk';
import type { OdooSaleOrder, OdooSaleOrderLine } from '../../services/odoo/types';
import { t, type Lang } from '../../services/i18n';
import { htmlToPlainText } from '../../utils/html';
import { BRAND, amountHighlightBox, createMessageActionButton, createPrefillButton, createUriActionButton, flexBubbleStyles, flexHeaderBox, formatMoney, mutedNoteBox, pairFlexButtonRows, truncate } from './shared';

export type ShopCartStage = 'cart' | 'checkout' | 'pay' | 'completed';

export type ShopCartFlexOptions = {
  stage: ShopCartStage;
  payUrl?: string;
  shopUrl?: string;
  cartPageUrl?: string;
};

const formatQty = (qty: number): string => (
  Number.isInteger(qty) ? String(qty) : String(qty)
);

const shopLineName = (line: OdooSaleOrderLine): string => {
  let name = (line.productName || '—').replace(/^\[[^\]]+\]\s*/, '').trim();
  if (line.isDelivery) {
    name = name.replace(/^delivery[_\-\s]?\d+\s*/i, '').replace(/^delivery:\s*/i, '').trim() || name;
  }
  return name || line.productName || '—';
};

const visibleShopLines = (order: OdooSaleOrder): OdooSaleOrderLine[] =>
  (order.lines || []).filter(line => !line.optional && line.qty > 0);

const cartLineRow = (line: OdooSaleOrderLine, language: Lang): messagingApi.FlexBox => {
  const name = shopLineName(line);
  const left = line.isDelivery
    ? name
    : `${formatQty(line.qty)} × ${name}`;
  const amount = line.subtotal || (line.priceUnit * line.qty);
  return {
    type: 'box',
    layout: 'horizontal',
    backgroundColor: BRAND.paper,
    cornerRadius: BRAND.radius,
    paddingAll: 'sm',
    contents: [
      { type: 'text', text: left, size: 'sm', weight: 'bold', color: BRAND.ink, wrap: true, flex: 3 },
      { type: 'text', text: formatMoney(amount, language), size: 'sm', color: BRAND.tealStrong, align: 'end', flex: 2, wrap: true },
    ],
  };
};

const cartLineBlock = (
  line: OdooSaleOrderLine,
  language: Lang,
  stage: ShopCartStage,
): messagingApi.FlexComponent => {
  const row = cartLineRow(line, language);
  if (stage !== 'cart' || !line.productId || line.isDelivery) return row;
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: [
      row,
      createMessageActionButton(t('shopRemove', language), `CART REMOVE ${line.productId}`, 'secondary', BRAND.goldTint),
    ],
  };
};

export const shopCartHasItems = (order: OdooSaleOrder): boolean =>
  (order.lines || []).some(line => !line.optional && !line.isDelivery && line.qty > 0 && Boolean(line.productId));

export const createShopCartFlexMessage = (
  order: OdooSaleOrder,
  options: ShopCartFlexOptions,
  language: Lang,
): messagingApi.FlexMessage => {
  const all = visibleShopLines(order);
  const lines = all.slice(0, 6);
  const extra = all.length - lines.length;
  const stage = options.stage;
  const title = stage === 'completed'
    ? t('shopCompletedTitle', language)
    : stage === 'pay'
      ? t('shopPayTitle', language)
      : stage === 'checkout'
        ? t('shopCheckoutTitle', language)
        : t('shopCartTitle', language);
  const bodyButtons: messagingApi.FlexButton[] = [];
  const leadButtons: messagingApi.FlexComponent[] = [];
  if (stage === 'pay') {
    if (options.payUrl) bodyButtons.push(createUriActionButton(t('shopPayWebCta', language), options.payUrl, 'primary', BRAND.teal));
    else bodyButtons.push(createMessageActionButton(t('pay', language), 'CART PAY', 'primary', BRAND.teal));
    bodyButtons.push(createMessageActionButton(t('shopCheckPayment', language), 'CART STATUS', 'secondary', BRAND.goldTint));
    bodyButtons.push(createMessageActionButton(t('shopCheckoutCta', language), 'CART CHECKOUT', 'secondary', BRAND.tealTint));
  } else if (stage === 'checkout') {
    leadButtons.push(createMessageActionButton(t('pay', language), 'CART PAY', 'primary', BRAND.teal));
    bodyButtons.push(createPrefillButton(t('shopCoupon', language), 'CART COUPON ', 'secondary', BRAND.tealTint));
    bodyButtons.push(createMessageActionButton(t('shopBackToCart', language), 'CART', 'secondary', BRAND.goldTint));
  } else if (stage === 'cart') {
    leadButtons.push(createMessageActionButton(t('shopCheckoutCta', language), 'CART CHECKOUT', 'primary', BRAND.teal));
    bodyButtons.push(createPrefillButton(t('shopCoupon', language), 'CART COUPON ', 'secondary', BRAND.tealTint));
    bodyButtons.push(createMessageActionButton(t('shopAddProducts', language), 'NAV HOME', 'secondary', BRAND.tealTint));
  }
  if (stage !== 'completed' && options.cartPageUrl) {
    bodyButtons.push(createUriActionButton(t('shopWebsiteCart', language), options.cartPageUrl, 'secondary', BRAND.goldTint));
  }
  if (stage === 'cart' && options.shopUrl) {
    bodyButtons.push(createUriActionButton(t('shopStorefront', language), options.shopUrl, 'secondary', BRAND.goldTint));
  }

  const footerButtons: messagingApi.FlexButton[] = [];
  footerButtons.push(createMessageActionButton(t('customerOrderHistory', language), 'QUOTE LIST', 'secondary', BRAND.tealTint));
  footerButtons.push(createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint));

  const note = htmlToPlainText(order.note || '').replace(/\s+/g, ' ').trim();
  const body: messagingApi.FlexComponent[] = [
    ...(lines.length
      ? [{
          type: 'box' as const,
          layout: 'vertical' as const,
          spacing: 'xs' as const,
          contents: [
            ...lines.map(line => cartLineBlock(line, language, stage)),
            ...(extra > 0 ? [{ type: 'text' as const, text: `+${extra}`, size: 'xs' as const, color: BRAND.inkSoft }] : []),
          ],
        }]
      : [mutedNoteBox(t('shopCartEmpty', language))]),
    ...(note ? [mutedNoteBox(truncate(note, 160))] : []),
    amountHighlightBox(t('total', language), formatMoney(order.amount_total, language)),
    ...(stage === 'completed' ? [mutedNoteBox(t('shopCompletedNote', language))] : []),
    ...(stage === 'pay' ? [mutedNoteBox(t('shopPayWebHint', language))] : []),
    ...(stage === 'checkout' ? [mutedNoteBox(t('shopCheckoutNote', language))] : []),
    ...leadButtons,
    ...pairFlexButtonRows(bodyButtons),
  ];

  return {
    type: 'flex',
    altText: truncate(`${title} ${order.name} — ${formatMoney(order.amount_total, language)}`, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(title, order.name),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: body.slice(0, 12),
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: pairFlexButtonRows(footerButtons).slice(0, 3),
      },
    },
  };
};
