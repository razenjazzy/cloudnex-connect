import { describe, expect, it } from 'vitest';

const extractVerifyStartPhone = (text: string): string => text.replace(/^VERIFY START\s*/i, '').trim();
const extractVerifyOtpCode = (text: string): string => text.replace(/^VERIFY OTP\s*/i, '').trim();

describe('verification command extraction', () => {
  it('extracts phone from VERIFY START', () => {
    expect(extractVerifyStartPhone('VERIFY START +8801787671962')).toBe('+8801787671962');
  });

  it('extracts OTP code from VERIFY OTP', () => {
    expect(extractVerifyOtpCode('VERIFY OTP 123456')).toBe('123456');
  });
});

describe('verificationSuccessMessage', () => {
  it('names the Odoo partner as an Odoo Sales user', async () => {
    const { verificationSuccessMessage } = await import('../src/services/user-verification');
    expect(verificationSuccessMessage('en', 'Razen', 'salesperson')).toBe('✅ Razen is an Odoo Sales User.');
    expect(verificationSuccessMessage('en', 'Razen', 'sales_manager')).toBe('✅ Razen is an Odoo Sales Administrator.');
    expect(verificationSuccessMessage('en', 'Razen')).toBe('✅ Razen is an Odoo customer.');
  });

  it('does not call a sales-admin a customer when tier is omitted', async () => {
    const { verificationSuccessMessage } = await import('../src/services/user-verification');
    expect(verificationSuccessMessage('en', 'Razen', undefined)).not.toContain('Sales Administrator');
  });
});
