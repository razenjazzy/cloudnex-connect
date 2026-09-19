import type { UserProfile } from '../services/firestore';
import { CUSTOMER_CHANNEL_ID, DEFAULT_CHANNEL_ID, SALES_CHANNEL_ID } from './channels';
import { isQuoteStaff } from './quote-access';

export type CommandRole = 'guest' | 'customer' | 'staff' | 'admin';
export type CommandChannel = typeof DEFAULT_CHANNEL_ID | typeof SALES_CHANNEL_ID | typeof CUSTOMER_CHANNEL_ID;

export type CommandGridEntry = {
  id: string;
  prefix: string;
  labelEn: string;
  labelTh: string;
  category: 'identity' | 'navigation' | 'admin' | 'help' | 'privacy' | 'commerce';
  roles: CommandRole[];
  channels?: CommandChannel[];
  requiresAdmin?: boolean;
  /** Match only the full token, not `PREFIX ...`. */
  exact?: boolean;
};

/**
 * Metadata for commands that are not already gated by SERVICE_CATALOG.
 * Longest prefix wins. Unlisted commands keep existing service/guest behavior.
 */
export const COMMAND_GRID: CommandGridEntry[] = [
  { id: 'nav-home', prefix: 'NAV HOME', labelEn: 'Home', labelTh: 'หน้าแรก', category: 'navigation', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'nav-bare', prefix: 'NAV', labelEn: 'Navigate', labelTh: 'เมนู', category: 'navigation', roles: ['guest', 'customer', 'staff', 'admin'], exact: true },
  { id: 'nav-back', prefix: 'BACK', labelEn: 'Back', labelTh: 'กลับ', category: 'navigation', roles: ['guest', 'customer', 'staff', 'admin'], exact: true },
  { id: 'nav-commerce', prefix: 'NAV COMMERCE', labelEn: 'Products & Quotes', labelTh: 'สินค้าและใบเสนอราคา', category: 'navigation', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'nav-catalog', prefix: 'NAV CATALOG', labelEn: 'Catalog', labelTh: 'บริการ', category: 'navigation', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'nav-verify', prefix: 'NAV VERIFY', labelEn: 'Verify', labelTh: 'ยืนยันตัวตน', category: 'identity', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'form-verify', prefix: 'FORM VERIFY', labelEn: 'Verify form', labelTh: 'ฟอร์มยืนยัน', category: 'identity', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'verify', prefix: 'VERIFY', labelEn: 'Verify', labelTh: 'ยืนยันตัวตน', category: 'identity', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'product-find-form', prefix: 'FORM PRODUCT FIND', labelEn: 'Find a product', labelTh: 'ค้นหาสินค้า', category: 'commerce', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'product-find', prefix: 'PRODUCT FIND', labelEn: 'Find a product', labelTh: 'ค้นหาสินค้า', category: 'commerce', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'service-list', prefix: 'SERVICE LIST', labelEn: 'Browse catalog', labelTh: 'รายการบริการ', category: 'commerce', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'lang', prefix: 'LANG', labelEn: 'Language', labelTh: 'ภาษา', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'english', prefix: 'ENGLISH', labelEn: 'English', labelTh: 'English', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'thai', prefix: 'THAI', labelEn: 'Thai', labelTh: 'ไทย', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'thai-native', prefix: 'ภาษาไทย', labelEn: 'Thai', labelTh: 'ภาษาไทย', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'guide', prefix: 'GUIDE', labelEn: 'Guide', labelTh: 'คู่มือ', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'my-data', prefix: 'MY DATA', labelEn: 'My data', labelTh: 'ข้อมูลของฉัน', category: 'privacy', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'delete-my-data', prefix: 'DELETE MY DATA', labelEn: 'Delete my data', labelTh: 'ลบข้อมูล', category: 'privacy', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'start', prefix: 'START', labelEn: 'Start', labelTh: 'เริ่มต้น', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'start-th', prefix: 'เริ่มต้น', labelEn: 'Start', labelTh: 'เริ่มต้น', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'help', prefix: 'HELP', labelEn: 'Help', labelTh: 'ช่วยเหลือ', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'options', prefix: 'OPTIONS', labelEn: 'Options', labelTh: 'ตัวเลือก', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'menu', prefix: 'MENU', labelEn: 'Menu', labelTh: 'เมนู', category: 'help', roles: ['guest', 'customer', 'staff', 'admin'] },
  { id: 'admin-enable', prefix: 'ADMIN ENABLE', labelEn: 'Enable admin', labelTh: 'เปิดสิทธิ์แอดมิน', category: 'admin', roles: ['customer', 'staff', 'admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID] },
  { id: 'admin-verify', prefix: 'ADMIN VERIFY', labelEn: 'Admin verify', labelTh: 'ตรวจแอดมิน', category: 'admin', roles: ['customer', 'staff', 'admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID] },
  { id: 'admin-disable', prefix: 'ADMIN DISABLE', labelEn: 'Disable admin', labelTh: 'ปิดสิทธิ์แอดมิน', category: 'admin', roles: ['admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID], requiresAdmin: true },
  { id: 'admin-revoke', prefix: 'ADMIN REVOKE', labelEn: 'Revoke admin', labelTh: 'เพิกถอนแอดมิน', category: 'admin', roles: ['admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID], requiresAdmin: true },
  { id: 'admin-config', prefix: 'ADMIN CONFIG', labelEn: 'Admin config', labelTh: 'ตั้งค่าแอดมิน', category: 'admin', roles: ['admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID], requiresAdmin: true },
  { id: 'admin-channel', prefix: 'ADMIN CHANNEL', labelEn: 'Channel services', labelTh: 'บริการช่องทาง', category: 'admin', roles: ['admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID], requiresAdmin: true },
  { id: 'admin-access', prefix: 'ADMIN ACCESS', labelEn: 'Admin access', labelTh: 'สิทธิ์แอดมิน', category: 'admin', roles: ['admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID], requiresAdmin: true },
  { id: 'admin-audit', prefix: 'ADMIN AUDIT ROTATE', labelEn: 'Rotate audit', labelTh: 'หมุนเวียนออดิต', category: 'admin', roles: ['admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID], requiresAdmin: true },
  { id: 'seed-sample', prefix: 'SEED SAMPLE DATA', labelEn: 'Seed sample data', labelTh: 'ข้อมูลตัวอย่าง', category: 'admin', roles: ['admin'], channels: [SALES_CHANNEL_ID, DEFAULT_CHANNEL_ID], requiresAdmin: true },
];

export const commandActor = (profile: Pick<UserProfile, 'odooVerified' | 'role' | 'salesTier'>): CommandRole => {
  if (!profile.odooVerified) return 'guest';
  if (profile.role === 'admin') return 'admin';
  if (isQuoteStaff(profile)) return 'staff';
  return 'customer';
};

export const matchCommandGrid = (upperText: string): CommandGridEntry | null => {
  let best: CommandGridEntry | null = null;
  for (const entry of COMMAND_GRID) {
    const hit = entry.exact
      ? upperText === entry.prefix
      : upperText === entry.prefix || upperText.startsWith(`${entry.prefix} `);
    if (!hit) continue;
    if (!best || entry.prefix.length > best.prefix.length) best = entry;
  }
  return best;
};

export const isGuestAllowedCommand = (upperText: string, pendingFlow?: { flow: string }): boolean => {
  if (pendingFlow?.flow === 'VERIFY' || pendingFlow?.flow === 'PRODUCT_FIND') return true;
  const entry = matchCommandGrid(upperText);
  return Boolean(entry?.roles.includes('guest'));
};

export const evaluateCommandGrid = (
  upperText: string,
  ctx: { profile: UserProfile; channel?: { channelId: string } },
): { ok: true } | { ok: false; reason: 'role' | 'channel' | 'admin' } => {
  const entry = matchCommandGrid(upperText);
  if (!entry) return { ok: true };

  const actor = commandActor(ctx.profile);
  if (!entry.roles.includes(actor)) return { ok: false, reason: 'role' };
  if (entry.requiresAdmin && ctx.profile.role !== 'admin') return { ok: false, reason: 'admin' };

  if (entry.channels?.length) {
    const channelId = ctx.channel?.channelId || DEFAULT_CHANNEL_ID;
    if (!entry.channels.includes(channelId as CommandChannel)) return { ok: false, reason: 'channel' };
  }

  return { ok: true };
};

export const getCommandGridPayload = () =>
  COMMAND_GRID.map(({ id, prefix, category, roles, channels, requiresAdmin }) => ({
    id,
    prefix,
    category,
    roles,
    channels: channels || ['any'],
    requiresAdmin: Boolean(requiresAdmin),
  }));
