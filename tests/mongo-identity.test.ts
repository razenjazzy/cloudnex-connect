import { afterEach, describe, expect, it } from 'vitest';
import {
  getMongoUserProfile,
  isMongoUsersEnabled,
  maybeWriteMongoOdooRecord,
  maybeWriteMongoUser,
  mongoIdentityReady,
  putMongoUserProfile,
  setMongoIdentityStoreForTests,
} from '../src/services/mongo-users';

describe('Mongo identity SoR', () => {
  afterEach(() => {
    delete process.env.MONGO_USERS;
    setMongoIdentityStoreForTests(null);
  });

  it('is off by default and skips writes', async () => {
    delete process.env.MONGO_USERS;
    expect(isMongoUsersEnabled()).toBe(false);
    expect(await maybeWriteMongoUser('U1', { role: 'user' })).toEqual({ skipped: true });
    expect(await maybeWriteMongoOdooRecord({ id: 1 })).toEqual({ skipped: true });
  });

  it('fails closed when the flag is on without URI or test store', () => {
    process.env.MONGO_USERS = 'true';
    delete process.env.MONGODB_URI;
    setMongoIdentityStoreForTests(null);
    expect(mongoIdentityReady().ok).toBe(false);
  });

  it('round-trips a profile through the test store', async () => {
    process.env.MONGO_USERS = 'true';
    setMongoIdentityStoreForTests(new Map());
    expect(mongoIdentityReady().ok).toBe(true);
    await putMongoUserProfile('U05594', {
      language: 'en',
      role: 'user',
      odooVerified: true,
      marketingOptIn: false,
      odooPartnerId: 9,
    });
    const profile = await getMongoUserProfile('U05594');
    expect(profile?.odooPartnerId).toBe(9);
    expect(profile?.odooVerified).toBe(true);
    expect(await maybeWriteMongoOdooRecord({ partnerId: 9 })).toEqual({ skipped: true });
  });
});
