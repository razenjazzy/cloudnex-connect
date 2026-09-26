import { FormEvent, useEffect, useMemo, useState } from 'react';
import logo from './assets/cloudnex-connect.jpeg';

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

declare global {
  interface Window {
    __ADMIN_BASE__?: string;
    __DEMO_BASE__?: string;
  }
}

/** Last path segment → SPA page id. Aliases share a page. */
const PAGE_BY_LEAF: Record<string, string> = {
  identity: 'identity',
  users: 'users',
  directory: 'users',
  privileges: 'privileges',
  language: 'language',
  line: 'line',
  campaigns: 'campaigns',
  crm: 'crm',
  commands: 'commands',
  jobs: 'jobs',
  settings: 'settings',
  security: 'settings',
  unmask: 'settings',
  setup: 'settings',
  logs: 'logs',
  audit: 'logs',
  platform: 'platform',
  erp: 'platform',
  advanced: 'advanced',
  testing: 'testing',
  demo: 'testing',
};

const ADMIN_PAGE_LEAVES = new Set(Object.keys(PAGE_BY_LEAF));

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const adminBaseFromPathname = (pathname: string): string => {
  const cleaned = stripTrailingSlash(pathname || '') || '/admin';
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 0) return '/admin';
  if (ADMIN_PAGE_LEAVES.has(parts[parts.length - 1])) parts.pop();
  return parts.length ? `/${parts.join('/')}` : '/admin';
};

const ADMIN_BASE = (() => {
  if (typeof window === 'undefined') return '/admin';
  if (window.__ADMIN_BASE__) return stripTrailingSlash(window.__ADMIN_BASE__) || '/admin';
  const href = document.querySelector('base')?.getAttribute('href');
  if (href && href !== './') {
    try {
      const path = new URL(href, window.location.origin).pathname;
      const fromBase = stripTrailingSlash(path);
      if (fromBase) return fromBase;
    } catch {
      const fromBase = stripTrailingSlash(href);
      if (fromBase) return fromBase;
    }
  }
  return adminBaseFromPathname(window.location.pathname);
})();

const DEMO_BASE = typeof window !== 'undefined' && window.__DEMO_BASE__
  ? window.__DEMO_BASE__.replace(/\/$/, '')
  : '/demo';

const pathOf = (): string => {
  const raw = window.location.pathname.replace(/\/$/, '') || ADMIN_BASE;
  return raw.startsWith(ADMIN_BASE) ? raw : ADMIN_BASE;
};

const VOLUME_SERIES = [
  { key: 'sales' as const, label: 'Sales OA', color: '#0f6e62' },
  { key: 'customer' as const, label: 'Customer OA', color: '#1a6f9a' },
  { key: 'other' as const, label: 'Unscoped', color: '#8a6a2a' },
];

type ChannelCounts = { sales: number; customer: number; other: number; total: number };
type TrafficSnap = {
  windowSeconds: number;
  activeUsers: ChannelCounts;
  messages: ChannelCounts;
  hourly: Array<{ hour: string; sales: number; customer: number; other: number; total: number }>;
};
type IdpStatus = {
  lineLogin?: boolean;
  oktaOidc?: boolean;
  saml?: boolean;
  callbacks?: { lineLogin?: string; oidc?: string; samlAcs?: string };
};

const emptyCounts = (): ChannelCounts => ({ sales: 0, customer: 0, other: 0, total: 0 });

const ColumnChart = ({
  buckets,
  unit,
  empty,
}: {
  buckets: ChannelCounts;
  unit: string;
  empty: string;
}) => {
  const max = Math.max(buckets.sales, buckets.customer, buckets.other, 0);
  const width = 360;
  const height = 200;
  const padL = 36;
  const padR = 12;
  const padT = 22;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const ticks = 4;
  const scaleMax = max <= 0 ? 1 : max;
  const plotted = VOLUME_SERIES.filter(series => buckets[series.key] > 0);
  const slot = plotted.length ? innerW / plotted.length : innerW;
  const barW = slot * 0.55;

  if (max === 0) {
    return <div className="chart-empty"><p>{empty}</p></div>;
  }

  return (
    <div className="chart-wrap">
      <svg className="volume-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${unit} by LINE Official Account`}>
        <text x={12} y={14} fontSize="10" fill="#3d5551">{unit}</text>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const t = i / ticks;
          const y = padT + innerH * (1 - t);
          const val = Math.round(scaleMax * t);
          return (
            <g key={i}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#e6eeec" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#3d5551">{val}</text>
            </g>
          );
        })}
        {plotted.map((series, i) => {
          const value = buckets[series.key];
          const barH = Math.max((value / scaleMax) * innerH, 2);
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + innerH - barH;
          return (
            <g key={series.key}>
              <rect x={x} y={y} width={barW} height={barH} rx="4" fill={series.color} />
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="650" fill="#102a27">{value}</text>
              <text x={x + barW / 2} y={height - 12} textAnchor="middle" fontSize="11" fill="#3d5551">{series.label}</text>
            </g>
          );
        })}
      </svg>
      <table className="chart-legend">
        <thead><tr><th>Channel</th><th>{unit}</th><th>Share</th></tr></thead>
        <tbody>
          {VOLUME_SERIES.map(series => {
            const value = buckets[series.key];
            const share = buckets.total ? Math.round((value / buckets.total) * 100) : 0;
            return (
              <tr key={series.key}>
                <td><span className="legend-swatch" style={{ background: series.color }} />{series.label}</td>
                <td>{value}</td>
                <td>{share}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const HourlyChart = ({ rows }: { rows: TrafficSnap['hourly'] }) => {
  const max = Math.max(0, ...rows.map(row => row.total));
  const width = 420;
  const height = 160;
  const padL = 28;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const slot = innerW / rows.length;
  const barW = slot * 0.7;
  if (max === 0) {
    return <div className="chart-empty"><p>No inbound LINE messages in the last 12 hours on this process. Hourly columns appear after users chat.</p></div>;
  }
  return (
    <svg className="volume-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Inbound messages last 12 hours">
      {rows.map((row, i) => {
        const x = padL + slot * i + (slot - barW) / 2;
        let y = padT + innerH;
        return (
          <g key={`${row.hour}-${i}`}>
            {VOLUME_SERIES.map(series => {
              const value = row[series.key];
              if (!value) return null;
              const h = (value / max) * innerH;
              y -= h;
              return <rect key={series.key} x={x} y={y} width={barW} height={h} fill={series.color} />;
            })}
            {i % 2 === 0 ? <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="9" fill="#3d5551">{row.hour}</text> : null}
          </g>
        );
      })}
    </svg>
  );
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

const readError = async (res: Response, fallback: string): Promise<string> => {
  try {
    const body = await res.json() as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
};

const parseDash = (body: {
  traffic?: Partial<TrafficSnap>;
  flags?: Record<string, unknown>;
  actorBound?: boolean;
}) => ({
  traffic: {
    windowSeconds: Number(body.traffic?.windowSeconds) || 3600,
    activeUsers: { ...emptyCounts(), ...(body.traffic?.activeUsers || {}) },
    messages: { ...emptyCounts(), ...(body.traffic?.messages || {}) },
    hourly: Array.isArray(body.traffic?.hourly) ? body.traffic!.hourly : [],
  } as TrafficSnap,
  flags: body.flags || {},
  actorBound: Boolean(body.actorBound),
});

const CopyField = ({ label, value }: { label: string; value: string }) => (
  <div className="snippet">
    <div className="snippet-bar">
      <span>{label}</span>
      <button type="button" className="copy" onClick={() => void navigator.clipboard.writeText(value)}>Copy</button>
    </div>
    <pre><code>{value}</code></pre>
  </div>
);

type NavItem = { id: string; href: string; label: string };
const NAV_GROUPS: Array<{ id: string; label: string; items: NavItem[] }> = [
  { id: 'home', label: 'Home', items: [{ id: 'home', href: ADMIN_BASE, label: 'Overview' }] },
  {
    id: 'identity',
    label: 'Identity',
    items: [
      { id: 'identity', href: `${ADMIN_BASE}/identity`, label: 'Bind' },
      { id: 'users', href: `${ADMIN_BASE}/users`, label: 'Directory' },
      { id: 'privileges', href: `${ADMIN_BASE}/privileges`, label: 'Privileges' },
      { id: 'language', href: `${ADMIN_BASE}/language`, label: 'Language' },
    ],
  },
  {
    id: 'line',
    label: 'LINE',
    items: [
      { id: 'line', href: `${ADMIN_BASE}/line`, label: 'Channels' },
      { id: 'campaigns', href: `${ADMIN_BASE}/campaigns`, label: 'Campaigns' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      { id: 'crm', href: `${ADMIN_BASE}/crm`, label: 'CRM' },
      { id: 'commands', href: `${ADMIN_BASE}/commands`, label: 'Commands' },
      { id: 'jobs', href: `${ADMIN_BASE}/jobs`, label: 'Jobs' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'settings', href: `${ADMIN_BASE}/settings`, label: 'Settings' },
      { id: 'logs', href: `${ADMIN_BASE}/logs`, label: 'Audit' },
      { id: 'platform', href: `${ADMIN_BASE}/platform`, label: 'ERP' },
      { id: 'advanced', href: `${ADMIN_BASE}/advanced`, label: 'Advanced' },
    ],
  },
  { id: 'testing', label: 'Testing', items: [{ id: 'testing', href: `${ADMIN_BASE}/testing`, label: 'Demo' }] },
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
  const [platformSnap, setPlatformSnap] = useState<Record<string, unknown> | null>(null);
  const [commands, setCommands] = useState<Array<Record<string, unknown>>>([]);
  const [toggles, setToggles] = useState<Array<{ key: string; effective: boolean; source: string }>>([]);
  const [langUser, setLangUser] = useState('');
  const [langCurrent, setLangCurrent] = useState('');
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [auditUser, setAuditUser] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [grantUser, setGrantUser] = useState('');
  const [privilegeSnap, setPrivilegeSnap] = useState('');
  const [tenantKey, setTenantKey] = useState('default');
  const [erpStatus, setErpStatus] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [dash, setDash] = useState<{
    traffic: TrafficSnap;
    flags: Record<string, unknown>;
    actorBound: boolean;
  } | null>(null);
  const [idp, setIdp] = useState<IdpStatus | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${ADMIN_BASE}/api/session/idp`);
      if (res.ok) setIdp(await res.json() as IdpStatus);
    })();
  }, []);

  useEffect(() => {
    const onPop = () => setPath(pathOf());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const existing = sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY);
    if (!existing) return;
    void (async () => {
      const res = await api(`${ADMIN_BASE}/api/settings`);
      if (res.status === 401) return;
      setAuthed(true);
      if (res.ok) {
        const body = await res.json() as Record<string, unknown>;
        setSettings(body);
        if (body.idp && typeof body.idp === 'object') setIdp(body.idp as IdpStatus);
      }
      const me = await api(`${ADMIN_BASE}/api/session/me`);
      if (me.ok) {
        const body = await me.json() as { appEnv?: string; actorUserId?: string | null };
        setAppEnv(body.appEnv || '—');
        setActor(body.actorUserId || null);
      }
    })();
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
    const res = await api(`${ADMIN_BASE}/api/settings`);
    if (res.status === 401) {
      setAuthed(false);
      setError('Unauthorized');
      return;
    }
    setAuthed(true);
    setError('');
    await loadSettings();
  };

  const loadSettings = async () => {
    const res = await api(`${ADMIN_BASE}/api/settings`);
    if (res.ok) setSettings(await res.json());
    const me = await api(`${ADMIN_BASE}/api/session/me`);
    if (me.ok) {
      const body = await me.json() as { appEnv?: string; actorUserId?: string | null };
      setAppEnv(body.appEnv || '—');
      setActor(body.actorUserId || null);
    }
  };

  const reveal = async (secretKey: string) => {
    const issued = await api(`${ADMIN_BASE}/api/secrets/reveal-token`, { method: 'POST', body: JSON.stringify({ secretKey }) });
    const issuedBody = await issued.json() as { token?: string; expiresInSec?: number; error?: string };
    if (!issued.ok || !issuedBody.token) {
      setError(issuedBody.error || 'Reveal denied');
      return;
    }
    const shown = await api(`${ADMIN_BASE}/api/secrets/reveal`, { method: 'POST', body: JSON.stringify({ token: issuedBody.token }) });
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
    const res = await api(`${ADMIN_BASE}/api/line-channels`, {
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
    const normalized = path.replace(/\/+$/, '') || ADMIN_BASE;
    if (normalized === ADMIN_BASE) return 'home';
    const leaf = normalized.split('/').filter(Boolean).pop() || '';
    return PAGE_BY_LEAF[leaf] || 'home';
  }, [path]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNavOpen(false);
        setOpenGroup(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      const node = event.target as Node | null;
      if (node instanceof Element && node.closest('.nav-dropdown')) return;
      setOpenGroup(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!authed) return;
    void (async () => {
      if (page === 'home') {
        const h = await fetch('/healthz');
        setHealth(`${h.status}`);
        const r = await fetch('/readyz');
        setReady(`${r.status}`);
        const dashRes = await api(`${ADMIN_BASE}/api/dashboard`);
        if (dashRes.ok) setDash(parseDash(await dashRes.json()));
        const plat = await api(`${ADMIN_BASE}/api/platform`);
        if (plat.ok) {
          const body = await plat.json() as { flags?: { redisConfigured?: boolean; appEnv?: string } };
          setPlatformSnap({
            redisConfigured: Boolean(body.flags?.redisConfigured),
            appEnv: body.flags?.appEnv || '—',
          });
        }
        if (actor) {
          const hist = await api(`${ADMIN_BASE}/api/campaigns`);
          if (hist.ok) {
            const body = await hist.json() as { campaigns?: Array<Record<string, unknown>> };
            setCampHistory(body.campaigns || []);
          }
        }
        return;
      }
      if (page === 'settings') {
        await loadSettings();
        const revealsRes = await api(`${ADMIN_BASE}/api/audit-log/reveals?limit=50`);
        if (revealsRes.ok) {
          const body = await revealsRes.json() as { events?: Array<Record<string, unknown>> };
          setReveals(body.events || []);
        }
        const tog = await api(`${ADMIN_BASE}/api/toggles`);
        if (tog.ok) {
          const body = await tog.json() as { toggles?: Array<{ key: string; effective: boolean; source: string }> };
          setToggles(body.toggles || []);
        }
        return;
      }
      if (page === 'commands') {
        const res = await api(`${ADMIN_BASE}/api/commands`);
        if (res.ok) {
          const body = await res.json() as { commands?: Array<Record<string, unknown>>; tenantKey?: string };
          setCommands(body.commands || []);
          if (body.tenantKey) setTenantKey(body.tenantKey);
        }
        return;
      }
      if (page === 'crm') {
        const res = await api(`${ADMIN_BASE}/crm/quotes`);
        if (res.ok) {
          const body = await res.json() as { quotes?: Quote[] };
          setQuotes(body.quotes || []);
        }
        return;
      }
      if (page === 'users') {
        const res = await api(`${ADMIN_BASE}/api/users?sales=1`);
        if (res.ok) {
          const body = await res.json() as { users?: Array<Record<string, unknown>> };
          setUsers(body.users || []);
        }
        return;
      }
      if (page === 'privileges') {
        const res = await api(`${ADMIN_BASE}/api/privileges`);
        if (res.ok) setPrivilegeSnap(JSON.stringify(await res.json(), null, 2));
        return;
      }
      if (page === 'logs') {
        const res = await api(`${ADMIN_BASE}/api/audit-log?limit=50`);
        if (res.ok) {
          const body = await res.json() as { events?: Array<Record<string, unknown>> };
          setLogs(body.events || []);
        }
        return;
      }
      if (page === 'platform') {
        await loadSettings();
        const st = await api(`${ADMIN_BASE}/api/erp/status`);
        if (st.ok) setErpStatus(JSON.stringify(await st.json(), null, 2));
        return;
      }
      if (page === 'campaigns') {
        const res = await api(`${ADMIN_BASE}/api/campaigns`);
        if (res.status === 403) return;
        if (res.ok) {
          const body = await res.json() as { campaigns?: Array<Record<string, unknown>> };
          setCampHistory(body.campaigns || []);
        }
      }
    })();
  }, [authed, page, actor]);

  const idpLinks = (
    <div className="row">
      {idp?.lineLogin
        ? <a href={`${ADMIN_BASE}/api/session/line/start`}>LINE Login</a>
        : <span className="muted">LINE Login off</span>}
      {idp?.oktaOidc
        ? <a href={`${ADMIN_BASE}/api/session/oidc/start`}>Okta OIDC</a>
        : <span className="muted">Okta OIDC off</span>}
      {idp?.saml
        ? <a href={`${ADMIN_BASE}/api/session/saml/start`}>SAML</a>
        : <span className="muted">SAML off</span>}
    </div>
  );

  if (!authed) {
    return (
      <main>
        <div className="card">
          <div className="login-brand">
            <img className="login-logo" src={logo} alt="" />
            <span className="brand-name">Cloudnex Connect</span>
          </div>
          <h1>Admin</h1>
          <p>Sign in with the OPS token first. Super-admin bind uses LINE OTP on Identity. LINE Login and Okta stay off until their env keys are set on the VPS.</p>
          <form className="field-row" onSubmit={login}>
            <div className="field">
              <label htmlFor="ops-token">OPS token</label>
              <input id="ops-token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="OPS_API_TOKEN" autoComplete="off" />
            </div>
            <button type="submit">Sign in</button>
          </form>
          {idpLinks}
          <p className="muted">After OPS sign-in, open Identity. Paste your LINE user id (U…), Send code, then enter the OTP from Cloudnex Sales.</p>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </main>
    );
  }

  const rows = (settings?.settings as Array<{ key: string; kind: string; set: boolean; value?: string }> | undefined) || [];
  const webhooks = (settings?.webhooks as Record<string, string> | undefined) || {};
  const flags = (settings?.optionalFlags as Record<string, boolean> | undefined) || {};

  const lineForm = (
    <form className="field-row" onSubmit={addLineChannel}>
      <div className="field"><label>Channel id</label><input value={channelSlug} onChange={e => setChannelSlug(e.target.value)} placeholder="hr" /></div>
      <div className="field"><label>Channel secret</label><input type="password" value={channelSecret} onChange={e => setChannelSecret(e.target.value)} placeholder="channel secret" autoComplete="off" /></div>
      <div className="field"><label>Access token</label><input type="password" value={channelToken} onChange={e => setChannelToken(e.target.value)} placeholder="access token" autoComplete="off" /></div>
      <div className="field"><label>Services CSV</label><input value={channelServices} onChange={e => setChannelServices(e.target.value)} placeholder="commerce,catalog" /></div>
      <div className="field"><label>Basic ID</label><input value={channelBasicId} onChange={e => setChannelBasicId(e.target.value)} placeholder="@basic-id" /></div>
      <div className="field"><label>Rich menu JSON</label><input value={channelRichMenu} onChange={e => setChannelRichMenu(e.target.value)} placeholder="rich-menu JSON" /></div>
      <button type="submit">Save channel</button>
    </form>
  );

  return (
    <>
      <header>
        <a className="brand" href={ADMIN_BASE} onClick={e => { e.preventDefault(); go(ADMIN_BASE); }}>
          <img src={logo} alt="" />
          <span className="brand-name">Cloudnex Connect</span>
        </a>
        <div className="header-end">
          <div className="header-meta">
            <span className="pill">{String(settings?.appEnv || appEnv)}</span>
            {actor ? <span className="pill">{actor}</span> : <span className="pill">not bound</span>}
          </div>
          <button className="nav-hamburger" type="button" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(open => !open)}>Menu</button>
          {navOpen ? <button type="button" className="nav-backdrop" aria-label="Close menu" onClick={() => setNavOpen(false)} /> : null}
          <nav className={navOpen ? 'open' : ''}>
            {NAV_GROUPS.map(group => {
              const current = group.items.some(item => item.id === page);
              if (group.items.length === 1) {
                const item = group.items[0];
                return (
                  <a
                    key={group.id}
                    className={current ? 'active' : ''}
                    href={item.href}
                    onClick={e => { e.preventDefault(); setNavOpen(false); setOpenGroup(null); go(item.href); }}
                  >{group.label}</a>
                );
              }
              return (
                <div key={group.id} className={`nav-dropdown${openGroup === group.id ? ' open' : ''}${current ? ' current' : ''}`}>
                  <button
                    type="button"
                    className="nav-dropdown-toggle"
                    aria-expanded={openGroup === group.id}
                    aria-haspopup="menu"
                    onClick={() => setOpenGroup(id => id === group.id ? null : group.id)}
                  >{group.label}</button>
                  <div className="nav-dropdown-menu" role="menu">
                    {group.items.map(item => (
                      <a
                        key={item.id}
                        role="menuitem"
                        className={page === item.id ? 'active' : ''}
                        href={item.href}
                        onClick={e => { e.preventDefault(); setNavOpen(false); setOpenGroup(null); go(item.href); }}
                      >{item.label}</a>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <button className="secondary header-signout" type="button" onClick={async () => {
            await api(`${ADMIN_BASE}/api/session/logout`, { method: 'POST' });
            sessionStorage.removeItem(TOKEN_KEY);
            setAuthed(false);
          }}>Sign out</button>
        </div>
      </header>
      <main>
        {error ? <p className="error">{error}</p> : null}
        {(page === 'campaigns' || page === 'settings' || page === 'jobs') && !actor ? (
          <p className="warn">Campaigns and secret reveal need a super-admin LINE bind. Open Identity, confirm OTP or LINE Login, then retry.</p>
        ) : null}
        {page === 'home' ? (() => {
          const probes = dash?.flags || {};
          const traffic = dash?.traffic;
          const active = traffic?.activeUsers || emptyCounts();
          const volume = traffic?.messages || emptyCounts();
          const windowMin = Math.round((traffic?.windowSeconds || 3600) / 60);
          const statusRows = [
            { label: 'App', on: health === '200', detail: health ? `HTTP ${health}` : 'probing' },
            { label: 'Firestore', on: Boolean(probes.firestoreProjectConfigured), detail: Boolean(probes.firestoreProjectConfigured) ? 'project set' : 'off' },
            { label: 'Odoo', on: Boolean(probes.odooConfigured), detail: Boolean(probes.odooConfigured) ? 'configured' : 'off' },
            { label: 'Redis', on: Boolean(probes.redisConfigured), detail: Boolean(probes.redisConfigured) ? 'configured' : 'off' },
            { label: 'LINE', on: Boolean(probes.lineConfigured), detail: Boolean(probes.lineConfigured) ? 'channel set' : 'off' },
            { label: 'Queue', on: Boolean(probes.queueReady), detail: Boolean(probes.queueReady) ? 'ready' : 'off' },
            { label: 'Actor', on: Boolean(dash?.actorBound), detail: dash?.actorBound ? 'bound' : 'unbound' },
          ];
          return (
          <div className="overview-grid">
            <div className="card">
              <h2>Overview</h2>
              <p>HMAC LINE → Firestore → one command router. Demo is testing only. Lock: {String(settings?.lock)}</p>
              <div className="status-grid">
                {statusRows.map(row => (
                  <div key={row.label} className={`status-cell ${row.on ? 'on' : 'off'}`}>
                    <span className="status-dot" aria-hidden="true" />
                    <span className="status-label">{row.label}</span>
                    <span className="status-value">{row.detail}</span>
                  </div>
                ))}
              </div>
              <div className="row">
                <button type="button" onClick={async () => {
                  const h = await fetch('/healthz');
                  setHealth(`${h.status}`);
                  const r = await fetch('/readyz');
                  setReady(`${r.status}`);
                  await loadSettings();
                  const plat = await api(`${ADMIN_BASE}/api/platform`);
                  if (plat.ok) {
                    const body = await plat.json() as { flags?: { redisConfigured?: boolean; appEnv?: string } };
                    setPlatformSnap({
                      redisConfigured: Boolean(body.flags?.redisConfigured),
                      appEnv: body.flags?.appEnv || '—',
                    });
                  }
                  const dashRes = await api(`${ADMIN_BASE}/api/dashboard`);
                  if (dashRes.ok) setDash(parseDash(await dashRes.json()));
                }}>Refresh</button>
                <a href="/healthz">/healthz {health}</a>
                <a href="/readyz">/readyz {ready}</a>
                <a href="/api-docs">OpenAPI</a>
              </div>
              {platformSnap ? <CopyField label="Platform" value={JSON.stringify(platformSnap, null, 2)} /> : null}
            </div>
            <div className="card">
              <h2>LINE traffic</h2>
              <p>Live inbound from Sales and Customer Official Accounts on this process. Not the audit log.</p>
              <div className="kpi-row">
                <div className="kpi"><span className="kpi-value">{active.total}</span><span className="kpi-label">users chatting now ({windowMin} min)</span></div>
                <div className="kpi"><span className="kpi-value">{volume.total}</span><span className="kpi-label">messages since last deploy</span></div>
              </div>
              <h3>Active users</h3>
              <ColumnChart buckets={active} unit="Users" empty="Nobody is chatting on Sales or Customer right now. After a LINE message, that user counts here until idle." />
              <h3>Message volume</h3>
              <ColumnChart buckets={volume} unit="Messages" empty="No inbound LINE text yet on this process. Totals count real webhook messages, not Admin audit rows." />
              <h3>Last 12 hours</h3>
              <HourlyChart rows={traffic?.hourly || []} />
            </div>
          </div>
          );
        })() : null}
        {page === 'identity' ? (
          <div className="card">
            <h2>Identity</h2>
            <ol className="howto">
              <li>Sign in with OPS_API_TOKEN (this page already did that).</li>
              <li>On the VPS <code>/opt/cloudnex-connect/.env</code>, set your LINE id on <code>SUPER_ADMIN_USER_IDS</code> and <code>ADMIN_USER_ID</code>. The same id must be Odoo-verified in Firestore.</li>
              <li>Paste that <code>U…</code> id below, Send code. Cloudnex Sales pushes a 6-digit OTP (you must have talked to the Sales OA at least once).</li>
              <li>Confirm OTP. The header pill shows the bound LINE user id. Campaigns and secret reveal need this cookie.</li>
              <li>LINE Login / Okta are optional. They stay “off” until LINE Developers Login (or Okta) credentials are in that same .env, plus the callback URLs below.</li>
            </ol>
            <p>Fail-closed chain: LINE id → profile → odooVerified → ADMIN_USER_ID → SUPER_ADMIN_USER_IDS. The bound actor is a LINE user id, not an Odoo login.</p>
            {actor ? <CopyField label="Bound LINE user id" value={actor} /> : null}
            {idpLinks}
            {idp?.callbacks?.lineLogin ? <CopyField label="LINE Login callback" value={idp.callbacks.lineLogin} /> : null}
            {idp?.callbacks?.oidc ? <CopyField label="Okta OIDC callback" value={idp.callbacks.oidc} /> : null}
            {idp?.callbacks?.samlAcs ? <CopyField label="SAML ACS" value={idp.callbacks.samlAcs} /> : null}
            <div className="field-row">
              <div className="field">
                <label>LINE user id</label>
                <input value={bindUser} onChange={e => setBindUser(e.target.value)} placeholder="LINE user id" />
              </div>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/session/bind`, { method: 'POST', body: JSON.stringify({ lineUserId: bindUser }) });
                setError(res.ok ? '' : await readError(res, 'Bind failed'));
              }}>Send code</button>
              <div className="field">
                <label>OTP</label>
                <input value={bindOtp} onChange={e => setBindOtp(e.target.value)} placeholder="OTP" />
              </div>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/session/confirm`, { method: 'POST', body: JSON.stringify({ lineUserId: bindUser, otp: bindOtp }) });
                setError(res.ok ? '' : await readError(res, 'Confirm failed'));
                await loadSettings();
              }}>Confirm</button>
            </div>
          </div>
        ) : null}
        {page === 'settings' ? (
          <div className="card">
            <h2>Settings</h2>
            <p>Credentials stay masked except a timed reveal. ADMIN_USER_ID is fail-closed. Service toggles cannot enable a key omitted from env.</p>
            <CopyField label="Webhooks" value={JSON.stringify(webhooks, null, 2)} />
            <button type="button" onClick={() => void loadSettings()}>Refresh</button>
            <div className="table-wrap">
            <table>
              <thead><tr><th>Key</th><th>Value</th><th></th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key}>
                    <td>{row.key}</td>
                    <td>{row.kind === 'secret' ? (unmasked[row.key] ? (
                      <CopyField label={row.key} value={unmasked[row.key].value} />
                    ) : (row.set ? '••••' : '—')) : (
                      row.value ? <CopyField label={row.key} value={row.value} /> : '—'
                    )}</td>
                    <td>{row.kind === 'secret' && row.set ? <button type="button" onClick={() => void reveal(row.key)}>Reveal</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <h3>Unmask log</h3>
            <button type="button" onClick={async () => {
              const res = await api(`${ADMIN_BASE}/api/audit-log/reveals?limit=50`);
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
            <h3>Service toggles</h3>
            <p>Live overrides for commerce, directory, catalog, reporting, groupBuy. Env-forced keys cannot be turned on here.</p>
            <div className="field-row">
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/toggles`);
                const body = await res.json() as { toggles?: Array<{ key: string; effective: boolean; source: string }> };
                setToggles(body.toggles || []);
                setError(res.ok ? '' : 'Could not load toggles');
              }}>Load toggles</button>
              <button type="button" onClick={async () => {
                const patch: Record<string, boolean> = {};
                for (const row of toggles) patch[row.key] = row.effective;
                const res = await api(`${ADMIN_BASE}/api/toggles`, { method: 'PUT', body: JSON.stringify(patch) });
                const body = await res.json() as { toggles?: Array<{ key: string; effective: boolean; source: string }>; error?: string };
                if (!res.ok) setError(body.error || 'Toggle save failed');
                else {
                  setToggles(body.toggles || toggles);
                  setError('');
                }
              }}>Save toggles</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Service</th><th>On</th><th>Source</th></tr></thead>
                <tbody>
                  {toggles.map(row => (
                    <tr key={row.key}>
                      <td>{row.key}</td>
                      <td>
                        <input type="checkbox" checked={row.effective} onChange={e => {
                          const on = e.target.checked;
                          setToggles(prev => prev.map(item => item.key === row.key ? { ...item, effective: on } : item));
                        }} />
                      </td>
                      <td>{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {toggles.length ? <CopyField label="Toggles JSON" value={JSON.stringify(toggles, null, 2)} /> : null}
          </div>
        ) : null}
        {page === 'language' ? (
          <div className="card">
            <h2>Language</h2>
            <p>LINE replies follow the Firestore profile language (EN/TH). Tray Language toggles it in chat. Here you set it for a LINE user id.</p>
            <div className="field-row">
              <div className="field">
                <label>LINE user id</label>
                <input value={langUser} onChange={e => setLangUser(e.target.value)} placeholder="U..." />
              </div>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/users?userId=${encodeURIComponent(langUser)}`);
                const body = await res.json() as { users?: Array<{ userId?: string; language?: string }>; error?: string };
                if (!res.ok) {
                  setError(body.error || 'Lookup failed');
                  return;
                }
                const user = body.users?.[0];
                setLangCurrent(String(user?.language || ''));
                setError('');
              }}>Lookup</button>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/users/${encodeURIComponent(langUser)}`, { method: 'PATCH', body: JSON.stringify({ language: 'en' }) });
                setError(res.ok ? '' : await readError(res, 'Set English failed'));
                if (res.ok) setLangCurrent('en');
              }}>Set English</button>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/users/${encodeURIComponent(langUser)}`, { method: 'PATCH', body: JSON.stringify({ language: 'th' }) });
                setError(res.ok ? '' : await readError(res, 'Set Thai failed'));
                if (res.ok) setLangCurrent('th');
              }}>Set Thai</button>
            </div>
            {langCurrent ? <CopyField label="Current language" value={langCurrent} /> : null}
          </div>
        ) : null}
        {page === 'commands' ? (
          <div className="card">
            <h2>Command config</h2>
            <p>Overlay on <code>command-grid.ts</code>. Cannot invent prefixes. Cannot enable a command whose service is env-disabled. ADMIN CONFIG Flex still toggles channel services; this page is the command overlay.</p>
            <div className="field-row">
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/commands`);
                const body = await res.json() as { commands?: Array<Record<string, unknown>>; tenantKey?: string };
                setCommands(body.commands || []);
                if (body.tenantKey) setTenantKey(body.tenantKey);
                setError(res.ok ? '' : 'Could not load commands');
              }}>Load commands</button>
              <button type="button" onClick={async () => {
                const patch: Record<string, { enabled: boolean }> = {};
                for (const row of commands) {
                  if (typeof row.id === 'string') patch[row.id] = { enabled: row.enabled !== false };
                }
                const res = await api(`${ADMIN_BASE}/api/commands`, { method: 'PUT', body: JSON.stringify({ commands: patch }) });
                const body = await res.json() as { commands?: Array<Record<string, unknown>>; error?: string };
                if (!res.ok) setError(body.error || 'Save failed');
                else {
                  setCommands(body.commands || commands);
                  setError('');
                }
              }}>Save overlay</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>On</th><th>Prefix</th><th>EN / TH</th><th>Category</th><th>Roles</th><th>Channels</th></tr></thead>
                <tbody>
                  {commands.map((row, i) => (
                    <tr key={String(row.id || i)}>
                      <td>
                        <input type="checkbox" checked={row.enabled !== false} onChange={e => {
                          const on = e.target.checked;
                          setCommands(prev => prev.map(item => item.id === row.id ? { ...item, enabled: on } : item));
                        }} />
                      </td>
                      <td><code>{String(row.prefix || '')}</code></td>
                      <td>{String(row.labelEn || '')} / {String(row.labelTh || '')}</td>
                      <td>{String(row.category || '')}</td>
                      <td>{Array.isArray(row.roles) ? row.roles.join(', ') : ''}</td>
                      <td>{Array.isArray(row.channels) ? row.channels.join(', ') : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {commands.length ? <CopyField label="Command grid JSON" value={JSON.stringify(commands, null, 2)} /> : null}
          </div>
        ) : null}
        {page === 'crm' ? (
          <div className="card">
            <h2>CRM quotes</h2>
            <div className="row">
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/crm/quotes?unassigned=1`);
                const body = await res.json() as { quotes?: Quote[] };
                setQuotes(body.quotes || []);
              }}>Unassigned</button>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/crm/quotes`);
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
            <div className="field-row">
              <div className="field">
                <label>Quote id</label>
                <input value={assignId} onChange={e => setAssignId(e.target.value)} placeholder="quote id" />
              </div>
              <div className="field">
                <label>Odoo user id</label>
                <input value={assignSales} onChange={e => setAssignSales(e.target.value)} placeholder="Odoo user id" />
              </div>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/crm/quotes/${assignId}`, { method: 'PUT', body: JSON.stringify({ salespersonUserId: Number(assignSales) }) });
                setError(res.ok ? '' : 'Assign failed');
                if (res.ok) {
                  const list = await api(`${ADMIN_BASE}/crm/quotes`);
                  const body = await list.json() as { quotes?: Quote[] };
                  setQuotes(body.quotes || []);
                }
              }}>Assign</button>
            </div>
          </div>
        ) : null}
        {page === 'users' ? (
          <div className="card">
            <h2>Directory</h2>
            <p>Paste a LINE user id (<code>U</code> + 32 hex), a phone, or an Odoo partner id. This is Firestore identity plus live Odoo <code>res.users</code> groups via the ERP adapter — not a second LINE router.</p>
            <div className="field-row">
              <div className="field">
                <label>LINE user id, phone, or partner id</label>
                <input value={lookup} onChange={e => setLookup(e.target.value)} placeholder="U05594… or phone" />
              </div>
              <button type="button" onClick={async () => {
                const raw = lookup.trim();
                const q = raw.startsWith('U') ? `userId=${encodeURIComponent(raw)}`
                  : /^\d+$/.test(raw) ? `partnerId=${encodeURIComponent(raw)}`
                  : `phone=${encodeURIComponent(raw)}`;
                const res = await api(`${ADMIN_BASE}/api/users?${q}`);
                const body = await res.json() as { users?: Array<Record<string, unknown>>; error?: string };
                setUsers(body.users || []);
                setError(res.ok ? '' : (body.error || 'Lookup failed'));
              }}>Lookup</button>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/users?sales=1`);
                const body = await res.json() as { users?: Array<Record<string, unknown>> };
                setUsers(body.users || []);
              }}>Verified sales</button>
            </div>
            <div className="table-wrap">
            <table>
              <thead><tr><th>LINE user</th><th>Command</th><th>Verified</th><th>Odoo groups</th><th></th></tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={String(u.userId || i)}>
                    <td>{String(u.userId || '')}</td>
                    <td>{String(u.commandRole || u.role || '')}</td>
                    <td>{String(u.odooVerified)}</td>
                    <td>{Array.isArray((u.odooPrivileges as { groups?: string[] } | undefined)?.groups)
                      ? ((u.odooPrivileges as { groups: string[] }).groups.join(', ') || '—')
                      : '—'}</td>
                    <td>
                      <button type="button" onClick={async () => {
                        const id = String(u.userId || '');
                        const res = await api(`${ADMIN_BASE}/api/users/${encodeURIComponent(id)}/activity?limit=50`);
                        const body = await res.json() as { events?: Array<Record<string, unknown>> };
                        setActivity(body.events || []);
                        setAuditUser(id);
                      }}>Activity</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {users[0] ? <CopyField label="User dossier" value={JSON.stringify(users[0], null, 2)} /> : null}
            {activity.length ? (
              <>
                <h3>Activity (actor or target)</h3>
                <table>
                  <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th></tr></thead>
                  <tbody>
                    {activity.map((row, i) => (
                      <tr key={String(row.id || i)}>
                        <td>{String(row.createdAt || '')}</td>
                        <td>{String(row.action || '')}</td>
                        <td>{String(row.actorUserId || '')}</td>
                        <td>{String(row.targetId || '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}
          </div>
        ) : null}
        {page === 'privileges' ? (
          <div className="card">
            <h2>Privileges</h2>
            <p>LINE command role is Firestore <code>role</code> + verification. Admin grant still requires the fail-closed chain. Odoo groups are live from the ERP API on Directory lookup.</p>
            <div className="row">
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/privileges`);
                const body = await res.json() as Record<string, unknown>;
                setPrivilegeSnap(JSON.stringify(body, null, 2));
                setError(res.ok ? '' : 'Privileges load failed');
              }}>Load allowlist</button>
            </div>
            {privilegeSnap ? <CopyField label="LINE admin allowlist + chain" value={privilegeSnap} /> : null}
            <div className="field-row">
              <div className="field">
                <label>Grant LINE admin (verified + allowlisted)</label>
                <input value={grantUser} onChange={e => setGrantUser(e.target.value)} placeholder="U05594…" />
              </div>
              <button type="button" disabled={!actor} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/privileges/enable`, { method: 'POST', body: JSON.stringify({ userId: grantUser.trim() }) });
                setError(res.ok ? '' : await readError(res, 'Grant failed'));
              }}>Grant role=admin</button>
            </div>
          </div>
        ) : null}
        {page === 'logs' ? (
          <div className="card">
            <h2>Ops audit</h2>
            <p>Firestore audit for all users. Filter by LINE id as actor or target. Secret reveals stay on Settings.</p>
            <div className="field-row">
              <div className="field">
                <label>LINE user id</label>
                <input value={auditUser} onChange={e => setAuditUser(e.target.value)} placeholder="U05594… (actor or target)" />
              </div>
              <div className="field">
                <label>Action</label>
                <input value={auditAction} onChange={e => setAuditAction(e.target.value)} placeholder="role_grant" />
              </div>
              <button type="button" onClick={async () => {
                const q = new URLSearchParams({ limit: '50' });
                if (auditUser.trim()) q.set('userId', auditUser.trim());
                if (auditAction.trim()) q.set('action', auditAction.trim());
                const res = await api(`${ADMIN_BASE}/api/audit-log?${q.toString()}`);
                const body = await res.json() as { events?: Array<Record<string, unknown>> };
                setLogs(body.events || []);
              }}>Load</button>
            </div>
            <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Action</th><th>Actor</th><th>Target</th><th>Outcome</th></tr></thead>
              <tbody>
                {logs.map((row, i) => (
                  <tr key={String(row.id || i)}>
                    <td>{String(row.createdAt || '')}</td>
                    <td>{String(row.action || '')}</td>
                    <td>{String(row.actorUserId || '')}</td>
                    <td>{String(row.targetId || '')}</td>
                    <td>{String(row.outcome || '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : null}
        {page === 'testing' ? (
          <div className="card">
            <h2>Testing (Demo)</h2>
            <p>Admin testing only. Off when APP_ENV=production. Same resolveCommandReply as LINE.</p>
            <p><a href={DEMO_BASE}>Open {DEMO_BASE}</a></p>
          </div>
        ) : null}
        {page === 'platform' ? (
          <div className="card">
            <h2>ERP / platform</h2>
            <div className="field-row">
              <div className="field">
                <label>Tenant key</label>
                <input value={tenantKey} onChange={e => setTenantKey(e.target.value)} placeholder="default" />
              </div>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/tenant`, { method: 'PUT', body: JSON.stringify({ tenantKey }) });
                const body = await res.json() as { tenantKey?: string; error?: string };
                if (!res.ok) setError(body.error || 'Tenant save failed (lock?)');
                else {
                  setTenantKey(body.tenantKey || tenantKey);
                  setError('');
                }
              }}>Save tenant</button>
              <button type="button" onClick={async () => {
                await loadSettings();
                const res = await api(`${ADMIN_BASE}/api/erp/test`);
                const body = await res.json() as { erpImplemented?: boolean; erpProvider?: string };
                setErp(res.ok ? JSON.stringify(body) : 'fail');
                const st = await api(`${ADMIN_BASE}/api/erp/status`);
                setErpStatus(JSON.stringify(await st.json(), null, 2));
              }}>Refresh ERP</button>
            </div>
            <p>ERP: {erp || '—'}</p>
            {erpStatus ? <CopyField label="E-sign / payment status" value={erpStatus} /> : null}
            <CopyField label="Platform settings" value={JSON.stringify({ lock: settings?.lock, missingRequired: settings?.missingRequired, capabilities: settings?.capabilities }, null, 2)} />
          </div>
        ) : null}
        {page === 'jobs' ? (
          <div className="card">
            <h2>Jobs</h2>
            <div className="field-row">
              <div className="field">
                <label>ADMIN_SECRET_TOKEN</label>
                <input type="password" value={jobsToken} onChange={e => { setJobsToken(e.target.value); sessionStorage.setItem(JOBS_TOKEN_KEY, e.target.value); }} placeholder="ADMIN_SECRET_TOKEN" />
              </div>
              <button type="button" onClick={async () => {
                const res = await fetch(`${ADMIN_BASE}/api/jobs/daily-report`, { method: 'POST', credentials: 'include', headers: { authorization: `Bearer ${jobsToken}` } });
                setError(res.ok ? '' : 'Job failed');
              }}>Daily report</button>
            </div>
          </div>
        ) : null}
        {page === 'line' ? (
          <div className="card">
            <h2>LINE channels</h2>
            <p>Add another OA. Existing <code>POST /webhook/:channelId</code>. Overlay only when ADMIN_CONFIG_LOCK is off.</p>
            {lineForm}
            {channelWebhook ? <CopyField label="New channel webhook" value={channelWebhook} /> : null}
            <CopyField label="Webhooks" value={JSON.stringify(webhooks, null, 2)} />
          </div>
        ) : null}
        {page === 'campaigns' ? (
          <div className="card">
            <h2>Campaigns</h2>
            <p>Channel → class → message → preview → test → multicast Send. Promo uses Send only (honors PROMO OFF). LINE Broadcast cannot filter opt-out; it is blocked for promo class.</p>
            {!actor ? <p className="error">Bind super-admin on Identity first. Campaign APIs return 403 without the actor cookie.</p> : null}
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
              <button type="button" disabled={!actor} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/campaigns/preview`, { method: 'POST', body: JSON.stringify(campaignBody()) });
                const body = await res.json() as { error?: string };
                setCampPreview(JSON.stringify(body, null, 2));
                setError(res.ok ? '' : (body.error || 'Preview failed'));
              }}>Preview</button>
              <button type="button" disabled={!actor} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/campaigns/test`, { method: 'POST', body: JSON.stringify(campaignBody()) });
                setError(res.ok ? '' : await readError(res, 'Test failed'));
              }}>Test (actor only)</button>
              <button type="button" disabled={!actor || settings?.queueReady === false} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/campaigns/send`, { method: 'POST', body: JSON.stringify({ ...campaignBody(), confirm: 'SEND' }) });
                setError(res.status === 202 || res.ok ? '' : await readError(res, res.status === 503 ? 'Redis required (503)' : 'Send failed'));
              }}>Send multicast</button>
              <button type="button" disabled={!actor} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/campaigns`);
                if (!res.ok) {
                  setError(await readError(res, 'History failed'));
                  return;
                }
                const body = await res.json() as { campaigns?: Array<Record<string, unknown>> };
                setCampHistory(body.campaigns || []);
              }}>History</button>
            </div>
            {campPreview ? <CopyField label="Campaign response" value={campPreview} /> : null}
            <h3>Broadcast (not default)</h3>
            <p>Sends to every OA friend. Blocked when class is promo — use multicast Send instead.</p>
            <div className="field-row">
              <input value={broadcastConfirm} onChange={e => setBroadcastConfirm(e.target.value)} placeholder="type BROADCAST" disabled={campClass === 'customers_promo'} />
              <button type="button" disabled={!actor || campClass === 'customers_promo'} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/campaigns/broadcast`, { method: 'POST', body: JSON.stringify({ channelId: campChannel, audienceType: campClass, text: campText, confirm: broadcastConfirm }) });
                setError(res.ok ? '' : await readError(res, 'Broadcast denied or failed'));
              }}>Broadcast</button>
            </div>
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
