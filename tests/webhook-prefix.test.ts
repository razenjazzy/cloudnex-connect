import { describe, expect, it, vi } from 'vitest';
import { registerWebhookRoutes, webhookPathPrefixes } from '../src/http/webhook-routes';

describe('webhook path prefixes', () => {
  it('serves host-root only when PUBLIC_BASE_URL has no path', () => {
    expect(webhookPathPrefixes('https://amardhaka.io')).toEqual(['']);
  });

  it('also serves the site path from PUBLIC_BASE_URL', () => {
    expect(webhookPathPrefixes('https://amardhaka.io/cloudnex-connect')).toEqual(['', '/cloudnex-connect']);
  });

  it('registers webhook and webhook-test at root and under the site path', () => {
    const previous = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    const post = vi.fn();
    registerWebhookRoutes({ post } as never);
    process.env.PUBLIC_BASE_URL = previous;
    const paths = post.mock.calls.map(call => call[0] as string);
    for (const path of ['/webhook', '/webhook/:channelId', '/webhook-test', '/cloudnex-connect/webhook', '/cloudnex-connect/webhook/:channelId', '/cloudnex-connect/webhook-test']) {
      expect(paths).toContain(path);
    }
  });
});

describe('verify and shop-pay routes follow the site path too', () => {
  it('registers /verify/* and /shop/pay* at root and under /cloudnex-connect', async () => {
    const previous = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    const get = vi.fn();
    const { registerVerifyRoutes } = await import('../src/http/verify-routes');
    const { registerShopPayRoutes } = await import('../src/http/shop-pay-routes');
    registerVerifyRoutes({ get } as never);
    registerShopPayRoutes({ get } as never);
    process.env.PUBLIC_BASE_URL = previous;
    const paths = get.mock.calls.map(call => call[0] as string);
    for (const path of ['/verify/odoo', '/verify/action', '/shop/pay', '/shop/pay/return', '/cloudnex-connect/verify/odoo', '/cloudnex-connect/verify/action', '/cloudnex-connect/shop/pay', '/cloudnex-connect/shop/pay/return']) {
      expect(paths).toContain(path);
    }
  });
});
