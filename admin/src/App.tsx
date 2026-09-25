import { FormEvent, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'cloudnex_ops_token';
const LEGACY_TOKEN_KEY = 'cns_ops_token';
const JOBS_TOKEN_KEY = 'cloudnex_admin_jobs_token';

type Quote = {
  id: number;
  name: string;
  state: string;
  amountTotal: number;
  partnerName?: string;
  salespersonUserId?: number;
  salespersonName?: string;
};

const pathOf = (): string => {
  const raw = window.location.pathname.replace(/\/$/, '') || '/admin';
  return raw.startsWith('/admin') ? raw : '/admin';
};

const authHeaders = (): HeadersInit => {
  const token = sessionStorage.getItem(TOKEN_KEY) || '';
  return token ? { authorization: `Bearer ${token}` } : {};
};

const api = async (path: string, init: RequestInit = {}) => {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  return res;
};

const NAV: Array<{ id: string; href: string; label: string }> = [
  { id: 'home', href: '/admin', label: 'Overview' },
  { id: 'identity', href: '/admin/identity', label: 'Identity' },
  { id: 'line', href: '/admin/line', label: 'LINE' },
  { id: 'campaigns', href: '/admin/campaigns', label: 'Campaigns' },
  { id: 'crm', href: '/admin/crm', label: 'CRM' },
  { id: 'users', href: '/admin/users', label: 'Directory' },
  { id: 'settings', href: '/admin/settings', label: 'Security' },
  { id: 'logs', href: '/admin/logs', label: 'Audit' },
  { id: 'platform', href: '/admin/platform', label: 'Platform' },
  { id: 'jobs', href: '/admin/jobs', label: 'Jobs' },
  { id: 'advanced', href: '/admin/advanced', label: 'Advanced' },
  { id: 'testing', href: '/admin/testing', label: 'Testing' },
];

export const App = () => {
  const [path, setPath] = useState(pathOf);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY) || '');
  const [jobsToken, setJobsToken] = useState(() => sessionStorage.getItem(JOBS_TOKEN_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [assignId, setAssignId] = useState('');
  const [assignSales, setAssignSales] = useState('');
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [reveals, setReveals] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [bindUser, setBindUser] = useState('');
  const [bindOtp, setBindOtp] = useState('');
  const [lookup, setLookup] = useState('');
  const [unmasked, setUnmasked] = useState<Record<string, { value: string; until: number }>>({});
  const [channelSlug, setChannelSlug] = useState('hr');
  const [channelSecret, setChannelSecret] = useState('');
  const [channelToken, setChannelToken] = useState('');
  const [channelServices, setChannelServices] = useState('');
  const [channelBasicId, setChannelBasicId] = useState('');
  const [channelRichMenu, setChannelRichMenu] = useState('');
  const [channelWebhook, setChannelWebhook] = useState('');
  const [health, setHealth] = useState('');
  const [ready, setReady] = useState('');
  const [erp, setErp] = useState('');
  const [actor, setActor] = useState<string | null>(null);
  const [appEnv, setAppEnv] = useState('—');
  const [campChannel, setCampChannel] = useState('customer');
  const [campClass, setCampClass] = useState('customers_transactional');
  const [campText, setCampText] = useState('');
  const [campPreview, setCampPreview] = useState('');
  const [campHistory, setCampHistory] = useState<Array<Record<string, unknown>>>([]);
  const [broadcastConfirm, setBroadcastConfirm] = useState('');

  useEffect(() => {
    const onPop = () => setPath(pathOf());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setUnmasked(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].until <= now) delete next[key];
        }
        return next;
      });
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const go = (next: string) => {
    window.history.pushState({}, '', next);
    setPath(pathOf());
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    const next = token.trim();
    sessionStorage.setItem(TOKEN_KEY, next);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    const res = await api('/admin/api/settings');
    if (res.status === 401) {
      setAuthed(false);
      setError('Unauthorized');
      return;
    }
    setSettings(await res.json());
    setAuthed(true);
    setError('');
  };

  const loadSettings = async () => {
    const res = await api('/admin/api/settings');
    if (res.ok) setSettings(await res.json());
    const me = await api('/admin/api/session/me');
    if (me.ok) {
      const body = await me.json() as { appEnv?: string; actorUserId?: string | null };
      setAppEnv(body.appEnv || '—');
      setActor(body.actorUserId || null);
    }
  };

  const reveal = async (secretKey: string) => {
    const issued = await api('/admin/api/secrets/reveal-token', { method: 'POST', body: JSON.stringify({ secretKey }) });
    const issuedBody = await issued.json() as { token?: string; expiresInSec?: number; error?: string };
    if (!issued.ok || !issuedBody.token) {
      setError(issuedBody.error || 'Reveal denied');
      return;
    }
    const shown = await api('/admin/api/secrets/reveal', { method: 'POST', body: JSON.stringify({ token: issuedBody.token }) });
    const body = await shown.json() as { secret?: string; expiresInSec?: number; error?: string };
    if (!shown.ok || typeof body.secret !== 'string') {
      setError(body.error || 'Reveal failed');
      return;
    }
    const ttl = (body.expiresInSec || 10) * 1000;
    setUnmasked(prev => ({ ...prev, [secretKey]: { value: body.secret as string, until: Date.now() + ttl } }));
    setError('');
  };

  const addLineChannel = async (event: FormEvent) => {
    event.preventDefault();
    const res = await api('/admin/api/line-channels', {
      method: 'POST',
      body: JSON.stringify({
        channelId: channelSlug,
        secret: channelSecret,
        accessToken: channelToken,
        services: channelServices,
        basicId: channelBasicId,
        richMenuJson: channelRichMenu,
      }),
    });
    const body = await res.json() as { ok?: boolean; webhookUrl?: string; error?: string };
    if (!res.ok) {
      setError(body.error || 'Could not add LINE channel');
      return;
    }
    setChannelWebhook(body.webhookUrl || '');
    setChannelSecret('');
    setChannelToken('');
    setError('');
    await loadSettings();
  };

  const campaignBody = () => ({
    audienceType: campClass,
    channelId: campChannel,
    text: campText,
  });

  const page = useMemo(() => {
    if (path.endsWith('/crm')) return 'crm';
    if (path.endsWith('/settings') || path.endsWith('/security') || path.endsWith('/unmask') || path.endsWith('/privileges') || path.endsWith('/setup')) return 'settings';
    if (path.endsWith('/logs') || path.endsWith('/audit')) return 'logs';
    if (path.endsWith('/users') || path.endsWith('/directory')) return 'users';
    if (path.endsWith('/testing') || path.endsWith('/demo')) return 'testing';
    if (path.endsWith('/erp') || path.endsWith('/platform')) return 'platform';
    if (path.endsWith('/jobs')) return 'jobs';
    if (path.endsWith('/line')) return 'line';
    if (path.endsWith('/campaigns')) return 'campaigns';
    if (path.endsWith('/identity')) return 'identity';
    if (path.endsWith('/advanced')) return 'advanced';
    return 'home';
  }, [path]);

  if (!authed) {
    return (
      <main>
        <div className="card">
          <h1>Cloudnex Connect Admin</h1>
          <p>OPS token required. Super-admin identity: LINE Login, Okta (OIDC/SAML), or LINE OTP bind.</p>
          <form className="row" onSubmit={login}>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="OPS_API_TOKEN" autoComplete="off" />
            <button type="submit">Sign in</button>
          </form>
          <div className="row">
            <a href="/admin/api/session/line/start">LINE Login</a>
            <a href="/admin/api/session/oidc/start">Okta OIDC</a>
            <a href="/admin/api/session/saml/start">Okta/SAML</a>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </main>
    );
  }

  const rows = (settings?.settings as Array<{ key: string; kind: string; set: boolean; value?: string }> | undefined) || [];
  const webhooks = (settings?.webhooks as Record<string, string> | undefined) || {};
  const flags = (settings?.optionalFlags as Record<string, boolean> | undefined) || {};

  const lineForm = (
    <form className="row" onSubmit={addLineChannel}>
      <input value={channelSlug} onChange={e => setChannelSlug(e.target.value)} placeholder="hr" />
      <input type="password" value={channelSecret} onChange={e => setChannelSecret(e.target.value)} placeholder="channel secret" autoComplete="off" />
      <input type="password" value={channelToken} onChange={e => setChannelToken(e.target.value)} placeholder="access token" autoComplete="off" />
      <input value={channelServices} onChange={e => setChannelServices(e.target.value)} placeholder="services CSV (optional)" />
      <input value={channelBasicId} onChange={e => setChannelBasicId(e.target.value)} placeholder="@basic-id (optional)" />
      <input value={channelRichMenu} onChange={e => setChannelRichMenu(e.target.value)} placeholder="rich-menu JSON (optional)" />
      <button type="submit">Save channel</button>
    </form>
  );

  return (
    <>
      <header>
        <strong>Cloudnex Connect</strong>
        <span className="pill">{String(settings?.appEnv || appEnv)}</span>
        {actor ? <span className="pill">{actor}</span> : null}
        {NAV.map(item => (
          <a key={item.id} className={page === item.id ? 'active' : ''} href={item.href} onClick={e => { e.preventDefault(); go(item.href); }}>{item.label}</a>
        ))}
        <button className="secondary" type="button" onClick={async () => {
          await api('/admin/api/session/logout', { method: 'POST' });
          sessionStorage.removeItem(TOKEN_KEY);
          setAuthed(false);
        }}>Sign out</button>
      </header>
      <main>
        {error ? <p className="error">{error}</p> : null}
        {page === 'home' ? (
          <div className="card">
            <h2>Overview</h2>
            <p>HMAC LINE → Firestore → one command router. Demo is testing only. Lock: {String(settings?.lock)}</p>
            <div className="row">
              <button type="button" onClick={async () => {
                const h = await fetch('/healthz');
                setHealth(`${h.status}`);
                const r = await fetch('/readyz');
                setReady(`${r.status}`);
                await loadSettings();
              }}>Refresh health</button>
              <a href="/healthz">/healthz {health}</a>
              <a href="/readyz">/readyz {ready}</a>
              <a href="/api-docs">OpenAPI</a>
            </div>
          </div>
        ) : null}
        {page === 'identity' ? (
          <div className="card">
            <h2>Identity</h2>
            <p>Bind super admin (LINE OTP, LINE Login, or Okta). Fail-closed ADMIN_USER_ID then SUPER_ADMIN_USER_IDS.</p>
            <div className="row">
              <a href="/admin/api/session/line/start">LINE Login</a>
              <a href="/admin/api/session/oidc/start">Okta OIDC</a>
              <a href="/admin/api/session/saml/start">SAML</a>
            </div>
            <div className="row">
              <input value={bindUser} onChange={e => setBindUser(e.target.value)} placeholder="LINE user id" />
              <button type="button" onClick={async () => {
                const res = await api('/admin/api/session/bind', { method: 'POST', body: JSON.stringify({ lineUserId: bindUser }) });
                setError(res.ok ? '' : 'Bind failed');
              }}>Send code</button>
              <input value={bindOtp} onChange={e => setBindOtp(e.target.value)} placeholder="OTP" />
              <button type="button" onClick={async () => {
                const res = await api('/admin/api/session/confirm', { method: 'POST', body: JSON.stringify({ lineUserId: bindUser, otp: bindOtp }) });
                setError(res.ok ? '' : 'Confirm failed');
                await loadSettings();
              }}>Confirm</button>
            </div>
          </div>
        ) : null}
        {page === 'settings' ? (
          <div className="card">
            <h2>Security</h2>
            <p>Credentials stay masked except a timed reveal. ADMIN_USER_ID is fail-closed.</p>
            <pre>{JSON.stringify(webhooks, null, 2)}</pre>
            <button type="button" onClick={() => void loadSettings()}>Refresh</button>
            <table>
              <thead><tr><th>Key</th><th>Value</th><th></th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key}>
                    <td>{row.key}</td>
                    <td>{row.kind === 'secret' ? (unmasked[row.key] ? `${unmasked[row.key].value} (${Math.max(0, Math.ceil((unmasked[row.key].until - Date.now()) / 1000))}s)` : (row.set ? '••••' : '—')) : (row.value || '—')}</td>
                    <td>{row.kind === 'secret' && row.set ? <button type="button" onClick={() => void reveal(row.key)}>Reveal</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Unmask log</h3>
            <button type="button" onClick={async () => {
              const res = await api('/admin/api/audit-log/reveals?limit=50');
              const body = await res.json() as { events?: Array<Record<string, unknown>>; error?: string };
              if (!res.ok) setError(body.error || 'Forbidden');
              setReveals(body.events || []);
            }}>Load reveals</button>
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Actor</th></tr></thead>
              <tbody>
                {reveals.map((row, i) => (
                  <tr key={String(row.id || i)}><td>{String(row.createdAt || '')}</td><td>{String(row.action || '')}</td><td>{String(row.actorUserId || '')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {page === 'crm' ? (
          <div className="card">
            <h2>CRM quotes</h2>
            <div className="row">
              <button type="button" onClick={async () => {
                const res = await api('/admin/crm/quotes?unassigned=1');
                const body = await res.json() as { quotes?: Quote[] };
                setQuotes(body.quotes || []);
              }}>Unassigned</button>
              <button type="button" onClick={async () => {
                const res = await api('/admin/crm/quotes');
                const body = await res.json() as { quotes?: Quote[] };
                setQuotes(body.quotes || []);
              }}>All</button>
            </div>
            <table>
              <thead><tr><th>Order</th><th>State</th><th>Partner</th><th>Salesperson</th></tr></thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id}><td>{q.name}</td><td>{q.state}</td><td>{q.partnerName || '—'}</td><td>{q.salespersonName || 'unassigned'}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="row">
              <input value={assignId} onChange={e => setAssignId(e.target.value)} placeholder="quote id" />
              <input value={assignSales} onChange={e => setAssignSales(e.target.value)} placeholder="Odoo user id" />
              <button type="button" onClick={async () => {
                const res = await api(`/admin/crm/quotes/${assignId}`, { method: 'PUT', body: JSON.stringify({ salespersonUserId: Number(assignSales) }) });
                setError(res.ok ? '' : 'Assign failed');
              }}>Assign</button>
            </div>
          </div>
        ) : null}
        {page === 'users' ? (
          <div className="card">
            <h2>Directory</h2>
            <div className="row">
              <input value={lookup} onChange={e => setLookup(e.target.value)} placeholder="LINE user id or phone" />
              <button type="button" onClick={async () => {
                const q = lookup.includes('U') ? `userId=${encodeURIComponent(lookup)}` : `phone=${encodeURIComponent(lookup)}`;
                const res = await api(`/admin/api/users?${q}`);
                const body = await res.json() as { users?: Array<Record<string, unknown>> };
                setUsers(body.users || []);
              }}>Lookup</button>
              <button type="button" onClick={async () => {
                const res = await api('/admin/api/users?sales=1');
                const body = await res.json() as { users?: Array<Record<string, unknown>> };
                setUsers(body.users || []);
              }}>Verified sales</button>
            </div>
            <table>
              <thead><tr><th>User</th><th>Verified</th><th>Language</th><th>Opt-in</th></tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={String(u.userId || i)}>
                    <td>{String(u.userId || '')}</td>
                    <td>{String(u.odooVerified)}</td>
                    <td>{String(u.language || '')}</td>
                    <td>{String(u.marketingOptIn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {page === 'logs' ? (
          <div className="card">
            <h2>Ops audit</h2>
            <button type="button" onClick={async () => {
              const res = await api('/admin/api/audit-log?limit=50');
              const body = await res.json() as { events?: Array<Record<string, unknown>> };
              setLogs(body.events || []);
            }}>Load</button>
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Actor</th></tr></thead>
              <tbody>
                {logs.map((row, i) => (
                  <tr key={String(row.id || i)}><td>{String(row.createdAt || '')}</td><td>{String(row.action || '')}</td><td>{String(row.actorUserId || '')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {page === 'testing' ? (
          <div className="card">
            <h2>Testing (Demo)</h2>
            <p>Admin testing only. Off when APP_ENV=production. Same resolveCommandReply as LINE.</p>
            <p><a href="/demo">Open /demo</a></p>
          </div>
        ) : null}
        {page === 'platform' ? (
          <div className="card">
            <h2>ERP / platform</h2>
            <button type="button" onClick={async () => {
              await loadSettings();
              const res = await api('/admin/api/erp/test');
              setErp(res.ok ? 'ok' : 'fail');
            }}>Refresh</button>
            <p>ERP test: {erp || '—'}</p>
            <pre>{JSON.stringify({ lock: settings?.lock, missingRequired: settings?.missingRequired, capabilities: settings?.capabilities }, null, 2)}</pre>
          </div>
        ) : null}
        {page === 'jobs' ? (
          <div className="card">
            <h2>Jobs</h2>
            <input type="password" value={jobsToken} onChange={e => { setJobsToken(e.target.value); sessionStorage.setItem(JOBS_TOKEN_KEY, e.target.value); }} placeholder="ADMIN_SECRET_TOKEN" />
            <button type="button" onClick={async () => {
              const res = await fetch('/admin/api/jobs/daily-report', { method: 'POST', credentials: 'include', headers: { authorization: `Bearer ${jobsToken}` } });
              setError(res.ok ? '' : 'Job failed');
            }}>Daily report</button>
          </div>
        ) : null}
        {page === 'line' ? (
          <div className="card">
            <h2>LINE channels</h2>
            <p>Add another OA. Existing <code>POST /webhook/:channelId</code>. Overlay only when ADMIN_CONFIG_LOCK is off.</p>
            {lineForm}
            {channelWebhook ? <p>Webhook: {channelWebhook}</p> : null}
            <pre>{JSON.stringify(webhooks, null, 2)}</pre>
          </div>
        ) : null}
        {page === 'campaigns' ? (
          <div className="card">
            <h2>Campaigns</h2>
            <p>Channel → class → message → preview → test → multicast Send. Promo uses Send only (honors PROMO OFF). LINE Broadcast cannot filter opt-out; it is blocked for promo class.</p>
            <div className="row">
              <select value={campChannel} onChange={e => setCampChannel(e.target.value)}>
                <option value="customer">customer</option>
                <option value="sales">sales</option>
              </select>
              <select value={campClass} onChange={e => setCampClass(e.target.value)}>
                <option value="customers_transactional">transactional customers</option>
                <option value="customers_promo">promo customers</option>
                <option value="sales_internal">sales internal</option>
              </select>
            </div>
            <textarea value={campText} onChange={e => setCampText(e.target.value)} rows={4} style={{ width: '100%' }} />
            <div className="row">
              <button type="button" onClick={async () => {
                const res = await api('/admin/api/campaigns/preview', { method: 'POST', body: JSON.stringify(campaignBody()) });
                const body = await res.json();
                setCampPreview(JSON.stringify(body));
                setError(res.ok ? '' : String((body as { error?: string }).error || 'Preview failed'));
              }}>Preview</button>
              <button type="button" onClick={async () => {
                const res = await api('/admin/api/campaigns/test', { method: 'POST', body: JSON.stringify(campaignBody()) });
                setError(res.ok ? '' : 'Test failed');
              }}>Test (actor only)</button>
              <button type="button" onClick={async () => {
                const res = await api('/admin/api/campaigns/send', { method: 'POST', body: JSON.stringify({ ...campaignBody(), confirm: 'SEND' }) });
                setError(res.status === 202 || res.ok ? '' : (res.status === 503 ? 'Redis required (503)' : 'Send failed'));
              }}>Send multicast</button>
              <button type="button" onClick={async () => {
                const res = await api('/admin/api/campaigns');
                const body = await res.json() as { campaigns?: Array<Record<string, unknown>> };
                setCampHistory(body.campaigns || []);
              }}>History</button>
            </div>
            <p>{campPreview}</p>
            <h3>Broadcast (not default)</h3>
            <p>Sends to every OA friend. Blocked when class is promo — use multicast Send instead.</p>
            <input value={broadcastConfirm} onChange={e => setBroadcastConfirm(e.target.value)} placeholder="type BROADCAST" disabled={campClass === 'customers_promo'} />
            <button type="button" disabled={campClass === 'customers_promo'} onClick={async () => {
              const res = await api('/admin/api/campaigns/broadcast', { method: 'POST', body: JSON.stringify({ channelId: campChannel, audienceType: campClass, text: campText, confirm: broadcastConfirm }) });
              setError(res.ok ? '' : 'Broadcast denied or failed');
            }}>Broadcast</button>
            <table>
              <thead><tr><th>Id</th><th>Status</th><th>Count</th></tr></thead>
              <tbody>
                {campHistory.map((row, i) => (
                  <tr key={String(row.id || i)}><td>{String(row.id || '')}</td><td>{String(row.status || '')}</td><td>{String(row.count || '')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {page === 'advanced' ? (
          <div className="card">
            <h2>Advanced — implemented, not enabled</h2>
            <p>Flags default off. Firestore remains identity SoR. One resolveCommandReply.</p>
            <table>
              <thead><tr><th>Control</th><th>Flag</th><th>Live</th><th></th></tr></thead>
              <tbody>
                <tr>
                  <td>Second HMAC process</td>
                  <td>LINE_SECOND_WEBHOOK</td>
                  <td>{String(Boolean(flags.LINE_SECOND_WEBHOOK))}</td>
                  <td><button type="button" disabled>Enable</button></td>
                </tr>
                <tr>
                  <td>Mongo users / Odoo SoR</td>
                  <td>MONGO_USERS</td>
                  <td>{String(Boolean(flags.MONGO_USERS))}</td>
                  <td><button type="button" disabled>Enable</button></td>
                </tr>
                <tr>
                  <td>GraphQL LINE ingest</td>
                  <td>GRAPHQL_LINE_INGEST</td>
                  <td>{String(Boolean(flags.GRAPHQL_LINE_INGEST))}</td>
                  <td><button type="button" disabled>Enable</button></td>
                </tr>
                <tr>
                  <td>Group rooms</td>
                  <td>LINE_GROUP_ROOMS</td>
                  <td>{String(Boolean(flags.LINE_GROUP_ROOMS))}</td>
                  <td><button type="button" disabled>Enable</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </>
  );
};
