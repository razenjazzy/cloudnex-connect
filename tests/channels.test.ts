import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_NAME, CUSTOMER_CHANNEL_ID, DEFAULT_CHANNEL_ID, SALES_CHANNEL_ID, customerNotifyChannelId, getAgentName, getBrandTitle, oaChatDeepLink, resolveChannelConfig, salesNotifyChannelId } from '../src/line/channels';

const ENV_KEYS = [
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_DEFAULT_SERVICES',
  'LINE_CHANNEL_SALES_SECRET',
  'LINE_CHANNEL_SALES_ACCESS_TOKEN',
  'LINE_CHANNEL_SALES_SERVICES',
  'LINE_CHANNEL_CUSTOMER_SECRET',
  'LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN',
  'LINE_CHANNEL_CUSTOMER_SERVICES',
];

describe('resolveChannelConfig', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it('returns null for the default channel when flat env vars are missing', () => {
    expect(resolveChannelConfig(DEFAULT_CHANNEL_ID)).toBeNull();
  });

  it('resolves the default channel from the existing flat env vars', () => {
    process.env.LINE_CHANNEL_SECRET = 'secret-default';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-default';

    const config = resolveChannelConfig(DEFAULT_CHANNEL_ID);
    expect(config).toEqual({
      channelId: DEFAULT_CHANNEL_ID,
      channelSecret: 'secret-default',
      channelAccessToken: 'token-default',
      enabledServices: null,
    });
  });

  it('parses enabledServices for the default channel when configured', () => {
    process.env.LINE_CHANNEL_SECRET = 'secret-default';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-default';
    process.env.LINE_CHANNEL_DEFAULT_SERVICES = 'commerce, reporting ,, directory';

    const config = resolveChannelConfig(DEFAULT_CHANNEL_ID);
    expect(config?.enabledServices).toEqual(['commerce', 'reporting', 'directory']);
  });

  it('resolves a named channel from namespaced env vars', () => {
    process.env.LINE_CHANNEL_SALES_SECRET = 'secret-sales';
    process.env.LINE_CHANNEL_SALES_ACCESS_TOKEN = 'token-sales';
    process.env.LINE_CHANNEL_SALES_SERVICES = 'commerce';

    const config = resolveChannelConfig('sales');
    expect(config).toEqual({
      channelId: 'sales',
      channelSecret: 'secret-sales',
      channelAccessToken: 'token-sales',
      enabledServices: ['commerce'],
    });
  });

  it('returns null for an unconfigured named channel', () => {
    expect(resolveChannelConfig('hr')).toBeNull();
  });

  it('returns null for an empty channelId', () => {
    expect(resolveChannelConfig('   ')).toBeNull();
  });

  it('resolves the customer OA and uses it for customer LINE pushes', () => {
    process.env.LINE_CHANNEL_CUSTOMER_SECRET = 'secret-customer';
    process.env.LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN = 'token-customer';
    process.env.LINE_CHANNEL_CUSTOMER_SERVICES = 'commerce,catalog';

    expect(resolveChannelConfig(CUSTOMER_CHANNEL_ID)).toEqual({
      channelId: CUSTOMER_CHANNEL_ID,
      channelSecret: 'secret-customer',
      channelAccessToken: 'token-customer',
      enabledServices: ['commerce', 'catalog'],
    });
    expect(customerNotifyChannelId()).toBe(CUSTOMER_CHANNEL_ID);
    expect(salesNotifyChannelId()).toBe(DEFAULT_CHANNEL_ID);
  });

  it('serves Cloudnex Sales at /webhook/sales using default LINE credentials when SALES_* is unset', () => {
    process.env.LINE_CHANNEL_SECRET = 'secret-default';
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-default';

    expect(resolveChannelConfig(SALES_CHANNEL_ID)).toEqual({
      channelId: SALES_CHANNEL_ID,
      channelSecret: 'secret-default',
      channelAccessToken: 'token-default',
      enabledServices: null,
    });
    expect(salesNotifyChannelId()).toBe(SALES_CHANNEL_ID);
  });

  it('falls back to the Sales OA for customer pushes when the customer channel is unset', () => {
    expect(customerNotifyChannelId()).toBe(DEFAULT_CHANNEL_ID);
  });
});

describe('agent name', () => {
  const keys = ['LINE_AGENT_NAME_EN', 'LINE_AGENT_NAME_TH'];
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('defaults to Sora in English and โซระ in Thai', () => {
    expect(getAgentName('en')).toBe('Sora');
    expect(getAgentName('th')).toBe('โซระ');
    expect(APP_NAME).toBe('CloudNex Connect');
    expect(getBrandTitle('en')).toBe('CloudNex Connect: Sora');
    expect(getBrandTitle('th')).toBe('CloudNex Connect: โซระ');
  });
});

describe('oaChatDeepLink', () => {
  const keys = ['LINE_CHANNEL_BASIC_ID', 'LINE_CHANNEL_CUSTOMER_BASIC_ID'];
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it('keeps the @ unencoded so LINE webview accepts the OA chat URL', () => {
    process.env.LINE_CHANNEL_BASIC_ID = '@cloudnex';
    expect(oaChatDeepLink(DEFAULT_CHANNEL_ID)).toBe('https://line.me/R/ti/p/@cloudnex');
    process.env.LINE_CHANNEL_BASIC_ID = 'cloudnex';
    expect(oaChatDeepLink(DEFAULT_CHANNEL_ID)).toBe('https://line.me/R/ti/p/@cloudnex');
    expect(oaChatDeepLink(DEFAULT_CHANNEL_ID)).not.toContain('%40');
  });

  it('points Add-friend for customer pushes at Cloudnex Customer', () => {
    process.env.LINE_CHANNEL_CUSTOMER_BASIC_ID = '@724tneri';
    expect(oaChatDeepLink(CUSTOMER_CHANNEL_ID)).toBe('https://line.me/R/ti/p/@724tneri');
  });
});
