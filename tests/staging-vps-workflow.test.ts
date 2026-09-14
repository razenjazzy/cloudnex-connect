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
});
