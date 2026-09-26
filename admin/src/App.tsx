import { FormEvent, useEffect, useMemo, useState } from 'react';
import logo from './assets/cloudnex-connect.jpeg';
import { DemoPanel } from './DemoPanel';
import { HelpFaq } from './HelpFaq';
import { CommandWork } from './CommandWork';
import { CopyField, FaqItem, Steps, ToastStack, type ToastItem } from './ui';
import { readUiLang, t, writeUiLang, type UiLang } from './i18n';

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
    __PUBLIC_ORIGIN__?: string;
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
  help: 'help',
  admin: 'home',
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

const DEFAULT_ORIGIN = 'http://127.0.0.1:8080';

const isHttpOrigin = (value: string): boolean => /^https?:\/\/.+/i.test(value);

/** Never empty: absolute http(s) origin with no trailing slash. */
const resolveOrigin = (candidate: string): string => {
  const cleaned = (candidate || '').replace(/\/+$/, '');
  if (isHttpOrigin(cleaned)) return cleaned;
  if (typeof window !== 'undefined' && isHttpOrigin(window.location.origin)) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return DEFAULT_ORIGIN;
};

const originPath = (origin: string, path: string): string => {
  const leaf = path.startsWith('/') ? path : `/${path}`;
  return `${resolveOrigin(origin)}${leaf}`;
};

/** Host origin from PUBLIC_BASE_URL (https://amardhaka.io). Health/OpenAPI/webhooks stay here, not under /cloudnex-connect. */
const publicOrigin = (): string => {
  const injected = (typeof window !== 'undefined' ? window.__PUBLIC_ORIGIN__ : '') || '';
  return resolveOrigin(injected);
};

const probeOrigin = (): string => {
  if (typeof window !== 'undefined' && isHttpOrigin(window.location.origin)) {
    return window.location.origin.replace(/\/+$/, '');
  }
  return publicOrigin();
};

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

type NavItem = { id: string; href: string; label: string };
const navGroupsFor = (lang: UiLang): Array<{ id: string; label: string; items: NavItem[] }> => [
  { id: 'home', label: t(lang, 'navHome'), items: [{ id: 'home', href: ADMIN_BASE, label: t(lang, 'navOverview') }] },
  {
    id: 'identity',
    label: t(lang, 'navIdentity'),
    items: [
      { id: 'identity', href: `${ADMIN_BASE}/identity`, label: t(lang, 'navBind') },
      { id: 'users', href: `${ADMIN_BASE}/users`, label: t(lang, 'navDirectory') },
      { id: 'privileges', href: `${ADMIN_BASE}/privileges`, label: t(lang, 'navPrivileges') },
      { id: 'language', href: `${ADMIN_BASE}/language`, label: t(lang, 'navLanguage') },
    ],
  },
  {
    id: 'line',
    label: t(lang, 'navLine'),
    items: [
      { id: 'line', href: `${ADMIN_BASE}/line`, label: t(lang, 'navChannels') },
      { id: 'campaigns', href: `${ADMIN_BASE}/campaigns`, label: t(lang, 'navCampaigns') },
    ],
  },
  {
    id: 'work',
    label: t(lang, 'navWork'),
    items: [
      { id: 'crm', href: `${ADMIN_BASE}/crm`, label: t(lang, 'navCrm') },
      { id: 'commands', href: `${ADMIN_BASE}/commands`, label: t(lang, 'navCommands') },
      { id: 'jobs', href: `${ADMIN_BASE}/jobs`, label: t(lang, 'navJobs') },
    ],
  },
  {
    id: 'platform',
    label: t(lang, 'navPlatform'),
    items: [
      { id: 'settings', href: `${ADMIN_BASE}/settings`, label: t(lang, 'navSettings') },
      { id: 'logs', href: `${ADMIN_BASE}/logs`, label: t(lang, 'navAudit') },
      { id: 'platform', href: `${ADMIN_BASE}/platform`, label: t(lang, 'navErp') },
      { id: 'advanced', href: `${ADMIN_BASE}/advanced`, label: t(lang, 'navAdvanced') },
      { id: 'testing', href: `${ADMIN_BASE}/testing`, label: t(lang, 'navDemo') },
      { id: 'help', href: `${ADMIN_BASE}/help`, label: t(lang, 'navHelp') },
    ],
  },
];

export const App = () => {
  const [uiLang, setUiLang] = useState<UiLang>(() => readUiLang());
  const NAV_GROUPS = useMemo(() => navGroupsFor(uiLang), [uiLang]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toast = (text: string, kind: ToastItem['kind'] = 'error') => {
    const id = Date.now() + Math.random();
    setToasts(list => [...list, { id, kind, text }]);
    window.setTimeout(() => setToasts(list => list.filter(item => item.id !== id)), 5600);
  };
  const [path, setPath] = useState(pathOf);
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY) || '');
  const [jobsToken, setJobsToken] = useState(() => sessionStorage.getItem(JOBS_TOKEN_KEY) || '');
  const [jobOut, setJobOut] = useState('');
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
  const [bindHints, setBindHints] = useState({ adminAllowlistSet: false, superAdminAllowlistSet: false, actorBound: false });
  const [actor, setActor] = useState<string | null>(null);
  const [appEnv, setAppEnv] = useState('—');
  const [campChannel, setCampChannel] = useState('customer');
  const [campClass, setCampClass] = useState('customers_transactional');
  const [campText, setCampText] = useState('');
  const [campTextEn, setCampTextEn] = useState('');
  const [campTextTh, setCampTextTh] = useState('');
  const [campLang, setCampLang] = useState('');
  const [campPreview, setCampPreview] = useState('');
  const [campHistory, setCampHistory] = useState<Array<Record<string, unknown>>>([]);
  const [broadcastConfirm, setBroadcastConfirm] = useState('');
  const [platformSnap, setPlatformSnap] = useState<Record<string, unknown> | null>(null);
  const [healthJson, setHealthJson] = useState('');
  const [readyJson, setReadyJson] = useState('');
  const [openapiJson, setOpenapiJson] = useState('');
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
        const body = await me.json() as {
          appEnv?: string;
          actorUserId?: string | null;
          bind?: { adminAllowlistSet?: boolean; superAdminAllowlistSet?: boolean; actorBound?: boolean };
        };
        setAppEnv(body.appEnv || '—');
        setActor(body.actorUserId || null);
        if (body.bind && typeof body.bind === 'object') {
          const bind = body.bind as { adminAllowlistSet?: boolean; superAdminAllowlistSet?: boolean; actorBound?: boolean };
          setBindHints({
            adminAllowlistSet: Boolean(bind.adminAllowlistSet),
            superAdminAllowlistSet: Boolean(bind.superAdminAllowlistSet),
            actorBound: Boolean(bind.actorBound),
          });
        }
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
    setError('');
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
      const body = await me.json() as {
        appEnv?: string;
        actorUserId?: string | null;
        bind?: { adminAllowlistSet?: boolean; superAdminAllowlistSet?: boolean; actorBound?: boolean };
      };
      setAppEnv(body.appEnv || '—');
      setActor(body.actorUserId || null);
      if (body.bind) {
        setBindHints({
          adminAllowlistSet: Boolean(body.bind.adminAllowlistSet),
          superAdminAllowlistSet: Boolean(body.bind.superAdminAllowlistSet),
          actorBound: Boolean(body.bind.actorBound),
        });
      }
    }
  };

  const prettyJson = async (res: Response): Promise<string> => {
    const text = await res.text();
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text || String(res.status);
    }
  };

  const loadOverviewProbes = async () => {
    const healthUrl = originPath(probeOrigin(), '/healthz');
    const readyUrl = originPath(probeOrigin(), '/readyz');
    const docsUrl = originPath(probeOrigin(), '/api-docs.json');
    const h = await fetch(healthUrl);
    setHealth(String(h.status));
    setHealthJson(await prettyJson(h));
    const r = await fetch(readyUrl);
    setReady(String(r.status));
    setReadyJson(await prettyJson(r));
    const docs = await api(docsUrl);
    setOpenapiJson(await prettyJson(docs));
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
    ...(campLang === 'en' || campLang === 'th' ? { language: campLang } : {}),
    textEn: campTextEn,
    textTh: campTextTh,
    text: campTextEn || campTextTh || campText,
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
        await loadOverviewProbes();
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
        if (actor) {
          const revealsRes = await api(`${ADMIN_BASE}/api/audit-log/reveals?limit=50`);
          if (revealsRes.ok) {
            const body = await revealsRes.json() as { events?: Array<Record<string, unknown>> };
            setReveals(body.events || []);
          }
        } else {
          setReveals([]);
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
      if (page === 'identity' || page === 'help') {
        await loadSettings();
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
        const usersRes = await api(`${ADMIN_BASE}/api/users?sales=1`);
        if (usersRes.ok) {
          const body = await usersRes.json() as { users?: Array<Record<string, unknown>> };
          setUsers(body.users || []);
        }
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

  const hostOrigin = probeOrigin();
  const lineLoginCallback = `${hostOrigin}${ADMIN_BASE}/api/session/line/callback`;
  const oidcCallback = `${hostOrigin}${ADMIN_BASE}/api/session/oidc/callback`;
  const samlAcs = `${hostOrigin}${ADMIN_BASE}/api/session/saml/acs`;
  const helpFaq = (
    <HelpFaq
      hostOrigin={hostOrigin}
      adminBase={ADMIN_BASE}
      lineLoginCallback={lineLoginCallback}
      oidcCallback={oidcCallback}
      samlAcs={samlAcs}
      idp={idp || undefined}
      showStartLinks
    />
  );

  if (!authed) {
    return (
      <>
        <header>
          <a className="brand" href={ADMIN_BASE} onClick={e => { e.preventDefault(); go(ADMIN_BASE); }}>
            <img src={logo} alt="" />
            <span className="brand-name">Cloudnex Connect</span>
          </a>
          <div className="header-end">
            <nav>
              <a
                className={page === 'help' ? 'active' : ''}
                href={`${ADMIN_BASE}/help`}
                onClick={e => { e.preventDefault(); go(`${ADMIN_BASE}/help`); }}
              >{t(uiLang, 'navHelp')}</a>
            </nav>
          </div>
        </header>
        {page === 'help' ? (
          <main>
            <div className="card">
              <h2>Help</h2>
              {helpFaq}
            </div>
          </main>
        ) : (
          <main className="login-page">
            <div className="card login-card">
              <h1>Admin</h1>
              <p className="page-lead">OPS token to enter. Super-admin bind is Identity after sign-in.</p>
              <form className="field-row" onSubmit={login}>
                <div className="field">
                  <label htmlFor="ops-token">OPS token</label>
                  <input id="ops-token" type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="OPS_API_TOKEN" autoComplete="off" />
                </div>
                <button type="submit">{t(uiLang, 'signIn')}</button>
              </form>
              {error ? <p className="error">{error}</p> : null}
            </div>
          </main>
        )}
      </>
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
          <button className="nav-hamburger" type="button" aria-label="Open menu" aria-expanded={navOpen} onClick={() => setNavOpen(open => !open)}>
            <span className="nav-hamburger-icon" aria-hidden="true"><span /><span /><span /></span>
          </button>
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
          }}>{t(uiLang, 'signOut')}</button>
        </div>
      </header>
      <ToastStack items={toasts} onDismiss={id => setToasts(list => list.filter(item => item.id !== id))} />
      <main>
        {error ? <p className="error">{error}</p> : null}
        {(page === 'campaigns' || page === 'settings') && !actor ? (
          <p className="warn">
            Campaigns and secret reveal need a bound super-admin cookie. Open <a href={`${ADMIN_BASE}/identity`} onClick={e => { e.preventDefault(); go(`${ADMIN_BASE}/identity`); }}>Identity → Bind</a>, set the VPS allowlists, then OTP from Cloudnex Sales. LINE Login is optional.
          </p>
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
            <p className="page-lead">HMAC LINE inbound. Demo is testing only. Lock: {String(settings?.lock)}</p>
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
                  await loadOverviewProbes();
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
              </div>
              <h3>Host probes</h3>
              <CopyField
                label="GET /healthz"
                url={originPath(publicOrigin(), '/healthz')}
                src={originPath(probeOrigin(), '/healthz')}
                value={healthJson || `HTTP ${health || '—'}`}
              />
              <CopyField
                label="GET /readyz"
                url={originPath(publicOrigin(), '/readyz')}
                src={originPath(probeOrigin(), '/readyz')}
                value={readyJson || `HTTP ${ready || '—'}`}
              />
              <CopyField
                label="GET /api-docs.json"
                url={originPath(publicOrigin(), '/api-docs.json')}
                value={openapiJson || 'Not loaded.'}
                load={() => api(originPath(probeOrigin(), '/api-docs.json')).then(prettyJson)}
              />
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
        {page === 'help' ? (
          <div className="card">
            <h2>Help</h2>
            {helpFaq}
          </div>
        ) : null}
        {page === 'identity' ? (
          <div className="card">
            <h2>Bind</h2>
            <p className="page-lead">LINE id → profile → odooVerified → ADMIN_USER_ID | SUPER_ADMIN_USER_IDS. Actor is a LINE user id, not an Odoo login.</p>
            <div className="status-grid">
              <div className={`status-cell ${bindHints.adminAllowlistSet ? 'on' : 'off'}`}>
                <span className="status-dot" aria-hidden="true" />
                <span className="status-label">ADMIN_USER_ID</span>
                <span className="status-value">{bindHints.adminAllowlistSet ? 'set' : 'unset on VPS'}</span>
              </div>
              <div className={`status-cell ${bindHints.superAdminAllowlistSet ? 'on' : 'off'}`}>
                <span className="status-dot" aria-hidden="true" />
                <span className="status-label">SUPER_ADMIN_USER_IDS</span>
                <span className="status-value">{bindHints.superAdminAllowlistSet ? 'overlap set' : 'unset / no overlap'}</span>
              </div>
              <div className={`status-cell ${actor ? 'on' : 'off'}`}>
                <span className="status-dot" aria-hidden="true" />
                <span className="status-label">Actor cookie</span>
                <span className="status-value">{actor ? 'bound' : 'not bound'}</span>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>LINE user id</label>
                <input value={bindUser} onChange={e => setBindUser(e.target.value)} placeholder="U…" />
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
            {actor ? <CopyField label="Bound LINE user id" value={actor} /> : null}
            <FaqItem title="How to bind">
              <Steps items={[
                <>OPS token is not the super-admin bind.</>,
                <>VPS <code>/opt/cloudnex-connect/.env</code>: same Sales LINE id on <code>ADMIN_USER_ID</code> and <code>SUPER_ADMIN_USER_IDS</code>, then recreate the container.</>,
                <>In LINE, VERIFY on Cloudnex Sales so the profile is <code>odooVerified</code>.</>,
                <>Paste that <code>U…</code>, Send code, enter the OTP from Sales.</>,
                <>LINE Login / Okta / SAML are optional. URLs are under Help.</>,
              ]} />
            </FaqItem>
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
                    <td>{row.kind === 'secret' && row.set ? <button type="button" disabled={!actor} onClick={() => void reveal(row.key)}>Reveal</button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <h3>Unmask log</h3>
            {!actor ? <p className="muted">Super-admin bind required. Secret reveal audit stays closed until Identity → Bind.</p> : null}
            <button type="button" disabled={!actor} onClick={async () => {
              const res = await api(`${ADMIN_BASE}/api/audit-log/reveals?limit=50`);
              const body = await res.json() as { events?: Array<Record<string, unknown>>; error?: string };
              if (!res.ok) {
                toast(body.error || t(uiLang, 'toastForbidden'));
                return;
              }
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
          <>
          <div className="card">
            <h2>{t(uiLang, 'uiLanguage')}</h2>
            <p className="page-lead">EN/TH for Admin chrome (nav, toasts). LINE chat language stays on the user profile below.</p>
            <div className="field-row">
              <button type="button" className={uiLang === 'en' ? '' : 'secondary'} onClick={() => { writeUiLang('en'); setUiLang('en'); }}>English</button>
              <button type="button" className={uiLang === 'th' ? '' : 'secondary'} onClick={() => { writeUiLang('th'); setUiLang('th'); }}>ไทย</button>
            </div>
          </div>
          <div className="card">
            <h2>{t(uiLang, 'lineUserLanguage')}</h2>
            <p>LINE replies follow the Firestore profile language (EN/TH). Tray Language toggles it in chat.</p>
            <div className="field-row">
              <div className="field">
                <label>LINE user id</label>
                <input value={langUser} onChange={e => setLangUser(e.target.value)} placeholder="U..." />
              </div>
              <button type="button" onClick={async () => {
                if (!langUser.trim()) return;
                const res = await api(`${ADMIN_BASE}/api/users?userId=${encodeURIComponent(langUser.trim())}`);
                const body = await res.json() as { users?: Array<{ userId?: string; language?: string }>; error?: string };
                if (!res.ok) {
                  toast(body.error || t(uiLang, 'toastUnauthorized'));
                  return;
                }
                const user = body.users?.[0];
                setLangCurrent(String(user?.language || ''));
              }}>Lookup</button>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/users/${encodeURIComponent(langUser)}`, { method: 'PATCH', body: JSON.stringify({ language: 'en' }) });
                if (!res.ok) toast(await readError(res, 'Set English failed'));
                else setLangCurrent('en');
              }}>Set English</button>
              <button type="button" onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/users/${encodeURIComponent(langUser)}`, { method: 'PATCH', body: JSON.stringify({ language: 'th' }) });
                if (!res.ok) toast(await readError(res, 'Set Thai failed'));
                else setLangCurrent('th');
              }}>Set Thai</button>
            </div>
            {langCurrent ? <CopyField label="Current language" value={langCurrent} /> : null}
          </div>
          </>
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
                const patch: Record<string, { enabled: boolean; labelEn?: string; labelTh?: string; roles?: string[]; channels?: string[] }> = {};
                for (const row of commands) {
                  if (typeof row.id === 'string') {
                    patch[row.id] = {
                      enabled: row.enabled !== false,
                      labelEn: String(row.labelEn || ''),
                      labelTh: String(row.labelTh || ''),
                      ...(Array.isArray(row.roles) && row.roles.length ? { roles: row.roles.map(String) } : {}),
                      ...(Array.isArray(row.channels) && row.channels.filter(ch => ch !== 'any').length
                        ? { channels: row.channels.map(String).filter(ch => ch !== 'any') }
                        : {}),
                    };
                  }
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
                <thead><tr><th>On</th><th>Prefix</th><th>EN</th><th>TH</th><th>Category</th><th>Roles</th><th>Channels</th></tr></thead>
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
                      <td>
                        <input value={String(row.labelEn || '')} onChange={e => {
                          const labelEn = e.target.value;
                          setCommands(prev => prev.map(item => item.id === row.id ? { ...item, labelEn } : item));
                        }} />
                      </td>
                      <td>
                        <input value={String(row.labelTh || '')} onChange={e => {
                          const labelTh = e.target.value;
                          setCommands(prev => prev.map(item => item.id === row.id ? { ...item, labelTh } : item));
                        }} />
                      </td>
                      <td>{String(row.category || '')}</td>
                      <td>
                        <input value={Array.isArray(row.roles) ? row.roles.join(',') : ''} onChange={e => {
                          const roles = e.target.value.split(',').map(part => part.trim()).filter(Boolean);
                          setCommands(prev => prev.map(item => item.id === row.id ? { ...item, roles } : item));
                        }} />
                      </td>
                      <td>
                        <input value={Array.isArray(row.channels) ? row.channels.filter(ch => ch !== 'any').join(',') : ''} onChange={e => {
                          const channels = e.target.value.split(',').map(part => part.trim()).filter(Boolean);
                          setCommands(prev => prev.map(item => item.id === row.id ? { ...item, channels } : item));
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {commands.length ? <CopyField label="Command grid JSON" value={JSON.stringify(commands, null, 2)} /> : null}
          </div>
        ) : null}
        {page === 'crm' ? (
          <>
          <CommandWork adminBase={ADMIN_BASE} api={api} actor={actor} uiLang={uiLang} toast={(text, kind) => toast(text, kind === 'ok' ? 'ok' : 'error')} />
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
          </>
        ) : null}
        {page === 'users' ? (
          <div className="card">
            <h2>Directory</h2>
            <p className="page-lead">Paste a LINE user id (<code>U</code> + 32 hex), a phone, or an Odoo partner id. Empty lookup lists verified sales.</p>
            <Steps items={[
              <>Lookup with a LINE id, phone, or partner id, or leave empty for verified sales.</>,
              <>Open Activity for audit rows on that user.</>,
            ]} />
            <div className="field-row">
              <div className="field">
                <label>LINE user id, phone, or partner id</label>
                <input value={lookup} onChange={e => setLookup(e.target.value)} placeholder="U05594… or phone" />
              </div>
              <button type="button" onClick={async () => {
                const raw = lookup.trim();
                const q = !raw ? 'sales=1'
                  : raw.startsWith('U') ? `userId=${encodeURIComponent(raw)}`
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
              <thead><tr><th>LINE</th><th>OA</th><th>Lang</th><th>Verified</th><th>Odoo partner</th><th>Role</th><th>Promo</th><th></th></tr></thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={String(u.userId || i)}>
                    <td>{String(u.userId || '')}</td>
                    <td>{String(u.lastChannelId || '—')}</td>
                    <td>{String(u.language || '')}</td>
                    <td>{String(u.odooVerified)}</td>
                    <td>{String(u.odooPartnerId || '—')}</td>
                    <td>{String(u.commandRole || u.role || '')}</td>
                    <td>{String(u.marketingOptIn)}</td>
                    <td>
                      <button type="button" onClick={async () => {
                        const id = String(u.userId || '');
                        const res = await api(`${ADMIN_BASE}/api/users/${encodeURIComponent(id)}/activity?limit=50`);
                        const body = await res.json() as { events?: Array<Record<string, unknown>> };
                        setActivity(body.events || []);
                        setAuditUser(id);
                      }}>Activity</button>
                      <button type="button" disabled={!actor} onClick={async () => {
                        const res = await api(`${ADMIN_BASE}/api/command`, { method: 'POST', body: JSON.stringify({ text: 'FORM VERIFY', preview: true }) });
                        const body = await res.json() as { error?: string };
                        if (!res.ok) toast(body.error || t(uiLang, 'toastUnauthorized'));
                        else toast(t(uiLang, 'preview'), 'ok');
                      }}>FORM VERIFY</button>
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
          <>
          <div className="card">
            <h2>Privileges</h2>
            <p className="page-lead">Roles from Directory. Admin grant still uses the fail-closed chain.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>LINE user</th><th>Role</th><th>Verified</th></tr></thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={String(u.userId || i)}>
                      <td>{String(u.userId || '')}</td>
                      <td>{String(u.commandRole || u.role || '')}</td>
                      <td>{String(u.odooVerified)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h2>Allowlist</h2>
            {privilegeSnap ? <CopyField label="LINE admin allowlist + chain" value={privilegeSnap} /> : <p className="muted">Loading…</p>}
            <div className="field-row">
              <div className="field">
                <label>Grant LINE admin (verified + allowlisted)</label>
                <input value={grantUser} onChange={e => setGrantUser(e.target.value)} placeholder="U05594…" />
              </div>
              <button type="button" disabled={!actor} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/privileges/enable`, { method: 'POST', body: JSON.stringify({ userId: grantUser.trim() }) });
                if (!res.ok) toast(await readError(res, t(uiLang, 'toastForbidden')));
                else toast('Granted', 'ok');
              }}>Grant role=admin</button>
            </div>
          </div>
          </>
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
        {page === 'testing' ? <DemoPanel adminBase={ADMIN_BASE} api={api} /> : null}
        {page === 'platform' ? (
          <div className="card">
            <h2>ERP / platform</h2>
            <p className="page-lead">ERP adapter status, tenant key, and e-sign/payment probes. Odoo masters stay in Odoo.</p>
            <Steps items={[
              <>Refresh ERP to load adapter status.</>,
              <>Save tenant only when ADMIN_CONFIG_LOCK is off.</>,
            ]} />
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
            {erp ? <CopyField label="ERP probe" value={erp} /> : null}
            {erpStatus ? <CopyField label="E-sign / payment status" value={erpStatus} /> : null}
            <CopyField label="Platform settings" value={JSON.stringify({ lock: settings?.lock, missingRequired: settings?.missingRequired, capabilities: settings?.capabilities }, null, 2)} />
          </div>
        ) : null}
        {page === 'jobs' ? (
          <>
          <div className="card">
            <h2>Jobs</h2>
            <p className="page-lead">{t(uiLang, 'jobsNeedToken')}</p>
            <div className="field-row">
              <div className="field">
                <label>ADMIN_SECRET_TOKEN</label>
                <input type="password" value={jobsToken} onChange={e => { setJobsToken(e.target.value); sessionStorage.setItem(JOBS_TOKEN_KEY, e.target.value); }} placeholder="ADMIN_SECRET_TOKEN" autoComplete="off" />
              </div>
            </div>
          </div>
          <div className="card">
            <h2>Run</h2>
            <div className="field-row">
              {(['daily-report', 'segmentation', 'seed-odoo'] as const).map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={async () => {
                    const secret = jobsToken.trim();
                    if (secret.length < 16) {
                      toast(t(uiLang, 'toastAdminSecret'));
                      return;
                    }
                    const res = await fetch(`${ADMIN_BASE}/api/jobs/${name}`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { authorization: `Bearer ${secret}` },
                    });
                    const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
                    if (!res.ok) {
                      toast(body.error || t(uiLang, 'toastUnauthorized'));
                      setJobOut('');
                      return;
                    }
                    setJobOut(body.message || `${name} ok`);
                    toast(body.message || `${name} ok`, 'ok');
                  }}
                >{name}</button>
              ))}
            </div>
            {jobOut ? <CopyField label="Last job result" value={jobOut} /> : null}
          </div>
          <div className="card">
            <h2>curl</h2>
            <CopyField
              label="curl (staging)"
              value={`curl -X POST '${hostOrigin}${ADMIN_BASE}/api/jobs/daily-report' -H "Authorization: Bearer $ADMIN_SECRET_TOKEN"`}
            />
          </div>
          </>
        ) : null}
        {page === 'line' ? (
          <div className="card">
            <h2>LINE channels</h2>
            <p className="page-lead">Add another OA. Existing <code>POST /webhook/:channelId</code>. Overlay only when ADMIN_CONFIG_LOCK is off.</p>
            <Steps items={[
              <>Copy the webhook URL for that channel id.</>,
              <>Paste secret and access token, then Save channel.</>,
              <>Set the same URL on the Messaging API channel in LINE Developers.</>,
            ]} />
            {lineForm}
            {channelWebhook ? <CopyField label="New channel webhook" value={channelWebhook} /> : null}
            <CopyField label="Webhooks" value={JSON.stringify(webhooks, null, 2)} />
          </div>
        ) : null}
        {page === 'campaigns' ? (
          <div className="card">
            <h2>{t(uiLang, 'navCampaigns')}</h2>
            <p className="page-lead">{t(uiLang, 'campLead')}</p>
            <Steps items={[
              <>Bind super-admin on Identity if the header pill says not bound.</>,
              <>{t(uiLang, 'transactionalAudience')} / {t(uiLang, 'optedInPromo')} / {t(uiLang, 'allFollowers')}.</>,
              <>Test to yourself, then Send multicast. Do not Broadcast promo.</>,
            ]} />
            {!actor ? <p className="warn">Bind super-admin on Identity first. Campaign send stays disabled until the actor cookie is set.</p> : null}
            <div className="row">
              <select value={campChannel} onChange={e => setCampChannel(e.target.value)}>
                <option value="customer">customer</option>
                <option value="sales">sales</option>
              </select>
              <select value={campClass} onChange={e => setCampClass(e.target.value)}>
                <option value="customers_transactional">{t(uiLang, 'transactionalAudience')}</option>
                <option value="customers_promo">{t(uiLang, 'optedInPromo')}</option>
                <option value="sales_internal">sales internal</option>
              </select>
              <select value={campLang} onChange={e => setCampLang(e.target.value)}>
                <option value="">lang filter off</option>
                <option value="en">en</option>
                <option value="th">th</option>
              </select>
            </div>
            <label>{t(uiLang, 'textEn')}</label>
            <textarea value={campTextEn} onChange={e => { setCampTextEn(e.target.value); setCampText(e.target.value); }} rows={3} style={{ width: '100%' }} />
            <label>{t(uiLang, 'textTh')}</label>
            <textarea value={campTextTh} onChange={e => setCampTextTh(e.target.value)} rows={3} style={{ width: '100%' }} />
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
            <h3>{t(uiLang, 'allFollowers')}</h3>
            <p>Broadcast is one payload (cannot pick EN vs TH per user). Blocked when class is promo — use multicast Send instead.</p>
            <div className="field-row">
              <input value={broadcastConfirm} onChange={e => setBroadcastConfirm(e.target.value)} placeholder="type BROADCAST" disabled={campClass === 'customers_promo'} />
              <button type="button" disabled={!actor || campClass === 'customers_promo'} onClick={async () => {
                const res = await api(`${ADMIN_BASE}/api/campaigns/broadcast`, { method: 'POST', body: JSON.stringify({ channelId: campChannel, audienceType: campClass, text: campTextEn || campTextTh || campText, textEn: campTextEn, textTh: campTextTh, language: campLang || undefined, confirm: broadcastConfirm }) });
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
            <h2>Advanced — fulfillment flags</h2>
            <p>{t(uiLang, 'fulfillment')}</p>
            {Array.isArray(settings?.missingRequired) && (settings.missingRequired as string[]).length
              ? <CopyField label={t(uiLang, 'missingEnv')} value={(settings.missingRequired as string[]).join('\n')} />
              : null}
            <table>
              <thead><tr><th>Control</th><th>Flag</th><th>Live</th></tr></thead>
              <tbody>
                {Object.entries((settings?.optionalFlags as Record<string, boolean> | undefined) || flags).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td><code>{key}</code></td>
                    <td>{String(Boolean(value))}</td>
                  </tr>
                ))}
                <tr>
                  <td>Redis / campaign queue</td>
                  <td>REDIS_URL / queueReady</td>
                  <td>{String(settings?.queueReady !== false)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </>
  );
};
