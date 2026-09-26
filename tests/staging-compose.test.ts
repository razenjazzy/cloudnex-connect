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
    expect(yaml).toContain('TZ: Asia/Bangkok');
    expect(yaml).toContain('/usr/share/zoneinfo:/usr/share/zoneinfo:ro');
    expect(yaml).toContain('condition: service_healthy');
  });
});

describe('deploy health wait', () => {
  const script = readFileSync(join(__dirname, '../scripts/deploy-vps-lane.sh'), 'utf8');

  it('polls loopback healthz without leaking curl RST', () => {
    expect(script).toContain('curl -fsS --max-time 2 "http://127.0.0.1:${HEALTH_PORT}/healthz" >/dev/null 2>&1');
    expect(script).toContain('seq 1 30');
    expect(script).toContain('REMOTE="${VPS_REMOTE_DIR:-/opt/cns-line-oa}"');
    expect(script).toContain('REMOTE="${VPS_REMOTE_DIR:-/opt/cloudnex-connect}"');
  });
});

describe('production compose', () => {
  const yaml = readFileSync(join(__dirname, '../deploy/hostinger/docker-compose.production.yml'), 'utf8');

  it('binds HMAC on 8080 with production APP_ENV and /admin', () => {
    expect(yaml).toContain('APP_ENV: production');
    expect(yaml).toContain('PUBLIC_ADMIN_BASE: /admin');
    expect(yaml).toContain('127.0.0.1:8080:8080');
    expect(yaml).toContain('ENABLE_DEMO_CONTROL_PANEL: "false"');
  });
});

describe('sibling compose', () => {
  const yaml = readFileSync(join(__dirname, '../deploy/hostinger/docker-compose.sibling.yml'), 'utf8');

  it('binds staging Admin on 8081 with /admin/test', () => {
    expect(yaml).toContain('APP_ENV: staging');
    expect(yaml).toContain('PUBLIC_ADMIN_BASE: /admin/test');
    expect(yaml).toContain('127.0.0.1:8081:8080');
  });
});
