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
  const audience = await resolveCampaignAudience({
    audienceType: campaign.audienceType,
    channelId: campaign.channelId,
    language: campaign.language === 'th' || campaign.language === 'en' ? campaign.language : undefined,
  });
  if (!audience.ok) {
    await updateCampaign(campaignId, { status: 'failed', error: audience.error });
    return;
  }
  const ok = await sendTargetedMessage(audience.userIds, campaign.text, campaign.channelId);
  const sentCount = ok ? audience.userIds.length : 0;
  await updateCampaign(campaignId, {
    status: ok ? 'sent' : 'partial',
    sentCount,
    count: audience.userIds.length,
    error: ok ? undefined : 'multicast failed for at least one chunk',
  });
};
