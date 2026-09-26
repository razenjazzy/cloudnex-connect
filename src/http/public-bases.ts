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

const joinSitePath = (leaf: string, publicBaseUrl?: string): string => {
  const prefix = pathFromPublicBaseUrl(publicBaseUrl);
  const path = normalizeBase(leaf, leaf);
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) return path;
  return `${prefix}${path}` || path;
};

/**
 * HTTP mount for Admin. Env stays `PUBLIC_ADMIN_BASE=/admin`.
 * With PUBLIC_BASE_URL=https://amardhaka.io/cloudnex-connect this is `/cloudnex-connect/admin`.
 */
export const adminPublicPath = (publicBaseUrl: string | undefined = process.env.PUBLIC_BASE_URL): string =>
  joinSitePath(normalizeBase(process.env.PUBLIC_ADMIN_BASE, '/admin'), publicBaseUrl);

export const demoPublicPath = (publicBaseUrl: string | undefined = process.env.PUBLIC_BASE_URL): string =>
  joinSitePath(normalizeBase(process.env.PUBLIC_DEMO_BASE, '/demo'), publicBaseUrl);

export const adminBase = (): string => adminPublicPath();

export const demoBase = (): string => demoPublicPath();

export const adminApiRoot = (): string => `${adminBase()}/api`;

export const adminCookiePath = (): string => adminPublicPath();
