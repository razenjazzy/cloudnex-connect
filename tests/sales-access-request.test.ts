import { afterEach, describe, expect, it, vi } from 'vitest';
import { tFill, t } from '../src/services/i18n';
import { getAgentSpeakPrefix } from '../src/line/channels';
import { customerBindActions, customerBindBody } from '../src/line/customer-bind';
import {
  requestSalesAccessFromAdmins,
  resetSalesAccessRequestsForTests,
  salesAccessDebounceSizeForTests,
  salesAccessRequestReply,
  salesVerifyMissActions,
} from '../src/line/sales-access-request';

vi.mock('../src/services/firestore', () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock('../src/line/messaging', () => ({
  sendTargetedFlexMessage: vi.fn(async (ids: string[]) => ids.length > 0),
}));

vi.mock('../src/services/runtime-settings', async () => {
  const actual = await vi.importActual<typeof import('../src/services/runtime-settings')>('../src/services/runtime-settings');
  return {
    ...actual,
    getEffectiveAdminUserIds: vi.fn(() => new Set<string>()),
  };
});

import { sendTargetedFlexMessage } from '../src/line/messaging';
import { getEffectiveAdminUserIds } from '../src/services/runtime-settings';

describe('sales access request', () => {
  afterEach(() => {
    resetSalesAccessRequestsForTests();
    vi.mocked(getEffectiveAdminUserIds).mockReturnValue(new Set());
    vi.mocked(sendTargetedFlexMessage).mockClear();
  });

  it('miss copy names the Sales User contact and uses Sora:', () => {
    const body = tFill('salesPhoneNotInOdoo', 'en', { prefix: getAgentSpeakPrefix('en'), phone: '+8801787671962' });
    expect(body.startsWith('Sora: ')).toBe(true);
    expect(body).toContain('+8801787671962');
    expect(body).toContain('Sales User');
    expect(body.toLowerCase()).not.toContain('customer number the salesperson');
  });

  it('Ask admin button posts VERIFY ASK ADMIN, not HUMAN', () => {
    const actions = salesVerifyMissActions('+8801787671962', 'en');
    expect(actions.map(a => a.text)).toEqual(['VERIFY ASK ADMIN +8801787671962', 'FORM VERIFY MANUAL']);
    expect(t('askAdmin', 'en').length).toBeLessThanOrEqual(20);
  });

  it('does not claim sent when no LINE admin is bound', async () => {
    const outcome = await requestSalesAccessFromAdmins({
      userId: 'Ustaff',
      userLanguage: 'en',
      profile: { displayName: 'Sora staff', phone: '+8801787671962' } as never,
    }, '+8801787671962');
    expect(outcome).toBe('no_admin');
    expect(sendTargetedFlexMessage).not.toHaveBeenCalled();
    expect(salesAccessRequestReply(outcome, 'en')).toContain('No admin is set up');
    expect(salesAccessRequestReply(outcome, 'en').startsWith('Sora: ')).toBe(true);
  });

  it('pushes a notice to bound admins', async () => {
    vi.mocked(getEffectiveAdminUserIds).mockReturnValue(new Set(['Uadmin1']));
    const outcome = await requestSalesAccessFromAdmins({
      userId: 'Ustaff',
      userLanguage: 'en',
      profile: { displayName: 'Razen', phone: '+8801787671962' } as never,
    }, '+8801787671962');
    expect(outcome).toBe('sent');
    expect(sendTargetedFlexMessage).toHaveBeenCalledOnce();
    const payload = JSON.stringify(vi.mocked(sendTargetedFlexMessage).mock.calls[0]);
    expect(payload).toContain('Uadmin1');
    expect(payload).toContain('+8801787671962');
    expect(payload).toContain('Ustaff');
    expect(payload).not.toContain('RELAY TO');
  });

  it('debounces a second ask within 60s', async () => {
    vi.mocked(getEffectiveAdminUserIds).mockReturnValue(new Set(['Uadmin1']));
    const ctx = {
      userId: 'Ustaff',
      userLanguage: 'en' as const,
      profile: { displayName: 'Razen' } as never,
    };
    expect(await requestSalesAccessFromAdmins(ctx, '017')).toBe('sent');
    expect(await requestSalesAccessFromAdmins(ctx, '017')).toBe('already');
    expect(sendTargetedFlexMessage).toHaveBeenCalledOnce();
  });

  it('drops debounce entries after 60s so the map does not grow forever', async () => {
    vi.mocked(getEffectiveAdminUserIds).mockReturnValue(new Set(['Uadmin1']));
    const t0 = 1_000_000;
    await requestSalesAccessFromAdmins({
      userId: 'Uold',
      userLanguage: 'en',
      profile: { displayName: 'Old' } as never,
    }, '+8801787671962', t0);
    expect(salesAccessDebounceSizeForTests()).toBe(1);
    await requestSalesAccessFromAdmins({
      userId: 'Unew',
      userLanguage: 'en',
      profile: { displayName: 'New' } as never,
    }, '+8801787671962', t0 + 60_000);
    expect(salesAccessDebounceSizeForTests()).toBe(1);
  });
});

describe('customer bind CTAs', () => {
  it('Order Now wall uses Register and I have a phone with Sora:', () => {
    const body = customerBindBody('en', 'order', 'Using: DualForth\n');
    expect(body).toContain('Using: DualForth');
    expect(body).toContain('Sora: ');
    expect(body.toLowerCase()).not.toContain('odoo user account');
    expect(customerBindActions('en').map(a => a.text)).toEqual(['FORM CUSTOMER REGISTER', 'FORM VERIFY MANUAL']);
  });

  it('history copy stays gated behind verify', () => {
    const body = customerBindBody('en', 'history');
    expect(body).toContain('Order History');
    expect(body).toContain('Sora: ');
  });
});
