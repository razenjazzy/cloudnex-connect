import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('staging compose LINE queue', () => {
  const yaml = readFileSync(join(__dirname, '../deploy/hostinger/docker-compose.staging.yml'), 'utf8');

  it('runs Redis and async webhook with an in-process worker', () => {
    expect(yaml).toContain('image: redis:7-alpine');
    expect(yaml).toContain('REDIS_URL: redis://redis:6379');
    expect(yaml).toContain('LINE_WEBHOOK_ASYNC: "true"');
    expect(yaml).toContain('RUN_BULLMQ_WORKER: "true"');
    expect(yaml).toContain('condition: service_healthy');
  });
});

describe('deploy health wait', () => {
  const script = readFileSync(join(__dirname, '../scripts/deploy-cloudnex-connect-staging.sh'), 'utf8');

  it('does not print curl RST while Node is still binding', () => {
    expect(script).toContain('curl -fsS --max-time 2 http://127.0.0.1:8080/healthz >/dev/null 2>&1');
    expect(script).toContain('seq 1 30');
  });
});
