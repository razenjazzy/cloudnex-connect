import {
  claimQuoteCreateLock,
  completeQuoteCreateLock,
  releaseQuoteCreateLock,
} from './firestore';

const QUOTE_CREATE_LOCK_MS = 20_000;

type QuoteLock = { at: number; orderName?: string };

const locks = new Map<string, QuoteLock>();

export const quoteCreateLockKey = (input: {
  userId: string;
  productId: number;
  qty: number;
  requestId?: string;
}): string => `${input.userId}:${input.productId}:${input.qty}:${input.requestId || ''}`;

export const beginQuoteCreate = async (key: string, now = Date.now()): Promise<{ ok: true } | { ok: false; orderName?: string }> => {
  const prev = locks.get(key);
  if (prev && now - prev.at < QUOTE_CREATE_LOCK_MS) {
    return { ok: false, orderName: prev.orderName };
  }
  locks.set(key, { at: now, orderName: prev?.orderName });
  const remote = await claimQuoteCreateLock(key, QUOTE_CREATE_LOCK_MS);
  if (!remote.ok) {
    locks.delete(key);
    return { ok: false, orderName: remote.orderName };
  }
  return { ok: true };
};

export const completeQuoteCreate = (key: string, orderName: string, now = Date.now()): void => {
  locks.set(key, { at: now, orderName });
  void completeQuoteCreateLock(key, orderName, QUOTE_CREATE_LOCK_MS);
};

export const failQuoteCreate = (key: string): void => {
  locks.delete(key);
  void releaseQuoteCreateLock(key);
};
