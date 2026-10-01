import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('github workflows', () => {
  it('does not ship staging-vps or push CI (laptop npm test / deploy:vps-staging)', () => {
    expect(existsSync(join(__dirname, '../.github/workflows/staging-vps.yml'))).toBe(false);
    expect(existsSync(join(__dirname, '../.github/workflows/ci.yml'))).toBe(false);
  });
});

describe('vps rsync allowlist', () => {
  it('ships both production and sibling compose files', () => {
    const list = readFileSync(join(__dirname, '../deploy/staging-rsync.allowlist'), 'utf8');
    expect(list).toContain('docker-compose.production.yml');
    expect(list).toContain('docker-compose.sibling.yml');
  });
});
