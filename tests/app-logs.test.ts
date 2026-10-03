import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseAppLogQuery, parseLogLine, queryAppLogs } from '../src/services/app-logs';

const json = (stamp: string, fields: Record<string, unknown>) => `${stamp} ${JSON.stringify({ time: stamp, scope: 'app', ...fields })}`;

describe('app log archive reader', () => {
  let dir: string;
  const now = Date.parse('2026-10-03T20:40:00Z');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cnx-logs-'));
    process.env.APP_LOG_DIR = dir;
    mkdirSync(join(dir, 'staging-app', '2026-10-03'), { recursive: true });
    mkdirSync(join(dir, 'edge-nginx-access', '2026-10-03'), { recursive: true });
    writeFileSync(join(dir, 'staging-app', '2026-10-03', '19.log.gz'), gzipSync([
      json('2026-10-03T19:10:00.000Z', { level: 'warn', message: 'webhook_signature_invalid', channelId: 'sales' }),
      json('2026-10-03T19:11:00.000Z', { level: 'info', message: 'http_access', path: '/admin/api/x/12', statusCode: 404, requestId: 'req-abc-1' }),
    ].join('\n')));
    writeFileSync(join(dir, 'staging-app', '2026-10-03', '20.log'), [
      json('2026-10-03T20:05:00.000Z', { level: 'error', message: 'line_webhook_error', error: 'boom', channelSecret: 'SHOULD-NOT-LEAK' }),
      '2026-10-03T20:06:00.000Z (node:1) MetadataLookupWarning: received unexpected error',
      json('2026-10-03T20:07:00.000Z', { level: 'info', message: 'http_access', path: '/healthz', statusCode: 200 }),
    ].join('\n'));
  });
  it('reads nginx access, nginx error and redis lines from the consolidated sources', () => {
    writeFileSync(join(dir, 'edge-nginx-access', '2026-10-03', '20.log'), [
      '2026-10-03T20:10:00Z 203.0.113.9 "POST /cloudnex-connect/webhook/sales HTTP/1.1" 401 38 rt=0.004 ua="LineBotWebhook/2.0" up=127.0.0.1:8081',
      '2026-10-03T20:11:00Z 203.0.113.9 "GET /healthz HTTP/1.1" 200 90 rt=0.001 ua="curl" up=127.0.0.1:8080',
    ].join('\n'));
    const access = queryAppLogs({ source: 'edge-nginx-access', hours: 6, limit: 50 }, now);
    expect(access.summary.byLevel.warn).toBe(1);
    expect(access.summary.httpErrors).toEqual([{ path: '/cloudnex-connect/webhook/sales', statusCode: 401, count: 1 }]);
    expect(access.entries[0]).toMatchObject({ message: 'nginx_access', scope: 'nginx' });
    expect(parseLogLine('2026-10-03T20:00:00Z 2026/10/04 03:00:00 [error] 12#12: *1 connect() failed (111: Connection refused)')).toMatchObject({ level: 'error', scope: 'nginx' });
    expect(parseLogLine('2026-10-03T20:54:52.871Z 1:C 04 Oct 2026 03:54:52.870 # WARNING Memory overcommit must be enabled!')).toMatchObject({ level: 'warn', scope: 'redis' });
    expect(queryAppLogs({ source: 'staging-app', hours: 6, limit: 5 }, now).sources).toEqual(['edge-nginx-access', 'staging-app']);
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.APP_LOG_DIR; });

  it('summarises levels, repeated problems and HTTP errors across plain and gzip hours', () => {
    const result = queryAppLogs({ source: 'staging-app', hours: 6, limit: 100 }, now);
    expect(result.scannedFiles).toBe(2);
    expect(result.summary.byLevel.error).toBe(2); // the pino error plus the plain-text "unexpected error" line
    expect(result.summary.signatureInvalid).toBe(1);
    expect(result.summary.httpErrors).toEqual([{ path: '/admin/api/x/:id', statusCode: 404, count: 1 }]);
    expect(result.entries[0].time >= result.entries[result.entries.length - 1].time).toBe(true);
  });

  it('filters by level, text and request id, and never returns secret-looking fields', () => {
    expect(queryAppLogs({ source: 'staging-app', hours: 6, limit: 100, level: 'warn' }, now).entries).toHaveLength(1);
    expect(queryAppLogs({ source: 'staging-app', hours: 6, limit: 100, q: 'boom' }, now).entries).toHaveLength(1);
    expect(queryAppLogs({ source: 'staging-app', hours: 6, limit: 100, requestId: 'req-abc-1' }, now).entries).toHaveLength(1);
    expect(JSON.stringify(queryAppLogs({ source: 'staging-app', hours: 6, limit: 100 }, now))).not.toContain('SHOULD-NOT-LEAK');
  });

  it('only reads hours inside the window and returns nothing for an unknown lane', () => {
    const recent = queryAppLogs({ source: 'staging-app', hours: 1, limit: 100 }, now);
    expect(recent.summary.total).toBe(3); // the 19:10 and 19:11 lines are older than the 1 h window
    expect(recent.summary.signatureInvalid).toBe(0);
    expect(queryAppLogs({ source: 'nope', hours: 6, limit: 100 }, now).entries).toEqual([]);
  });

  it('validates the query (no path tricks in lane)', () => {
    expect(parseAppLogQuery({ source: '../etc' }, 'staging-app')).toEqual({ error: expect.any(String) });
    expect(parseAppLogQuery({ hours: '999', limit: '9999', level: 'error' }, 'staging-app')).toMatchObject({ source: 'staging-app', hours: 168, limit: 500, level: 'error' });
    expect(parseLogLine('')).toBeNull();
  });
});
