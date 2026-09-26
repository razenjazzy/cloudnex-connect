import { describe, expect, it } from 'vitest';
import { buildAdminCspHeader, buildCspHeader, buildDemoCspHeader, buildSwaggerCspHeader } from '../src/utils/html';
import { cspHeaderForPath } from '../src/http/middleware';

describe('CSP headers', () => {
  it('keeps JSON/API pages script-free', () => {
    expect(buildCspHeader()).toContain("default-src 'none'");
    expect(buildCspHeader()).not.toContain('script-src');
  });

  it('allows demo panel inline script and same-origin fetch', () => {
    const csp = buildDemoCspHeader();
    expect(csp).toContain("script-src 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self'");
  });

  it('allows admin SPA hashed assets and injected base script', () => {
    const csp = buildAdminCspHeader();
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it('keeps Swagger connect-src self', () => {
    expect(buildSwaggerCspHeader()).toContain("connect-src 'self'");
  });

  it('applies admin CSP under PUBLIC_ADMIN_BASE, not the global default', () => {
    const prev = process.env.PUBLIC_ADMIN_BASE;
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect';
    expect(cspHeaderForPath('/cloudnex-connect')).toBe(buildAdminCspHeader());
    expect(cspHeaderForPath('/cloudnex-connect/testing')).toBe(buildAdminCspHeader());
    expect(cspHeaderForPath('/healthz')).toBe(buildCspHeader());
    if (prev === undefined) delete process.env.PUBLIC_ADMIN_BASE;
    else process.env.PUBLIC_ADMIN_BASE = prev;
  });
});
