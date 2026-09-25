import { describe, expect, it } from 'vitest';
import { assertCampaignAudience, parseCampaignAudienceRequest, resolveCampaignAudience, type CampaignAudienceDeps } from '../src/line/campaigns';
import type { UserProfile } from '../src/services/firestore';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  language: 'en',
  role: 'user',
  odooVerified: true,
  marketingOptIn: false,
  ...overrides,
});

const depsFor = (profiles: Record<string, UserProfile>): CampaignAudienceDeps => ({
  listSalesIds: async () => Object.keys(profiles).filter(id => profiles[id].salesTier || profiles[id].role === 'admin'),
  listCustomerIds: async () => Object.keys(profiles).filter(id => profiles[id].lastChannelId === 'customer'),
  getProfile: async (userId) => profiles[userId] || profile({ odooVerified: false }),
  filterOptedIn: async (userIds) => userIds.filter(id => profiles[id]?.marketingOptIn),
});

describe('assertCampaignAudience', () => {
  it('rejects promo on the Sales OA', () => {
    expect(assertCampaignAudience({ audienceType: 'customers_promo', channelId: 'sales' }))
      .toMatch(/Customer OA/);
  });

  it('rejects internal bulletins on the Customer OA', () => {
    expect(assertCampaignAudience({ audienceType: 'sales_internal', channelId: 'customer' }))
      .toMatch(/Sales OA/);
  });

  it('allows the three legal pairs', () => {
    expect(assertCampaignAudience({ audienceType: 'sales_internal', channelId: 'sales' })).toBeNull();
    expect(assertCampaignAudience({ audienceType: 'customers_transactional', channelId: 'customer' })).toBeNull();
    expect(assertCampaignAudience({ audienceType: 'customers_promo', channelId: 'customer' })).toBeNull();
  });
});

describe('parseCampaignAudienceRequest', () => {
  it('parses audience bodies and rejects illegal pairs', () => {
    expect(parseCampaignAudienceRequest({ audienceType: 'customers_promo', channelId: 'customer' })).toEqual({
      audienceType: 'customers_promo',
      channelId: 'customer',
    });
    expect(parseCampaignAudienceRequest({ audienceType: 'customers_promo', channelId: 'sales' })).toMatchObject({
      error: expect.stringMatching(/Customer OA/),
    });
  });
});

describe('resolveCampaignAudience', () => {
  const profiles: Record<string, UserProfile> = {
    Usales: profile({ salesTier: 'salesperson', lastChannelId: 'sales' }),
    UcustOn: profile({ lastChannelId: 'customer', marketingOptIn: true }),
    UcustOff: profile({ lastChannelId: 'customer', marketingOptIn: false }),
    UcustTh: profile({ lastChannelId: 'customer', marketingOptIn: true, language: 'th' }),
    UstaffAsCustomer: profile({ lastChannelId: 'customer', salesTier: 'salesperson', marketingOptIn: true }),
  };

  it('keeps opted-out customers on transactional lists', async () => {
    const result = await resolveCampaignAudience({ audienceType: 'customers_transactional', channelId: 'customer' }, depsFor(profiles));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userIds.sort()).toEqual(['UcustOff', 'UcustOn', 'UcustTh']);
    expect(result.skipped.not_opted_in).toBe(0);
    expect(result.skipped.staff).toBe(1);
  });

  it('excludes marketingOptIn false from promo', async () => {
    const result = await resolveCampaignAudience({ audienceType: 'customers_promo', channelId: 'customer' }, depsFor(profiles));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userIds.sort()).toEqual(['UcustOn', 'UcustTh']);
    expect(result.skipped.not_opted_in).toBe(1);
  });

  it('lists verified sales for internal bulletins', async () => {
    const result = await resolveCampaignAudience({ audienceType: 'sales_internal', channelId: 'sales' }, depsFor(profiles));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userIds.sort()).toEqual(['Usales', 'UstaffAsCustomer']);
  });

  it('filters language when requested', async () => {
    const result = await resolveCampaignAudience({
      audienceType: 'customers_promo',
      channelId: 'customer',
      language: 'th',
    }, depsFor(profiles));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userIds).toEqual(['UcustTh']);
    expect(result.skipped.wrong_language).toBe(1);
  });
});
