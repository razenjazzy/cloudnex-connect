import { messagingApi } from '@line/bot-sdk';
import type { OdooSaleOrder } from '../../services/odoo/types';
import type { ErpDeliveryStatus } from '../../erp/adapter';
import { t, tFill, stateLabel, invoiceStatusLabel, type Lang } from '../../services/i18n';
import { bindPostbackData } from '../postback';
import { overlayLabelForText } from '../command-overlay';
import { catalogUiLabel } from '../catalog-ui';
import { BRAND, amountHighlightBox, createDatePickerButton, createMessageActionButton, createPrefillButton, createUriActionButton, flexBubbleStyles, flexHeaderBox, formatMoney, mutedNoteBox, truncate } from './shared';
import { htmlToPlainText } from '../../utils/html';
import type { QuoteAskThread } from '../quote-ask';

const tr = (language: Lang, th: string, en: string): string => (language === 'en' ? en : th);

const QUOTATION_STATE_SEQUENCE = ['draft', 'sent', 'sale'] as const;

const pairButtons = (left: messagingApi.FlexButton, right: messagingApi.FlexButton): messagingApi.FlexBox => ({
  type: 'box',
  layout: 'horizontal',
  spacing: 'md',
  contents: [
    { ...left, flex: 1 },
    { ...right, flex: 1 },
  ],
});

/**
 * Mirrors the real Odoo Sales record's status bar (Quotation -> Quotation
 * Sent -> Sales Order) plus the actions relevant to who's looking at it.
 * `role` controls the action set — an admin can drive the order forward
 * (Confirm/Send); a customer can only Approve their own order or view it.
 * See quotation.ts for the authorization check that keeps that split real
 * (a customer's Approve tap is rejected server-side if the order isn't
 * theirs, regardless of what buttons this card happens to render).
 */
export const createQuotationJourneyFlexMessage = (
  order: OdooSaleOrder,
  options: { role: 'admin' | 'customer'; salesTier?: 'salesperson' | 'sales_manager'; canManageLines?: boolean; portalLink?: string; pdfLink?: string; delivery?: ErpDeliveryStatus; shopMode?: boolean },
  language: Lang
): messagingApi.FlexMessage => {
  const customerView = options.role === 'customer';
  const shopMode = Boolean(options.shopMode && customerView);
  const audience = customerView ? 'customer' : 'staff';
  const customerName = order.partner_id?.[1] || '-';
  const isCancelled = order.state === 'cancel';
  const currentIndex = isCancelled ? -1 : QUOTATION_STATE_SEQUENCE.indexOf(order.state as typeof QUOTATION_STATE_SEQUENCE[number]);

  const invoiceLabel = invoiceStatusLabel(order.invoice_status, language);
  const invoiceChip: messagingApi.FlexBox | null = invoiceLabel ? {
    type: 'box',
    layout: 'horizontal',
    backgroundColor: BRAND.paper,
    cornerRadius: BRAND.radius,
    paddingAll: 'sm',
    contents: [
      { type: 'text', text: t('invoiceField', language), size: 'xs', color: BRAND.inkSoft, flex: 2 },
      { type: 'text', text: invoiceLabel, size: 'sm', color: BRAND.tealStrong, align: 'end', flex: 3, wrap: true },
    ],
  } : null;
  const delivery = options.delivery;
  const deliveryLines = delivery
    ? [
        `${t('deliveryField', language)}: ${delivery.state}${delivery.carrier ? ` · ${delivery.carrier}` : ''}`,
        ...(delivery.trackingRef ? [`${t('trackingField', language)}: ${delivery.trackingRef}`] : []),
        ...(delivery.responsible ? [`${t('deliveryPerson', language)}: ${delivery.responsible}`] : []),
        ...(delivery.scheduledDate ? [delivery.scheduledDate] : []),
      ]
    : [];
  const deliveryChip: messagingApi.FlexBox | null = deliveryLines.length
    ? {
        type: 'box',
        layout: 'vertical',
        backgroundColor: BRAND.paper,
        cornerRadius: BRAND.radius,
        paddingAll: 'sm',
        contents: deliveryLines.map((line, index) => ({
          type: 'text' as const,
          text: line,
          size: 'xs' as const,
          color: index === 0 ? BRAND.tealStrong : BRAND.inkSoft,
          wrap: true,
        })),
      }
    : null;
  const lines = order.lines || [];
  const visibleLines = lines.slice(0, 4);
  const extraCount = lines.length - visibleLines.length;

  const statusRow: messagingApi.FlexBox = isCancelled
    ? {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#F8D7DA',
        cornerRadius: BRAND.radius,
        paddingAll: 'sm',
        contents: [
          { type: 'text', text: stateLabel('cancel', language, audience), align: 'center', weight: 'bold', size: 'sm', color: '#7A271A' },
        ],
      }
    : {
        type: 'box',
        layout: 'horizontal',
        spacing: 'xs',
        contents: QUOTATION_STATE_SEQUENCE.map((state, index) => ({
          type: 'box',
          layout: 'vertical',
          flex: 1,
          cornerRadius: BRAND.radius,
          paddingAll: 'xs',
          backgroundColor: index === currentIndex ? BRAND.teal : BRAND.tealTint,
          contents: [
            {
              type: 'text',
              text: shopMode
                ? (state === 'sent'
                  ? (language === 'en' ? 'Checkout' : 'รอชำระ')
                  : stateLabel(state, language, audience))
                : state === 'sent' && customerView
                  ? catalogUiLabel('glossary-quotation-received', language, { en: 'Quote Received', th: 'รับใบเสนอราคาแล้ว' })
                  : stateLabel(state, language, audience),
              size: 'xxs',
              align: 'center',
              wrap: true,
              color: index === currentIndex ? '#FFFFFF' : BRAND.tealStrong,
              weight: index === currentIndex ? 'bold' : 'regular',
            },
          ],
        })),
      };

  const isDraft = order.state === 'draft';
  const isSent = order.state === 'sent';
  const isSale = order.state === 'sale';

  // Footer: View Quote|PDF, then More|Home (Sales) or Order History above Home (Customer).
  const bodyActions: messagingApi.FlexComponent[] = [];
  if (options.role === 'admin') {
    if (!isCancelled && (isDraft || isSent)) {
      bodyActions.push(pairButtons(
        createMessageActionButton(t('confirm', language), `QUOTE CONFIRM ${order.id}`, 'primary', BRAND.teal),
        createMessageActionButton(t('sendNow', language), `QUOTE SEND ${order.id}`, 'secondary', BRAND.tealTint),
      ));
      if (!order.user_id?.[0]) {
        bodyActions.push(createMessageActionButton(t('assignSalesperson', language), `QUOTE ASSIGN ${order.id}`, 'secondary', BRAND.goldTint));
      }
    }
    if (!isCancelled && isSale) {
      const canCreateInvoice = order.invoice_status === 'to invoice' || order.invoice_status === 'upselling';
      bodyActions.push(canCreateInvoice
        ? pairButtons(
            createMessageActionButton(t('createInvoice', language), `QUOTE INVOICE ${order.id}`, 'primary', BRAND.teal),
            createMessageActionButton(t('sendInvoice', language), `QUOTE INVOICE SEND ${order.id}`, 'secondary', BRAND.tealTint),
          )
        : options.pdfLink
          ? pairButtons(
              createMessageActionButton(t('sendInvoice', language), `QUOTE INVOICE SEND ${order.id}`, 'secondary', BRAND.tealTint),
              createUriActionButton(t('print', language), options.pdfLink, 'secondary', BRAND.goldTint),
            )
          : createMessageActionButton(t('sendInvoice', language), `QUOTE INVOICE SEND ${order.id}`, 'secondary', BRAND.tealTint));
    }
  } else if (!isCancelled && isSent) {
    if (shopMode) {
      if (options.portalLink) {
        bodyActions.push(createUriActionButton(t('pay', language), options.portalLink, 'primary', BRAND.teal));
      }
    } else {
      bodyActions.push(createMessageActionButton(t('confirm', language), `QUOTE APPROVE ${order.id}`, 'primary', BRAND.teal));
    }
  } else if (!isCancelled && isDraft) {
    if (shopMode) {
      if (options.portalLink) {
        bodyActions.push(createUriActionButton(t('pay', language), options.portalLink, 'primary', BRAND.teal));
      }
    } else {
      bodyActions.push(mutedNoteBox(t('quoteWaitingForSales', language)));
    }
  } else if (!isCancelled && isSale && options.portalLink) {
    bodyActions.push(createUriActionButton(t('invoiceField', language), options.portalLink, 'secondary', BRAND.goldTint));
  }
  if (!isCancelled && (isDraft || isSent)) {
    bodyActions.push(pairButtons(
      createMessageActionButton(t('addMore', language), `FORM QUOTE ADD ${order.id}`, 'secondary', BRAND.tealTint),
      createMessageActionButton(t('skip', language), 'NAV HOME', 'secondary', BRAND.goldTint),
    ));
  }

  const footerContents: messagingApi.FlexComponent[] = [];
  if (!isCancelled && (options.portalLink || options.pdfLink)) {
    const linkRow = [
      ...(options.portalLink ? [createUriActionButton(
        customerView
          ? catalogUiLabel('glossary-order-details', language, { en: 'Order Details', th: 'รายละเอียดออเดอร์' })
          : t('viewFullQuotation', language),
        options.portalLink,
        'secondary',
        BRAND.goldTint,
      )] : []),
      ...(options.pdfLink ? [createUriActionButton(t('downloadPdf', language), options.pdfLink, 'secondary', BRAND.goldTint)] : []),
    ];
    footerContents.push(linkRow.length === 1
      ? linkRow[0]
      : { type: 'box', layout: 'horizontal', spacing: 'md', contents: linkRow.map(button => ({ ...button, flex: 1 })) });
  }
  if (options.role === 'admin') {
    footerContents.push(pairButtons(
      createMessageActionButton(t('moreActions', language), `QUOTE MORE ${order.id}`, 'secondary', BRAND.tealTint),
      createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint),
    ));
  } else {
    footerContents.push(createMessageActionButton(
      overlayLabelForText('QUOTE LIST', language, t('customerOrderHistory', language), 'customer'),
      'QUOTE LIST',
      'secondary',
      BRAND.tealTint,
    ));
    footerContents.push(createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint));
  }

  return {
    type: 'flex',
    altText: truncate(`${customerView ? catalogUiLabel('glossary-order-noun', language, { en: 'Order', th: 'คำสั่งซื้อ' }) : t('quotation', language)} ${order.name} — ${customerName} — ${formatMoney(order.amount_total, language)}`, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(order.name, `${t('customer', language)}: ${customerName}`),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          statusRow,
          ...(invoiceChip ? [invoiceChip] : []),
          ...(deliveryChip ? [deliveryChip] : []),
          ...(visibleLines.length ? [{
            type: 'box' as const,
            layout: 'vertical' as const,
            spacing: 'xs' as const,
            contents: [
              { type: 'text' as const, text: t('items', language), size: 'xs' as const, color: BRAND.inkSoft },
              ...visibleLines.map(line => ({
                type: 'box' as const,
                layout: 'horizontal' as const,
                backgroundColor: BRAND.paper,
                cornerRadius: BRAND.radius,
                paddingAll: 'sm' as const,
                contents: [
                  { type: 'text' as const, text: line.productName, size: 'sm' as const, weight: 'bold' as const, color: BRAND.ink, wrap: true, flex: 3 },
                  { type: 'text' as const, text: `× ${line.qty}`, size: 'sm' as const, color: BRAND.inkSoft, align: 'end' as const, flex: 1 },
                ],
              })),
              ...(extraCount > 0 ? [{ type: 'text' as const, text: `+${extraCount} ${t('moreItems', language)}`, size: 'xs' as const, color: BRAND.inkSoft }] : []),
            ],
          }] : []),
          ...(order.note ? [mutedNoteBox(truncate(htmlToPlainText(order.note).replace(/\s+/g, ' '), 200))] : []),
          amountHighlightBox(
            t('total', language),
            formatMoney(order.amount_total, language),
            order.amount_invoiced
              ? [{ type: 'text' as const, text: `${t('invoiceInvoiced', language)}: ${formatMoney(order.amount_invoiced, language)}`, size: 'xs' as const, color: BRAND.inkSoft, wrap: true }]
              : [],
          ),
          ...bodyActions,
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: footerContents.length
          ? footerContents.slice(0, 3)
          : [{ type: 'text', text: ' ', size: 'xs', color: BRAND.surface }],
      },
    },
  };
};

export const createQuotationMoreFlexMessage = (
  order: OdooSaleOrder,
  options: { salesTier?: 'salesperson' | 'sales_manager' },
  language: Lang,
): messagingApi.FlexMessage => {
  const canStillAct = order.state !== 'cancel' && order.state !== 'sale';
  const canInvoice = order.state === 'sale' && (order.invoice_status === 'to invoice' || order.invoice_status === 'upselling');
  const isRestrictedToSalesperson = options.salesTier === 'salesperson';
  const rows: messagingApi.FlexComponent[] = [];
  let cancelButton: messagingApi.FlexButton | null = null;
  if (canStillAct) {
    rows.push(createMessageActionButton(tr(language, 'แก้ไขใบเสนอราคา', 'Edit Quote'), `QUOTE LINES ${order.id}`, 'primary', BRAND.teal));
    if (order.state === 'draft' || order.state === 'sent') {
      rows.push(createMessageActionButton(t('sendViaEmail', language), `QUOTE SEND OPTIONS ${order.id}`, 'secondary', BRAND.tealTint));
    }
    if (!isRestrictedToSalesperson) {
      cancelButton = createMessageActionButton(t('cancelQuote', language), `QUOTE CANCEL ${order.id}`, 'secondary', BRAND.goldTint);
    }
  }
  if (order.state === 'sale') {
    if (canInvoice) {
      rows.push(createMessageActionButton(t('createInvoice', language), `QUOTE INVOICE ${order.id}`, 'primary', BRAND.teal));
    }
    rows.push(createMessageActionButton(t('sendInvoice', language), `QUOTE INVOICE SEND ${order.id}`, 'secondary', BRAND.tealTint));
    if (!isRestrictedToSalesperson && order.invoice_status !== 'invoiced') {
      cancelButton = createMessageActionButton(t('cancelQuote', language), `QUOTE CANCEL ${order.id}`, 'secondary', BRAND.goldTint);
    }
  }
  rows.push(createPrefillButton(t('messageCustomer', language), `QUOTE MESSAGE ${order.id} `, 'secondary', BRAND.tealTint));
  if (canStillAct) {
    rows.push(pairButtons(
      createMessageActionButton(t('addMore', language), `FORM QUOTE ADD ${order.id}`, 'secondary', BRAND.tealTint),
      createMessageActionButton(t('skip', language), 'NAV HOME', 'secondary', BRAND.goldTint),
    ));
  }
  const backButton = createMessageActionButton(t('back', language), `QUOTE STATUS ${order.id}`, 'secondary', BRAND.goldTint);
  rows.push(cancelButton ? pairButtons(cancelButton, backButton) : backButton);

  return {
    type: 'flex',
    altText: truncate(`${t('moreActions', language)} ${order.name}`, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(t('moreActions', language), order.name),
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'lg', contents: rows },
    },
  };
};

export const createQuotationEditFlexMessage = (
  order: OdooSaleOrder,
  language: Lang,
): messagingApi.FlexMessage => {
  const lines = (order.lines || []).slice(0, 8);
  const lineRows: messagingApi.FlexComponent[] = lines.map(line => ({
        type: 'box' as const,
        layout: 'vertical' as const,
        spacing: 'xs' as const,
        backgroundColor: BRAND.paper,
        cornerRadius: BRAND.radius,
        paddingAll: 'sm' as const,
        contents: [
          {
            type: 'box' as const,
            layout: 'horizontal' as const,
            contents: [
              { type: 'text' as const, text: line.productName, size: 'sm' as const, color: BRAND.ink, wrap: true, flex: 3 },
              { type: 'text' as const, text: `× ${line.qty}`, size: 'sm' as const, color: BRAND.inkSoft, align: 'end' as const, flex: 1 },
            ],
          },
          {
            type: 'box' as const,
            layout: 'horizontal' as const,
            spacing: 'md' as const,
            contents: [
              { ...createPrefillButton(t('editItem', language), `QUOTE EDIT ${order.id} ${line.productName},`, 'primary', BRAND.teal), flex: 1 },
              { ...createPrefillButton(tr(language, 'ลบรายการ', 'Remove'), `QUOTE REMOVE ${order.id} ${line.productName}`, 'secondary', BRAND.goldTint), flex: 1 },
            ],
          },
        ],
      }));

  return {
    type: 'flex',
    altText: truncate(`${tr(language, 'แก้ไขใบเสนอราคา', 'Edit Quote')} ${order.name}`, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(tr(language, 'แก้ไขใบเสนอราคา', 'Edit Quote'), order.name),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: tr(language, 'แตะรายการเพื่อแก้จำนวน เพิ่มหรือลบด้านล่าง', 'Tap a line to change qty. Add or remove below.'), size: 'xs', color: BRAND.inkSoft, wrap: true },
          ...lineRows,
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          createPrefillButton(t('addItem', language), `QUOTE ADD ${order.id} `, 'primary', BRAND.teal),
          createMessageActionButton(t('back', language), `QUOTE MORE ${order.id}`, 'secondary', BRAND.goldTint),
        ],
      },
    },
  };
};

export const createQuoteSendComposerFlexMessage = (
  order: OdooSaleOrder,
  email: string | undefined,
  language: Lang,
  kind: 'quotation' | 'invoice' = 'quotation',
  phone?: string,
): messagingApi.FlexMessage => {
  const customerName = order.partner_id?.[1] || '-';
  const isInvoice = kind === 'invoice';
  const confirmPrefix = isInvoice ? `QUOTE INVOICE SEND CONFIRM ${order.id}` : `QUOTE SEND CONFIRM ${order.id}`;
  const subject = isInvoice
    ? (language === 'en' ? `Invoice ${order.name}` : `ใบแจ้งหนี้ ${order.name}`)
    : (language === 'en' ? `Quotation ${order.name}` : `ใบเสนอราคา ${order.name}`);
  const body = isInvoice
    ? (language === 'en'
      ? `Please review invoice ${order.name} (${formatMoney(order.amount_total, language)}).`
      : `กรุณาตรวจสอบใบแจ้งหนี้ ${order.name} (${formatMoney(order.amount_total, language)})`)
    : (language === 'en'
      ? `Please review quotation ${order.name} (${formatMoney(order.amount_total, language)}). Confirm in LINE or Odoo to proceed.`
      : `กรุณาตรวจสอบใบเสนอราคา ${order.name} (${formatMoney(order.amount_total, language)}) ยืนยันใน LINE หรือ Odoo เพื่อดำเนินการต่อ`);
  const emailChips = email ? [email] : [];
  const title = isInvoice ? t('invoiceSendComposerTitle', language) : t('sendComposerTitle', language);
  const emailSuffix = email ? ` ${email}` : '';

  return {
    type: 'flex',
    altText: truncate(title, 390),
    quickReply: {
      items: [
        { type: 'action' as const, action: { type: 'message' as const, label: t('sendViaLine', language), text: `${confirmPrefix} LINE` } },
        { type: 'action' as const, action: { type: 'message' as const, label: t('sendViaEmail', language), text: `${confirmPrefix} EMAIL${emailSuffix}` } },
        { type: 'action' as const, action: { type: 'message' as const, label: t('sendViaBoth', language), text: `${confirmPrefix} BOTH${emailSuffix}` } },
        ...emailChips.map(value => ({
          type: 'action' as const,
          action: { type: 'message' as const, label: value, text: `${confirmPrefix} BOTH ${value}` },
        })),
      ],
    },
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(title, order.name),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          { type: 'text', text: `${t('customer', language)}: ${customerName}`, size: 'sm', color: BRAND.ink, wrap: true },
          { type: 'text', text: `${t('phoneField', language)}: ${phone || '—'}`, size: 'sm', color: BRAND.ink, wrap: true },
          { type: 'text', text: `${t('emailTo', language)}: ${email || '—'}`, size: 'sm', color: BRAND.ink, wrap: true },
          { type: 'text', text: `${t('emailSubject', language)}: ${subject}`, size: 'sm', color: BRAND.ink, wrap: true },
          { type: 'text', text: body, size: 'xs', color: BRAND.inkSoft, wrap: true },
          ...(!phone ? [{ type: 'text' as const, text: t('quoteNotLinked', language), size: 'xs' as const, color: BRAND.gold, wrap: true }] : []),
          ...(!email ? [{ type: 'text' as const, text: t('noPartnerEmail', language), size: 'xs' as const, color: BRAND.gold, wrap: true }] : []),
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            contents: [
              { ...createMessageActionButton(t('sendViaLine', language), `${confirmPrefix} LINE`, 'secondary', BRAND.tealTint), flex: 1 },
              { ...createMessageActionButton(t('sendViaEmail', language), `${confirmPrefix} EMAIL${emailSuffix}`, 'secondary', BRAND.tealTint), flex: 1 },
            ],
          },
          createMessageActionButton(t('sendViaBoth', language), `${confirmPrefix} BOTH${emailSuffix}`, 'primary', BRAND.teal),
          createPrefillButton(t('typeEmail', language), `${confirmPrefix} BOTH `, 'secondary', BRAND.tealTint),
          createMessageActionButton(t('back', language), `QUOTE STATUS ${order.id}`, 'secondary', BRAND.goldTint),
        ],
      },
    },
  };
};

/**
 * Customer "My Orders" / staff "My quotations" — three rows, More, optional date filter.
 */
export const createQuotationListFlexMessage = (
  orders: OdooSaleOrder[],
  hasMore: boolean,
  language: Lang,
  nextCursor?: string,
  dateFrom?: string,
  dateTo?: string,
  userId = '',
  listOptions: { staff?: boolean; admin?: boolean } = {},
): messagingApi.FlexMessage => {
  const listTitle = listOptions.staff ? t('myQuotations', language) : t('customerOrderHistory', language);
  const emptyTitle = listOptions.staff ? t('noQuotationsYet', language) : t('noOrdersYet', language);
  const emptyBody = listOptions.staff ? t('noQuotations', language) : t('noOrders', language);
  const dateQuery = dateFrom && dateTo ? ` FROM ${dateFrom} TO ${dateTo}` : '';
  return {
    type: 'flex',
    altText: truncate(listTitle, 390),
    contents: {
      type: 'bubble',
      styles: flexBubbleStyles,
      header: flexHeaderBox(
        listTitle,
        orders.length ? tFill('listTapHint', language, { n: orders.length }) : emptyTitle,
      ),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: orders.length
          ? orders.map(order => {
              const kind = order.state === 'sale' || order.state === 'done'
                ? t('orderKind', language)
                : (listOptions.staff
                  ? t('quotation', language)
                  : catalogUiLabel('glossary-order-noun', language, { en: 'Order', th: 'คำสั่งซื้อ' }));
              const datePart = order.date_order ? order.date_order.split(' ')[0] : '';
              const customer = order.partner_id?.[1] || '-';
              const assignHint = listOptions.admin && !order.user_id?.[0] ? ` · ${t('assignSalesperson', language)}` : '';
              return {
                type: 'box' as const,
                layout: 'horizontal' as const,
                backgroundColor: BRAND.paper,
                cornerRadius: BRAND.radius,
                paddingAll: 'sm' as const,
                action: {
                  type: 'message' as const,
                  text: listOptions.admin && !order.user_id?.[0] ? `QUOTE ASSIGN ${order.id}` : `QUOTE STATUS ${order.id}`,
                },
                contents: [
                  {
                    type: 'box' as const,
                    layout: 'vertical' as const,
                    flex: 3,
                    contents: [
                      { type: 'text' as const, text: order.name, size: 'sm' as const, color: BRAND.ink, wrap: true },
                      {
                        type: 'text' as const,
                        text: `${kind}: ${datePart} | ${customer}${assignHint}`,
                        size: 'xs' as const, color: BRAND.inkSoft, wrap: true,
                      },
                    ],
                  },
                  {
                    type: 'text' as const,
                    text: formatMoney(order.amount_total, language),
                    size: 'sm' as const, color: BRAND.tealStrong, align: 'end' as const, flex: 2, gravity: 'center' as const,
                  },
                ],
              };
            })
          : [{ type: 'text', text: emptyBody, size: 'sm', color: BRAND.inkSoft, wrap: true }],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: 'lg',
        contents: [
          { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { ...createDatePickerButton(t('dateFrom', language), bindPostbackData('quote.list.from', userId)), flex: 1 },
            { ...createDatePickerButton(t('dateTo', language), bindPostbackData('quote.list.to', userId)), flex: 1 },
          ] },
          ...(hasMore && nextCursor ? [createMessageActionButton(t('nextPage', language), `QUOTE LIST CURSOR ${nextCursor}${dateQuery}`, 'secondary', BRAND.tealTint)] : []),
          ...(listOptions.staff ? [createMessageActionButton(overlayLabelForText('FORM QUOTE CREATE', language, t('createQuote', language)), 'FORM QUOTE CREATE', 'primary', BRAND.teal)] : []),
          createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint),
        ],
      },
    },
  };
};

export const createQuoteAskListFlexMessage = (
  threads: QuoteAskThread[],
  language: Lang,
): messagingApi.FlexMessage => ({
  type: 'flex',
  altText: truncate(t('askForQuotations', language), 390),
  contents: {
    type: 'bubble',
    styles: flexBubbleStyles,
    header: flexHeaderBox(
      t('askForQuotations', language),
      threads.length ? tFill('listTapHint', language, { n: threads.length }) : t('noQuoteAsks', language),
    ),
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: 'lg',
      contents: threads.length
        ? threads.slice(0, 5).map(thread => ({
            type: 'box' as const,
            layout: 'vertical' as const,
            backgroundColor: BRAND.paper,
            cornerRadius: BRAND.radius,
            paddingAll: 'sm' as const,
            spacing: 'xs' as const,
            contents: [
              { type: 'text' as const, text: truncate(thread.ask, 80), size: 'sm' as const, color: BRAND.ink, wrap: true },
              {
                type: 'text' as const,
                text: thread.status === 'replied' ? t('quoteAskReplied', language) : t('quoteAskPending', language),
                size: 'xs' as const,
                color: thread.status === 'replied' ? BRAND.tealStrong : BRAND.inkSoft,
                wrap: true,
              },
              ...(thread.reply
                ? [{
                    type: 'text' as const,
                    text: tFill('quoteAskReply', language, { text: truncate(thread.reply, 80) }),
                    size: 'xs' as const,
                    color: BRAND.inkSoft,
                    wrap: true,
                  }]
                : []),
            ],
          }))
        : [{ type: 'text', text: t('noQuoteAsks', language), size: 'sm', color: BRAND.inkSoft, wrap: true }],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: 'lg',
      contents: [
        createMessageActionButton(t('sendMessage', language), 'FORM MESSAGE REQUEST', 'primary', BRAND.teal),
        createMessageActionButton(t('home', language), 'NAV HOME', 'secondary', BRAND.tealTint),
      ],
    },
  },
});
