import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('vps rsync allowlist', () => {
  it('ships both production and sibling compose files', () => {
    const list = readFileSync(join(__dirname, '../deploy/staging-rsync.allowlist'), 'utf8');
    expect(list).toContain('docker-compose.production.yml');
    expect(list).toContain('docker-compose.sibling.yml');
  });
});
