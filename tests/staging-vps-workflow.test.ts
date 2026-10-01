import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('github workflows', () => {
  it('does not ship staging-vps (laptop npm run deploy:vps-staging owns :8081)', () => {
    expect(existsSync(join(__dirname, '../.github/workflows/staging-vps.yml'))).toBe(false);
  });

  it('runs CI only on main pushes and pull requests', () => {
    const yaml = readFileSync(join(__dirname, '../.github/workflows/ci.yml'), 'utf8');
    expect(yaml).toContain('npm audit --omit=dev --audit-level=high');
    expect(yaml).toContain('branches: [main]');
    expect(yaml).toMatch(/push:\n    branches: \[main\]/);
    expect(yaml).toContain("github.actor != 'dependabot[bot]'");
  });
});

describe('vps rsync allowlist', () => {
  it('ships both production and sibling compose files', () => {
    const list = readFileSync(join(__dirname, '../deploy/staging-rsync.allowlist'), 'utf8');
    expect(list).toContain('docker-compose.production.yml');
    expect(list).toContain('docker-compose.sibling.yml');
  });
});
