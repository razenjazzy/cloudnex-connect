import { afterEach, describe, expect, it } from 'vitest';
import { adminBase, adminCookiePath, demoBase, originFromPublicBaseUrl, pathFromPublicBaseUrl, publicSiteUrl } from '../src/http/public-bases';

describe('public URL bases', () => {
  afterEach(() => {
    delete process.env.PUBLIC_ADMIN_BASE;
    delete process.env.PUBLIC_DEMO_BASE;
    delete process.env.PUBLIC_BASE_URL;
  });

  it('defaults to /admin and /demo', () => {
    expect(adminBase()).toBe('/admin');
    expect(demoBase()).toBe('/demo');
    expect(adminCookiePath()).toBe('/admin');
  });

  it('joins PUBLIC_BASE_URL path with /admin for cookie Path', () => {
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect/';
    process.env.PUBLIC_ADMIN_BASE = '/admin';
    expect(pathFromPublicBaseUrl()).toBe('/cloudnex-connect');
    expect(adminBase()).toBe('/cloudnex-connect/admin');
    expect(demoBase()).toBe('/cloudnex-connect/demo');
    expect(adminCookiePath()).toBe('/cloudnex-connect/admin');
    expect(publicSiteUrl(process.env.PUBLIC_BASE_URL)).toBe('https://amardhaka.io/cloudnex-connect');
    expect(originFromPublicBaseUrl(process.env.PUBLIC_BASE_URL)).toBe('https://amardhaka.io');
  });

  it('does not double the site path when Admin is already under PUBLIC_BASE_URL', () => {
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect/admin/test';
    expect(adminCookiePath()).toBe('/cloudnex-connect/admin/test');
  });

  it('normalizes custom prefixes without a trailing slash', () => {
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect/admin/test/';
    process.env.PUBLIC_DEMO_BASE = 'cloudnex-connect/demo';
    expect(adminBase()).toBe('/cloudnex-connect/admin/test');
    expect(demoBase()).toBe('/cloudnex-connect/demo');
    expect(adminCookiePath()).toBe('/cloudnex-connect/admin/test');
  });
});
