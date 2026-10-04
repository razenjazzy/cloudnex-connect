import { listVerifiedSalesLineUserIds, getUserProfile } from '../services/firestore';
import { clearSalesLogin, salesIdleExpired, salesSessionExpired, salesSessionUntracked } from '../services/sales-session';
import { salesNotifyChannelId } from '../line/channels';
import { linkUserRichMenu } from '../line/rich-menu';
import { appLogger } from '../services/logger';

export type SalesSweepResult = { checked: number; signedOut: number; failed: number };

/**
 * Sales sessions end on their own: 24 h after Verify (SALES_SESSION_TTL_HOURS) or after the idle limit
 * (SALES_IDLE_SIGNOUT_SECONDS). The chat only notices on the user's next message, so this sweep (run every few
 * minutes from the host cron through POST /ops/sales-session-sweep) signs expired users out and puts their native
 * menu back to the default colors: Verify white (not verified), Language gold (EN) or white (TH).
 */
export const sweepExpiredSalesSessions = async (now = Date.now()): Promise<SalesSweepResult> => {
  const result: SalesSweepResult = { checked: 0, signedOut: 0, failed: 0 };
  const userIds = await listVerifiedSalesLineUserIds();
  for (const userId of userIds) {
    result.checked += 1;
    try {
      const profile = await getUserProfile(userId);
      if (!profile.odooVerified || !profile.salesTier) continue;
      if (!salesSessionExpired(profile, now) && !salesIdleExpired(profile, now) && !salesSessionUntracked(profile)) continue;
      await clearSalesLogin(userId);
      await linkUserRichMenu(userId, profile.language, salesNotifyChannelId(), 'default', false);
      result.signedOut += 1;
      appLogger.info('sales_session_swept', { userId, tier: profile.salesTier, expiresAt: profile.salesSessionExpiresAt, lastActiveAt: profile.salesLastActiveAt });
    } catch (error) {
      result.failed += 1;
      appLogger.warn('sales_session_sweep_failed', { userId, error: String(error) });
    }
  }
  return result;
};
