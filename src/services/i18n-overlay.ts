import { getPlatformConfig, mutatePlatformConfig } from './firestore';
import { tenantScopedKey } from './tenant';
import { registerI18nPairLookup, UI_STRINGS, type UiStringKey } from './i18n';

export type LocalePair = { en?: string; th?: string };
export type I18nOverlayMap = {
  api?: Partial<Record<string, LocalePair>>;
  portal?: Partial<Record<string, LocalePair>>;
};

let overlayCache: I18nOverlayMap = {};
let overlayLoadedAt = 0;
const OVERLAY_TTL_MS = 60_000;

const configKey = (): string => tenantScopedKey('i18n-overlay');

const overlayHasEntries = (next: I18nOverlayMap | undefined): boolean => {
  const apiCount = next?.api ? Object.keys(next.api).length : 0;
  const portalCount = next?.portal ? Object.keys(next.portal).length : 0;
  return apiCount > 0 || portalCount > 0;
};

const isPair = (value: unknown): value is LocalePair =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const loadI18nOverlay = async (): Promise<I18nOverlayMap> => {
  if (overlayLoadedAt && Date.now() - overlayLoadedAt < OVERLAY_TTL_MS) return overlayCache;
  const stored = await getPlatformConfig<I18nOverlayMap>(configKey());
  overlayCache = stored && typeof stored === 'object' ? stored : {};
  overlayLoadedAt = Date.now();
  return overlayCache;
};

export const getCachedI18nOverlay = (): I18nOverlayMap => overlayCache;

export const setI18nOverlayCacheForTests = (next: I18nOverlayMap): void => {
  overlayCache = next || {};
  overlayLoadedAt = overlayHasEntries(next) ? Date.now() : 0;
};

export const i18nOverlayCacheIsWarmForTests = (): boolean => overlayLoadedAt > 0;

export const apiPairForKey = (key: UiStringKey): { en: string; th: string } => {
  const base = UI_STRINGS[key];
  const over = overlayCache.api?.[key];
  return {
    en: (over?.en || '').trim() || base.en,
    th: (over?.th || '').trim() || base.th,
  };
};

export const listApiI18nCatalog = (): Array<{ key: string; en: string; th: string; source: 'overlay' | 'code' }> =>
  (Object.keys(UI_STRINGS) as UiStringKey[]).map(key => {
    const over = overlayCache.api?.[key];
    const pair = apiPairForKey(key);
    return {
      key,
      en: pair.en,
      th: pair.th,
      source: over && ((over.en || '').trim() || (over.th || '').trim()) ? 'overlay' : 'code',
    };
  });

const sanitizeScope = (
  raw: unknown,
  allow: (key: string) => boolean,
): { ok: true; map: Record<string, LocalePair> } | { ok: false; error: string } => {
  if (raw == null) return { ok: true, map: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Invalid i18n map.' };
  const map: Record<string, LocalePair> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(key) || !allow(key)) {
      return { ok: false, error: `Unknown i18n key ${key}.` };
    }
    if (!isPair(value)) return { ok: false, error: `Invalid pair for ${key}.` };
    const en = typeof value.en === 'string' ? value.en.trim() : '';
    const th = typeof value.th === 'string' ? value.th.trim() : '';
    if (en || th) map[key] = { ...(en ? { en } : {}), ...(th ? { th } : {}) };
  }
  return { ok: true, map };
};

export const sanitizeI18nOverlay = (
  body: unknown,
): { ok: true; overlay: I18nOverlayMap } | { ok: false; error: string } => {
  const raw = body && typeof body === 'object' ? body as I18nOverlayMap : {};
  const apiKeys = new Set(Object.keys(UI_STRINGS));
  const api = sanitizeScope(raw.api, key => apiKeys.has(key));
  if (!api.ok) return api;
  const portal = sanitizeScope(raw.portal, () => true);
  if (!portal.ok) return portal;
  return { ok: true, overlay: { api: api.map, portal: portal.map } };
};

export const saveI18nOverlay = async (overlay: I18nOverlayMap): Promise<{ ok: boolean; error?: string }> => {
  const result = await mutatePlatformConfig<I18nOverlayMap>(configKey(), () => overlay);
  if (!result.ok) return result;
  overlayCache = overlay;
  overlayLoadedAt = Date.now();
  return { ok: true };
};

registerI18nPairLookup(key => apiPairForKey(key));
