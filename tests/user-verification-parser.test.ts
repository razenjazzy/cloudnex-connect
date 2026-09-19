import { describe, expect, it } from 'vitest';

const extractVerifyStartPhone = (text: string): string => text.replace(/^VERIFY START\s*/i, '').trim();
const extractVerifyOtpCode = (text: string): string => text.replace(/^VERIFY OTP\s*/i, '').trim();

describe('verification command extraction', () => {
  it('extracts phone from VERIFY START', () => {
    expect(extractVerifyStartPhone('VERIFY START 0812345678')).toBe('0812345678');
  });

  it('extracts OTP code from VERIFY OTP', () => {
    expect(extractVerifyOtpCode('VERIFY OTP 123456')).toBe('123456');
  });
});

describe('verificationSuccessMessage', () => {
  it('names the Odoo partner as an Odoo Sales user', async () => {
    const { verificationSuccessMessage } = await import('../src/services/user-verification');
    expect(verificationSuccessMessage('en', 'Somchai', 'salesperson')).toBe('✅ Somchai is an Odoo Sales User.');
    expect(verificationSuccessMessage('en', 'Somchai', 'sales_manager')).toBe('✅ Somchai is an Odoo Sales Administrator.');
    expect(verificationSuccessMessage('en', 'Somchai')).toBe('✅ Somchai is an Odoo customer.');
  });
});
