import express from 'express';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformConfig, getUserProfile, listRecentAuditEventsPage, listVerifiedCustomerLineUserIds, recordAuditEvent, setPlatformConfig } from '../src/services/firestore';
import { sendTargetedMessage } from '../src/line/messaging';
import { enqueueCampaignSend } from '../src/jobs/queue';
import { resetRuntimeSettingsForTests } from '../src/services/runtime-settings';
import { registerAdminApiRoutes } from '../src/http/admin-api-routes';
import { buildAdminActorCookie } from '../src/services/admin-session';
import { buildOpenApiDocument } from '../src/http/openapi/document';

vi.mock('../src/line/messaging', () => ({
  sendTargetedMessage: vi.fn(async () => undefined),
  sendBroadcastMessage: vi.fn(async () => true),
  SALES_CHANNEL_ID: 'sales',
}));

vi.mock('../src/jobs/queue', () => ({
  isQueueBackendReady: vi.fn(() => true),
  enqueueCampaignSend: vi.fn(async () => 'job-campaign-1'),
  enqueueOpsJob: vi.fn(async () => 'job-ops-1'),
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
    listVerifiedCustomerLineUserIds: vi.fn(async () => []),
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
    'LINE_CHANNEL_ACCESS_TOKEN',
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

  it('returns 503 for LINE Login start when unset', async () => {
    const res = await fetch(`${base()}/admin/api/session/line/start`, { redirect: 'manual' });
    expect([503, 302]).toContain(res.status);
    if (res.status === 302) return;
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/LINE Login/);
  });

  it('previews promo skip counts and rejects promo on sales', async () => {
    const { cookie } = buildAdminActorCookie('Usuper');
    const headers = { ...ops, 'content-type': 'application/json', cookie };
    const denied = await fetch(`${base()}/admin/api/campaigns/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ audienceType: 'customers_promo', channelId: 'sales' }),
    });
    expect(denied.status).toBe(400);

    vi.mocked(listVerifiedCustomerLineUserIds).mockResolvedValueOnce(['UcustOff']);
    mockedProfile.mockImplementation(async (userId: string) => (
      userId === 'UcustOff'
        ? { ...profile, lastChannelId: 'customer' as const, marketingOptIn: false }
        : profile
    ));
    const preview = await fetch(`${base()}/admin/api/campaigns/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ audienceType: 'customers_promo', channelId: 'customer' }),
    });
    expect(preview.status).toBe(200);
    const body = await preview.json() as { count: number; skipped: { not_opted_in: number } };
    expect(body.count).toBe(0);
    expect(body.skipped.not_opted_in).toBe(1);
    expect(mockedSend).not.toHaveBeenCalled();
    mockedProfile.mockResolvedValue(profile);
  });

  it('test-pushes only the bound super-admin on the configured channel', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-default';
    const { cookie } = buildAdminActorCookie('Usuper');
    mockedSend.mockResolvedValueOnce(true);
    const res = await fetch(`${base()}/admin/api/campaigns/test`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ audienceType: 'sales_internal', channelId: 'sales', text: 'hello staff' }),
    });
    expect(res.status).toBe(200);
    expect(mockedSend).toHaveBeenCalledWith(['Usuper'], '[Cloudnex test] hello staff', 'sales');
    const body = await res.json() as { to: string };
    expect(body.to).toBe('Usuper');
  });

  it('queues send without calling LINE and replays idempotency key', async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'token-default';
    process.env.LINE_CHANNEL_CUSTOMER_SECRET = 'cust-secret';
    process.env.LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN = 'cust-token';
    resetRuntimeSettingsForTests();
    const { cookie } = buildAdminActorCookie('Usuper');
    const headers = { ...ops, 'content-type': 'application/json', cookie };
    vi.mocked(listVerifiedCustomerLineUserIds).mockResolvedValue(['UcustOn']);
    mockedProfile.mockImplementation(async (userId: string) => (
      userId === 'UcustOn'
        ? { ...profile, lastChannelId: 'customer' as const, marketingOptIn: true }
        : profile
    ));
    const send = vi.mocked(enqueueCampaignSend);
    send.mockClear();
    mockedSend.mockClear();
    const first = await fetch(`${base()}/admin/api/campaigns/send`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'camp-1' },
      body: JSON.stringify({
        audienceType: 'customers_transactional',
        channelId: 'customer',
        text: 'hello',
        confirm: 'SEND',
      }),
    });
    expect(first.status).toBe(202);
    expect(mockedSend).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    const replay = await fetch(`${base()}/admin/api/campaigns/send`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'camp-1' },
      body: JSON.stringify({
        audienceType: 'customers_transactional',
        channelId: 'customer',
        text: 'hello',
        confirm: 'SEND',
      }),
    });
    expect(replay.status).toBe(200);
    const replayBody = await replay.json() as { replayed?: boolean };
    expect(replayBody.replayed).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const list = await fetch(`${base()}/admin/api/campaigns`, { headers: { ...ops, cookie } });
    expect(list.status).toBe(200);
    mockedProfile.mockResolvedValue(profile);
  });

  it('rejects broadcast without BROADCAST confirm', async () => {
    const { cookie } = buildAdminActorCookie('Usuper');
    const res = await fetch(`${base()}/admin/api/campaigns/broadcast`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ channelId: 'customer', text: 'hi', confirm: 'SEND' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects promo LINE Broadcast so PROMO OFF is not bypassed', async () => {
    const { cookie } = buildAdminActorCookie('Usuper');
    const res = await fetch(`${base()}/admin/api/campaigns/broadcast`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        channelId: 'customer',
        audienceType: 'customers_promo',
        text: 'sale',
        confirm: 'BROADCAST',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/PROMO OFF/);
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
    expect(document.paths['/admin/api/campaigns/send']).toBeTruthy();
    expect(document.paths['/admin/api/campaigns/broadcast']).toBeTruthy();
    expect(document.paths['/admin/api/session/line/start']).toBeTruthy();
    expect(document.paths['/admin/api/session/oidc/start']).toBeTruthy();
    expect(document.paths['/admin/api/session/saml/acs']).toBeTruthy();
    expect(document.paths['/webhook']).toBeTruthy();
    const auditParams = document.paths['/ops/audit-log'].get?.parameters?.map(param => param.name) || [];
    expect(auditParams).toEqual(expect.arrayContaining(['actorUserId', 'action', 'from', 'to']));
  });
});
