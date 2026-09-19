import { describe, expect, it } from 'vitest';
import {
  maskPhoneForLog,
  resolveVerificationPhase,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from '../src/services/verification-lifecycle';
import { beginQuoteCreate, completeQuoteCreate, failQuoteCreate, quoteCreateLockKey } from '../src/services/quote-idempotency';

describe('verification lifecycle', () => {
  const pending = {
    phone: '+66812345678',
    createdAt: new Date(1_000).toISOString(),
    expiresAt: new Date(1_000 + 10 * 60_000).toISOString(),
    status: 'pending',
  };

  it('returns VERIFIED when the profile is already verified', () => {
    expect(resolveVerificationPhase({ odooVerified: true, phone: '0812345678' })).toBe('VERIFIED');
  });

  it('uses saved phone as VERIFICATION_REQUIRED', () => {
    expect(resolveVerificationPhase({ odooVerified: false, phone: '081-234-5678' })).toBe('VERIFICATION_REQUIRED');
  });

  it('returns UNVERIFIED when no phone and no challenge', () => {
    expect(resolveVerificationPhase({ odooVerified: false })).toBe('UNVERIFIED');
  });

  it('rate-limits resend while a fresh challenge is pending', () => {
    expect(resolveVerificationPhase({
      odooVerified: false,
      pending,
      now: 1_000 + 10_000,
    })).toBe('RATE_LIMITED');
  });

  it('allows resend after cooldown as CODE_SENT', () => {
    expect(resolveVerificationPhase({
      odooVerified: false,
      pending,
      now: 1_000 + VERIFICATION_RESEND_COOLDOWN_MS + 1,
    })).toBe('CODE_SENT');
  });

  it('marks expired challenges', () => {
    expect(resolveVerificationPhase({
      odooVerified: false,
      pending,
      now: Date.parse(pending.expiresAt) + 1,
    })).toBe('EXPIRED');
  });

  it('never logs a full phone number', () => {
    expect(maskPhoneForLog('+66812345678')).toBe('***5678');
    expect(maskPhoneForLog('12')).toBe('****');
  });
});

describe('verification start reuse (source)', () => {
  it('returns RATE_LIMITED reuse before creating a new OTP challenge', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/services/user-verification.ts', 'utf8');
    const start = src.indexOf('export const startOdooUserVerification');
    const slice = src.slice(start);
    const limited = slice.indexOf("phase === 'RATE_LIMITED'");
    const created = slice.indexOf('createOdooVerificationChallenge');
    expect(limited).toBeGreaterThan(-1);
    expect(created).toBeGreaterThan(limited);
    expect(src).toContain('reused: true');
  });
});

describe('quote create idempotency', () => {
  it('blocks a duplicate create within the lock window', async () => {
    const key = quoteCreateLockKey({ userId: 'U1', productId: 9, qty: 2, requestId: 'req-1' });
    failQuoteCreate(key);
    expect((await beginQuoteCreate(key, 50)).ok).toBe(true);
    completeQuoteCreate(key, 'SO001', 60);
    const blocked = await beginQuoteCreate(key, 70);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.orderName).toBe('SO001');
  });
});
