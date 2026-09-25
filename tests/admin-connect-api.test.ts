import express from 'express';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformConfig, getUserProfile, listRecentAuditEventsPage, recordAuditEvent, setPlatformConfig } from '../src/services/firestore';
import { sendTargetedMessage } from '../src/line/messaging';
import { resetRuntimeSettingsForTests } from '../src/services/runtime-settings';
import { registerAdminApiRoutes } from '../src/http/admin-api-routes';
import { buildAdminActorCookie } from '../src/services/admin-session';
import { buildOpenApiDocument } from '../src/http/openapi/document';

vi.mock('../src/line/messaging', () => ({
  sendTargetedMessage: vi.fn(async () => undefined),
  SALES_CHANNEL_ID: 'sales',
}));

vi.mock('../src/services/firestore', async () => {
  const actual = await vi.importActual<typeof import('../src/services/firestore')>('../src/services/firestore');
  return {
    ...actual,
    getPlatformConfig: vi.fn(),
    setPlatformConfig: vi.fn(),
    getUserProfile: vi.fn(),
    recordAuditEvent: vi.fn(async () => undefined),
    listRecentAuditEventsPage: vi.fn(),
    findLineUserIdByPhone: vi.fn(),
    findVerifiedUserIdByPartnerId: vi.fn(),
    listVerifiedSalesLineUserIds: vi.fn(async () => []),
    listRecentApprovals: vi.fn(async () => []),
    setMarketingOptIn: vi.fn(),
    setUserLanguage: vi.fn(),
    setUserPendingFlow: vi.fn(),
    setUserRole: vi.fn(async () => ({ ok: true })),
  };
});

const mockedGetConfig = vi.mocked(getPlatformConfig);
const mockedSetConfig = vi.mocked(setPlatformConfig);
const mockedProfile = vi.mocked(getUserProfile);
const mockedAuditPage = vi.mocked(listRecentAuditEventsPage);
const mockedSend = vi.mocked(sendTargetedMessage);

const profile = {
  language: 'en' as const,
  role: 'user' as const,
  odooVerified: true,
  marketingOptIn: false,
};

describe('Cloudnex Connect admin API', () => {
  const store: Record<string, unknown> = {};
  const original: Record<string, string | undefined> = {};
  const keys = [
    'OPS_API_TOKEN',
    'ADMIN_USER_ID',
    'SUPER_ADMIN_USER_IDS',
    'CONNECT_BOOTSTRAP_TOKEN',
    'LINE_CHANNEL_SECRET',
    'ADMIN_CONFIG_LOCK',
    'SECRET_REVEAL_TTL_SECONDS',
    'SECRETS_ENCRYPTION_KEY',
  ];

  const app = express();
  registerAdminApiRoutes(app);
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = () => `http://127.0.0.1:${port}`;

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    for (const key of keys) original[key] = process.env[key];
    process.env.OPS_API_TOKEN = 'ops-token-for-tests-16';
    process.env.ADMIN_USER_ID = 'Usuper';
    process.env.SUPER_ADMIN_USER_IDS = 'Usuper';
    process.env.LINE_CHANNEL_SECRET = 'line-secret-value';
    process.env.ADMIN_CONFIG_LOCK = 'true';
    process.env.SECRET_REVEAL_TTL_SECONDS = '10';
    process.env.CONNECT_BOOTSTRAP_TOKEN = 'bootstrap-token-16chars';
    resetRuntimeSettingsForTests({});
    mockedGetConfig.mockImplementation(async (key: string) => (store[key] as never) ?? null);
    mockedSetConfig.mockImplementation(async (key: string, value: unknown) => {
      store[key] = value;
      return { ok: true };
    });
    mockedProfile.mockResolvedValue(profile);
    mockedAuditPage.mockResolvedValue({
      events: [
        { id: '1', action: 'quote_create', outcome: 'success', actorUserId: 'U1', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: '2', action: 'secret_reveal_consumed', outcome: 'success', actorUserId: 'Usuper', createdAt: '2026-01-01T00:00:00.000Z', detail: 'LINE_CHANNEL_SECRET' },
      ],
      nextCursor: undefined,
    } as never);
    mockedSend.mockClear();
    vi.mocked(recordAuditEvent).mockClear();
  });

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  afterAll(() => new Promise<void>((resolve, reject) => {
    server.close(err => (err ? reject(err) : resolve()));
  }));

  const ops = { authorization: 'Bearer ops-token-for-tests-16' };

  it('rejects CRM-equivalent settings without OPS', async () => {
    const res = await fetch(`${base()}/admin/api/settings`);
    expect(res.status).toBe(401);
  });

  it('masks secrets on settings GET', async () => {
    const res = await fetch(`${base()}/admin/api/settings`, { headers: ops });
    expect(res.status).toBe(200);
    const body = await res.json() as { settings: Array<{ key: string; kind: string; value?: string }> };
    const secret = body.settings.find(row => row.key === 'LINE_CHANNEL_SECRET');
    expect(secret?.kind).toBe('secret');
    expect(secret?.value).toBeUndefined();
  });

  it('burns bootstrap after the first success', async () => {
    delete process.env.OPS_API_TOKEN;
    const first = await fetch(`${base()}/admin/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'bootstrap-token-16chars' }),
    });
    expect(first.status).toBe(200);
    const second = await fetch(`${base()}/admin/api/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'bootstrap-token-16chars' }),
    });
    expect(second.status).toBe(410);
  });

  it('denies reveal without a bound LINE cookie even if JSON claims an actor', async () => {
    const res = await fetch(`${base()}/admin/api/secrets/reveal-token`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json' },
      body: JSON.stringify({ secretKey: 'LINE_CHANNEL_SECRET', actorLineUserId: 'Usuper' }),
    });
    expect(res.status).toBe(403);
  });

  it('denies reveal when SUPER_ADMIN_USER_IDS is empty', async () => {
    delete process.env.SUPER_ADMIN_USER_IDS;
    const { cookie } = buildAdminActorCookie('Usuper');
    const res = await fetch(`${base()}/admin/api/secrets/reveal-token`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ secretKey: 'LINE_CHANNEL_SECRET' }),
    });
    expect(res.status).toBe(403);
  });

  it('binds via LINE OTP then reveals once', async () => {
    const bind = await fetch(`${base()}/admin/api/session/bind`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json' },
      body: JSON.stringify({ lineUserId: 'Usuper' }),
    });
    expect(bind.status).toBe(200);
    const pushed = String(mockedSend.mock.calls[0]?.[1] || '');
    const otp = pushed.match(/(\d{6})/)?.[1];
    expect(otp).toBeTruthy();
    const confirm = await fetch(`${base()}/admin/api/session/confirm`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json' },
      body: JSON.stringify({ lineUserId: 'Usuper', otp }),
    });
    expect(confirm.status).toBe(200);
    const setCookie = confirm.headers.get('set-cookie') || '';
    const issued = await fetch(`${base()}/admin/api/secrets/reveal-token`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie: setCookie },
      body: JSON.stringify({ secretKey: 'LINE_CHANNEL_SECRET' }),
    });
    expect(issued.status).toBe(200);
    const tokenBody = await issued.json() as { token: string; expiresInSec: number };
    expect(tokenBody.expiresInSec).toBe(10);
    const revealed = await fetch(`${base()}/admin/api/secrets/reveal`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie: setCookie },
      body: JSON.stringify({ token: tokenBody.token }),
    });
    expect(revealed.status).toBe(200);
    const secretBody = await revealed.json() as { secret: string };
    expect(secretBody.secret).toBe('line-secret-value');
    const reuse = await fetch(`${base()}/admin/api/secrets/reveal`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie: setCookie },
      body: JSON.stringify({ token: tokenBody.token }),
    });
    expect(reuse.status).toBe(410);
  });

  it('strips secret_reveal_* from ops audit', async () => {
    const res = await fetch(`${base()}/admin/api/audit-log`, { headers: ops });
    expect(res.status).toBe(200);
    const body = await res.json() as { events: Array<{ action: string }> };
    expect(body.events.map(event => event.action)).toEqual(['quote_create']);
  });
});

describe('OpenAPI Cloudnex Connect coverage', () => {
  it('documents install, admin, webhooks, and audit actorUserId', () => {
    const document = buildOpenApiDocument() as {
      tags: Array<{ name: string }>;
      paths: Record<string, { get?: { parameters?: Array<{ name: string }> } }>;
    };
    const names = document.tags.map(tag => tag.name);
    expect(names).toEqual(expect.arrayContaining(['install', 'line-services', 'admin', 'ops', 'jobs', 'erp']));
    expect(document.paths['/admin/api/bootstrap']).toBeTruthy();
    expect(document.paths['/admin/api/settings']).toBeTruthy();
    expect(document.paths['/admin/api/session/bind']).toBeTruthy();
    expect(document.paths['/webhook']).toBeTruthy();
    const auditParams = document.paths['/ops/audit-log'].get?.parameters?.map(param => param.name) || [];
    expect(auditParams).toEqual(expect.arrayContaining(['actorUserId', 'action', 'from', 'to']));
  });
});
