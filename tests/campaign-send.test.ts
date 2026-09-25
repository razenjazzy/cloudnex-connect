import { describe, expect, it, vi } from 'vitest';
import { runCampaignSend } from '../src/jobs/campaign-send';
import { createQueuedCampaign, getCampaign } from '../src/jobs/campaign-store';
import { sendTargetedMessage } from '../src/line/messaging';

vi.mock('../src/line/messaging', () => ({
  sendTargetedMessage: vi.fn(async () => true),
}));

vi.mock('../src/line/campaigns', () => ({
  resolveCampaignAudience: vi.fn(async () => ({
    ok: true,
    userIds: ['U1', 'U2'],
    skipped: { not_opted_in: 0, wrong_language: 0, staff: 0, unverified: 0 },
  })),
}));

vi.mock('../src/services/firestore', () => {
  const store: Record<string, unknown> = {};
  return {
    getPlatformConfig: async (key: string) => store[key] || null,
    setPlatformConfig: async (key: string, value: unknown) => {
      store[key] = value;
      return { ok: true };
    },
    mutatePlatformConfig: async (key: string, mutator: (current: unknown) => unknown) => {
      store[key] = mutator(store[key] || null);
      return { ok: true };
    },
  };
});

describe('campaign send worker', () => {
  it('sends from the worker not the HTTP layer', async () => {
    const created = await createQueuedCampaign({
      audienceType: 'customers_transactional',
      channelId: 'customer',
      text: 'hello',
      count: 2,
      actorUserId: 'Usuper',
      delivery: 'multicast',
    });
    await runCampaignSend(created.id);
    expect(vi.mocked(sendTargetedMessage)).toHaveBeenCalledWith(['U1', 'U2'], 'hello', 'customer');
    const stored = await getCampaign(created.id);
    expect(stored?.status).toBe('sent');
    expect(stored?.sentCount).toBe(2);
  });

  it('sends stored userIds and does not re-resolve the audience', async () => {
    const { resolveCampaignAudience } = await import('../src/line/campaigns');
    vi.mocked(resolveCampaignAudience).mockClear();
    vi.mocked(sendTargetedMessage).mockClear();
    const created = await createQueuedCampaign({
      audienceType: 'customers_transactional',
      channelId: 'customer',
      text: 'fixed',
      count: 2,
      actorUserId: 'Usuper',
      delivery: 'multicast',
      userIds: ['U9', 'U10'],
    });
    await runCampaignSend(created.id);
    expect(vi.mocked(resolveCampaignAudience)).not.toHaveBeenCalled();
    expect(vi.mocked(sendTargetedMessage)).toHaveBeenCalledWith(['U9', 'U10'], 'fixed', 'customer');
  });
});
