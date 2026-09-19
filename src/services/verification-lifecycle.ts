export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;

export type VerificationPhase =
  | 'UNVERIFIED'
  | 'VERIFICATION_REQUIRED'
  | 'CODE_SENT'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'EXPIRED'
  | 'FAILED'
  | 'RATE_LIMITED'
  | 'CANCELLED'
  | 'ERROR';

export type VerificationChallengeView = {
  phone: string;
  createdAt: string;
  expiresAt: string;
  status?: string;
  attemptCount?: number;
};

export const resolveVerificationPhase = (input: {
  odooVerified: boolean;
  phone?: string;
  pending?: VerificationChallengeView | null;
  now?: number;
  cooldownMs?: number;
  lastError?: 'invalid_otp' | 'expired' | 'locked' | 'error';
}): VerificationPhase => {
  if (input.odooVerified) return 'VERIFIED';
  if (input.lastError === 'locked') return 'FAILED';
  if (input.lastError === 'error') return 'ERROR';
  const now = input.now ?? Date.now();
  const cooldownMs = input.cooldownMs ?? VERIFICATION_RESEND_COOLDOWN_MS;
  const pending = input.pending;
  if (pending?.status === 'pending') {
    if (Date.parse(pending.expiresAt) <= now) return 'EXPIRED';
    if (input.lastError === 'expired') return 'EXPIRED';
    if (input.lastError === 'invalid_otp') return 'FAILED';
    const age = now - Date.parse(pending.createdAt);
    if (Number.isFinite(age) && age >= 0 && age < cooldownMs) return 'RATE_LIMITED';
    return 'CODE_SENT';
  }
  if (input.lastError === 'expired') return 'EXPIRED';
  if (input.lastError === 'invalid_otp') return 'FAILED';
  const phone = input.phone?.replace(/[^0-9+]/g, '').trim();
  if (phone) return 'VERIFICATION_REQUIRED';
  return 'UNVERIFIED';
};

export const maskPhoneForLog = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***${digits.slice(-4)}`;
};
