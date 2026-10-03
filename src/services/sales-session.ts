import type { UserProfile } from './firestore/types';
import { setSalesLastActiveAt, setSalesSessionExpiresAt, setUserOdooVerificationStatus } from './firestore';

export const startSalesSession = async (userId: string): Promise<void> => {
  await setSalesSessionExpiresAt(userId, salesSessionExpiresAtFromNow());
  await setSalesLastActiveAt(userId, new Date().toISOString());
};

export const clearSalesLogin = async (userId: string): Promise<void> => {
  await setUserOdooVerificationStatus(userId, false);
  await setSalesSessionExpiresAt(userId, null);
  await setSalesLastActiveAt(userId, null);
};

/** Seconds of silence after which a Sales staff session must verify again. 0 turns the idle sign-out off. */
export const salesIdleSignoutSeconds = (env: NodeJS.ProcessEnv = process.env): number => {
  const raw = env.SALES_IDLE_SIGNOUT_SECONDS;
  if (raw === undefined || raw.trim() === '') return 3600;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3600;
};

export const salesIdleExpired = (
  profile: Pick<UserProfile, 'odooVerified' | 'salesTier' | 'salesLastActiveAt'>,
  now = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const limit = salesIdleSignoutSeconds(env);
  if (!limit || !profile.odooVerified || !profile.salesTier || !profile.salesLastActiveAt) return false;
  const last = Date.parse(profile.salesLastActiveAt);
  return Number.isFinite(last) && now - last > limit * 1000;
};

const ACTIVITY_TOUCH_MS = 60_000;

/** Record activity at most once a minute so the idle clock does not cost a write per message. */
export const shouldTouchSalesActivity = (
  profile: Pick<UserProfile, 'odooVerified' | 'salesTier' | 'salesLastActiveAt'>,
  now = Date.now(),
): boolean => {
  if (!profile.odooVerified || !profile.salesTier) return false;
  const last = profile.salesLastActiveAt ? Date.parse(profile.salesLastActiveAt) : NaN;
  return !Number.isFinite(last) || now - last >= ACTIVITY_TOUCH_MS;
};

export const touchSalesActivity = async (userId: string, now = Date.now()): Promise<string> => {
  const iso = new Date(now).toISOString();
  await setSalesLastActiveAt(userId, iso);
  return iso;
};

export const salesSessionTtlHours = (env: NodeJS.ProcessEnv = process.env): number => {
  const parsed = Number(env.SALES_SESSION_TTL_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
};

export const salesSessionExpiresAtFromNow = (now = Date.now(), env: NodeJS.ProcessEnv = process.env): string =>
  new Date(now + salesSessionTtlHours(env) * 60 * 60 * 1000).toISOString();

export const hasActiveSalesSession = (
  profile: Pick<UserProfile, 'odooVerified' | 'salesSessionExpiresAt' | 'salesTier'>,
  now = Date.now(),
): boolean => {
  if (!profile.odooVerified) return false;
  if (!profile.salesTier) return true;
  if (!profile.salesSessionExpiresAt) return false;
  return new Date(profile.salesSessionExpiresAt).getTime() > now;
};

export const salesSessionExpired = (
  profile: Pick<UserProfile, 'salesSessionExpiresAt' | 'salesTier' | 'odooVerified'>,
  now = Date.now(),
): boolean => {
  if (!profile.odooVerified || !profile.salesTier || !profile.salesSessionExpiresAt) return false;
  return new Date(profile.salesSessionExpiresAt).getTime() <= now;
};
