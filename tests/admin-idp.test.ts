import { createPublicKey, createSign, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPlatformConfig, setPlatformConfig } from '../src/services/firestore';
import {
  describeAdminIdp,
  buildLineAuthorizeUrl,
  consumeOauthState,
  exchangeLineLoginCode,
  issueOauthState,
  mapIdpSubjectToLineUserId,
  setAdminIdpFetchForTests,
  signSamlSignedInfoForTests,
  verifyRs256Jwt,
  verifySamlResponse,
} from '../src/services/admin-idp';
import { resetRuntimeSettingsForTests } from '../src/services/runtime-settings';

vi.mock('../src/services/firestore', () => ({
  getPlatformConfig: vi.fn(),
  setPlatformConfig: vi.fn(),
}));

const store: Record<string, unknown> = {};
vi.mocked(getPlatformConfig).mockImplementation(async (key: string) => (store[key] as never) ?? null);
vi.mocked(setPlatformConfig).mockImplementation(async (key: string, value: unknown) => {
  store[key] = value;
  return { ok: true };
});

describe('admin IdP mapping and LINE Login', () => {
  afterEach(() => {
    setAdminIdpFetchForTests(null);
    resetRuntimeSettingsForTests({});
  });

  it('maps Okta subject via claim, JSON map, or LINE-shaped sub', () => {
    resetRuntimeSettingsForTests({ OKTA_LINE_USER_MAP: '{"okta|1":"Umappeduserxx"}' });
    expect(mapIdpSubjectToLineUserId('x', 'Uclaimuserxxx')).toBe('Uclaimuserxxx');
    expect(mapIdpSubjectToLineUserId('okta|1')).toBe('Umappeduserxx');
    expect(mapIdpSubjectToLineUserId('Udirectuserxx')).toBe('Udirectuserxx');
    expect(mapIdpSubjectToLineUserId('user@example.com')).toBeNull();
    resetRuntimeSettingsForTests({ OKTA_LINE_USER_MAP: '{not-json' });
    expect(mapIdpSubjectToLineUserId('Udirectuserxx')).toBe('Udirectuserxx');
    expect(mapIdpSubjectToLineUserId('user@example.com')).toBeNull();
  });

  it('treats SAML as configured without SAML_SP_ENTITY_ID', () => {
    resetRuntimeSettingsForTests({
      SAML_IDP_SSO_URL: 'https://example.okta.com/app/sso/saml',
      SAML_IDP_CERT: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----',
    });
    expect(describeAdminIdp().saml).toBe(true);
    resetRuntimeSettingsForTests({ SAML_IDP_SSO_URL: 'https://example.okta.com/app/sso/saml' });
    expect(describeAdminIdp().saml).toBe(false);
  });

  it('exposes LINE Login callback under PUBLIC_ADMIN_BASE', () => {
    const prevBase = process.env.PUBLIC_ADMIN_BASE;
    process.env.PUBLIC_ADMIN_BASE = '/cloudnex-connect/admin';
    resetRuntimeSettingsForTests({
      PUBLIC_BASE_URL: 'https://amardhaka.io',
    });
    try {
      expect(describeAdminIdp().callbacks.lineLogin).toBe(
        'https://amardhaka.io/cloudnex-connect/admin/api/session/line/callback',
      );
    } finally {
      if (prevBase === undefined) delete process.env.PUBLIC_ADMIN_BASE;
      else process.env.PUBLIC_ADMIN_BASE = prevBase;
    }
  });

  it('builds LINE authorize URL with PKCE when configured', () => {
    resetRuntimeSettingsForTests({
      LINE_LOGIN_CHANNEL_ID: '123456',
      PUBLIC_BASE_URL: 'https://amardhaka.io',
    });
    const url = buildLineAuthorizeUrl('abc', 'verifier');
    expect(url).toContain('access.line.me/oauth2/v2.1/authorize');
    expect(url).toContain('client_id=123456');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('exchanges LINE Login code via profile when id_token has no LINE sub', async () => {
    resetRuntimeSettingsForTests({
      LINE_LOGIN_CHANNEL_ID: '123',
      LINE_LOGIN_CHANNEL_SECRET: 'secret',
      PUBLIC_BASE_URL: 'https://amardhaka.io',
    });
    setAdminIdpFetchForTests(async (input) => {
      const url = String(input);
      if (url.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
      }
      return new Response(JSON.stringify({ userId: 'Ulinefromprofile' }), { status: 200 });
    });
    expect(await exchangeLineLoginCode('code', 'verifier')).toBe('Ulinefromprofile');
  });

  it('binds oauth state to SameSite Lax cookie and consumes once', async () => {
    const issued = await issueOauthState('line_login');
    expect(issued.cookie).toContain('SameSite=Lax');
    const first = await consumeOauthState(issued.state, issued.cookie, 'line_login');
    expect(first).toBe(issued.verifier);
    expect(await consumeOauthState(issued.state, issued.cookie, 'line_login')).toBeNull();
  });
});

describe('OIDC JWT and SAML assertion verify', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  it('verifies RS256 id_token iss/aud/exp', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://example.okta.com/oauth2/default',
      aud: 'client-1',
      sub: 'okta|1',
      exp: Math.floor(Date.now() / 1000) + 300,
      line_user_id: 'Ujwtlineuserx',
    })).toString('base64url');
    const sig = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privPem, 'base64url');
    const verified = verifyRs256Jwt(
      `${header}.${payload}.${sig}`,
      createPublicKey(pubPem),
      { iss: 'https://example.okta.com/oauth2/default', aud: 'client-1' },
    );
    expect(verified?.line_user_id).toBe('Ujwtlineuserx');
  });

  it('rejects unsigned or wrapped SAML and accepts a single signed assertion', () => {
    const audience = 'https://amardhaka.io/admin/api/session/saml/metadata';
    const signedInfo = '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha256"/><ds:Reference URI="#_a1"><ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha256"/><ds:DigestValue>abc</ds:DigestValue></ds:Reference></ds:SignedInfo>';
    const signatureValue = signSamlSignedInfoForTests(signedInfo, privPem);
    const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"><saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_a1"><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<ds:SignatureValue>${signatureValue}</ds:SignatureValue></ds:Signature><saml:Subject><saml:NameID>Usamluserxxxx</saml:NameID></saml:Subject><saml:Conditions NotOnOrAfter="${new Date(Date.now() + 60_000).toISOString()}"><saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction></saml:Conditions></saml:Assertion></samlp:Response>`;
    const b64 = Buffer.from(xml, 'utf8').toString('base64');
    expect(verifySamlResponse(b64, audience, pubPem)).toBe('Usamluserxxxx');
    expect(verifySamlResponse(Buffer.from('<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><x>&x;</x>').toString('base64'), audience, pubPem)).toBeNull();
  });
});
