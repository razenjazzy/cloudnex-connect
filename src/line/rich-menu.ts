import type { UserLanguage } from '../services/firestore';
import { DEFAULT_CHANNEL_ID, resolveChannelConfig } from './channels';
import { getRuntime } from '../services/runtime-settings';
import { appLogger } from '../services/logger';

export type RichMenuVariant = 'default' | 'home' | 'verify' | 'commerce' | 'orders' | 'help' | 'language';

const parseMenuMap = (env: NodeJS.ProcessEnv, channelId = DEFAULT_CHANNEL_ID): Record<string, Record<string, string>> => {
  const envKey = channelId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const namespaced = channelId !== DEFAULT_CHANNEL_ID
    ? (env[`LINE_CHANNEL_${envKey}_RICH_MENU_JSON`]?.trim() || getRuntime(`LINE_CHANNEL_${envKey}_RICH_MENU_JSON`))
    : undefined;
  const raw = namespaced || env.LINE_RICH_MENU_JSON?.trim() || getRuntime('LINE_RICH_MENU_JSON');
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

/** Home is already the rest tray — do not press then rest (two LINE rich-menu calls). */
export const trayAfterReplyPlan = (
  highlight?: RichMenuVariant,
): { press: RichMenuVariant; restDelayed: boolean } | null => {
  if (!highlight) return null;
  if (highlight === 'home') return { press: 'default', restDelayed: false };
  return { press: highlight, restDelayed: true };
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

export const unlinkUserRichMenu = async (
  userId: string,
  channelId: string = DEFAULT_CHANNEL_ID,
): Promise<void> => {
  const channel = resolveChannelConfig(channelId || DEFAULT_CHANNEL_ID);
  if (!channel) return;
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/user/${encodeURIComponent(userId)}/richmenu`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${channel.channelAccessToken}` } },
    );
    if (!response.ok && response.status !== 404) {
      appLogger.warn('rich_menu_unlink_failed', { status: response.status, body: await response.text() });
    }
  } catch (error) {
    appLogger.warn('rich_menu_unlink_failed', { error: String(error) });
  }
};

export const applyTrayAfterReply = (
  userId: string,
  language: UserLanguage,
  channelId: string | undefined,
  highlight: RichMenuVariant | undefined,
  rest: TrayRestState | undefined,
): void => {
  const plan = trayAfterReplyPlan(highlight);
  if (!plan) return;
  const sales = Boolean(rest?.salesSessionActive);
  const channel = channelId || DEFAULT_CHANNEL_ID;
  void linkUserRichMenu(userId, language, channel, plan.press, sales);
  if (plan.restDelayed) queueTrayRestAfterReply(userId, rest, channel);
};
