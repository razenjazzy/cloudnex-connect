import { messagingApi } from '@line/bot-sdk';
import { t } from '../../services/i18n';
import { BRAND, createMessageActionButton, createTapRow, flexBubbleStyles, flexHeaderBox, formatMoney, truncate, type ReportLanguage } from './shared';

/**
 * PRODUCT FIND <query> shown when the search matched more than one
 * product — previously the handler silently acted on whichever row Odoo
 * happened to return first with no indication others matched. Tapping a
 * row re-issues PRODUCT FIND with that exact name, which always resolves
 * to a single match.
 */
export const createProductPickerFlexMessage = (
  products: { name: string; price?: number }[],
  language: ReportLanguage,
): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: language === 'en' ? `${products.length} products found` : `พบสินค้า ${products.length} รายการ`,
  contents: {
    type: 'bubble',
    styles: flexBubbleStyles,
    header: flexHeaderBox(
      language === 'en' ? 'Multiple products matched' : 'พบสินค้าหลายรายการ',
      language === 'en' ? 'Tap the one you meant' : 'แตะเลือกสินค้าที่ต้องการ',
    ),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'lg',
      contents: products.map(product => createTapRow(
        product.price !== undefined ? `${product.name} — ${formatMoney(product.price, language)}` : product.name,
        `PRODUCT FIND ${product.name}`,
        BRAND.tealTint,
        BRAND.tealStrong,
        'md',
      )),
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.goldTint)],
    },
  },
});

export const createProductCardFlexMessage = (productName: string, price: number, stock: number, language: ReportLanguage = 'en'): messagingApi.FlexMessage => {
  return {
    type: 'flex',
    altText: truncate(language === 'en' ? `Product: ${productName}` : `สินค้า: ${productName}`, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(t('productDetail', language), t('productNext', language)),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: productName, weight: 'bold', size: 'xl', color: BRAND.ink, wrap: true },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                backgroundColor: BRAND.tealTint,
                cornerRadius: BRAND.radius,
                paddingAll: 'sm',
                contents: [
                  { type: 'text', text: t('price', language), size: 'xs', color: BRAND.inkSoft },
                  { type: 'text', text: formatMoney(price, language), size: 'sm', color: BRAND.tealStrong, weight: 'bold', wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                backgroundColor: BRAND.goldTint,
                cornerRadius: BRAND.radius,
                paddingAll: 'sm',
                contents: [
                  { type: 'text', text: t('stock', language), size: 'xs', color: BRAND.inkSoft },
                  { type: 'text', text: String(stock), size: 'sm', color: BRAND.ink, weight: 'bold', wrap: true },
                ],
              },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          createMessageActionButton(t('createQuote', language), 'FORM QUOTE CREATE FROM CARD', 'primary', BRAND.teal),
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              { ...createMessageActionButton(t('searchAgain', language), 'FORM PRODUCT FIND', 'secondary', BRAND.tealTint), flex: 1 },
              { ...createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.goldTint), flex: 1 },
            ],
          },
        ],
      },
    },
  };
};

export const createProductCarouselFlexMessage = (
  products: { name: string; price?: number; quantity?: number }[],
  language: ReportLanguage,
): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: language === 'en' ? `${products.length} products` : `สินค้า ${products.length} รายการ`,
  contents: {
    type: 'carousel',
    contents: products.slice(0, 10).map(product =>
      (createProductCardFlexMessage(product.name, product.price || 0, product.quantity || 0, language).contents as messagingApi.FlexBubble),
    ),
  },
});

export const createOrderSummaryFlexMessage = (total: number, language: ReportLanguage = 'en', orderId?: number): messagingApi.FlexMessage => {
  return {
    type: 'flex',
    altText: language === 'en' ? 'Order summary' : 'สรุปคำสั่งซื้อ',
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(
        language === 'en' ? 'Quotation created' : 'สร้างใบเสนอราคาแล้ว',
        language === 'en' ? 'Summary and next steps' : 'สรุปและขั้นตอนถัดไป',
      ),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: BRAND.tealTint,
            cornerRadius: BRAND.radius,
            paddingAll: 'md',
            contents: [
              { type: 'text', text: t('total', language), size: 'xs', color: BRAND.inkSoft },
              { type: 'text', text: formatMoney(total, language), size: 'xl', color: BRAND.tealStrong, weight: 'bold', wrap: true },
            ],
          },
          { type: 'text', text: language === 'en' ? 'Please follow your payment workflow.' : 'กรุณาชำระเงินตามขั้นตอนที่ร้านกำหนด', size: 'sm', wrap: true, color: BRAND.inkSoft },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          createMessageActionButton(
            t('checkOrder', language),
            orderId ? `QUOTE STATUS ${orderId}` : 'FORM ORDER STATUS',
            'primary',
            BRAND.teal,
          ),
          createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.goldTint),
        ],
      },
    },
  };
};
