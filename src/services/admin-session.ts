import { createHmac, createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getPlatformConfig, setPlatformConfig } from './firestore';
import { adminCookiePath } from '../http/public-bases';
import { isAuthorizedForAdminRole } from './admin-authorization';
import type { UserProfile } from './firestore';
import { getSecretRevealTtlSeconds, getSuperAdminUserIds } from './runtime-settings';

const BIND_CONFIG_KEY = 'adminBindOtpsV1';
const REVEAL_CONFIG_KEY = 'secretRevealTokensV1';
const cookieName = 'cloudnex_admin_actor';

type BindRecord = { hash: string; expiresAt: number };
type RevealRecord = { secretKey: string; actorUserId: string; expiresAt: number; used?: boolean };

const hmacSecret = (): string =>
  process.env.SECRETS_ENCRYPTION_KEY?.trim()
  || process.env.OPS_API_TOKEN?.trim()
  || process.env.CONNECT_BOOTSTRAP_TOKEN?.trim()
  || 'dev-admin-actor';

const sha = (value: string): string => createHash('sha256').update(value).digest('hex');

const signActor = (userId: string, exp: number): string =>
  createHmac('sha256', hmacSecret()).update(`${userId}.${exp}`).digest('hex');

export const adminActorCookieName = cookieName;

export const parseAdminActorCookie = (cookieHeader: string | undefined): string | null => {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith(`${cookieName}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(cookieName.length + 1));
  const [userId, expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!userId || !sig || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = signActor(userId, exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
};

export const buildAdminActorCookie = (userId: string, ttlMs = 8 * 60 * 60 * 1000): { value: string; cookie: string } => {
  const exp = Date.now() + ttlMs;
  const value = `${userId}.${exp}.${signActor(userId, exp)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = `${cookieName}=${encodeURIComponent(value)}; Path=${adminCookiePath()}; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}${secure}`;
  return { value, cookie };
};

export const clearAdminActorCookie = (): string =>
  `${cookieName}=; Path=${adminCookiePath()}; HttpOnly; SameSite=Lax; Max-Age=0`;

export const isSuperAdminActor = (userId: string, profile: { odooVerified: boolean }): boolean => {
  const supers = getSuperAdminUserIds();
  if (supers.size === 0) return false;
  if (!supers.has(userId.trim())) return false;
  return isAuthorizedForAdminRole(userId, profile).ok;
};

export const issueBindOtp = async (userId: string): Promise<{ ok: true; expiresInSec: number; otp: string } | { ok: false; error: string }> => {
  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresInSec = 10 * 60;
  const stored = (await getPlatformConfig<Record<string, BindRecord>>(BIND_CONFIG_KEY)) || {};
  stored[userId] = { hash: sha(otp), expiresAt: Date.now() + expiresInSec * 1000 };
  const result = await setPlatformConfig(BIND_CONFIG_KEY, stored as unknown as Record<string, unknown>);
  if (!result.ok) return { ok: false, error: 'Failed to persist bind OTP.' };
  return { ok: true, expiresInSec, otp };
};

export const consumeBindOtp = async (userId: string, otp: string): Promise<boolean> => {
  const stored = (await getPlatformConfig<Record<string, BindRecord>>(BIND_CONFIG_KEY)) || {};
  const row = stored[userId];
  if (!row || row.expiresAt < Date.now()) return false;
  if (row.hash !== sha(otp.trim())) return false;
  delete stored[userId];
  await setPlatformConfig(BIND_CONFIG_KEY, stored as unknown as Record<string, unknown>);
  return true;
};

export const issueRevealToken = async (secretKey: string, actorUserId: string): Promise<{ token: string; expiresInSec: number }> => {
  const token = randomBytes(32).toString('hex');
  const expiresInSec = getSecretRevealTtlSeconds();
  const stored = (await getPlatformConfig<Record<string, RevealRecord>>(REVEAL_CONFIG_KEY)) || {};
  stored[sha(token)] = { secretKey, actorUserId, expiresAt: Date.now() + expiresInSec * 1000 };
  await setPlatformConfig(REVEAL_CONFIG_KEY, stored as unknown as Record<string, unknown>);
  return { token, expiresInSec };
};

export const consumeRevealToken = async (token: string): Promise<RevealRecord | null> => {
  const stored = (await getPlatformConfig<Record<string, RevealRecord>>(REVEAL_CONFIG_KEY)) || {};
  const key = sha(token);
  const row = stored[key];
  if (!row || row.used || row.expiresAt < Date.now()) return null;
  stored[key] = { ...row, used: true };
  await setPlatformConfig(REVEAL_CONFIG_KEY, stored as unknown as Record<string, unknown>);
  return row;
};

export type { UserProfile };
