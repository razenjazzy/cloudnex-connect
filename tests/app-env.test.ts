import { describe, expect, it, vi } from 'vitest';
import { resolveAppEnv, resolveDemoEnabled, resolveWebhookTestEnabled } from '../src/http/env';
import { requireDemoPanelEnabled } from '../src/http/demo-api';
import type { Request, Response } from 'express';

describe('APP_ENV lanes', () => {
  it('uses an explicit staging lane even when NODE_ENV is production', () => {
    expect(resolveAppEnv({ NODE_ENV: 'production', APP_ENV: 'staging' })).toBe('staging');
  });

  it('fails closed to production when NODE_ENV is production and APP_ENV is unset', () => {
    expect(resolveAppEnv({ NODE_ENV: 'production' })).toBe('production');
  });

  it('defaults local work to development', () => {
    expect(resolveAppEnv({ NODE_ENV: 'development' })).toBe('development');
    expect(resolveAppEnv({})).toBe('development');
  });

  it('never opens demo or webhook-test in delivery production', () => {
    const production = { NODE_ENV: 'production', APP_ENV: 'production', ENABLE_DEMO_CONTROL_PANEL: 'true', ENABLE_WEBHOOK_TEST: 'true' };
    expect(resolveDemoEnabled(production)).toBe(false);
    expect(resolveWebhookTestEnabled(production)).toBe(false);
  });

  it('opens demo on staging only when the flag is set', () => {
    expect(resolveDemoEnabled({ NODE_ENV: 'production', APP_ENV: 'staging' })).toBe(false);
    expect(resolveDemoEnabled({ NODE_ENV: 'production', APP_ENV: 'staging', ENABLE_DEMO_CONTROL_PANEL: 'true' })).toBe(true);
  });

  it('gates demo writes with the same resolveDemoEnabled() used by GET/POST policy', () => {
    const prevApp = process.env.APP_ENV;
    const prevNode = process.env.NODE_ENV;
    const prevFlag = process.env.ENABLE_DEMO_CONTROL_PANEL;
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const next = vi.fn();
    const res = { status } as unknown as Response;
    try {
      process.env.APP_ENV = 'production';
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEMO_CONTROL_PANEL = 'true';
      requireDemoPanelEnabled({} as Request, res, next);
      expect(status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    } finally {
      if (prevApp === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = prevApp;
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
      if (prevFlag === undefined) delete process.env.ENABLE_DEMO_CONTROL_PANEL;
      else process.env.ENABLE_DEMO_CONTROL_PANEL = prevFlag;
    }
  });
});
