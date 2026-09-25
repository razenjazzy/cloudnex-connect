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

export const App = () => {
  const [path, setPath] = useState(pathOf);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY) || '');
  const [jobsToken, setJobsToken] = useState(() => sessionStorage.getItem(JOBS_TOKEN_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [reveals, setReveals] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [bindUser, setBindUser] = useState('');
  const [bindOtp, setBindOtp] = useState('');
  const [lookup, setLookup] = useState('');
  const [unmasked, setUnmasked] = useState<Record<string, { value: string; until: number }>>({});

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

  const page = useMemo(() => {
    if (path.endsWith('/crm')) return 'crm';
    if (path.endsWith('/settings')) return 'settings';
    if (path.endsWith('/logs') || path.endsWith('/audit')) return 'logs';
    if (path.endsWith('/unmask')) return 'unmask';
    if (path.endsWith('/users')) return 'users';
    if (path.endsWith('/testing') || path.endsWith('/demo')) return 'testing';
    if (path.endsWith('/erp')) return 'erp';
    if (path.endsWith('/jobs')) return 'jobs';
    if (path.endsWith('/setup')) return 'setup';
    if (path.endsWith('/line')) return 'line';
    if (path.endsWith('/privileges')) return 'privileges';
    if (path.endsWith('/platform')) return 'platform';
    return 'home';
  }, [path]);

  if (!authed) {
    return (
      <main>
        <div className="card">
          <h1>Cloudnex Connect Admin</h1>
          <p>OPS token required. Super-admin secret reveal needs a LINE bind after sign-in.</p>
          <form className="row" onSubmit={login}>
            <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="OPS_API_TOKEN" autoComplete="off" />
            <button type="submit">Sign in</button>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </main>
    );
  }

  const rows = (settings?.settings as Array<{ key: string; kind: string; set: boolean; value?: string }> | undefined) || [];
  const webhooks = (settings?.webhooks as Record<string, string> | undefined) || {};

  return (
    <>
      <header>
        <strong>Cloudnex Connect</strong>
        <a className={page === 'home' ? 'active' : ''} href="/admin" onClick={e => { e.preventDefault(); go('/admin'); }}>Home</a>
        <a className={page === 'settings' ? 'active' : ''} href="/admin/settings" onClick={e => { e.preventDefault(); go('/admin/settings'); }}>Settings</a>
        <a className={page === 'crm' ? 'active' : ''} href="/admin/crm" onClick={e => { e.preventDefault(); go('/admin/crm'); }}>CRM</a>
        <a className={page === 'users' ? 'active' : ''} href="/admin/users" onClick={e => { e.preventDefault(); go('/admin/users'); }}>Users</a>
        <a className={page === 'logs' ? 'active' : ''} href="/admin/logs" onClick={e => { e.preventDefault(); go('/admin/logs'); }}>Logs</a>
        <a className={page === 'unmask' ? 'active' : ''} href="/admin/unmask" onClick={e => { e.preventDefault(); go('/admin/unmask'); }}>Unmask log</a>
        <a className={page === 'testing' ? 'active' : ''} href="/admin/testing" onClick={e => { e.preventDefault(); go('/admin/testing'); }}>Testing</a>
        <button className="secondary" type="button" onClick={() => { sessionStorage.removeItem(TOKEN_KEY); setAuthed(false); }}>Sign out</button>
      </header>
      <main>
        {error ? <p className="error">{error}</p> : null}
        {page === 'home' ? (
          <div className="card">
            <h2>Cloudnex Connect Admin</h2>
            <p>LINE services and admin share this image. Demo is testing only.</p>
            <div className="row">
              <button type="button" onClick={() => go('/admin/settings')}>Settings</button>
              <button type="button" onClick={() => go('/admin/crm')}>CRM</button>
              <button type="button" onClick={() => go('/admin/testing')}>Testing</button>
              <button type="button" onClick={() => go('/admin/platform')}>Platform</button>
            </div>
            <p>Bind LINE (super admin):</p>
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
              }}>Confirm</button>
            </div>
          </div>
        ) : null}
        {page === 'settings' ? (
          <div className="card">
            <h2>Settings</h2>
            <p>Credentials stay masked except a timed reveal. Webhooks:</p>
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
          </div>
        ) : null}
        {page === 'crm' ? (
          <div className="card">
            <h2>CRM quotes</h2>
            <button type="button" onClick={async () => {
              const res = await api('/admin/crm/quotes?unassigned=1');
              const body = await res.json() as { quotes?: Quote[] };
              setQuotes(body.quotes || []);
            }}>Load unassigned</button>
            <table>
              <thead><tr><th>Order</th><th>State</th><th>Partner</th><th>Salesperson</th></tr></thead>
              <tbody>
                {quotes.map(q => (
                  <tr key={q.id}><td>{q.name}</td><td>{q.state}</td><td>{q.partnerName || '—'}</td><td>{q.salespersonName || 'unassigned'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {page === 'users' ? (
          <div className="card">
            <h2>Users</h2>
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
            <pre>{JSON.stringify(users, null, 2)}</pre>
          </div>
        ) : null}
        {page === 'logs' ? (
          <div className="card">
            <h2>Ops audit (no secrets, no unmask events)</h2>
            <button type="button" onClick={async () => {
              const res = await api('/admin/api/audit-log?limit=50');
              const body = await res.json() as { events?: Array<Record<string, unknown>> };
              setLogs(body.events || []);
            }}>Load</button>
            <pre>{JSON.stringify(logs, null, 2)}</pre>
          </div>
        ) : null}
        {page === 'unmask' ? (
          <div className="card">
            <h2>Unmask log (super admin)</h2>
            <button type="button" onClick={async () => {
              const res = await api('/admin/api/audit-log/reveals?limit=50');
              const body = await res.json() as { events?: Array<Record<string, unknown>>; error?: string };
              if (!res.ok) setError(body.error || 'Forbidden');
              setReveals(body.events || []);
            }}>Load</button>
            <pre>{JSON.stringify(reveals, null, 2)}</pre>
          </div>
        ) : null}
        {page === 'testing' ? (
          <div className="card">
            <h2>Testing (Demo)</h2>
            <p>Admin testing only. Off when APP_ENV=production. Same resolveCommandReply as LINE.</p>
            <p><a href="/demo">Open /demo</a></p>
          </div>
        ) : null}
        {page === 'erp' || page === 'platform' ? (
          <div className="card">
            <h2>ERP / platform</h2>
            <button type="button" onClick={() => void loadSettings()}>Refresh settings</button>
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
        {page === 'setup' || page === 'line' || page === 'privileges' ? (
          <div className="card">
            <h2>{page}</h2>
            <p>Use Settings for LINE/ERP keys (masked). Privileges: ADMIN_USER_ID allowlist is fail-closed.</p>
            <button type="button" onClick={() => go('/admin/settings')}>Open settings</button>
          </div>
        ) : null}
      </main>
    </>
  );
};
