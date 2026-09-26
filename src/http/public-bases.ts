const stripSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizeBase = (raw: string | undefined, fallback: string): string => {
  const trimmed = (raw || '').trim() || fallback;
  const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const cleaned = stripSlash(withLead);
  return cleaned || fallback;
};

/** SPA + `/api` prefix. Default `/admin` (local). VPS: `/cloudnex-connect/admin` or `/cloudnex-connect/admin/test`. */
export const adminBase = (): string => normalizeBase(process.env.PUBLIC_ADMIN_BASE, '/admin');

/** Demo panel prefix. Default `/demo`. VPS: `/cloudnex-connect/demo`. */
export const demoBase = (): string => normalizeBase(process.env.PUBLIC_DEMO_BASE, '/demo');

export const adminApiRoot = (): string => `${adminBase()}/api`;

export const adminCookiePath = (): string => adminBase() || '/admin';
