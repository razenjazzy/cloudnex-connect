const stripSlash = (value: string): string => value.replace(/\/+$/, '');

const normalizeBase = (raw: string | undefined, fallback: string): string => {
  const trimmed = (raw || '').trim() || fallback;
  const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const cleaned = stripSlash(withLead);
  return cleaned || fallback;
};

const urlFrom = (raw: string | undefined): URL | null => {
  const value = (raw || '').trim();
  if (!value) return null;
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
};

/** Host origin for HMAC `/webhook*` and `/verify/*`. */
export const originFromPublicBaseUrl = (raw: string | undefined): string => {
  const parsed = urlFrom(raw);
  if (parsed) return parsed.origin;
  return stripSlash((raw || '').trim());
};

/** Path on PUBLIC_BASE_URL (`/cloudnex-connect` on staging). Empty locally. */
export const pathFromPublicBaseUrl = (raw: string | undefined = process.env.PUBLIC_BASE_URL): string => {
  const parsed = urlFrom(raw);
  if (!parsed) return '';
  const path = stripSlash(parsed.pathname);
  return path === '' ? '' : path;
};

/** Origin + site path, no trailing slash. */
export const publicSiteUrl = (raw: string | undefined): string => {
  const origin = originFromPublicBaseUrl(raw);
  const path = pathFromPublicBaseUrl(raw);
  if (!origin) return path;
  return path ? `${origin}${path}` : origin;
};

/** SPA + `/api` prefix. Exact env form: `/admin` (local and VPS). Sibling may set `/cloudnex-connect/admin/test`. */
export const adminBase = (): string => normalizeBase(process.env.PUBLIC_ADMIN_BASE, '/admin');

/** Demo prefix. Exact env form: `/demo`. GET redirects to Admin `/testing` (same UI). */
export const demoBase = (): string => normalizeBase(process.env.PUBLIC_DEMO_BASE, '/demo');

export const adminPublicPath = (publicBaseUrl: string | undefined = process.env.PUBLIC_BASE_URL): string => {
  const prefix = pathFromPublicBaseUrl(publicBaseUrl);
  const admin = adminBase() || '/admin';
  if (prefix && (admin === prefix || admin.startsWith(`${prefix}/`))) return admin;
  return `${prefix}${admin}` || '/admin';
};

export const adminApiRoot = (): string => `${adminBase()}/api`;

export const adminCookiePath = (): string => adminPublicPath();
