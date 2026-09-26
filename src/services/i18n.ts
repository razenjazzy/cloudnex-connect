import type { UserLanguage } from './firestore';

/**
 * Single bilingual source of truth for LINE Flex, forms, and Odoo domain terms.
 * Languages are EN and TH only. Handlers should call `t` / `tFill` / `pickLocale`
 * instead of English-only literals.
 *
 * Reuses UserLanguage ('th' | 'en') rather than introducing a third
 * language type — every call site elsewhere already threads that type.
 */
export type Lang = UserLanguage;

/**
 * The authoritative list is `sale.order`'s own `state` selection field,
 * verified live against the real Odoo instance:
 *   draft -> Quotation, sent -> Quotation Sent, sale -> Sales Order,
 *   cancel -> Cancelled. `done` is included too since some Odoo versions
 *   still emit it for a locked order even though it's deprecated in newer
 *   ones. Never hardcode a 6th value here without re-checking against the
 *   live `fields_get` selection first — see documents for the debug-script
 *   technique used to verify this during planning.
 */
export type OdooSaleOrderState = 'draft' | 'sent' | 'sale' | 'cancel' | 'done';

export const ODOO_STATE_LABELS: Record<OdooSaleOrderState, { en: string; th: string }> = {
  draft: { en: 'Quotation', th: 'ใบเสนอราคา' },
  sent: { en: 'Quotation Sent', th: 'ส่งใบเสนอราคาแล้ว' },
  sale: { en: 'Sales Order', th: 'คำสั่งขาย' },
  cancel: { en: 'Cancelled', th: 'ยกเลิกแล้ว' },
  done: { en: 'Locked', th: 'ล็อกแล้ว' },
};

export const UI_STRINGS = {
  quotation: { en: 'Quotation', th: 'ใบเสนอราคา' },
  customer: { en: 'Customer', th: 'ลูกค้า' },
  items: { en: 'Items', th: 'รายการ' },
  total: { en: 'Total', th: 'ยอดรวม' },
  status: { en: 'Status', th: 'สถานะ' },
  moreItems: { en: 'more item(s)', th: 'รายการเพิ่มเติม' },
  preview: { en: 'Preview', th: 'ดูตัวอย่าง' },
  sendToCustomer: { en: 'Send to customer', th: 'ส่งให้ลูกค้า' },
  confirm: { en: 'Confirm', th: 'ยืนยันคำสั่งซื้อ' },
  approve: { en: 'Approve', th: 'อนุมัติ' },
  moreActions: { en: 'More', th: 'เพิ่มเติม' },
  sendNow: { en: 'Send', th: 'ส่ง' },
  createMore: { en: 'Create More', th: 'สร้างเพิ่ม' },
  sendComposerTitle: { en: 'Send quotation', th: 'ส่งใบเสนอราคา' },
  invoiceSendComposerTitle: { en: 'Send invoice', th: 'ส่งใบแจ้งหนี้' },
  sendInvoice: { en: 'Send Invoice', th: 'ส่งใบแจ้งหนี้' },
  invoiceSentToCustomer: { en: 'Invoice sent to the customer.', th: 'ส่งใบแจ้งหนี้ให้ลูกค้าแล้ว' },
  emailTo: { en: 'To', th: 'ถึง' },
  emailSubject: { en: 'Subject', th: 'เรื่อง' },
  noPartnerEmail: { en: 'No email on this customer. Type one below or send via LINE if they verified.', th: 'ลูกค้ายังไม่มีอีเมล พิมพ์อีเมลด้านล่าง หรือส่งทาง LINE ได้ถ้ายืนยันตัวตนแล้ว' },
  typeEmail: { en: 'Type email', th: 'พิมพ์อีเมล' },
  nextPage: { en: 'Next 5', th: 'ถัดไป 5 รายการ' },
  filterDates: { en: 'Filter dates', th: 'กรองวันที่' },
  // Kept short deliberately — this button often sits half-width next to
  // "Download", and a longer label gets visually clipped by the LINE
  // client itself (its width-based clipping, not the 20-char cap below).
  viewFullQuotation: { en: 'View Quote', th: 'ดูใบเสนอราคา' },
  quoteSentToAdmin: { en: 'Quotation sent to the customer to Confirm or Approve.', th: 'ส่งใบเสนอราคาให้ลูกค้าเพื่อยืนยันหรืออนุมัติแล้ว' },
  sentViaLine: { en: 'Quotation sent to the customer on LINE to Confirm or Approve.', th: 'ส่งใบเสนอราคาให้ลูกค้าทาง LINE เพื่อยืนยันหรืออนุมัติแล้ว' },
  sentViaEmail: { en: 'Sent to the customer by email.', th: 'ส่งให้ลูกค้าทางอีเมลแล้ว' },
  sentViaBoth: { en: 'Quotation sent on LINE and by email for the customer to Confirm or Approve.', th: 'ส่งใบเสนอราคาทาง LINE และอีเมลให้ลูกค้าเพื่อยืนยันหรืออนุมัติแล้ว' },
  sendViaLine: { en: 'Send LINE', th: 'ส่ง LINE' },
  sendViaEmail: { en: 'Send Email', th: 'ส่งอีเมล' },
  sendViaBoth: { en: 'Send both', th: 'ส่งทั้งคู่' },
  phoneField: { en: 'Phone', th: 'เบอร์โทร' },
  quoteLineNotDelivered: {
    en: 'LINE was not delivered. The partner needs a phone on the quotation, or the customer must open Cloudnex Customer.',
    th: 'ส่งทาง LINE ไม่สำเร็จ ต้องมีเบอร์บนใบเสนอราคา หรือลูกค้าต้องเปิด Cloudnex Customer',
  },
  quoteNotLinked: {
    en: 'This customer has not opened the Official Account yet. Share the Add friend link below or send email. They do not need VERIFY to receive it.',
    th: 'ลูกค้ายังไม่ได้เพิ่ม Official Account นี้ ส่งลิงก์เพิ่มเพื่อนด้านล่างหรือส่งอีเมล ลูกค้าไม่ต้อง VERIFY เพื่อรับใบเสนอราคา',
  },
  addFriend: { en: 'Add friend', th: 'เพิ่มเพื่อน' },
  quoteNotYours: {
    en: "This quotation isn't linked to your account.",
    th: 'ใบเสนอราคานี้ไม่ได้ผูกกับบัญชีของคุณ',
  },
  quoteWaitingForSales: {
    en: 'Sales will send this quote. You can approve it after it arrives.',
    th: 'ฝ่ายขายจะส่งใบเสนอราคานี้ คุณอนุมัติได้เมื่อได้รับแล้ว',
  },
  deliveryField: { en: 'Delivery', th: 'การจัดส่ง' },
  trackingField: { en: 'Tracking', th: 'เลขติดตาม' },
  deliveryPerson: { en: 'Responsible', th: 'ผู้รับผิดชอบ' },
  quoteApproved: { en: 'Quotation approved. Thank you!', th: 'อนุมัติใบเสนอราคาแล้ว ขอบคุณค่ะ' },
  quoteApprovedStaff: { en: 'Customer approved. Next: Invoice or Send Invoice.', th: 'ลูกค้าอนุมัติแล้ว ขั้นถัดไป: ใบแจ้งหนี้ หรือ ส่งใบแจ้งหนี้' },
  quoteNotFound: { en: 'Quotation not found.', th: 'ไม่พบใบเสนอราคานี้' },
  addItem: { en: 'Add item', th: 'เพิ่มรายการ' },
  addMore: { en: 'Add More', th: 'เพิ่มสินค้า' },
  editItem: { en: 'Edit item', th: 'แก้ไขรายการ' },
  editQuote: { en: 'Edit Quote', th: 'แก้ไขใบเสนอราคา' },
  editQuoteHint: { en: 'Tap a line to change qty. Add or remove below.', th: 'แตะรายการเพื่อแก้จำนวน เพิ่มหรือลบด้านล่าง' },
  removeItem: { en: 'Remove', th: 'ลบรายการ' },
  cancelQuote: { en: 'Cancel', th: 'ยกเลิก' },
  createInvoice: { en: 'Invoice', th: 'ใบแจ้งหนี้' },
  downloadPdf: { en: 'Download', th: 'ดาวน์โหลด' },
  print: { en: 'Print', th: 'พิมพ์' },
  myQuotations: { en: 'My quotations', th: 'ใบเสนอราคาของฉัน' },
  myOrders: { en: 'My Orders', th: 'คำสั่งซื้อของฉัน' },
  askForQuotations: { en: 'Ask for Quotations', th: 'ขอใบเสนอราคา' },
  quoteAskPending: { en: 'Status: Pending', th: 'สถานะ: รอตอบ' },
  quoteAskReplied: { en: 'Status: Replied', th: 'สถานะ: ตอบแล้ว' },
  quoteAskReply: { en: 'Reply: {text}', th: 'ตอบ: {text}' },
  noQuoteAsks: { en: 'No quotation requests yet. Send a message to sales.', th: 'ยังไม่มีคำขอใบเสนอราคา ส่งข้อความถึงฝ่ายขายได้' },
  noOrders: { en: 'No orders found.', th: 'ไม่พบคำสั่งซื้อ' },
  noOrdersYet: { en: 'No orders yet', th: 'ยังไม่มีคำสั่งซื้อ' },
  noQuotations: { en: "No quotations found.", th: 'ไม่พบใบเสนอราคา' },
  moreQuotations: { en: 'More quotations exist — ask an admin to narrow the search.', th: 'มีใบเสนอราคาเพิ่มเติม — กรุณาแจ้งแอดมินให้ช่วยค้นหาแบบเจาะจงมากขึ้น' },
  messageCustomer: { en: 'Message customer', th: 'ส่งข้อความลูกค้า' },
  home: { en: 'Home', th: 'หน้าหลัก' },
  back: { en: 'Back', th: 'ย้อนกลับ' },
  skip: { en: 'Skip', th: 'ข้าม' },
  cancelForm: { en: 'Cancel', th: 'ยกเลิก' },
  pickDate: { en: '📅 Pick date', th: '📅 เลือกวันที่' },
  dateFrom: { en: '📅 From', th: '📅 จาก' },
  dateTo: { en: '📅 To', th: '📅 ถึง' },
  createQuote: { en: 'Create quote', th: 'สร้างใบเสนอราคา' },
  searchAgain: { en: 'Search again', th: 'ค้นหาอีกครั้ง' },
  viewProduct: { en: 'View', th: 'ดูสินค้า' },
  productCatalog: { en: 'Catalog', th: 'สินค้า' },
  productDetail: { en: 'Product detail', th: 'รายละเอียดสินค้า' },
  productNext: { en: 'Review and choose the next action', th: 'ตรวจสอบข้อมูลแล้วเลือกขั้นตอนต่อไป' },
  price: { en: 'Price', th: 'ราคา' },
  stock: { en: 'Stock', th: 'คงเหลือ' },
  checkOrder: { en: 'Check order', th: 'เช็คออเดอร์' },
  retryStatus: { en: 'Check status', th: 'เช็คสถานะ' },
  listTapHint: { en: '{n} found — tap one for details', th: 'พบ {n} รายการ — แตะเพื่อดูรายละเอียด' },
  noQuotationsYet: { en: 'No quotations yet', th: 'ยังไม่มีใบเสนอราคา' },
  orderKind: { en: 'Order', th: 'คำสั่งขาย' },
  needsAttention: { en: 'Needs attention', th: 'ต้องตรวจสอบ' },
  notice: { en: 'Notice', th: 'แจ้งเตือน' },
  done: { en: 'Done', th: 'สำเร็จ' },
  nextStepHint: { en: 'Use the buttons below for the next step.', th: 'ใช้ปุ่มด้านล่างเพื่อไปขั้นตอนถัดไป' },
  tapOptionOrType: { en: 'Tap an option below, or type your own answer.', th: 'แตะเลือกตัวเลือกด้านล่าง หรือพิมพ์คำตอบเอง' },
  pickDateOrType: { en: 'Pick a date, or type YYYY-MM-DD.', th: 'เลือกวันที่ หรือพิมพ์ YYYY-MM-DD' },
  typeAnswer: { en: 'Please type your answer in the chat box.', th: 'กรุณาพิมพ์คำตอบในช่องแชท' },
  stepOf: { en: 'Step {current} of {total}', th: 'ขั้นตอน {current} จาก {total}' },
  optionalSummaryHint: { en: 'Optional — tap any to fill, or finalize as-is', th: 'ไม่บังคับ — แตะเพื่อกรอก หรือสร้างได้เลย' },
  requiredResumeHint: { en: 'Saved from last time — continue or change', th: 'บันทึกไว้แล้ว — ทำต่อหรือแก้ไข' },
  continueForm: { en: 'Continue', th: 'ทำต่อ' },
  changeForm: { en: 'Change', th: 'เปลี่ยน' },
  sendMessage: { en: 'Send Message', th: 'ส่งข้อความ' },
  tapService: { en: 'Tap a service to continue', th: 'เลือกบริการเพื่อเริ่มใช้งาน' },
  chooseAction: { en: 'Choose one action', th: 'เลือกสิ่งที่ต้องการทำ' },
  languageToggle: { en: 'Language', th: 'ภาษา' },
  guide: { en: 'Guide', th: 'คู่มือ' },
  invoiceField: { en: 'Invoice', th: 'ใบแจ้งหนี้' },
  invoiceToInvoice: { en: 'To invoice', th: 'รอเปิดบิล' },
  invoiceInvoiced: { en: 'Invoiced', th: 'เปิดบิลแล้ว' },
  invoiceUpselling: { en: 'Upselling', th: 'เสนอเพิ่ม' },
  myData: { en: 'My data', th: 'ข้อมูลของฉัน' },
  deleteMyData: { en: 'Delete my data', th: 'ลบข้อมูล' },
  quoteReceivedTitle: { en: 'Quotation received', th: 'รับใบเสนอราคาแล้ว' },
  quoteReceivedWaitingSales: {
    en: 'Quotation {name} was received. Waiting for sales to send it. You can add more products or open My Orders.',
    th: 'รับใบเสนอราคา {name} แล้ว รอฝ่ายขายส่ง คุณเพิ่มสินค้าหรือเปิดคำสั่งซื้อของฉันได้',
  },
  quoteCreatedStaffTitle: { en: 'Quotation created', th: 'สร้างใบเสนอราคาแล้ว' },
  quoteCreatedStaffUnassigned: {
    en: 'Quotation {name} has no salesperson. Assign in Odoo, then Confirm or Send.',
    th: 'ใบเสนอราคา {name} ยังไม่มีพนักงานขาย มอบหมายใน Odoo แล้วกดยืนยันหรือส่ง',
  },
  quoteCreatedStaffNext: {
    en: 'Quotation {name} created. Confirm or Send when ready.',
    th: 'สร้างใบเสนอราคา {name} แล้ว กดยืนยันหรือส่งเมื่อพร้อม',
  },
  quoteLineAddedTitle: { en: 'Item added', th: 'เพิ่มรายการแล้ว' },
  quoteLineAddedWaitingSales: {
    en: 'The product was added. Waiting for sales to send this quote.',
    th: 'เพิ่มสินค้าแล้ว รอฝ่ายขายส่งใบเสนอราคานี้',
  },
  quoteLineAddedStaff: {
    en: 'The product was added. Send when the quote is ready.',
    th: 'เพิ่มสินค้าแล้ว ส่งได้เมื่อใบเสนอราคาพร้อม',
  },
  quoteLineEditedTitle: { en: 'Quantity updated', th: 'อัปเดตจำนวนแล้ว' },
  quoteLineEdited: { en: 'Line quantity was updated. Send when ready.', th: 'แก้จำนวนแล้ว ส่งได้เมื่อพร้อม' },
  quoteLineRemovedTitle: { en: 'Item removed', th: 'ลบรายการแล้ว' },
  quoteLineRemoved: { en: 'The line was removed. Send when ready.', th: 'ลบรายการแล้ว ส่งได้เมื่อพร้อม' },
  quoteConfirmedTitle: { en: 'Quotation confirmed', th: 'ยืนยันใบเสนอราคาแล้ว' },
  quoteConfirmedStaff: {
    en: 'Confirmed as a sales order. Next: Invoice or Send Invoice (manual).',
    th: 'ยืนยันเป็นคำสั่งขายแล้ว ขั้นถัดไป: ใบแจ้งหนี้ หรือ ส่งใบแจ้งหนี้ (ทำเอง)',
  },
  quoteInvoiceCreatedTitle: { en: 'Invoice created', th: 'สร้างใบแจ้งหนี้แล้ว' },
  quoteInvoiceCreated: {
    en: 'Invoice created. Send it when Accounting is ready.',
    th: 'สร้างใบแจ้งหนี้แล้ว ส่งได้เมื่อบัญชีพร้อม',
  },
  actionVerifiedContinue: { en: 'Continuing to the next step.', th: 'ดำเนินการต่อในขั้นตอนถัดไป' },
  otpMissingVerifyUrl: {
    en: 'Cannot open the verify page. Set PUBLIC_BASE_URL and retry the action.',
    th: 'เปิดหน้ายืนยันไม่ได้ ตั้ง PUBLIC_BASE_URL แล้วลองคำสั่งเดิมอีกครั้ง',
  },
  replyDroppedLimit: { en: 'Reply was too large', th: 'ข้อความยาวเกิน' },
  replyDroppedLimitBody: {
    en: 'The result was trimmed so LINE could deliver it. Open My quotations or Home.',
    th: 'ตัดข้อความเพื่อให้ส่งได้ เปิดใบเสนอราคาของฉันหรือหน้าแรก',
  },
  replyDeliverFailed: { en: 'Could not show the card', th: 'แสดงการ์ดไม่สำเร็จ' },
  replyDeliverFailedBody: {
    en: 'The request finished. Open My quotations or Home for the next step.',
    th: 'คำขอเสร็จแล้ว เปิดใบเสนอราคาของฉันหรือหน้าแรกสำหรับขั้นตอนถัดไป',
  },
  inboundLeadTitle: { en: 'Customer message', th: 'ข้อความลูกค้า' },
  inboundFromCustomer: {
    en: 'Customer wrote: {text}',
    th: 'ลูกค้าเขียน: {text}',
  },
  inboundAssigned: { en: 'Assigned. Create a quotation when ready.', th: 'มอบหมายแล้ว สร้างใบเสนอราคาได้' },
  assignSalesperson: { en: 'Assign', th: 'มอบหมาย' },
  waitingForCustomerReply: {
    en: 'Waiting for the customer to reply or approve.',
    th: 'รอลูกค้าตอบหรืออนุมัติ',
  },
} as const;

export type UiStringKey = keyof typeof UI_STRINGS;

/** Non-empty when both locales are blank. Never return '' to LINE or Admin. */
export const EMPTY_COPY = '—';

export const pickLocale = (language: Lang, pair: { en?: string; th?: string }): string => {
  const en = (pair.en || '').trim();
  const th = (pair.th || '').trim();
  const preferred = language === 'th' ? th : en;
  if (preferred) return preferred;
  if (en) return en;
  if (th) return th;
  return EMPTY_COPY;
};

/** Same shape as the existing `tr(language, th, en)` helper repeated in every handler file, just table-driven. */
export const t = (key: UiStringKey, language: Lang): string => pickLocale(language, UI_STRINGS[key]);

export const tFill = (key: UiStringKey, language: Lang, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [name, value]) => acc.split(`{${name}}`).join(String(value)), t(key, language));

export const invoiceStatusLabel = (status: string | undefined, language: Lang): string => {
  if (status === 'to invoice') return t('invoiceToInvoice', language);
  if (status === 'invoiced') return t('invoiceInvoiced', language);
  if (status === 'upselling') return t('invoiceUpselling', language);
  return '';
};

export const stateLabel = (state: string, language: Lang): string => {
  const entry = ODOO_STATE_LABELS[state as OdooSaleOrderState];
  return entry ? entry[language] : state;
};
