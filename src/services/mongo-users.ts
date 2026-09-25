import { MongoClient, type Collection } from 'mongodb';
import { mongoUri } from '../http/env';
import { appLogger } from './logger';
import type { UserProfile } from './firestore/types';

export const isMongoUsersEnabled = (): boolean => /^(1|true|yes|on)$/i.test(process.env.MONGO_USERS || '');

type IdentityDoc = UserProfile & { userId: string };

let testStore: Map<string, IdentityDoc> | null = null;
let client: MongoClient | null = null;
let collectionPromise: Promise<Collection<IdentityDoc> | null> | null = null;

export const setMongoIdentityStoreForTests = (store: Map<string, IdentityDoc> | null): void => {
  testStore = store;
};

export const mongoIdentityReady = (): { ok: boolean; message: string } => {
  if (!isMongoUsersEnabled()) return { ok: true, message: 'Mongo identity SoR is off.' };
  if (testStore) return { ok: true, message: 'Mongo identity test store.' };
  if (!mongoUri) return { ok: false, message: 'MONGO_USERS is on but MONGODB_URI is unset.' };
  return { ok: true, message: 'Mongo identity SoR is configured.' };
};

const collection = async (): Promise<Collection<IdentityDoc> | null> => {
  if (testStore) return null;
  if (!isMongoUsersEnabled() || !mongoUri) return null;
  if (!collectionPromise) {
    collectionPromise = (async () => {
      client = new MongoClient(mongoUri);
      await client.connect();
      return client.db().collection<IdentityDoc>('line_users');
    })().catch(err => {
      appLogger.error('mongo_identity_connect_failed', { error: String(err) });
      collectionPromise = null;
      return null;
    });
  }
  return collectionPromise;
};

export const getMongoUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!isMongoUsersEnabled()) return null;
  const ready = mongoIdentityReady();
  if (!ready.ok) return null;
  if (testStore) return testStore.get(userId) || null;
  const col = await collection();
  if (!col) return null;
  const doc = await col.findOne({ userId });
  if (!doc) return null;
  const { userId: _id, ...profile } = doc;
  return profile;
};

export const putMongoUserProfile = async (userId: string, profile: UserProfile): Promise<{ ok: boolean; error?: string }> => {
  if (!isMongoUsersEnabled()) return { ok: true };
  const ready = mongoIdentityReady();
  if (!ready.ok) return { ok: false, error: ready.message };
  const doc: IdentityDoc = { ...profile, userId };
  if (testStore) {
    testStore.set(userId, doc);
    return { ok: true };
  }
  const col = await collection();
  if (!col) return { ok: false, error: 'Mongo identity collection is unavailable.' };
  await col.updateOne({ userId }, { $set: doc }, { upsert: true });
  return { ok: true };
};

export const patchMongoUserProfile = async (userId: string, patch: Partial<UserProfile>, current: UserProfile): Promise<{ ok: boolean; error?: string }> => {
  return putMongoUserProfile(userId, { ...current, ...patch });
};

export const maybeWriteMongoUser = async (userId: string, doc: Record<string, unknown>): Promise<{ skipped: boolean }> => {
  if (!isMongoUsersEnabled()) return { skipped: true };
  const current = await getMongoUserProfile(userId) || {
    language: 'en' as const,
    role: 'user' as const,
    odooVerified: false,
    marketingOptIn: false,
  };
  const result = await putMongoUserProfile(userId, { ...current, ...(doc as Partial<UserProfile>) });
  return { skipped: !result.ok };
};

/** Odoo masters are never stored in Mongo. */
export const maybeWriteMongoOdooRecord = async (_record: Record<string, unknown>): Promise<{ skipped: boolean }> => {
  return { skipped: true };
};
