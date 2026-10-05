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

/** Customer OA journey chips. Sales OA keeps ODOO_STATE_LABELS. */
export const ODOO_STATE_LABELS_CUSTOMER: Record<OdooSaleOrderState, { en: string; th: string }> = {
  draft: { en: 'Order', th: 'คำสั่งซื้อ' },
  sent: { en: 'Quote Received', th: 'รับใบเสนอราคาแล้ว' },
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
  quoteApprovedProcessing: {
    en: '{name} is processing your order.',
    th: '{name} กำลังดำเนินการคำสั่งซื้อของคุณ',
  },
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
  customerOrderHistory: { en: 'Order History', th: 'ประวัติคำสั่งซื้อ' },
  customerOrderDetails: { en: 'Order Details', th: 'รายละเอียดออเดอร์' },
  customerRequestForOrder: { en: 'Request for Order', th: 'ขอสั่งซื้อ' },
  customerRequestAccepted: { en: 'Request accepted. We will get back to you soon.', th: 'รับคำขอแล้ว เราจะติดต่อกลับโดยเร็ว' },
  askForQuotations: { en: 'Ask for Quotations', th: 'ขอใบเสนอราคา' },
  quoteAskPending: { en: 'Status: Pending', th: 'สถานะ: รอตอบ' },
  quoteAskReplied: { en: 'Status: Replied', th: 'สถานะ: ตอบแล้ว' },
  quoteAskReply: { en: 'Reply: {text}', th: 'ตอบ: {text}' },
  noQuoteAsks: { en: 'No quotation requests yet. Send a message to sales.', th: 'ยังไม่มีคำขอใบเสนอราคา ส่งข้อความถึงฝ่ายขายได้' },
  noOrders: { en: 'No orders found.', th: 'ไม่พบคำสั่งซื้อ' },
  noOrdersYet: { en: 'No orders yet', th: 'ยังไม่มีคำสั่งซื้อ' },
  noQuotations: { en: "No quotations found.", th: 'ไม่พบใบเสนอราคา' },
  quoteSalespersonUnlinked: { en: 'Your LINE account is not linked to an Odoo salesperson, so this list shows quotes for your own contact instead. Ask an admin to link you.', th: 'บัญชี LINE ของคุณยังไม่ได้ผูกกับพนักงานขายใน Odoo รายการนี้จึงแสดงใบเสนอราคาของผู้ติดต่อของคุณแทน กรุณาติดต่อผู้ดูแลเพื่อผูกบัญชี' },
  salesVerifyRequired: { en: '{prefix}Please verify with your Odoo phone number to use Sales. Verification lasts {ttl} and ends after {idle} of inactivity.', th: '{prefix}กรุณายืนยันตัวตนด้วยเบอร์โทรใน Odoo เพื่อใช้งาน Sales การยืนยันใช้ได้ {ttl} และสิ้นสุดเมื่อไม่มีการใช้งานเกิน {idle}' },
  orderAgain: { en: 'Order Again', th: 'สั่งซ้ำ' },
  quoteAgain: { en: 'Quote Again', th: 'ทำใบเสนอราคาซ้ำ' },
  againNoLines: { en: 'This order has no product line to repeat. Start a new one from the catalog.', th: 'ออเดอร์นี้ไม่มีรายการสินค้าให้สั่งซ้ำ กรุณาเริ่มใหม่จากแคตตาล็อก' },
  againMoreLines: { en: 'Repeated the first item of this order. Tap Add more to add the others.', th: 'สั่งซ้ำรายการแรกของออเดอร์นี้แล้ว แตะ เพิ่มสินค้า เพื่อเพิ่มรายการอื่น' },
  salesAccountSignedIn: { en: 'Signed in', th: 'เข้าสู่ระบบแล้ว' },
  salesAccountUntil: { en: 'Session until {time}', th: 'ใช้งานได้ถึง {time}' },
  salesAccountIdle: { en: 'Signs out after {idle} idle', th: 'ออกจากระบบเมื่อไม่ใช้งาน {idle}' },
  salesRoleAdmin: { en: 'Admin', th: 'ผู้ดูแลระบบ' },
  salesRoleManager: { en: 'Sales Administrator', th: 'ผู้ดูแลฝ่ายขาย' },
  salesRoleUser: { en: 'Sales User', th: 'พนักงานขาย' },
  salesVerifyAgain: { en: 'Verify', th: 'ยืนยันตัวตน' },
  salesSignOut: { en: 'Sign out', th: 'ออกจากระบบ' },
  salesPhoneNotInOdoo: { en: '{prefix}No Odoo Sales User matches {phone}. Sales access uses the phone saved on your Sales User in Odoo. Ask an admin to add it, or try another phone.', th: '{prefix}ไม่พบผู้ใช้ฝ่ายขาย Odoo ที่ตรงกับเบอร์ {phone} การเข้าใช้ Sales ใช้เบอร์ที่บันทึกในผู้ใช้ฝ่ายขายใน Odoo กรุณาให้ผู้ดูแลเพิ่มเบอร์ หรือลองเบอร์อื่น' },
  salesAskAdminSent: { en: '{prefix}Your request was sent to the admins. They can add your phone on your Sales User in Odoo. Then tap Verify again.', th: '{prefix}ส่งคำขอให้ผู้ดูแลแล้ว ผู้ดูแลสามารถเพิ่มเบอร์ของคุณในผู้ใช้ฝ่ายขายใน Odoo จากนั้นแตะ ยืนยันตัวตน อีกครั้ง' },
  salesAskAdminAlready: { en: '{prefix}Your request was already sent a moment ago. Please wait for an admin, or try another phone.', th: '{prefix}ส่งคำขอไปแล้วเมื่อสักครู่ กรุณารอผู้ดูแล หรือลองเบอร์อื่น' },
  salesAskAdminNone: { en: '{prefix}No admin is set up to receive requests yet. Please contact your administrator directly, or try another phone.', th: '{prefix}ยังไม่มีผู้ดูแลที่รับคำขอได้ กรุณาติดต่อผู้ดูแลโดยตรง หรือลองเบอร์อื่น' },
  salesAskAdminFailed: { en: '{prefix}Could not reach the admins right now. Please try again in a minute.', th: '{prefix}ติดต่อผู้ดูแลไม่สำเร็จในขณะนี้ กรุณาลองใหม่ในอีกสักครู่' },
  salesAskAdminNeedPhone: { en: '{prefix}Need a phone number to ask an admin. Tap Another phone, or send VERIFY ASK ADMIN plus the digits.', th: '{prefix}ต้องมีเบอร์โทรเพื่อถามผู้ดูแล แตะ เบอร์อื่น หรือพิมพ์ VERIFY ASK ADMIN ตามด้วยเบอร์' },
  salesAccessRequestTitle: { en: 'Sales access request', th: 'คำขอเข้าใช้ Sales' },
  salesAccessRequestBody: { en: '{name} ({lineId}) tried to verify on the Sales OA with phone {phone}, but no Odoo Sales User has that phone. Add the phone on their Sales User in Odoo, then ask them to tap Verify again.', th: '{name} ({lineId}) พยายามยืนยันตัวตนบน Sales OA ด้วยเบอร์ {phone} แต่ไม่พบผู้ใช้ฝ่ายขาย Odoo ที่มีเบอร์นี้ กรุณาเพิ่มเบอร์ในผู้ใช้ฝ่ายขายใน Odoo แล้วให้ผู้ใช้แตะ ยืนยันตัวตน อีกครั้ง' },
  askAdmin: { en: 'Ask admin', th: 'ถามผู้ดูแล' },
  anotherPhone: { en: 'Another phone', th: 'เบอร์อื่น' },
  newCustomer: { en: 'New customer', th: 'สมัครลูกค้าใหม่' },
  iHaveAPhone: { en: 'I have a phone', th: 'มีเบอร์แล้ว' },
  verifyAskAdminDenied: { en: '{prefix}Ask admin is only for unverified Sales staff. On Customer, register or verify with your phone.', th: '{prefix}ถามผู้ดูแลใช้ได้เฉพาะพนักงาน Sales ที่ยังไม่ยืนยัน ฝั่งลูกค้าให้สมัครหรือยืนยันด้วยเบอร์' },
  guestQuoteCapped: { en: '{prefix}Guest orders are limited to 3 per day for this LINE account and phone. Verify, or try again tomorrow.', th: '{prefix}ออเดอร์แบบไม่ยืนยันจำกัด 3 ครั้งต่อวันต่อบัญชี LINE และเบอร์นี้ กรุณายืนยันตัวตน หรือลองใหม่พรุ่งนี้' },
  customerBindToOrder: { en: '{prefix}Save your phone as a customer in Odoo to send this order. New here? Register. Already a contact? Use that phone.', th: '{prefix}บันทึกเบอร์เป็นลูกค้าใน Odoo เพื่อส่งคำสั่งนี้ หากยังไม่มีบัญชีให้สมัคร หากมีผู้ติดต่อแล้วให้ใช้เบอร์นั้น' },
  customerBindToHistory: { en: '{prefix}Order History is for a registered customer. Verify with the phone from your order.', th: '{prefix}ประวัติคำสั่งซื้อสำหรับลูกค้าที่ลงทะเบียนแล้ว ยืนยันด้วยเบอร์ที่ใช้สั่งซื้อ' },
  customerBindToMessage: { en: '{prefix}Save or verify your phone before messaging sales.', th: '{prefix}บันทึกหรือยืนยันเบอร์ก่อนส่งข้อความถึงฝ่ายขาย' },
  customerBindToServices: { en: '{prefix}Verify with the phone from your order to see history or message sales.', th: '{prefix}ยืนยันด้วยเบอร์จากคำสั่งซื้อเพื่อดูประวัติหรือส่งข้อความถึงฝ่ายขาย' },
  customerNoContact: { en: '{prefix}No Odoo contact matches {phone}. Register as a new customer, or enter another phone.', th: '{prefix}ไม่พบบุคคลใน Odoo ที่ตรงกับเบอร์ {phone} สมัครลูกค้าใหม่ หรือกรอกเบอร์อื่น' },
  customerNoPhoneYet: { en: '{prefix}No phone is on file yet. Register as a new customer, or enter a phone already on your Odoo contact. You can browse products without verifying.', th: '{prefix}ยังไม่มีเบอร์ในระบบ สมัครลูกค้าใหม่ หรือกรอกเบอร์ที่มีในผู้ติดต่อ Odoo ดูสินค้าได้โดยไม่ต้องยืนยัน' },
  quoteListFailed: { en: 'Could not load quotations right now. Please try again.', th: 'โหลดใบเสนอราคาไม่สำเร็จ กรุณาลองอีกครั้ง' },
  quoteSendFailed: { en: 'Could not send this quotation. Nothing was sent. Please try again.', th: 'ส่งใบเสนอราคาไม่สำเร็จ ยังไม่มีการส่งออก กรุณาลองอีกครั้ง' },
  tryAgain: { en: 'Try again', th: 'ลองอีกครั้ง' },
  assignUnsupported: { en: 'Assigning a salesperson is not supported by the connected ERP.', th: 'ระบบ ERP ที่เชื่อมต่อไม่รองรับการมอบหมายพนักงานขาย' },
  assignFailed: { en: 'Could not assign the salesperson. Please try again.', th: 'มอบหมายพนักงานขายไม่สำเร็จ กรุณาลองอีกครั้ง' },
  adminOnlyCommand: { en: 'This command is for administrators only.', th: 'คำสั่งนี้สำหรับผู้ดูแลระบบเท่านั้น' },
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
  shopOrderTitle: { en: 'Order placed', th: 'สร้างคำสั่งซื้อแล้ว' },
  shopOrderWaitingPay: {
    en: 'Order {name} is in checkout. Open Pay, finish in the browser, then Check payment for Order completed.',
    th: 'คำสั่งซื้อ {name} อยู่ที่ขั้นตอนชำระ เปิดหน้าชำระในเบราว์เซอร์ แล้วกดตรวจสอบการชำระ',
  },
  quoteAskNotApplicable: {
    en: 'This Official Account is in shop mode. Browse products and tap Order Now instead of Ask for Quotations.',
    th: 'บัญชีนี้เป็นโหมดร้านค้า เลือกสินค้าแล้วกดสั่งซื้อ ไม่ใช้ขอใบเสนอราคา',
  },
  shopUsePay: {
    en: 'Use Pay on the order card. Confirm is not used in shop mode.',
    th: 'กดชำระเงินบนการ์ดคำสั่งซื้อ โหมดร้านค้าไม่ใช้ปุ่มยืนยันใบเสนอราคา',
  },
  pay: { en: 'Pay', th: 'ชำระเงิน' },
  shopCartTitle: { en: 'My Cart', th: 'ตะกร้าของฉัน' },
  shopCheckoutTitle: { en: 'Order process', th: 'ดำเนินการสั่งซื้อ' },
  shopPayTitle: { en: 'Pay', th: 'ชำระเงิน' },
  shopCompletedTitle: { en: 'Order completed', th: 'สั่งซื้อสำเร็จ' },
  shopCompletedNote: {
    en: 'Payment is confirmed in Odoo. Thank you.',
    th: 'ยืนยันการชำระใน Odoo แล้ว ขอบคุณค่ะ',
  },
  shopCheckoutNote: {
    en: 'Review the order. Coupon is optional. Then Pay.',
    th: 'ตรวจสอบรายการ คูปองถ้ามี แล้วกดชำระเงิน',
  },
  shopPayWebHint: {
    en: 'Pay opens a web page. After the provider succeeds, tap I\'ve paid or Check payment in LINE.',
    th: 'ชำระเงินเปิดหน้าเว็บ เมื่อสำเร็จกด I\'ve paid หรือตรวจสอบการชำระใน LINE',
  },
  shopPayWebCta: { en: 'Open pay page', th: 'เปิดหน้าชำระเงิน' },
  shopCheckPayment: { en: 'Check payment', th: 'ตรวจสอบการชำระ' },
  shopAddProducts: { en: 'Add products', th: 'เพิ่มสินค้า' },
  shopCartEmpty: { en: 'Your cart is empty. Order Now from Home.', th: 'ตะกร้าว่าง กดสั่งซื้อจากหน้าแรก' },
  shopCartQuoteMode: {
    en: 'Cart checkout is only in shop mode. This Official Account is on quotations.',
    th: 'ตะกร้าใช้ได้เฉพาะโหมดร้านค้า บัญชีนี้เป็นใบเสนอราคา',
  },
  shopCoupon: { en: 'Coupon', th: 'คูปอง' },
  shopCouponApplied: { en: 'Coupon applied.', th: 'ใช้คูปองแล้ว' },
  shopCouponFailed: {
    en: 'That coupon could not be applied. Check the code in Odoo (sale coupon / loyalty).',
    th: 'ใช้คูปองไม่สำเร็จ ตรวจสอบรหัสใน Odoo',
  },
  shopPayMissing: {
    en: 'Pay is unavailable until Odoo returns an HTTPS portal link.',
    th: 'ยังชำระเงินไม่ได้ จนกว่า Odoo จะให้ลิงก์พอร์ทัล HTTPS',
  },
  shopWebsiteCart: { en: 'Website cart', th: 'ตะกร้าวิดไซต์' },
  shopStorefront: { en: 'Shop', th: 'ร้านค้า' },
  shopCheckoutCta: { en: 'Checkout', th: 'ชำระเงิน' },
  shopBackToCart: { en: 'My Cart', th: 'ตะกร้าของฉัน' },
  shopRemove: { en: 'Remove', th: 'ลบ' },
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

type PairLookup = (key: UiStringKey) => { en: string; th: string };

let pairLookup: PairLookup | null = null;

/** Wired from i18n-overlay so LINE copy overlay does not create an import cycle. */
export const registerI18nPairLookup = (lookup: PairLookup): void => {
  pairLookup = lookup;
};

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
export const t = (key: UiStringKey, language: Lang): string =>
  pickLocale(language, pairLookup ? pairLookup(key) : UI_STRINGS[key]);

export const tFill = (key: UiStringKey, language: Lang, vars: Record<string, string | number>): string =>
  Object.entries(vars).reduce((acc, [name, value]) => acc.split(`{${name}}`).join(String(value)), t(key, language));

export const invoiceStatusLabel = (status: string | undefined, language: Lang): string => {
  if (status === 'to invoice') return t('invoiceToInvoice', language);
  if (status === 'invoiced') return t('invoiceInvoiced', language);
  if (status === 'upselling') return t('invoiceUpselling', language);
  return '';
};

export const stateLabel = (state: string, language: Lang, audience: 'customer' | 'staff' = 'staff'): string => {
  const table = audience === 'customer' ? ODOO_STATE_LABELS_CUSTOMER : ODOO_STATE_LABELS;
  const entry = table[state as OdooSaleOrderState];
  return entry ? entry[language] : state;
};
