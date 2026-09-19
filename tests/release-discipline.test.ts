import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveDemoEnabled, resolveWebhookTestEnabled } from '../src/http/env';

describe('release discipline', () => {
  it('keeps delivery production demo and webhook-test closed even if flags are set', () => {
    const production = {
      NODE_ENV: 'production',
      APP_ENV: 'production',
      ENABLE_DEMO_CONTROL_PANEL: 'true',
      ENABLE_WEBHOOK_TEST: 'true',
    };
    expect(resolveDemoEnabled(production)).toBe(false);
    expect(resolveWebhookTestEnabled(production)).toBe(false);
  });

  it('rsync allowlist never includes env files and never uses a full-tree copy', () => {
    const allow = readFileSync('deploy/staging-rsync.allowlist', 'utf8');
    expect(allow).toMatch(/docker-compose\.staging\.yml/);
    expect(allow).not.toMatch(/\.env/);
    expect(allow).not.toMatch(/^src\//m);
  });

  it('production cutover requires staging validation and human approval', () => {
    const cutover = readFileSync('scripts/validate-cutover.sh', 'utf8');
    expect(cutover).toMatch(/PRODUCTION_APPROVED/);
    expect(cutover).toMatch(/STAGING_VALIDATED/);
    const signoff = readFileSync('scripts/require-production-signoff.sh', 'utf8');
    expect(signoff).toMatch(/STAGING_VALIDATED/);
    expect(signoff).toMatch(/PRODUCTION_APPROVED/);
  });
});
