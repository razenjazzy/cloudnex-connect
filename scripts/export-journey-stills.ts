/**
 * Fills missing documents/journey/*.png from published tray assets and
 * the live Flex builders (studio, not iPhone chrome).
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  createBotTextFlexMessage,
  createFormPromptFlexMessage,
  createGuideCategoriesFlexMessage,
  createProductCarouselFlexMessage,
  createQuotationEditFlexMessage,
  createQuotationJourneyFlexMessage,
  createQuotationListFlexMessage,
  createQuotationMoreFlexMessage,
  createServiceActionFlexMessage,
  createServiceHomeFlexMessage,
} from '../src/line/templates';
import { getBrandTitle } from '../src/line/channels';
import { getServiceDefinition, getVisibleCommands } from '../src/services/service-catalog';
import type { OdooSaleOrder } from '../src/services/odoo/types';
import type { messagingApi } from '@line/bot-sdk';

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'documents', 'journey');
const tmpDir = path.join(root, 'tmp', 'journey-stills');

const order = (state: string, invoice = 'no'): OdooSaleOrder => ({
  id: 1001,
  name: 'S00042',
  state,
  amount_total: 1200,
  partner_id: [7, 'Demo Partner'],
  date_order: '2026-09-19 08:00:00',
  invoice_status: invoice,
  lines: [{ productName: 'Cloudnex Care', qty: 2, priceUnit: 600, subtotal: 1200 }],
});

const commerce = getServiceDefinition('commerce')!;
const staffActions = getVisibleCommands(commerce, false, true).map(c => ({
  text: c.text,
  label: c.labelEn,
}));
const customerActions = getVisibleCommands(commerce, false, false).map(c => ({
  text: c.text,
  label: c.labelEn,
}));
const customerActionsTh = getVisibleCommands(commerce, false, false).map(c => ({
  text: c.text,
  label: c.labelTh,
}));

const stills: { file: string; messages: messagingApi.FlexMessage[]; wide?: boolean }[] = [
  {
    file: 'a1-home-en.png',
    messages: [
      createBotTextFlexMessage({
        title: getBrandTitle('en'),
        body: 'Before we begin: Sora stores what you share (like your phone number and name) only to verify your identity and provide service.',
        language: 'en',
        actions: [
          { label: 'My data', text: 'MY DATA', style: 'primary' },
          { label: 'Delete my data', text: 'DELETE MY DATA', style: 'secondary' },
        ],
      }),
      createServiceHomeFlexMessage([{ key: 'commerce', label: commerce.labelEn }], 'en', 'Sora'),
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
    file: 'a6-help-guide.png',
    messages: [createGuideCategoriesFlexMessage('en', 'Sora')],
  },
  {
    file: 'b2-quote-qty.png',
    messages: [createFormPromptFlexMessage({
      title: 'Create a quote',
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
      title: 'Create a quote',
      prompt: "Customer's name?",
      stepIndex: 2,
      totalSteps: 9,
      language: 'en',
      options: ['Demo Partner', 'Sample Shop'],
    })],
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
      createBotTextFlexMessage({
        title: getBrandTitle('en'),
        body: 'Before we begin: Sora stores what you share (like your phone number and name) only to verify your identity and provide service.',
        language: 'en',
        actions: [
          { label: 'My data', text: 'MY DATA', style: 'primary' },
          { label: 'Delete my data', text: 'DELETE MY DATA', style: 'secondary' },
        ],
      }),
      createServiceHomeFlexMessage(
        [{ key: 'commerce', label: commerce.labelEn }],
        'en',
        'Sora',
        false,
        { name: 'Demo Partner', phone: '+66 80 000 0000' },
      ),
    ],
  },
  {
    file: 'c1-guest-catalog.png',
    wide: true,
    messages: [
      createServiceActionFlexMessage(commerce.labelEn, customerActions, 'en'),
      createProductCarouselFlexMessage(
        [
          { id: 11, name: 'Cloudnex Care', sku: 'CARE', price: 600, quantity: 12 },
          { id: 12, name: 'Cloudnex Assist', sku: 'ASSIST', price: 900, quantity: 4 },
        ],
        'en',
      ),
    ],
  },
  {
    file: 'c2-customer-verify.png',
    messages: [createBotTextFlexMessage({
      title: 'Verify',
      body: 'Sora no phone is on file yet. Tap Verify now to bind this LINE account to an Odoo customer (your LINE display name is the starting name). You can browse products without verifying.',
      language: 'en',
      tone: 'info',
      actions: [
        { label: 'Verify now', text: 'FORM CUSTOMER REGISTER', style: 'primary' },
        { label: 'I have a phone', text: 'FORM VERIFY MANUAL', style: 'secondary' },
      ],
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
    file: 'c3-sales-order-customer.png',
    messages: [createQuotationJourneyFlexMessage(order('sale', 'to invoice'), { role: 'customer', portalLink: 'https://example.odoo.com/my/orders/1001' }, 'en')],
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
    messages: [createServiceHomeFlexMessage([{ key: 'commerce', label: commerce.labelTh }], 'th', 'โซระ')],
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
function mount(payload){
  const root=document.getElementById('root');
  payload.forEach(msg=>{const n=render(msg); if(n)root.appendChild(n)});
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
  const height = still.wide ? 720 : still.messages.length > 1 ? 980 : 900;
  capture(htmlPath, path.join(outDir, still.file), still.wide ? 720 : 380, height);
  console.log('wrote', still.file);
}
