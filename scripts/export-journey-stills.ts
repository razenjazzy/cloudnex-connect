/**
 * Regenerates documents/journey/*.png from published tray assets and
 * the live Flex builders (studio, not iPhone chrome). Overwrites listed studio files.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  createBotTextFlexMessage,
  createFormPromptFlexMessage,
  createGuideCategoriesFlexMessage,
  createOptionalSummaryFlexMessage,
  createProductCarouselFlexMessage,
  createQuotationEditFlexMessage,
  createQuotationJourneyFlexMessage,
  createQuotationListFlexMessage,
  createQuotationMoreFlexMessage,
  createSalesAccountFlexMessage,
  createServiceActionFlexMessage,
} from '../src/line/templates';
import { CUSTOMER_CHANNEL_ID, getAgentName, getAgentSpeakPrefix, getBrandTitle } from '../src/line/channels';
import { getDefaultCustomerName, getDefaultCustomerPhone } from '../src/line/default-contact';
import { salesVerifyMissActions } from '../src/line/sales-access-request';
import { getServiceDefinition, getVisibleCommands, serviceMenuLabel } from '../src/services/service-catalog';
import { salesPolicyText } from '../src/services/sales-session';
import { outcomeFlex } from '../src/line/outcome-reply';
import { t, tFill } from '../src/services/i18n';
import type { CatalogCarouselItem } from '../src/line/templates/catalog';
import type { OdooSaleOrder } from '../src/services/odoo/types';
import type { messagingApi } from '@line/bot-sdk';

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'documents', 'journey');
const tmpDir = path.join(root, 'tmp', 'journey-stills');

const sampleName = getDefaultCustomerName('en');
const samplePhone = getDefaultCustomerPhone('en');
const sampleNameTh = getDefaultCustomerName('th');

const order = (state: string, invoice = 'no'): OdooSaleOrder => ({
  id: 1001,
  name: 'S00042',
  state,
  amount_total: 1200,
  partner_id: [7, sampleName],
  date_order: '2026-10-06 08:00:00',
  invoice_status: invoice,
  lines: [{ productName: 'Cloudnex Care', qty: 2, priceUnit: 600, subtotal: 1200 }],
});

const catalogItems: CatalogCarouselItem[] = [
  { id: 11, name: 'Cloudnex Care', sku: 'CARE', price: 600, quantity: 12 },
  { id: 12, name: 'Cloudnex Assist', sku: 'ASSIST', price: 900, quantity: 4 },
];

const commerce = getServiceDefinition('commerce')!;
const staffActionsEn = getVisibleCommands(commerce, false, true).map(c => ({
  text: c.text,
  label: c.labelEn,
}));
const customerActionsEn = getVisibleCommands(commerce, false, false, { shopMode: false }).map(c => ({
  text: c.text,
  label: c.labelEn,
}));
const customerActionsTh = getVisibleCommands(commerce, false, false, { shopMode: false }).map(c => ({
  text: c.text,
  label: c.labelTh,
}));

const pdpa = (language: 'en' | 'th'): messagingApi.FlexMessage => createBotTextFlexMessage({
  title: getBrandTitle(language),
  body: language === 'th'
    ? `ก่อนเริ่มใช้งาน ${getAgentName('th')} ขอเก็บข้อมูลที่คุณให้ไว้ (เช่น เบอร์โทร ชื่อ) เพื่อยืนยันตัวตนและให้บริการเท่านั้น`
    : `Before we begin: ${getAgentName('en')} stores what you share (like your phone number and name) only to verify your identity and provide service.`,
  language,
  actions: [
    { label: language === 'th' ? 'ข้อมูลของฉัน' : 'My data', text: 'MY DATA', style: 'primary' },
    { label: language === 'th' ? 'ลบข้อมูล' : 'Delete my data', text: 'DELETE MY DATA', style: 'secondary' },
  ],
});

const salesPolicy = salesPolicyText('en');
const soraQuote = `${getAgentSpeakPrefix('en')}Create a quote`.trim();
const staffDraft = createQuotationJourneyFlexMessage(order('draft'), {
  role: 'admin',
  salesTier: 'sales_manager',
  canManageLines: true,
  portalLink: 'https://example.odoo.com/my/orders/1001',
  pdfLink: 'https://example.odoo.com/my/orders/1001?report_type=pdf',
}, 'en');
const staffSent = createQuotationJourneyFlexMessage(order('sent'), {
  role: 'admin',
  salesTier: 'sales_manager',
  portalLink: 'https://example.odoo.com/my/orders/1001',
  pdfLink: 'https://example.odoo.com/my/orders/1001?report_type=pdf',
}, 'en');
const staffSale = createQuotationJourneyFlexMessage(order('sale', 'to invoice'), {
  role: 'admin',
  salesTier: 'sales_manager',
  portalLink: 'https://example.odoo.com/my/orders/1001',
  pdfLink: 'https://example.odoo.com/my/orders/1001?report_type=pdf',
}, 'en');
const staffInvoiced = createQuotationJourneyFlexMessage(order('sale', 'invoiced'), {
  role: 'admin',
  salesTier: 'sales_manager',
  portalLink: 'https://example.odoo.com/my/orders/1001',
  pdfLink: 'https://example.odoo.com/my/orders/1001?report_type=pdf',
}, 'en');

const stills: { file: string; messages: messagingApi.FlexMessage[]; wide?: boolean }[] = [
  {
    file: 'a1-home-en.png',
    messages: [
      pdpa('en'),
      createSalesAccountFlexMessage({
        name: sampleName,
        phone: samplePhone,
        roleKey: 'salesperson',
        idle: salesPolicy.idle,
      }, 'en'),
      createServiceActionFlexMessage(
        serviceMenuLabel(commerce, 'en'),
        staffActionsEn,
        'en',
      ),
    ],
  },
  {
    file: 'a5-order-status.png',
    messages: [createFormPromptFlexMessage({
      title: 'Check an order',
      prompt: 'Order reference?',
      stepIndex: 0,
      totalSteps: 1,
      language: 'en',
    })],
  },
  {
    file: 'a3-verify.png',
    messages: [createFormPromptFlexMessage({
      title: `${getAgentSpeakPrefix('en')}Verify your account`.trim(),
      prompt: 'Phone number on your account?',
      stepIndex: 0,
      totalSteps: 1,
      language: 'en',
      options: [samplePhone],
    })],
  },
  {
    file: 'a4-products-quotes.png',
    messages: [createServiceActionFlexMessage(
      serviceMenuLabel(commerce, 'en'),
      staffActionsEn,
      'en',
    )],
  },
  {
    file: 'a6-help-guide.png',
    messages: [createGuideCategoriesFlexMessage('en', 'Sora')],
  },
  {
    file: 'b1-quote-product-chips.png',
    messages: [createFormPromptFlexMessage({
      title: soraQuote,
      prompt: 'Product name?',
      stepIndex: 0,
      totalSteps: 9,
      language: 'en',
      options: ['Cloudnex Care', 'Cloudnex Assist'],
    })],
  },
  {
    file: 'b2-quote-qty.png',
    messages: [createFormPromptFlexMessage({
      title: soraQuote,
      prompt: 'Quantity?',
      stepIndex: 1,
      totalSteps: 9,
      language: 'en',
      contextNote: 'Using: Cloudnex Care',
    })],
  },
  {
    file: 'b3-quote-customer-name.png',
    messages: [createFormPromptFlexMessage({
      title: soraQuote,
      prompt: "Customer's name?",
      stepIndex: 2,
      totalSteps: 9,
      language: 'en',
      options: [sampleName, sampleNameTh],
    })],
  },
  {
    file: 'b4-quote-phone.png',
    messages: [createFormPromptFlexMessage({
      title: soraQuote,
      prompt: "Customer's phone?",
      stepIndex: 3,
      totalSteps: 9,
      language: 'en',
      options: [samplePhone],
      contextNote: `Saved on file: ${samplePhone}`,
    })],
  },
  {
    file: 'b5-quote-optional.png',
    messages: [createOptionalSummaryFlexMessage({
      title: `${getAgentName('en')} Create a quote`,
      language: 'en',
      finalizeLabel: 'Create now',
      fields: [
        { index: 4, label: 'Customer ref' },
        { index: 5, label: 'Discount %' },
        { index: 6, label: 'Valid until', value: '2026-11-05' },
        { index: 7, label: 'Note' },
        { index: 8, label: 'Payment term', value: '30 Days' },
      ],
    })],
  },
  {
    file: 'b6-quote-draft.png',
    messages: [staffDraft],
  },
  {
    file: 'b8-quote-sent-admin.png',
    messages: [staffSent],
  },
  {
    file: 'b9-quote-sent-customer.png',
    messages: [createQuotationJourneyFlexMessage(order('sent'), { role: 'customer' }, 'en')],
  },
  {
    file: 'b10-quote-more.png',
    messages: [createQuotationMoreFlexMessage(order('draft'), { salesTier: 'sales_manager' }, 'en')],
  },
  {
    file: 'b11-quote-edit.png',
    messages: [createQuotationEditFlexMessage(order('draft'), 'en')],
  },
  {
    file: 'c0-customer-home.png',
    messages: [
      pdpa('en'),
      createProductCarouselFlexMessage(catalogItems, 'en', undefined, CUSTOMER_CHANNEL_ID),
      createServiceActionFlexMessage(
        serviceMenuLabel(commerce, 'en', CUSTOMER_CHANNEL_ID),
        customerActionsEn,
        'en',
      ),
    ],
  },
  {
    file: 'c1-guest-catalog.png',
    wide: true,
    messages: [
      createProductCarouselFlexMessage(catalogItems, 'en', undefined, CUSTOMER_CHANNEL_ID),
      createServiceActionFlexMessage(
        serviceMenuLabel(commerce, 'en', CUSTOMER_CHANNEL_ID),
        customerActionsEn,
        'en',
      ),
    ],
  },
  {
    file: 'c2-customer-verify.png',
    messages: [createBotTextFlexMessage({
      title: t('salesVerifyAgain', 'en'),
      body: tFill('customerNoPhoneYet', 'en', { prefix: getAgentSpeakPrefix('en') }),
      language: 'en',
      tone: 'warning',
      actions: [
        { label: t('newCustomer', 'en'), text: 'FORM CUSTOMER REGISTER', style: 'primary' },
        { label: t('iHaveAPhone', 'en'), text: 'FORM VERIFY MANUAL', style: 'secondary' },
      ],
    })],
  },
  {
    file: 'a3-ask-admin.png',
    messages: [createBotTextFlexMessage({
      title: t('salesVerifyAgain', 'en'),
      body: tFill('salesPhoneNotInOdoo', 'en', {
        prefix: getAgentSpeakPrefix('en'),
        phone: samplePhone,
      }),
      language: 'en',
      tone: 'warning',
      actions: salesVerifyMissActions(samplePhone, 'en'),
    })],
  },
  {
    file: 'c3-self-quote-draft.png',
    messages: [createQuotationJourneyFlexMessage(order('draft'), { role: 'customer' }, 'en')],
  },
  {
    file: 'c4-customer-sent.png',
    messages: [createQuotationJourneyFlexMessage(order('sent'), { role: 'customer' }, 'en')],
  },
  {
    file: 'c5-my-quotes.png',
    messages: [createQuotationListFlexMessage([order('sent'), order('sale', 'to invoice')], false, 'en')],
  },
  {
    file: 'c1-customer-approve.png',
    messages: [
      outcomeFlex({
        language: 'en',
        tone: 'success',
        title: t('done', 'en'),
        body: t('quoteApproved', 'en'),
        actions: [{ label: t('myOrders', 'en'), text: 'QUOTE LIST', style: 'primary' }],
      }),
      createQuotationJourneyFlexMessage(order('sale', 'to invoice'), {
        role: 'customer',
        portalLink: 'https://example.odoo.com/my/orders/1001',
        pdfLink: 'https://example.odoo.com/my/orders/1001?report_type=pdf',
      }, 'en'),
    ],
  },
  {
    file: 'c2-sales-order-admin.png',
    messages: [staffSale],
  },
  {
    file: 'c3-sales-order-customer.png',
    messages: [createQuotationJourneyFlexMessage(order('sale', 'to invoice'), { role: 'customer', portalLink: 'https://example.odoo.com/my/orders/1001' }, 'en')],
  },
  {
    file: 'c4-invoice-staff.png',
    messages: [staffInvoiced],
  },
  {
    file: 'd1-lang-toggle.png',
    messages: [createBotTextFlexMessage({
      title: getBrandTitle('th'),
      body: 'โซระ เปลี่ยนภาษาเป็นไทยแล้วค่ะ',
      language: 'th',
      tone: 'success',
    })],
  },
  {
    file: 'd2-home-th.png',
    messages: [
      createProductCarouselFlexMessage(catalogItems, 'th', undefined, CUSTOMER_CHANNEL_ID),
      createServiceActionFlexMessage(
        serviceMenuLabel(commerce, 'th', CUSTOMER_CHANNEL_ID),
        customerActionsTh,
        'th',
      ),
    ],
  },
  {
    file: 'd4-guide-th.png',
    messages: [createGuideCategoriesFlexMessage('th', 'โซระ')],
  },
  {
    file: 'd5-lang-en.png',
    messages: [createBotTextFlexMessage({
      title: getBrandTitle('en'),
      body: 'Sora switched language to English.',
      language: 'en',
      tone: 'success',
    })],
  },
];

const renderer = `function gap(s){return({none:0,xs:2,sm:4,md:8,lg:12,xl:16,xxl:20}[s]||0)}
function fs(s){return({xxs:10,xs:11,sm:13,md:14,lg:16,xl:18,xxl:20,'3xl':24,'4xl':28,'5xl':32}[s]||14)}
function el(tag,style,kids,text){const n=document.createElement(tag);if(style)n.setAttribute('style',style);(kids||[]).forEach(c=>c&&n.appendChild(c));if(text!=null)n.textContent=text;return n}
function render(node){
  if(!node||typeof node!=='object')return null;
  if(node.type==='flex')return render(node.contents);
  if(node.type==='carousel'){
    const row=el('div','display:flex;gap:12px;align-items:flex-start;overflow:auto;padding-bottom:8px', (node.contents||[]).map(render));
    return row;
  }
  if(node.type==='bubble'){
    const styles=node.styles||{};
    const card=el('div','width:300px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #d7e0dd;flex:0 0 auto');
    function section(child,key){
      if(!child)return;
      const bg=styles[key]&&styles[key].backgroundColor;
      const wrap=el('div', bg?'background:'+bg:'');
      wrap.appendChild(render(child));
      card.appendChild(wrap);
    }
    if(node.hero)card.appendChild(render(node.hero));
    section(node.header,'header');
    section(node.body,'body');
    section(node.footer,'footer');
    return card;
  }
  if(node.type==='image'){
    return el('div','height:160px;background:#E3F0EE;display:flex;align-items:center;justify-content:center;color:#5B6C69;font-size:12px',[], node.alt||'image');
  }
  if(node.type==='separator')return el('div','height:1px;background:#d7e0dd;margin:8px 0');
  if(node.type==='filler')return el('div','flex:1');
  if(node.type==='button'){
    const primary=node.style==='primary';
    const bg=primary?(node.color||'#0B6E6A'):(node.color||'#E3F0EE');
    const fg=primary?'#fff':'#063F3D';
    const label=(node.action&&(node.action.label||node.action.text))||'';
    return el('div','margin:4px 0;padding:10px 12px;border-radius:12px;text-align:center;font-size:13px;background:'+bg+';color:'+fg, [], label);
  }
  if(node.type==='text'){
    const st=[
      'color:'+(node.color||'#10201E'),
      'font-size:'+fs(node.size)+'px',
      node.weight==='bold'?'font-weight:700':'font-weight:400',
      node.wrap?'white-space:pre-wrap':'white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      node.align==='end'?'text-align:right':node.align==='center'?'text-align:center':'',
      node.flex!=null?'flex:'+node.flex:'',
      node.margin?'margin-top:'+gap(node.margin)+'px':'',
    ].filter(Boolean).join(';');
    return el('div',st,[], node.text||'');
  }
  if(node.type==='box'){
    const dir=node.layout==='horizontal'||node.layout==='baseline'?'row':'column';
    const st=[
      'display:flex','flex-direction:'+dir,
      'gap:'+gap(node.spacing)+'px',
      node.backgroundColor?'background:'+node.backgroundColor:'',
      node.cornerRadius?'border-radius:'+node.cornerRadius:'',
      node.paddingAll?'padding:'+gap(node.paddingAll)+'px':'',
      node.paddingStart?'padding-left:'+gap(node.paddingStart)+'px':'',
      node.paddingEnd?'padding-right:'+gap(node.paddingEnd)+'px':'',
      node.paddingTop?'padding-top:'+gap(node.paddingTop)+'px':'',
      node.paddingBottom?'padding-bottom:'+gap(node.paddingBottom)+'px':'',
      node.width?'width:'+node.width:'',
      node.height?'height:'+node.height:'',
      node.flex!=null?'flex:'+node.flex:'',
      node.justifyContent?'justify-content:'+node.justifyContent:'',
      node.alignItems?'align-items:'+node.alignItems:'',
    ].filter(Boolean).join(';');
    const box=el('div',st,(node.contents||[]).map(render));
    return box;
  }
  return null;
}
function chips(msg){
  const items=(msg&&msg.quickReply&&msg.quickReply.items)||[];
  if(!items.length)return null;
  const wrap=el('div','display:flex;flex-direction:column;gap:6px;margin-top:10px;max-width:360px');
  wrap.appendChild(el('div','color:#9bb3af;font-size:10px;letter-spacing:.02em',[],'Composer chips (LINE quick reply)'));
  const row=el('div','display:flex;flex-wrap:wrap;gap:8px');
  items.forEach(it=>{
    const label=(it.action&&(it.action.label||it.action.text))||'';
    row.appendChild(el('div','padding:8px 12px;border-radius:18px;background:#fff;border:1px solid #d7e0dd;font-size:12px;color:#063F3D',[],label));
  });
  wrap.appendChild(row);
  return wrap;
}
function mount(payload){
  const root=document.getElementById('root');
  payload.forEach(msg=>{
    const col=el('div','display:flex;flex-direction:column;align-items:flex-start');
    const n=render(msg); if(n)col.appendChild(n);
    const c=chips(msg); if(c)col.appendChild(c);
    root.appendChild(col);
  });
}
`;

function htmlFor(messages: messagingApi.FlexMessage[]): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#1a2a28;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
#root{display:flex;flex-direction:column;gap:16px;padding:24px;align-items:flex-start;width:max-content}
.cap{color:#9bb3af;font-size:11px;letter-spacing:.02em}
</style></head><body>
<div class="cap">Studio Flex — same builders as Cloudnex Connect OA</div>
<div id="root"></div>
<script>${renderer}mount(${JSON.stringify(messages)});</script>
</body></html>`;
}

function chromePath(): string | null {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  return candidates.find(existsSync) || null;
}

function capture(htmlPath: string, pngPath: string, width: number, height: number): void {
  const chrome = chromePath();
  if (!chrome) throw new Error('Chrome/Edge not found for screenshots');
  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${width},${height}`,
    `--screenshot=${pngPath}`,
    `file://${htmlPath}`,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || `chrome exit ${result.status}`);
  }
}

mkdirSync(outDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

copyFileSync(path.join(root, 'assets/rich-menu/menu-en.png'), path.join(outDir, 'a2-tray-en.png'));
copyFileSync(path.join(root, 'assets/rich-menu/menu-en-language.png'), path.join(outDir, 'a3-language.png'));
copyFileSync(path.join(root, 'assets/rich-menu/menu-th.png'), path.join(outDir, 'd3-tray-th.png'));
console.log('copied tray stills a2-tray-en, a3-language, d3-tray-th');

for (const still of stills) {
  const htmlPath = path.join(tmpDir, still.file.replace('.png', '.html'));
  writeFileSync(htmlPath, htmlFor(still.messages));
  const hasChips = still.messages.some(msg => Boolean(msg.quickReply?.items?.length));
  const height = still.wide ? 720 : still.messages.length > 2 ? 1400 : still.messages.length > 1 ? 980 : hasChips ? 1100 : 900;
  capture(htmlPath, path.join(outDir, still.file), still.wide ? 720 : hasChips ? 440 : 380, height);
  console.log('wrote', still.file);
}
