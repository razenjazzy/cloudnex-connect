import { messagingApi } from '@line/bot-sdk';
import type { OdooSaleOrder } from '../../services/odoo/types';
import { t, type Lang } from '../../services/i18n';
import { BRAND, amountHighlightBox, createMessageActionButton, createPrefillButton, createUriActionButton, flexBubbleStyles, flexHeaderBox, formatMoney, mutedNoteBox, truncate } from './shared';

export type ShopCartStage = 'cart' | 'checkout' | 'pay' | 'completed';

export type ShopCartFlexOptions = {
  stage: ShopCartStage;
  payUrl?: string;
  shopUrl?: string;
  cartPageUrl?: string;
};

export const createShopCartFlexMessage = (
  order: OdooSaleOrder,
  options: ShopCartFlexOptions,
  language: Lang,
): messagingApi.FlexMessage => {
  const lines = (order.lines || []).slice(0, 6);
  const extra = (order.lines || []).length - lines.length;
  const stage = options.stage;
  const title = stage === 'completed'
    ? t('shopCompletedTitle', language)
    : stage === 'pay'
      ? t('shopPayTitle', language)
      : stage === 'checkout'
        ? t('shopCheckoutTitle', language)
        : t('shopCartTitle', language);
  const body: messagingApi.FlexComponent[] = [
    ...(lines.length
      ? [{
          type: 'box' as const,
          layout: 'vertical' as const,
          spacing: 'xs' as const,
          contents: [
            ...lines.map(line => ({
              type: 'box' as const,
              layout: 'horizontal' as const,
              backgroundColor: BRAND.paper,
              cornerRadius: BRAND.radius,
              paddingAll: 'sm' as const,
              contents: [
                { type: 'text' as const, text: line.productName || '—', size: 'sm' as const, weight: 'bold' as const, color: BRAND.ink, wrap: true, flex: 3 },
                { type: 'text' as const, text: `× ${line.qty}`, size: 'sm' as const, color: BRAND.inkSoft, align: 'end' as const, flex: 1 },
              ],
            })),
            ...(extra > 0 ? [{ type: 'text' as const, text: `+${extra}`, size: 'xs' as const, color: BRAND.inkSoft }] : []),
          ],
        }]
      : [mutedNoteBox(t('shopCartEmpty', language))]),
    ...(order.note ? [mutedNoteBox(truncate(order.note, 160))] : []),
    amountHighlightBox(t('total', language), formatMoney(order.amount_total, language)),
  ];

  if (stage === 'completed') {
    body.push(mutedNoteBox(t('shopCompletedNote', language)));
  } else if (stage === 'pay') {
    body.push(mutedNoteBox(t('shopPayWebHint', language)));
    if (options.payUrl) {
      body.push(createUriActionButton(t('shopPayWebCta', language), options.payUrl, 'primary', BRAND.teal));
    } else {
      body.push(createMessageActionButton(t('pay', language), 'CART PAY', 'primary', BRAND.teal));
    }
    body.push(createMessageActionButton(t('shopCheckPayment', language), 'CART STATUS', 'secondary', BRAND.goldTint));
    body.push(createMessageActionButton(t('shopCheckoutCta', language), 'CART CHECKOUT', 'secondary', BRAND.tealTint));
  } else if (stage === 'checkout') {
    body.push(mutedNoteBox(t('shopCheckoutNote', language)));
    body.push(createMessageActionButton(t('pay', language), 'CART PAY', 'primary', BRAND.teal));
    body.push(createPrefillButton(t('shopCoupon', language), 'CART COUPON ', 'secondary', BRAND.tealTint));
    body.push(createMessageActionButton(t('shopBackToCart', language), 'CART', 'secondary', BRAND.goldTint));
  } else {
    body.push(createMessageActionButton(t('shopCheckoutCta', language), 'CART CHECKOUT', 'primary', BRAND.teal));
    body.push(createPrefillButton(t('shopCoupon', language), 'CART COUPON ', 'secondary', BRAND.tealTint));
    body.push(createMessageActionButton(t('shopAddProducts', language), 'NAV HOME', 'secondary', BRAND.tealTint));
  }
  if (stage !== 'completed' && options.cartPageUrl) {
    body.push(createUriActionButton(t('shopWebsiteCart', language), options.cartPageUrl, 'secondary', BRAND.goldTint));
  }
  if (stage === 'cart' && options.shopUrl) {
    body.push(createUriActionButton(t('shopStorefront', language), options.shopUrl, 'secondary', BRAND.goldTint));
  }

  const footer: messagingApi.FlexComponent[] = [];
  const removable = lines.find(line => line.productId);
  if (stage === 'cart' && removable?.productId) {
    footer.push(createMessageActionButton(t('shopRemove', language), `CART REMOVE ${removable.productId}`, 'secondary', BRAND.goldTint));
  }
  footer.push(createMessageActionButton(t('customerOrderHistory', language), 'QUOTE LIST', 'secondary', BRAND.tealTint));
  footer.push(createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint));

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
        contents: footer.slice(0, 3),
      },
    },
  };
};
