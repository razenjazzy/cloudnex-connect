export type UiLang = 'en' | 'th';

const STORAGE = 'cloudnex_admin_ui_lang';

export const readUiLang = (): UiLang => {
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw === 'th' ? 'th' : 'en';
  } catch {
    return 'en';
  }
};

export const writeUiLang = (lang: UiLang): void => {
  try {
    localStorage.setItem(STORAGE, lang);
  } catch {
    /* ignore */
  }
};

const en = {
  navHome: 'Home',
  navOverview: 'Overview',
  navIdentity: 'Identity',
  navBind: 'Bind',
  navDirectory: 'Directory',
  navPrivileges: 'Privileges',
  navLanguage: 'Language',
  navLine: 'LINE',
  navChannels: 'Channels',
  navCampaigns: 'Campaigns',
  navWork: 'Work',
  navCrm: 'CRM',
  navCommands: 'Commands',
  navJobs: 'Jobs',
  navPlatform: 'Platform',
  navSettings: 'Settings',
  navAudit: 'Audit',
  navErp: 'ERP',
  navAdvanced: 'Advanced',
  navDemo: 'Demo',
  navHelp: 'Help',
  signIn: 'Sign in',
  signOut: 'Sign out',
  toastAdminSecret: 'ADMIN_SECRET_TOKEN required. Paste 16+ characters, Save, then Run. The value must match the VPS token (or the overlay token if env is empty).',
  toastUnauthorized: 'Unauthorized. Bind super-admin or use the correct token.',
  toastForbidden: 'Forbidden. Super-admin bind is required for this action.',
  jobsNeedToken: 'Run jobs while signed in with OPS. ADMIN_SECRET_TOKEN is optional (curl/scripts). Save uploads it when env is empty.',
  uiLanguage: 'Admin panel language',
  lineUserLanguage: 'LINE user language',
  preview: 'Preview',
  confirm: 'Confirm',
  optional: 'optional',
  bindFirst: 'Bind super-admin on Identity first.',
  cmdLead: 'The Prefix column is the LINE command (read-only; routing never uses EN/TH). Edit EN/TH labels (≤20 on LINE actions). Optional aliases are typed shortcuts that normalize inbound to the prefix; buttons still send the prefix. Save, then the next Flex uses new labels. LINE uses the user’s language (ENGLISH / THAI), not Admin chrome.',
  cmdReload: 'Reload',
  cmdSave: 'Save labels',
  cmdSaved: 'Labels saved. The next LINE reply uses them.',
  pickForm: 'Pick a LINE form',
  commandText: 'Command text',
  commandResult: 'Command result',
  commandWorkLead: 'Preview reconstructs the LINE command. Confirm runs the same resolveCommandReply as the Official Account. Write commands may still require ACTION OTP on LINE.',
  campLead: 'Opted-in promo uses multicast (honors PROMO OFF). Transactional audience uses multicast. All followers uses LINE Broadcast (one language, type BROADCAST).',
  textEn: 'Message (EN)',
  textTh: 'Message (TH)',
  allFollowers: 'All followers (Broadcast)',
  optedInPromo: 'Opted-in promo (multicast)',
  transactionalAudience: 'Transactional audience',
  missingEnv: 'Missing required env',
  fulfillment: 'Turn features, pages, and LINE commands on/off here when ADMIN_CONFIG_LOCK is false. Command checkboxes write the Commands overlay (live). DISABLED_COMMANDS is a comma list of prefixes. GraphQL/docs flags persist in overlay; the process may need a recreate if those routes registered at boot. MONGO_USERS overlay still fails closed without MONGODB_URI.',
};

const th: typeof en = {
  navHome: 'หน้าแรก',
  navOverview: 'ภาพรวม',
  navIdentity: 'ตัวตน',
  navBind: 'ผูกสิทธิ์',
  navDirectory: 'รายชื่อ',
  navPrivileges: 'สิทธิ์',
  navLanguage: 'ภาษา',
  navLine: 'LINE',
  navChannels: 'ช่องทาง',
  navCampaigns: 'แคมเปญ',
  navWork: 'งาน',
  navCrm: 'CRM',
  navCommands: 'คำสั่ง',
  navJobs: 'จ็อบ',
  navPlatform: 'แพลตฟอร์ม',
  navSettings: 'ตั้งค่า',
  navAudit: 'บันทึก',
  navErp: 'ERP',
  navAdvanced: 'ขั้นสูง',
  navDemo: 'เดโม',
  navHelp: 'ช่วยเหลือ',
  signIn: 'เข้าสู่ระบบ',
  signOut: 'ออก',
  toastAdminSecret: 'ต้องมี ADMIN_SECRET_TOKEN ≥16 ตัว วางแล้วกดบันทึกก่อนรัน ค่าต้องตรงกับ VPS หรือ overlay เมื่อ env ว่าง',
  toastUnauthorized: 'ไม่มีสิทธิ์ ผูก super-admin หรือใช้โทเคนที่ถูกต้อง',
  toastForbidden: 'ห้ามเข้า ต้องผูก super-admin',
  jobsNeedToken: 'รันจ็อบได้เมื่อเข้าสู่ระบบด้วย OPS ADMIN_SECRET_TOKEN เป็นทางเลือกสำหรับ curl เมื่อ env ว่าง กดบันทึกเพื่ออัปโหลด',
  uiLanguage: 'ภาษาแผงแอดมิน',
  lineUserLanguage: 'ภาษาผู้ใช้ LINE',
  preview: 'ดูตัวอย่าง',
  confirm: 'ยืนยัน',
  optional: 'ไม่บังคับ',
  bindFirst: 'ผูก super-admin ที่หน้าตัวตนก่อน',
  cmdLead: 'คอลัมน์ Prefix คือคำสั่ง LINE (แก้ไม่ได้ ระบบไม่ใช้ป้าย EN/TH ตอนเกต) แก้ป้าย EN/TH (ปุ่ม LINE สูงสุด 20 ตัว) นามแฝงเป็นทางลัดที่พิมพ์แล้วถูกแปลงเป็น Prefix ปุ่มยังส่ง Prefix บันทึกแล้วข้อความ LINE ถัดไปใช้ป้ายใหม่ ภาษาบน LINE ตาม ENGLISH / THAI ของผู้ใช้ ไม่ใช่ภาษาแผงแอดมิน',
  cmdReload: 'โหลดใหม่',
  cmdSave: 'บันทึกป้าย',
  cmdSaved: 'บันทึกแล้ว ข้อความ LINE ถัดไปใช้ป้ายนี้',
  pickForm: 'เลือกฟอร์ม LINE',
  commandText: 'ข้อความคำสั่ง',
  commandResult: 'ผลคำสั่ง',
  commandWorkLead: 'ดูตัวอย่างจะประกอบคำสั่ง LINE ยืนยันแล้วเข้า resolveCommandReply เดียวกับ OA คำสั่งเขียนอาจยังต้อง ACTION OTP บน LINE',
  campLead: 'โปรโมชันใช้ multicast (เคารพ PROMO OFF) ธุรกรรมใช้ multicast ผู้ติดตามทั้งหมดใช้ Broadcast (ภาษาเดียว พิมพ์ BROADCAST)',
  textEn: 'ข้อความ (EN)',
  textTh: 'ข้อความ (TH)',
  allFollowers: 'ผู้ติดตามทั้งหมด (Broadcast)',
  optedInPromo: 'โปรโมชันที่เปิดรับ (multicast)',
  transactionalAudience: 'กลุ่มธุรกรรม',
  missingEnv: 'env ที่ยังขาด',
  fulfillment: 'เมื่อ ADMIN_CONFIG_LOCK=false เปิด/ปิดฟีเจอร์ หน้า และคำสั่งได้ ช่องคำสั่งเขียน overlay ทันที DISABLED_COMMANDS เป็นรายการ prefix คั่นด้วยจุลภาค ธง GraphQL/docs เก็บใน overlay อาจต้อง recreate คอนเทนเนอร์ MONGO_USERS ใช้ overlay ได้ แต่ไม่มี MONGODB_URI จะปิดแบบ fail-closed',
};

export type UiKey = keyof typeof en;

let portalOverlay: Partial<Record<UiKey, { en?: string; th?: string }>> = {};

const asLocalePair = (value: unknown): { en?: string; th?: string } | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (rec.en !== undefined && typeof rec.en !== 'string') return null;
  if (rec.th !== undefined && typeof rec.th !== 'string') return null;
  if (rec.en === undefined && rec.th === undefined) return null;
  const pair: { en?: string; th?: string } = {};
  if (typeof rec.en === 'string') pair.en = rec.en;
  if (typeof rec.th === 'string') pair.th = rec.th;
  return pair;
};

export const applyPortalI18nOverlay = (next: unknown): void => {
  const applied: Partial<Record<UiKey, { en?: string; th?: string }>> = {};
  if (!next || typeof next !== 'object' || Array.isArray(next)) {
    portalOverlay = applied;
    return;
  }
  for (const [key, value] of Object.entries(next as Record<string, unknown>)) {
    if (!(key in en)) continue;
    const pair = asLocalePair(value);
    if (!pair) continue;
    applied[key as UiKey] = pair;
  }
  portalOverlay = applied;
};

export const portalStringRows = (): Array<{ key: UiKey; en: string; th: string }> =>
  (Object.keys(en) as UiKey[]).map(key => ({ key, en: en[key], th: th[key] }));

export const t = (lang: UiLang, key: UiKey): string => {
  const over = portalOverlay[key];
  const fromOverlay = (lang === 'th' ? over?.th : over?.en)?.trim();
  if (fromOverlay) return fromOverlay;
  return (lang === 'th' ? th : en)[key];
};
