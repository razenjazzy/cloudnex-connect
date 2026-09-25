import { resolveCampaignAudience } from '../line/campaigns';
import { sendTargetedMessage } from '../line/messaging';
import { getCampaign, updateCampaign } from './campaign-store';
import { appLogger } from '../services/logger';

export const runCampaignSend = async (campaignId: string): Promise<void> => {
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    appLogger.warn('campaign_send_missing', { campaignId });
    return;
  }
  if (campaign.delivery === 'broadcast') {
    await updateCampaign(campaignId, { status: 'failed', error: 'Broadcast is not a queued multicast job.' });
    return;
  }
  await updateCampaign(campaignId, { status: 'sending' });
  let userIds = Array.isArray(campaign.userIds) ? campaign.userIds.filter(id => id.startsWith('U')) : [];
  if (userIds.length === 0) {
    const audience = await resolveCampaignAudience({
      audienceType: campaign.audienceType,
      channelId: campaign.channelId,
      language: campaign.language === 'th' || campaign.language === 'en' ? campaign.language : undefined,
    });
    if (!audience.ok) {
      await updateCampaign(campaignId, { status: 'failed', error: audience.error });
      return;
    }
    userIds = audience.userIds;
  }
  const ok = await sendTargetedMessage(userIds, campaign.text, campaign.channelId);
  const sentCount = ok ? userIds.length : 0;
  await updateCampaign(campaignId, {
    status: ok ? 'sent' : 'partial',
    sentCount,
    count: userIds.length,
    error: ok ? undefined : 'multicast failed for at least one chunk',
  });
};
