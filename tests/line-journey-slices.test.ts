import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { shouldApplyTrayAfterReply } from '../src/line/tray-policy';
import { guidedFormTtlMinutes, shouldIdleHome } from '../src/line/idle-home';
import { resolveChannelConfig } from '../src/line/channels';
import { resetRuntimeSettingsForTests } from '../src/services/runtime-settings';
import type { UserProfile } from '../src/services/firestore';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  language: 'en',
  role: 'user',
  odooVerified: true,
  marketingOptIn: false,
  ...overrides,
});

describe('tray policy', () => {
  it('skips tray on pendingFlow, keyboard chips, and waiting', () => {
    expect(shouldApplyTrayAfterReply({ pendingFlow: true })).toBe(false);
    expect(shouldApplyTrayAfterReply({ expectsKeyboard: true })).toBe(false);
    expect(shouldApplyTrayAfterReply({ relayWait: true })).toBe(false);
    expect(shouldApplyTrayAfterReply({})).toBe(true);
  });
});

describe('idle home', () => {
  it('resumes pendingFlow instead of home', () => {
    expect(shouldIdleHome(profile({
      pendingFlow: { flow: 'QUOTE_ADD', stepIndex: 0, collected: {}, expiresAt: '2099-01-01T00:00:00.000Z' },
      lastTerminalAt: '2000-01-01T00:00:00.000Z',
    }))).toBe(false);
  });

  it('skips home while waiting after send', () => {
    expect(shouldIdleHome(profile({
      lastTerminalAt: '2000-01-01T00:00:00.000Z',
      relayWaitAt: '2026-09-26T00:00:00.000Z',
    }))).toBe(false);
  });

  it('homes after LINE_IDLE_HOME_SECONDS with no flow', () => {
    expect(shouldIdleHome(profile({ lastTerminalAt: '2000-01-01T00:00:00.000Z' }))).toBe(true);
  });

  it('keeps form TTL at least idle minutes', () => {
    const prevIdle = process.env.LINE_IDLE_HOME_SECONDS;
    const prevForm = process.env.GUIDED_FORM_TTL_MINUTES;
    process.env.LINE_IDLE_HOME_SECONDS = '3600';
    process.env.GUIDED_FORM_TTL_MINUTES = '10';
    expect(guidedFormTtlMinutes()).toBeGreaterThanOrEqual(60);
    process.env.LINE_IDLE_HOME_SECONDS = prevIdle;
    process.env.GUIDED_FORM_TTL_MINUTES = prevForm;
  });
});

describe('assign and overlay channels', () => {
  afterEach(() => {
    resetRuntimeSettingsForTests();
  });

  it('denies QUOTE ASSIGN off the admin chain', () => {
    const relay = readFileSync('src/line/handlers/relay.ts', 'utf8');
    expect(relay).toContain('isAuthorizedForAdminRole');
    expect(relay).toContain("profile.role !== 'admin'");
    expect(relay).toContain('getErpAdapter().assignQuotationSalesperson');
  });

  it('inbound chips are RELAY TO the customer, not RELAY ASSIGN', () => {
    const inbound = readFileSync('src/line/inbound-relay.ts', 'utf8');
    expect(inbound).toContain('RELAY TO ${ctx.userId}');
    expect(inbound).not.toContain('RELAY ASSIGN ${ctx.userId}');
  });

  it('resolves overlay LINE_CHANNEL_HR_* and still rejects unknown ids', () => {
    resetRuntimeSettingsForTests({
      LINE_CHANNEL_HR_SECRET: 'hr-secret',
      LINE_CHANNEL_HR_ACCESS_TOKEN: 'hr-token',
    });
    expect(resolveChannelConfig('hr')).toEqual({
      channelId: 'hr',
      channelSecret: 'hr-secret',
      channelAccessToken: 'hr-token',
      enabledServices: null,
    });
    expect(resolveChannelConfig('unknown-oa')).toBeNull();
  });

  it('rejects unknown webhook channels before HMAC', () => {
    const webhook = readFileSync('src/line/webhook.ts', 'utf8');
    const unknownIdx = webhook.indexOf('Unknown or unconfigured LINE channel');
    const middlewareIdx = webhook.indexOf('middleware({ channelSecret');
    expect(unknownIdx).toBeGreaterThan(-1);
    expect(middlewareIdx).toBeGreaterThan(unknownIdx);
  });
});

describe('skip, home cache, no Gemini on quote-create', () => {
  it('puts Skip and Add more on journey cards', () => {
    const templates = readFileSync('src/line/templates/quotation.ts', 'utf8');
    expect(templates).toContain("t('skip', language)");
    expect(templates).toContain('FORM QUOTE ADD');
  });

  it('uses peekCachedProducts on customer home and skips Gemini in quote-create', () => {
    const router = readFileSync('src/line/command-router.ts', 'utf8');
    const commerce = readFileSync('src/line/handlers/commerce.ts', 'utf8');
    expect(router).toContain('peekCachedProducts');
    expect(commerce).not.toContain('classifyIntent');
    const createStart = commerce.indexOf("name: 'commerce-quote-create'");
    const createEnd = commerce.indexOf("name: 'commerce-system-status'");
    expect(commerce.slice(createStart, createEnd)).not.toContain('vertex');
  });
});
