import { CUSTOMER_CHANNEL_ID, DEFAULT_CHANNEL_ID, SALES_CHANNEL_ID } from './channels';
import { isQuoteStaff } from './quote-access';
import {
  filterMarketingOptedInUserIds,
  getUserProfile,
  listVerifiedCustomerLineUserIds,
  listVerifiedSalesLineUserIds,
  type UserLanguage,
  type UserProfile,
} from '../services/firestore';

/** Who the campaign is for. Illegal channel/class pairs are rejected in assertCampaignAudience. */
export type CampaignAudienceType = 'sales_internal' | 'customers_transactional' | 'customers_promo';

export type CampaignAudienceRequest = {
  audienceType: CampaignAudienceType;
  channelId: string;
  language?: UserLanguage;
};

export type CampaignSkipReason = 'not_opted_in' | 'wrong_language' | 'staff' | 'unverified';

export type CampaignAudienceResult = {
  ok: true;
  userIds: string[];
  skipped: Record<CampaignSkipReason, number>;
} | {
  ok: false;
  error: string;
};

export type CampaignAudienceDeps = {
  listSalesIds: () => Promise<string[]>;
  listCustomerIds: () => Promise<string[]>;
  getProfile: (userId: string) => Promise<UserProfile>;
  filterOptedIn: (userIds: string[]) => Promise<string[]>;
};

const defaultDeps = (): CampaignAudienceDeps => ({
  listSalesIds: listVerifiedSalesLineUserIds,
  listCustomerIds: listVerifiedCustomerLineUserIds,
  getProfile: getUserProfile,
  filterOptedIn: filterMarketingOptedInUserIds,
});

const emptySkipped = (): Record<CampaignSkipReason, number> => ({
  not_opted_in: 0,
  wrong_language: 0,
  staff: 0,
  unverified: 0,
});

export const assertCampaignAudience = (input: CampaignAudienceRequest): string | null => {
  const channelId = input.channelId.trim();
  if (!channelId) return 'channelId is required.';
  if (input.audienceType === 'sales_internal') {
    if (channelId !== SALES_CHANNEL_ID && channelId !== DEFAULT_CHANNEL_ID) {
      return 'Internal sales bulletins must use the Sales OA (or default).';
    }
    return null;
  }
  if (channelId !== CUSTOMER_CHANNEL_ID) {
    return input.audienceType === 'customers_promo'
      ? 'Promotional campaigns must use the Customer OA.'
      : 'Customer messages must use the Customer OA.';
  }
  return null;
};

const applyLanguageFilter = async (
  userIds: string[],
  language: UserLanguage | undefined,
  getProfile: CampaignAudienceDeps['getProfile'],
  skipped: Record<CampaignSkipReason, number>,
): Promise<string[]> => {
  if (!language) return userIds;
  const kept: string[] = [];
  for (const userId of userIds) {
    const profile = await getProfile(userId);
    if (profile.language === language) kept.push(userId);
    else skipped.wrong_language += 1;
  }
  return kept;
};

export const CAMPAIGN_AUDIENCE_TYPES: CampaignAudienceType[] = [
  'sales_internal',
  'customers_transactional',
  'customers_promo',
];

export const parseCampaignAudienceRequest = (body: unknown): CampaignAudienceRequest | { error: string } => {
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const audienceType = String(raw.audienceType || '').trim() as CampaignAudienceType;
  if (!CAMPAIGN_AUDIENCE_TYPES.includes(audienceType)) {
    return { error: 'audienceType must be sales_internal, customers_transactional, or customers_promo.' };
  }
  const channelId = String(raw.channelId || '').trim();
  const languageRaw = typeof raw.language === 'string' ? raw.language.trim() : '';
  const language = languageRaw === 'th' || languageRaw === 'en' ? languageRaw : undefined;
  if (languageRaw && !language) return { error: 'language must be th or en.' };
  const request: CampaignAudienceRequest = { audienceType, channelId, ...(language ? { language } : {}) };
  const combo = assertCampaignAudience(request);
  if (combo) return { error: combo };
  return request;
};

export const parseCampaignTestText = (body: unknown): string | { error: string } => {
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const language = String(raw.language || '').trim();
  const textEn = String(raw.textEn || '').trim();
  const textTh = String(raw.textTh || '').trim();
  const text = String(raw.text || '').trim()
    || (language === 'th' ? textTh : textEn)
    || textEn
    || textTh;
  if (!text) return { error: 'text is required for a test push.' };
  if (text.length > 1000) return { error: 'text must be at most 1000 characters.' };
  return text;
};

export const parseCampaignSendRequest = (body: unknown): (CampaignAudienceRequest & {
  text: string;
  confirm: 'SEND';
  delivery: 'multicast';
}) | { error: string } => {
  const parsed = parseCampaignAudienceRequest(body);
  if ('error' in parsed) return parsed;
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const text = parseCampaignTestText(body);
  if (typeof text !== 'string') return text;
  if (String(raw.confirm || '').trim() !== 'SEND') return { error: 'confirm must be SEND.' };
  const delivery = String(raw.delivery || 'multicast').trim();
  if (delivery !== 'multicast') return { error: 'delivery must be multicast. Use /broadcast for LINE Broadcast.' };
  return { ...parsed, text, confirm: 'SEND', delivery: 'multicast' };
};

export const parseCampaignBroadcastRequest = (body: unknown): { channelId: string; text: string } | { error: string } => {
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const audienceType = String(raw.audienceType || '').trim();
  if (audienceType === 'customers_promo') {
    return { error: 'LINE Broadcast cannot honor PROMO OFF. Use multicast Send for promotional audiences.' };
  }
  const channelId = String(raw.channelId || '').trim();
  if (!channelId) return { error: 'channelId is required.' };
  if (String(raw.confirm || '').trim() !== 'BROADCAST') return { error: 'confirm must be BROADCAST.' };
  const text = parseCampaignTestText(body);
  if (typeof text !== 'string') return text;
  return { channelId, text };
};

export const resolveCampaignAudience = async (
  input: CampaignAudienceRequest,
  deps: CampaignAudienceDeps = defaultDeps(),
): Promise<CampaignAudienceResult> => {
  const comboError = assertCampaignAudience(input);
  if (comboError) return { ok: false, error: comboError };

  const skipped = emptySkipped();

  if (input.audienceType === 'sales_internal') {
    const userIds = await applyLanguageFilter(await deps.listSalesIds(), input.language, deps.getProfile, skipped);
    return { ok: true, userIds, skipped };
  }

  const candidates = await deps.listCustomerIds();
  const eligible: string[] = [];
  for (const userId of candidates) {
    const profile = await deps.getProfile(userId);
    if (!profile.odooVerified) {
      skipped.unverified += 1;
      continue;
    }
    if (isQuoteStaff(profile)) {
      skipped.staff += 1;
      continue;
    }
    eligible.push(userId);
  }

  let userIds = eligible;
  if (input.audienceType === 'customers_promo') {
    const optedIn = new Set(await deps.filterOptedIn(eligible));
    userIds = eligible.filter(id => optedIn.has(id));
    skipped.not_opted_in = eligible.length - userIds.length;
  }

  userIds = await applyLanguageFilter(userIds, input.language, deps.getProfile, skipped);
  return { ok: true, userIds, skipped };
};
