import express from 'express';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformConfig, getUserProfile, listRecentAuditEventsPage, listVerifiedCustomerLineUserIds, mutatePlatformConfig, recordAuditEvent, setPlatformConfig } from '../src/services/firestore';
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

vi.mock('../src/line/command-router', () => ({
  resolveCommandReply: vi.fn(async () => [{ type: 'text', text: 'ok' }]),
}));

vi.mock('../src/services/firestore', async () => {
  const actual = await vi.importActual<typeof import('../src/services/firestore')>('../src/services/firestore');
  return {
    ...actual,
    getPlatformConfig: vi.fn(),
    setPlatformConfig: vi.fn(),
    mutatePlatformConfig: vi.fn(),
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
const mockedMutateConfig = vi.mocked(mutatePlatformConfig);
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
    mockedMutateConfig.mockImplementation(async (key: string, mutator: (current: never) => never) => {
      store[key] = mutator((store[key] as never) ?? null);
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
    const body = await res.json() as { settings: Array<{ key: string; kind: string; value?: string }>; queueReady?: boolean };
    const secret = body.settings.find(row => row.key === 'LINE_CHANNEL_SECRET');
    expect(secret?.kind).toBe('secret');
    expect(secret?.value).toBeUndefined();
    expect(typeof body.queueReady).toBe('boolean');
  });

  it('lists command grid for Admin Commands', async () => {
    const res = await fetch(`${base()}/admin/api/commands`, { headers: ops });
    expect(res.status).toBe(200);
    const body = await res.json() as { commands: Array<{ prefix: string }> };
    expect(body.commands.some(row => row.prefix === 'NAV HOME')).toBe(true);
  });

  it('rejects unknown command overlay ids', async () => {
    const res = await fetch(`${base()}/admin/api/commands`, {
      method: 'PUT',
      headers: { ...ops, 'content-type': 'application/json' },
      body: JSON.stringify({ commands: { 'not-real': { enabled: true } } }),
    });
    expect(res.status).toBe(400);
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

  it('accepts campaign textEn/textTh when text is omitted', async () => {
    const { parseCampaignTestText } = await import('../src/line/campaigns');
    expect(parseCampaignTestText({ textTh: 'สวัสดี', language: 'th' })).toBe('สวัสดี');
    expect(parseCampaignTestText({ textEn: 'Hello', language: 'en' })).toBe('Hello');
  });

  it('previews admin command without calling the command router', async () => {
    const { resolveCommandReply } = await import('../src/line/command-router');
    const { cookie } = buildAdminActorCookie('Usuper');
    const res = await fetch(`${base()}/admin/api/command`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ text: 'FORM USER CREATE', preview: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { preview?: boolean; form?: { startCommand?: string } };
    expect(body.preview).toBe(true);
    expect(body.form?.startCommand).toBe('FORM USER CREATE');
    expect(vi.mocked(resolveCommandReply)).not.toHaveBeenCalled();
  });

  it('confirms admin command as the bound actor', async () => {
    const { resolveCommandReply } = await import('../src/line/command-router');
    vi.mocked(resolveCommandReply).mockClear();
    const { cookie } = buildAdminActorCookie('Usuper');
    const res = await fetch(`${base()}/admin/api/command`, {
      method: 'POST',
      headers: { ...ops, 'content-type': 'application/json', cookie },
      body: JSON.stringify({ text: 'NAV HOME' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { transcript?: Array<{ text?: string }>; preview?: boolean };
    expect(body.preview).toBe(false);
    expect(body.transcript?.[0]?.text).toBe('ok');
    expect(vi.mocked(resolveCommandReply)).toHaveBeenCalled();
  });

  it('lists verified sales when Directory is opened with no lookup query', async () => {
    const res = await fetch(`${base()}/admin/api/users`, { headers: ops });
    expect(res.status).toBe(200);
    const body = await res.json() as { users: unknown[] };
    expect(Array.isArray(body.users)).toBe(true);
  });

  it('reports bind allowlist flags on session/me', async () => {
    const res = await fetch(`${base()}/admin/api/session/me`, { headers: ops });
    expect(res.status).toBe(200);
    const body = await res.json() as { bind: { adminAllowlistSet: boolean; superAdminAllowlistSet: boolean } };
    expect(body.bind.adminAllowlistSet).toBe(true);
    expect(body.bind.superAdminAllowlistSet).toBe(true);
  });

  it('returns a LINE user dossier and activity for ops', async () => {
    const lineUserId = 'U05594eb080e50a62b6911f45ffe30d4ea';
    const list = await fetch(`${base()}/admin/api/users?userId=${lineUserId}`, { headers: ops });
    expect(list.status).toBe(200);
    const listed = await list.json() as { users: Array<{ userId: string; commandRole: string; odooPrivileges: { groups: string[] } }> };
    expect(listed.users[0].userId).toBe(lineUserId);
    expect(listed.users[0].commandRole).toBeTruthy();
    expect(Array.isArray(listed.users[0].odooPrivileges.groups)).toBe(true);
    const one = await fetch(`${base()}/admin/api/users/${lineUserId}`, { headers: ops });
    expect(one.status).toBe(200);
    const activity = await fetch(`${base()}/admin/api/users/${lineUserId}/activity?limit=20`, { headers: ops });
    expect(activity.status).toBe(200);
    const priv = await fetch(`${base()}/admin/api/privileges`, { headers: ops });
    expect(priv.status).toBe(200);
    const snap = await priv.json() as { chain: string[]; identityFormat: string };
    expect(snap.chain).toEqual(expect.arrayContaining(['odooVerified', 'role=admin']));
    expect(snap.identityFormat).toMatch(/LINE user id/);
  });

  it('returns live channel traffic on dashboard, not audit rows', async () => {
    const { recordChannelInbound, resetChannelTrafficForTests } = await import('../src/services/channel-traffic');
    resetChannelTrafficForTests();
    recordChannelInbound('sales', 'U1');
    recordChannelInbound('customer', 'U2');
    const res = await fetch(`${base()}/admin/api/dashboard`, { headers: ops });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      traffic: {
        activeUsers: { sales: number; customer: number; total: number };
        messages: { sales: number; customer: number; total: number };
      };
      flags: { redisConfigured?: boolean; queueReady?: boolean };
    };
    expect(body.traffic.activeUsers.total).toBe(2);
    expect(body.traffic.messages.sales).toBe(1);
    expect(body.traffic.messages.customer).toBe(1);
    expect(typeof body.flags.queueReady).toBe('boolean');
    resetChannelTrafficForTests();
  });

  it('registers a custom PUBLIC_ADMIN_BASE prefix', async () => {
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect/admin';
    const extra = express();
    registerAdminApiRoutes(extra);
    const srv = extra.listen(0);
    const addr = srv.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/cloudnex-connect/admin/api/settings`, { headers: ops });
      expect(res.status).toBe(200);
      const miss = await fetch(`http://127.0.0.1:${port}/admin/api/settings`, { headers: ops });
      expect(miss.status).toBe(404);
    } finally {
      delete process.env.PUBLIC_ADMIN_BASE;
      await new Promise<void>((resolve, reject) => srv.close(err => (err ? reject(err) : resolve())));
    }
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
