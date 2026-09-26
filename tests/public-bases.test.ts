import { afterEach, describe, expect, it } from 'vitest';
import { adminBase, adminCookiePath, demoBase } from '../src/http/public-bases';

describe('public URL bases', () => {
  afterEach(() => {
    delete process.env.PUBLIC_ADMIN_BASE;
    delete process.env.PUBLIC_DEMO_BASE;
  });

  it('defaults to /admin and /demo', () => {
    expect(adminBase()).toBe('/admin');
    expect(demoBase()).toBe('/demo');
    expect(adminCookiePath()).toBe('/admin');
  });

  it('normalizes custom prefixes without a trailing slash', () => {
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-admin/test/';
    process.env.PUBLIC_DEMO_BASE = 'cloudnex-connect/demo';
    expect(adminBase()).toBe('/cloudnex-admin/test');
    expect(demoBase()).toBe('/cloudnex-connect/demo');
    expect(adminCookiePath()).toBe('/cloudnex-admin/test');
  });
});
