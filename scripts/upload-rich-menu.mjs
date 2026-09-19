#!/usr/bin/env node
/**
 * Publishes default EN/TH trays plus per-cell active variants for each OA
 * that has an access token. Prints env keys to paste on the VPS.
 *
 *   node scripts/upload-rich-menu.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const salesToken = (
  process.env.LINE_CHANNEL_SALES_ACCESS_TOKEN
  || process.env.LINE_CHANNEL_ACCESS_TOKEN
  || process.env.LINE_CHANNEL_DEFAULT_ACCESS_TOKEN
  || ''
).trim();
const customerToken = (process.env.LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN || '').trim();

const jobs = [];
if (salesToken) jobs.push({ label: 'sales', token: salesToken, customer: false });
if (customerToken && customerToken !== salesToken) jobs.push({ label: 'customer', token: customerToken, customer: true });
if (!jobs.length) {
  console.error('Set LINE_CHANNEL_ACCESS_TOKEN and/or LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN before publishing.');
  process.exit(1);
}

const layout = JSON.parse(readFileSync(join(root, 'assets/rich-menu/layout.json'), 'utf8'));
const areas = layout.areas.map(({ bounds, action }) => ({ bounds, action }));
const variants = [
  'default',
  'default-verified',
  ...layout.areas.flatMap(area => [area.id, `${area.id}-verified`]),
];

const publish = async (token, language, variant) => {
  const headers = { Authorization: `Bearer ${token}` };
  const pngName = variant === 'default' || variant === 'default-verified'
    ? `menu-${language}${variant === 'default' ? '' : '-verified'}.png`
    : `menu-${language}-${variant}.png`;
  const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      size: layout.size,
      selected: true,
      name: `${layout.name} ${language.toUpperCase()} ${variant}`,
      chatBarText: language === 'th' ? layout.chatBarTextTh : layout.chatBarTextEn,
      areas,
    }),
  });
  if (!createRes.ok) {
    console.error('createRichMenu failed', language, variant, createRes.status, await createRes.text());
    process.exit(1);
  }
  const { richMenuId } = await createRes.json();
  const png = readFileSync(join(root, 'assets/rich-menu', pngName));
  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/png' },
    body: png,
  });
  if (!uploadRes.ok) {
    console.error('upload rich menu image failed', language, variant, uploadRes.status, await uploadRes.text());
    process.exit(1);
  }
  return richMenuId;
};

const publishChannel = async (job) => {
  const ids = { en: {}, th: {} };
  for (const language of ['en', 'th']) {
    for (const variant of variants) {
      ids[language][variant] = await publish(job.token, language, variant);
    }
  }
  const defaultEn = ids.en.default;
  const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${defaultEn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${job.token}` },
  });
  if (!defaultRes.ok) {
    console.error('setDefaultRichMenu failed', job.label, defaultRes.status, await defaultRes.text());
    process.exit(1);
  }
  console.log(`Published ${job.label} default EN ${defaultEn}`);
  console.log(`Published ${job.label} default TH ${ids.th.default}`);
  const json = JSON.stringify(ids);
  if (job.customer) {
    console.log(`Set LINE_CHANNEL_CUSTOMER_RICH_MENU_JSON=${json}`);
  } else {
    console.log(`Set LINE_RICH_MENU_EN=${defaultEn}`);
    console.log(`Set LINE_RICH_MENU_TH=${ids.th.default}`);
    console.log(`Set LINE_RICH_MENU_JSON=${json}`);
  }
  return ids;
};

for (const job of jobs) {
  await publishChannel(job);
}
