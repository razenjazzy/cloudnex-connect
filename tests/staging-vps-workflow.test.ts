import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('staging-vps workflow', () => {
  const yaml = readFileSync(join(__dirname, '../.github/workflows/staging-vps.yml'), 'utf8');

  it('does not use secrets in job if (GitHub treats that as an invalid workflow)', () => {
    expect(yaml).not.toMatch(/if:\s*\$\{\{\s*secrets\./);
  });

  it('opts in via repository variable ENABLE_STAGING_VPS_DEPLOY', () => {
    expect(yaml).toContain("vars.ENABLE_STAGING_VPS_DEPLOY == 'true'");
  });

  it('deploys the sibling staging lane, not host-root validate-staging', () => {
    expect(yaml).toContain('deploy-vps-lane.sh staging');
    expect(yaml).toContain('VPS_REMOTE_DIR: /opt/cns-line-oa');
    expect(yaml).not.toContain('validate-staging.sh');
  });
});

describe('vps rsync allowlist', () => {
  it('ships both production and sibling compose files', () => {
    const list = readFileSync(join(__dirname, '../deploy/staging-rsync.allowlist'), 'utf8');
    expect(list).toContain('docker-compose.production.yml');
    expect(list).toContain('docker-compose.sibling.yml');
  });
});
