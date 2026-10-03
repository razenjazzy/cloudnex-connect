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
