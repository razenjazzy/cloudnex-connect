import type { UserLanguage } from '../services/firestore';
import { DEFAULT_CHANNEL_ID, resolveChannelConfig } from './channels';
import { appLogger } from '../services/logger';

export type RichMenuVariant = 'default' | 'home' | 'verify' | 'commerce' | 'orders' | 'help' | 'language';

const parseMenuMap = (env: NodeJS.ProcessEnv, channelId = DEFAULT_CHANNEL_ID): Record<string, Record<string, string>> => {
  const envKey = channelId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const namespaced = channelId !== DEFAULT_CHANNEL_ID
    ? env[`LINE_CHANNEL_${envKey}_RICH_MENU_JSON`]?.trim()
    : undefined;
  const raw = namespaced || env.LINE_RICH_MENU_JSON?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, string>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export type TrayRestState = { language: UserLanguage; salesSessionActive: boolean };

export const richMenuIdForLanguage = (
  language: UserLanguage,
  env: NodeJS.ProcessEnv = process.env,
  variant: RichMenuVariant = 'default',
  salesSessionActive = false,
  channelId = DEFAULT_CHANNEL_ID,
): string | undefined => {
  const map = parseMenuMap(env, channelId)[language] || {};
  // Tap = dark teal on that cell (and keep Language/Verify rest colors on the others).
  // Rest after success = default (EN gold Language, idle Verify tint) or default-verified (gold Verify).
  if (variant !== 'default') {
    if (salesSessionActive) {
      const pressedOn = map[`${variant}-verified`]?.trim();
      if (pressedOn) return pressedOn;
    }
    const pressed = map[variant]?.trim();
    if (pressed) return pressed;
  }
  if (salesSessionActive) {
    const verified = map['default-verified']?.trim();
    if (verified) return verified;
  }
  const mapped = map.default?.trim() || map[variant]?.trim();
  if (mapped) return mapped;
  const key = language === 'th' ? 'LINE_RICH_MENU_TH' : 'LINE_RICH_MENU_EN';
  return env[key]?.trim() || undefined;
};

export const trayVariantForCommand = (text: string): RichMenuVariant | undefined => {
  const upper = text.trim().toUpperCase();
  if (upper === 'NAV HOME' || upper === 'NAV' || upper === 'BACK') return 'home';
  if (upper === 'FORM VERIFY' || upper === 'VERIFY SIGNOUT') return 'verify';
  if (upper === 'NAV COMMERCE' || /^NAV\s+COMMERCE$/i.test(text.trim())) return 'commerce';
  if (upper === 'FORM ORDER STATUS') return 'orders';
  if (upper === 'GUIDE' || upper.startsWith('GUIDE ')) return 'help';
  if (upper === 'LANG' || upper === 'LANG EN' || upper === 'LANG TH' || upper === 'ENGLISH' || upper === 'THAI' || upper === 'ภาษาไทย') return 'language';
  return undefined;
};

export const linkUserRichMenu = async (
  userId: string,
  language: UserLanguage,
  channelId: string = DEFAULT_CHANNEL_ID,
  variant: RichMenuVariant = 'default',
  salesSessionActive = false,
): Promise<void> => {
  const richMenuId = richMenuIdForLanguage(language, process.env, variant, salesSessionActive, channelId);
  if (!richMenuId) return;
  const channel = resolveChannelConfig(channelId || DEFAULT_CHANNEL_ID);
  if (!channel) {
    appLogger.warn('rich_menu_link_skipped_no_channel', { channelId, language, variant });
    return;
  }
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`,
      { method: 'POST', headers: { Authorization: `Bearer ${channel.channelAccessToken}` } },
    );
    if (!response.ok) {
      appLogger.warn('rich_menu_link_failed', { language, variant, status: response.status, body: await response.text() });
    }
  } catch (error) {
    appLogger.warn('rich_menu_link_failed', { language, variant, error: String(error) });
  }
};

/** After the success Flex is sent, rest Language/Verify (gold vs light teal). Dark teal is tap-only. */
export const queueTrayRestAfterReply = (
  userId: string,
  rest: TrayRestState | undefined,
  channelId: string = DEFAULT_CHANNEL_ID,
): void => {
  if (!rest) return;
  setTimeout(() => {
    linkUserRichMenu(userId, rest.language, channelId, 'default', rest.salesSessionActive).catch(error => {
      appLogger.warn('rich_menu_rest_failed', { error: String(error) });
    });
  }, 750);
};
