import { createHmac, createHash, createSign, createVerify, createPublicKey, randomBytes, timingSafeEqual, type KeyObject } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { getPlatformConfig, setPlatformConfig } from './firestore';
import { getRuntime } from './runtime-settings';
import { adminBase, adminCookiePath } from '../http/public-bases';

const STATE_KEY = 'adminOauthStatesV1';
const cookieName = 'cloudnex_admin_oauth';

export const clearOauthStateCookie = (): string =>
  `${cookieName}=; Path=${adminCookiePath()}; HttpOnly; SameSite=Lax; Max-Age=0`;

export type IdpProvider = 'line_login' | 'okta_oidc' | 'saml';

type StateRow = { provider: IdpProvider; verifier: string; expiresAt: number };

let idpFetch: typeof fetch = fetch;

export const setAdminIdpFetchForTests = (fn: typeof fetch | null): void => {
  idpFetch = fn || fetch;
};

const hmacSecret = (): string =>
  process.env.SECRETS_ENCRYPTION_KEY?.trim()
  || process.env.OPS_API_TOKEN?.trim()
  || process.env.CONNECT_BOOTSTRAP_TOKEN?.trim()
  || 'dev-admin-actor';

const pkceChallenge = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url');

export const describeAdminIdp = () => ({
  lineLogin: Boolean(getRuntime('LINE_LOGIN_CHANNEL_ID') && getRuntime('LINE_LOGIN_CHANNEL_SECRET')),
  oktaOidc: Boolean(getRuntime('OKTA_ISSUER') && getRuntime('OKTA_CLIENT_ID') && getRuntime('OKTA_CLIENT_SECRET')),
  saml: Boolean(getRuntime('SAML_IDP_SSO_URL') && getRuntime('SAML_IDP_CERT')),
});

export const publicBase = (): string => getRuntime('PUBLIC_BASE_URL').replace(/\/$/, '');

const callbackUrl = (path: string): string => `${publicBase()}${adminBase()}/api${path}`;

export const mapIdpSubjectToLineUserId = (subject: string, claimValue?: string): string | null => {
  const mappedClaim = (claimValue || '').trim();
  if (mappedClaim.startsWith('U') && mappedClaim.length >= 10) return mappedClaim;
  const raw = getRuntime('OKTA_LINE_USER_MAP');
  if (raw) {
    try {
      const map = JSON.parse(raw) as unknown;
      if (map && typeof map === 'object' && !Array.isArray(map)) {
        const hit = (map as Record<string, unknown>)[subject];
        if (typeof hit === 'string' && hit.trim()) return hit.trim();
      }
    } catch {
      // Malformed OKTA_LINE_USER_MAP must not block LINE-shaped subject fallback.
    }
  }
  const trimmed = subject.trim();
  if (trimmed.startsWith('U') && trimmed.length >= 10) return trimmed;
  return null;
};

export const issueOauthState = async (provider: IdpProvider): Promise<{ state: string; verifier: string; cookie: string }> => {
  const state = randomBytes(24).toString('hex');
  const verifier = randomBytes(32).toString('base64url');
  const stored = (await getPlatformConfig<Record<string, StateRow>>(STATE_KEY)) || {};
  stored[state] = { provider, verifier, expiresAt: Date.now() + 10 * 60 * 1000 };
  await setPlatformConfig(STATE_KEY, stored as unknown as Record<string, unknown>);
  const sig = createHmac('sha256', hmacSecret()).update(state).digest('hex');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = `${cookieName}=${encodeURIComponent(`${state}.${sig}`)}; Path=${adminCookiePath()}; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
  return { state, verifier, cookie };
};

export const consumeOauthState = async (
  state: string,
  cookieHeader: string | undefined,
  provider: IdpProvider,
): Promise<string | null> => {
  if (!state || !cookieHeader) return null;
  const match = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith(`${cookieName}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(cookieName.length + 1));
  const [cookieState, sig] = token.split('.');
  if (cookieState !== state || !sig) return null;
  const expected = createHmac('sha256', hmacSecret()).update(state).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const stored = (await getPlatformConfig<Record<string, StateRow>>(STATE_KEY)) || {};
  const row = stored[state];
  if (!row || row.provider !== provider || row.expiresAt < Date.now()) return null;
  delete stored[state];
  await setPlatformConfig(STATE_KEY, stored as unknown as Record<string, unknown>);
  return row.verifier;
};

const formBody = (params: Record<string, string>): string =>
  Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

export const buildLineAuthorizeUrl = (state: string, verifier: string): string | null => {
  const clientId = getRuntime('LINE_LOGIN_CHANNEL_ID');
  if (!clientId || !publicBase()) return null;
  const url = new URL('https://access.line.me/oauth2/v2.1/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl('/session/line/callback'));
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'profile openid');
  url.searchParams.set('code_challenge', pkceChallenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
};

export const exchangeLineLoginCode = async (code: string, verifier: string): Promise<string | null> => {
  const clientId = getRuntime('LINE_LOGIN_CHANNEL_ID');
  const clientSecret = getRuntime('LINE_LOGIN_CHANNEL_SECRET');
  if (!clientId || !clientSecret) return null;
  const tokenRes = await idpFetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formBody({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl('/session/line/callback'),
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return null;
  const tokenJson = await tokenRes.json() as { id_token?: string; access_token?: string };
  if (tokenJson.id_token) {
    const payload = decodeJwtPayload(tokenJson.id_token);
    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (sub.startsWith('U')) return sub;
  }
  if (!tokenJson.access_token) return null;
  const profileRes = await idpFetch('https://api.line.me/v2/profile', {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileRes.ok) return null;
  const profile = await profileRes.json() as { userId?: string };
  return profile.userId?.startsWith('U') ? profile.userId : null;
};

const oktaEndpoint = (issuer: string, name: 'authorize' | 'token' | 'keys'): string => {
  const base = issuer.replace(/\/$/, '');
  if (base.includes('/oauth2/')) return `${base}/v1/${name}`;
  return `${base}/oauth2/v1/${name}`;
};

export const buildOktaAuthorizeUrl = (state: string, verifier: string): string | null => {
  const issuer = getRuntime('OKTA_ISSUER').replace(/\/$/, '');
  const clientId = getRuntime('OKTA_CLIENT_ID');
  if (!issuer || !clientId || !publicBase()) return null;
  const url = new URL(oktaEndpoint(issuer, 'authorize'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callbackUrl('/session/oidc/callback'));
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'openid profile');
  url.searchParams.set('code_challenge', pkceChallenge(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
};

export const exchangeOktaCode = async (code: string, verifier: string): Promise<string | null> => {
  const issuer = getRuntime('OKTA_ISSUER').replace(/\/$/, '');
  const clientId = getRuntime('OKTA_CLIENT_ID');
  const clientSecret = getRuntime('OKTA_CLIENT_SECRET');
  if (!issuer || !clientId || !clientSecret) return null;
  const tokenRes = await idpFetch(oktaEndpoint(issuer, 'token'), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formBody({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl('/session/oidc/callback'),
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return null;
  const tokenJson = await tokenRes.json() as { id_token?: string };
  if (!tokenJson.id_token) return null;
  const payload = await verifyOidcIdToken(tokenJson.id_token, issuer, clientId);
  if (!payload) return null;
  const claim = getRuntime('OKTA_LINE_CLAIM') || 'line_user_id';
  const claimValue = typeof payload[claim] === 'string' ? payload[claim] as string : '';
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  return mapIdpSubjectToLineUserId(sub, claimValue);
};

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export const verifyRs256Jwt = (
  token: string,
  key: KeyObject,
  expected: { iss: string; aud: string },
): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as { alg?: string };
    if (header.alg !== 'RS256') return null;
    const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(key, Buffer.from(s, 'base64url'));
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (payload.iss !== expected.iss) return null;
    const aud = payload.aud;
    const audOk = aud === expected.aud || (Array.isArray(aud) && aud.includes(expected.aud));
    if (!audOk) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now() - 30_000) return null;
    return payload;
  } catch {
    return null;
  }
};

const jwksCache = new Map<string, { exp: number; keys: Array<JsonWebKey & { kid?: string }> }>();

const verifyOidcIdToken = async (token: string, issuer: string, aud: string): Promise<Record<string, unknown> | null> => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { kid?: string; alg?: string };
  if (header.alg !== 'RS256') return null;
  const jwksUrl = oktaEndpoint(issuer, 'keys');
  const cached = jwksCache.get(jwksUrl);
  let keys = cached && cached.exp > Date.now() ? cached.keys : null;
  if (!keys) {
    const res = await idpFetch(jwksUrl);
    if (!res.ok) return null;
    const body = await res.json() as { keys?: Array<JsonWebKey & { kid?: string }> };
    keys = body.keys || [];
    jwksCache.set(jwksUrl, { exp: Date.now() + 10 * 60 * 1000, keys });
  }
  const jwk = keys.find(k => !header.kid || k.kid === header.kid) || keys[0];
  if (!jwk) return null;
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  return verifyRs256Jwt(token, key, { iss: issuer, aud });
};

export const buildSamlMetadataXml = (): string => {
  const entityId = getRuntime('SAML_SP_ENTITY_ID') || `${publicBase()}${adminBase()}/api/session/saml/metadata`;
  const acs = callbackUrl('/session/saml/acs');
  return `<?xml version="1.0" encoding="UTF-8"?><EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}"><SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"><AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="0" isDefault="true"/></SPSSODescriptor></EntityDescriptor>`;
};

export const buildSamlRedirectUrl = (state: string): string | null => {
  const sso = getRuntime('SAML_IDP_SSO_URL');
  const entityId = getRuntime('SAML_SP_ENTITY_ID') || `${publicBase()}${adminBase()}/api/session/saml/metadata`;
  if (!sso || !publicBase()) return null;
  const acs = callbackUrl('/session/saml/acs');
  const id = `_${randomBytes(12).toString('hex')}`;
  const xml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${new Date().toISOString()}" AssertionConsumerServiceURL="${acs}"><saml:Issuer>${entityId}</saml:Issuer></samlp:AuthnRequest>`;
  const deflated = deflateRawSync(Buffer.from(xml, 'utf8')).toString('base64');
  const url = new URL(sso);
  url.searchParams.set('SAMLRequest', deflated);
  url.searchParams.set('RelayState', state);
  return url.toString();
};

const pemToKey = (pem: string): KeyObject => createPublicKey(pem);

export const verifySamlResponse = (samlResponseB64: string, audience: string, certPem: string): string | null => {
  let xml = '';
  try {
    xml = Buffer.from(samlResponseB64, 'base64').toString('utf8');
  } catch {
    return null;
  }
  if (/<!DOCTYPE|<!ENTITY|&lt;!DOCTYPE/i.test(xml)) return null;
  const assertionCount = (xml.match(/<(?:\w+:)?Assertion\b/g) || []).length;
  if (assertionCount !== 1) return null;
  const signatureValue = xml.match(/<(?:\w+:)?SignatureValue[^>]*>([^<]+)</)?.[1]?.replace(/\s+/g, '');
  const signedInfo = xml.match(/<(?:\w+:)?SignedInfo\b[\s\S]*?<\/(?:\w+:)?SignedInfo>/)?.[0];
  if (!signatureValue || !signedInfo) return null;
  const canonical = signedInfo.includes('xmlns:') ? signedInfo : signedInfo.replace('<ds:SignedInfo', '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"').replace('<SignedInfo', '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"');
  try {
    const ok = createVerify('RSA-SHA256').update(canonical).verify(pemToKey(certPem), Buffer.from(signatureValue, 'base64'));
    if (!ok) return null;
  } catch {
    return null;
  }
  const notOnOrAfter = xml.match(/NotOnOrAfter="([^"]+)"/)?.[1];
  if (notOnOrAfter && Date.parse(notOnOrAfter) < Date.now() - 30_000) return null;
  if (audience && xml.includes('Audience') && !xml.includes(audience)) return null;
  const attrName = getRuntime('SAML_LINE_ATTRIBUTE') || 'line_user_id';
  const attr = xml.match(new RegExp(`Name="${attrName}"[^>]*>\\s*<(?:\\w+:)?AttributeValue[^>]*>([^<]+)`));
  const nameId = xml.match(/<(?:\w+:)?NameID[^>]*>([^<]+)</)?.[1];
  return mapIdpSubjectToLineUserId((nameId || '').trim(), (attr?.[1] || '').trim());
};

export const signSamlSignedInfoForTests = (signedInfoXml: string, privateKeyPem: string): string =>
  createSign('RSA-SHA256').update(signedInfoXml).sign(privateKeyPem, 'base64');