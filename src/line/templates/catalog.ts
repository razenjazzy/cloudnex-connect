import { messagingApi } from '@line/bot-sdk';
import { t } from '../../services/i18n';
import { BRAND, createMessageActionButton, createTapRow, flexBubbleStyles, flexHeaderBox, formatMoney, truncate, type ReportLanguage } from './shared';
import { catalogUiLabel, isCatalogUiVisible } from '../catalog-ui';

const flexHero = (imageUrl?: string): { hero: messagingApi.FlexImage } | Record<string, never> => {
  const url = imageUrl?.startsWith('https://') ? imageUrl : undefined;
  if (!url) return {};
  return {
    hero: {
      type: 'image',
      url,
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
    },
  };
};

const stripBubbleHero = (bubble: messagingApi.FlexBubble): messagingApi.FlexBubble => {
  const next = { ...bubble };
  delete next.hero;
  return next;
};

/** LINE rejects the whole reply when a Flex hero URL is not a public image. */
export const stripFlexHeroImages = (messages: messagingApi.Message[]): messagingApi.Message[] =>
  messages.map((msg) => {
    if (msg.type !== 'flex') return msg;
    const contents = msg.contents;
    if (contents.type === 'carousel') {
      return {
        ...msg,
        contents: {
          ...contents,
          contents: contents.contents.map(stripBubbleHero),
        },
      };
    }
    if (contents.type === 'bubble') {
      return { ...msg, contents: stripBubbleHero(contents) };
    }
    return msg;
  });

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
      contents: [createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint)],
    },
  },
});

export type CatalogFlexOptions = {
  channelId?: string;
  description?: string;
};

const priceStockRow = (price: number, stock: number, language: ReportLanguage, channelId?: string): messagingApi.FlexBox => {
  const priceBox: messagingApi.FlexBox = {
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
  };
  if (!isCatalogUiVisible('ui-catalog-stock', channelId)) {
    return { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [priceBox] };
  }
  return {
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    contents: [
      priceBox,
      {
        type: 'box',
        layout: 'vertical',
        flex: 1,
        backgroundColor: BRAND.paper,
        cornerRadius: BRAND.radius,
        paddingAll: 'sm',
        contents: [
          { type: 'text', text: catalogUiLabel('ui-catalog-stock', language, { en: 'Stock', th: 'คงเหลือ' }), size: 'xs', color: BRAND.inkSoft },
          { type: 'text', text: String(stock), size: 'sm', color: BRAND.ink, weight: 'bold', wrap: true },
        ],
      },
    ],
  };
};

export const createProductCardFlexMessage = (
  productName: string,
  price: number,
  stock: number,
  language: ReportLanguage = 'en',
  productId?: number,
  imageUrl?: string,
  options?: CatalogFlexOptions,
): messagingApi.FlexMessage => {
  const quoteText = productId ? `FORM QUOTE CREATE FROM CARD ${productId}` : 'FORM QUOTE CREATE FROM CARD';
  const channelId = options?.channelId;
  const showImage = isCatalogUiVisible('ui-catalog-image', channelId);
  const showQuote = isCatalogUiVisible('ui-product-detail-quote', channelId);
  const showMessage = isCatalogUiVisible('ui-product-detail-message', channelId);
  const showDescription = isCatalogUiVisible('ui-product-detail-description', channelId);
  const description = showDescription ? options?.description?.trim() : undefined;
  const footerButtons: messagingApi.FlexComponent[] = [];
  if (showQuote) {
    footerButtons.push(createMessageActionButton(
      catalogUiLabel('quote-from-card', language, { en: 'Order Now', th: 'สั่งซื้อเลย' }),
      quoteText,
      'primary',
      BRAND.teal,
    ));
  }
  if (showMessage) {
    footerButtons.push(createMessageActionButton(
      catalogUiLabel('ui-product-detail-message', language, { en: 'Send message', th: 'ส่งข้อความ' }),
      productId ? `FORM MESSAGE REQUEST ${productId}` : 'FORM MESSAGE REQUEST',
      'secondary',
      BRAND.tealTint,
    ));
  }
  footerButtons.push({
    type: 'box',
    layout: 'horizontal',
    spacing: 'md',
    contents: [
      { ...createMessageActionButton(catalogUiLabel('ui-product-detail-back', language, { en: 'Back', th: 'กลับ' }), 'BACK', 'secondary', BRAND.tealTint), flex: 1 },
      { ...createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint), flex: 1 },
    ],
  });
  const bodyContents: messagingApi.FlexComponent[] = [
    { type: 'text', text: productName, weight: 'bold', size: 'xl', color: BRAND.ink, wrap: true },
    priceStockRow(price, stock, language, channelId),
  ];
  if (description) {
    bodyContents.push({ type: 'text', text: truncate(description, 240), size: 'sm', color: BRAND.inkSoft, wrap: true });
  }
  return {
    type: 'flex',
    altText: truncate(language === 'en' ? `Product: ${productName}` : `สินค้า: ${productName}`, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      ...flexHero(showImage ? imageUrl : undefined),
      header: flexHeaderBox(t('productDetail', language), t('productNext', language)),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: bodyContents,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: footerButtons,
      },
    },
  };
};

export type CatalogCarouselItem = { id?: number; name: string; sku?: string; price?: number; quantity?: number; imageUrl?: string; description?: string };

const createProductCatalogBubble = (
  product: CatalogCarouselItem,
  language: ReportLanguage,
  viewText: string,
  channelId?: string,
): messagingApi.FlexBubble => {
  const quoteText = product.id
    ? `FORM QUOTE CREATE FROM CARD ${product.id}`
    : viewText;
  const showImage = isCatalogUiVisible('ui-catalog-image', channelId);
  const showQuote = isCatalogUiVisible('quote-from-card', channelId);
  const showMessage = isCatalogUiVisible('ui-catalog-message', channelId);
  const showView = isCatalogUiVisible('ui-catalog-view', channelId);
  const footer: messagingApi.FlexComponent[] = [];
  if (showQuote) {
    footer.push(createMessageActionButton(
      catalogUiLabel('quote-from-card', language, { en: 'Order Now', th: 'สั่งซื้อเลย' }),
      quoteText,
      'primary',
      BRAND.teal,
    ));
  }
  if (showMessage) {
    footer.push(createMessageActionButton(
      catalogUiLabel('ui-catalog-message', language, { en: 'Send message', th: 'ส่งข้อความ' }),
      product.id ? `FORM MESSAGE REQUEST ${product.id}` : 'FORM MESSAGE REQUEST',
      'secondary',
      BRAND.tealTint,
    ));
  }
  if (showView || footer.length === 0) {
    footer.push(createMessageActionButton(
      catalogUiLabel('ui-catalog-view', language, { en: 'View Details', th: 'ดูรายละเอียด' }),
      viewText,
      'secondary',
      BRAND.tealTint,
    ));
  }
  return {
    type: 'bubble',
    size: 'kilo',
    styles: flexBubbleStyles,
    ...flexHero(showImage ? product.imageUrl : undefined),
    header: flexHeaderBox(truncate(product.name, 40), product.sku || t('productCatalog', language)),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [priceStockRow(product.price || 0, product.quantity || 0, language, channelId)],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: 'lg',
      contents: footer,
    },
  };
};

export const createProductCarouselFlexMessage = (
  products: CatalogCarouselItem[],
  language: ReportLanguage,
  viewFor?: (item: CatalogCarouselItem) => string,
  channelId?: string,
): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: truncate(language === 'en' ? `${products.length} products` : `สินค้า ${products.length} รายการ`, 390),
  contents: {
    type: 'carousel',
    contents: products.slice(0, 10).map(product =>
      createProductCatalogBubble(product, language, (viewFor || (item => `PRODUCT FIND ${item.name}`))(product), channelId),
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
          createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint),
        ],
      },
    },
  };
};
