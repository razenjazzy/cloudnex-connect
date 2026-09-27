import { afterEach, describe, expect, it } from 'vitest';
import { adminBase, adminCookiePath, catalogPublicPath, demoBase, originFromPublicBaseUrl, pathFromPublicBaseUrl, publicSiteUrl } from '../src/http/public-bases';

describe('public URL bases', () => {
  afterEach(() => {
    delete process.env.PUBLIC_ADMIN_BASE;
    delete process.env.PUBLIC_DEMO_BASE;
    delete process.env.PUBLIC_BASE_URL;
  });

  it('defaults to /admin, /demo, and /catalog', () => {
    expect(adminBase()).toBe('/admin');
    expect(demoBase()).toBe('/demo');
    expect(adminCookiePath()).toBe('/admin');
    expect(catalogPublicPath()).toBe('/catalog');
  });

  it('joins PUBLIC_BASE_URL path with /admin for cookie Path', () => {
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect/';
    process.env.PUBLIC_ADMIN_BASE = '/admin';
    expect(pathFromPublicBaseUrl()).toBe('/cloudnex-connect');
    expect(adminBase()).toBe('/cloudnex-connect/admin');
    expect(demoBase()).toBe('/cloudnex-connect/demo');
    expect(adminCookiePath()).toBe('/cloudnex-connect/admin');
    expect(catalogPublicPath()).toBe('/cloudnex-connect/catalog');
    expect(publicSiteUrl(process.env.PUBLIC_BASE_URL)).toBe('https://amardhaka.io/cloudnex-connect');
    expect(originFromPublicBaseUrl(process.env.PUBLIC_BASE_URL)).toBe('https://amardhaka.io');
  });

  it('does not double the site path when Admin is already under PUBLIC_BASE_URL', () => {
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect/admin/test';
    expect(adminCookiePath()).toBe('/cloudnex-connect/admin/test');
    expect(catalogPublicPath()).toBe('/cloudnex-connect/catalog/test');
  });

  it('mirrors extra admin segments onto the catalog path', () => {
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    process.env.PUBLIC_ADMIN_BASE = '/admin/test/staging';
    expect(adminBase()).toBe('/cloudnex-connect/admin/test/staging');
    expect(catalogPublicPath()).toBe('/cloudnex-connect/catalog/test/staging');
  });

  it('rewrites mixed-case /admin segments the same way as lowercase', () => {
    process.env.PUBLIC_BASE_URL = 'https://amardhaka.io/cloudnex-connect';
    process.env.PUBLIC_ADMIN_BASE = '/Admin/TEST';
    expect(adminBase()).toBe('/cloudnex-connect/Admin/TEST');
    expect(catalogPublicPath()).toBe('/cloudnex-connect/catalog/TEST');
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect/ADMIN/test';
    expect(catalogPublicPath()).toBe('/cloudnex-connect/catalog/test');
  });

  it('normalizes custom prefixes without a trailing slash', () => {
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect/admin/test/';
    process.env.PUBLIC_DEMO_BASE = 'cloudnex-connect/demo';
    expect(adminBase()).toBe('/cloudnex-connect/admin/test');
    expect(demoBase()).toBe('/cloudnex-connect/demo');
    expect(adminCookiePath()).toBe('/cloudnex-connect/admin/test');
  });
});
