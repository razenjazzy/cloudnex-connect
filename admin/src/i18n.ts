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
  toastAdminSecret: 'ADMIN_SECRET_TOKEN required. Paste a token of at least 16 characters on Jobs, then run the job.',
  toastUnauthorized: 'Unauthorized. Bind super-admin or use the correct token.',
  toastForbidden: 'Forbidden. Super-admin bind is required for this action.',
  jobsNeedToken: 'Jobs stay idle until ADMIN_SECRET_TOKEN is pasted. No request is sent.',
  uiLanguage: 'Admin panel language',
  lineUserLanguage: 'LINE user language',
  preview: 'Preview',
  confirm: 'Confirm',
  optional: 'optional',
  bindFirst: 'Bind super-admin on Identity first.',
  cmdLead: 'The Prefix column is the LINE command (cannot change). EN and TH are the button labels customers see. Edit EN/TH, then Save labels. LINE uses the user’s language (ENGLISH / THAI), not the Admin chrome language.',
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
  fulfillment: 'Fulfillment scopes live in documents/PLATFORM_FULFILLMENT.md. Flags stay off until VPS .env is set.',
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
  toastAdminSecret: 'ต้องมี ADMIN_SECRET_TOKEN ความยาวอย่างน้อย 16 ตัว วางในหน้าจ็อบก่อนรัน',
  toastUnauthorized: 'ไม่มีสิทธิ์ ผูก super-admin หรือใช้โทเคนที่ถูกต้อง',
  toastForbidden: 'ห้ามเข้า ต้องผูก super-admin',
  jobsNeedToken: 'ยังไม่เรียก API จนกว่าจะวาง ADMIN_SECRET_TOKEN',
  uiLanguage: 'ภาษาแผงแอดมิน',
  lineUserLanguage: 'ภาษาผู้ใช้ LINE',
  preview: 'ดูตัวอย่าง',
  confirm: 'ยืนยัน',
  optional: 'ไม่บังคับ',
  bindFirst: 'ผูก super-admin ที่หน้าตัวตนก่อน',
  cmdLead: 'คอลัมน์ Prefix คือคำสั่ง LINE (แก้ไม่ได้) EN และ TH คือข้อความปุ่มที่ลูกค้าเห็น แก้แล้วกดบันทึกป้าย ภาษาบน LINE ตาม ENGLISH / THAI ของผู้ใช้ ไม่ใช่ภาษาแผงแอดมิน',
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
  fulfillment: 'ขอบเขตครบอยู่ใน documents/PLATFORM_FULFILLMENT.md ธงยังปิดจนกว่าจะตั้ง .env บน VPS',
};

export type UiKey = keyof typeof en;

export const t = (lang: UiLang, key: UiKey): string => (lang === 'th' ? th : en)[key];
