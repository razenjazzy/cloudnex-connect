import { appLogger } from './logger';

/** Optional Mongo identity store. Default off. Firestore remains SoR. */
export const isMongoUsersEnabled = (): boolean => /^(1|true|yes|on)$/i.test(process.env.MONGO_USERS || '');

export const maybeWriteMongoUser = async (userId: string, _doc: Record<string, unknown>): Promise<{ skipped: boolean }> => {
  if (!isMongoUsersEnabled()) return { skipped: true };
  appLogger.info('mongo_user_write_enabled_not_used_as_sor', { userId });
  return { skipped: false };
};

export const maybeWriteMongoOdooRecord = async (_record: Record<string, unknown>): Promise<{ skipped: boolean }> => {
  if (!isMongoUsersEnabled()) return { skipped: true };
  return { skipped: false };
};
