import { afterEach, describe, expect, it, vi } from 'vitest';
import { t, tFill } from '../src/services/i18n';
import { getAgentSpeakPrefix } from '../src/line/channels';
import { evaluateCommandGrid, isSalesPreVerifyCommand } from '../src/line/command-grid';
import { salesVerifyMissActions, requestSalesAccessFromAdmins, resetSalesAccessRequestsForTests, salesAccessRequestReply, salesAskAdminPhone } from '../src/line/sales-access-request';
import type { UserProfile } from '../src/services/firestore';

vi.mock('../src/services/firestore', async () => {
  const actual = await vi.importActual<typeof import('../src/services/firestore')>('../src/services/firestore');
  return { ...actual, recordAuditEvent: vi.fn() };
});

vi.mock('../src/line/messaging', () => ({
  sendTargetedFlexMessage: vi.fn(async (ids: string[]) => ids.length > 0),
}));

vi.mock('../src/services/runtime-settings', async () => {
  const actual = await vi.importActual<typeof import('../src/services/runtime-settings')>('../src/services/runtime-settings');
  return { ...actual, getEffectiveAdminUserIds: vi.fn(() => new Set<string>()) };
});

import { sendTargetedFlexMessage } from '../src/line/messaging';
import { getEffectiveAdminUserIds } from '../src/services/runtime-settings';
import { recordAuditEvent } from '../src/services/firestore';

const guest: UserProfile = { language: 'en', role: 'user', odooVerified: false, marketingOptIn: false };

describe('sales verify miss', () => {
  afterEach(() => {
    resetSalesAccessRequestsForTests();
    vi.mocked(getEffectiveAdminUserIds).mockReturnValue(new Set());
    vi.mocked(sendTargetedFlexMessage).mockReset();
    vi.mocked(sendTargetedFlexMessage).mockImplementation(async (ids: string[]) => ids.length > 0);
  });

  it('EN miss names Sales User, not the customer-number hint, and uses Sora:', () => {
    const en = tFill('salesPhoneNotInOdoo', 'en', { prefix: getAgentSpeakPrefix('en'), phone: '+8801787671962' });
    const th = tFill('salesPhoneNotInOdoo', 'th', { prefix: getAgentSpeakPrefix('th'), phone: '+8801787671962' });
    expect(en).toContain('Sales User');
    expect(en.toLowerCase()).not.toContain('customer number the salesperson');
    expect(en).not.toContain('Verifying your saved number');
    expect(en.startsWith('Sora: ')).toBe(true);
    expect(th.startsWith('โซระ: ') || th.includes('ผู้ใช้ฝ่ายขาย')).toBe(true);
  });

  it('miss card actions are Ask admin + Another phone', () => {
    expect(salesVerifyMissActions('+8801787671962', 'en').map(a => a.text)).toEqual([
      'VERIFY ASK ADMIN +8801787671962',
      'FORM VERIFY MANUAL',
    ]);
    expect(t('askAdmin', 'en').length).toBeLessThanOrEqual(20);
    expect(t('anotherPhone', 'en').length).toBeLessThanOrEqual(20);
  });

  it('VERIFY ASK ADMIN is a Sales pre-verify identity command', () => {
    expect(isSalesPreVerifyCommand('VERIFY ASK ADMIN +8801787671962')).toBe(true);
    expect(isSalesPreVerifyCommand('HUMAN')).toBe(false);
    expect(evaluateCommandGrid('VERIFY ASK ADMIN 017', { profile: guest, channel: { channelId: 'sales' } })).toEqual({ ok: true });
    expect(evaluateCommandGrid('VERIFY ASK ADMIN 017', { profile: guest, channel: { channelId: 'customer' } })).toEqual({
      ok: false,
      reason: 'channel',
    });
  });

  it('does not claim sent when LINE delivery fails, and does not debounce', async () => {
    vi.mocked(getEffectiveAdminUserIds).mockReturnValue(new Set(['Uadmin1']));
    vi.mocked(sendTargetedFlexMessage).mockResolvedValue(false);
    const ctx = { userId: 'Ustaff', userLanguage: 'en' as const, profile: { displayName: 'Razen' } as never };
    expect(await requestSalesAccessFromAdmins(ctx, '+8801787671962')).toBe('failed');
    expect(salesAccessRequestReply('failed', 'en')).toContain('Could not reach');
    expect(await requestSalesAccessFromAdmins(ctx, '+8801787671962')).toBe('failed');
    expect(sendTargetedFlexMessage).toHaveBeenCalledTimes(2);
  });

  it('audit detail masks the phone and the notice has no relay chips', async () => {
    vi.mocked(getEffectiveAdminUserIds).mockReturnValue(new Set(['Uadmin1']));
    await requestSalesAccessFromAdmins({
      userId: 'Ustaff',
      userLanguage: 'en',
      profile: { displayName: 'Razen' } as never,
    }, '+8801787671962');
    const audit = vi.mocked(recordAuditEvent).mock.calls.at(-1)?.[0] as { detail?: string };
    expect(audit.detail).toMatch(/^phone=/);
    expect(audit.detail).toContain('*');
    expect(audit.detail).not.toContain('+8801787671962');
    const payload = JSON.stringify(vi.mocked(sendTargetedFlexMessage).mock.calls[0]);
    expect(payload).not.toContain('RELAY TO');
    expect(payload).not.toContain('FORM QUOTE CREATE');
  });

  it('does not ask admins when no usable phone was typed or saved', () => {
    expect(salesAskAdminPhone('VERIFY ASK ADMIN', '')).toBe('');
    expect(salesAskAdminPhone('VERIFY ASK ADMIN ---', 'abc')).toBe('');
    expect(salesAskAdminPhone('VERIFY ASK ADMIN', '+8801787671962')).toBe('+8801787671962');
    expect(salesAskAdminPhone('VERIFY ASK ADMIN 0899999999', '')).toBe('0899999999');
  });
});
