import { describe, expect, it } from 'vitest';
import { buildCspHeader, buildDemoCspHeader, buildSwaggerCspHeader } from '../src/utils/html';

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

  it('keeps Swagger connect-src self', () => {
    expect(buildSwaggerCspHeader()).toContain("connect-src 'self'");
  });
});
