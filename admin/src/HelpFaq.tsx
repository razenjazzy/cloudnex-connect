import { CopyField, FaqItem } from './ui';

export type HelpFaqProps = {
  hostOrigin: string;
  adminBase: string;
  lineLoginCallback: string;
  oidcCallback: string;
  samlAcs: string;
  idp?: { lineLogin?: boolean; oktaOidc?: boolean; saml?: boolean };
  showStartLinks?: boolean;
};

export const HelpFaq = ({
  hostOrigin,
  adminBase,
  lineLoginCallback,
  oidcCallback,
  samlAcs,
  idp,
  showStartLinks = false,
}: HelpFaqProps) => (
  <div className="faq-list">
    <p className="page-lead">OTP bind on Identity does not use these consoles. Register a URL only for the product you are turning on.</p>

    <FaqItem title="Where to get OPS token, admin secret, and other config">
      <p>Values live in env files. They are never in this UI as plaintext until a super-admin reveal. Do not commit <code>.env</code>.</p>
      <CopyField label="Key names (not the secrets)" value={'OPS_API_TOKEN — Admin login and /ops/*\nADMIN_SECRET_TOKEN — Jobs page and CLI jobs:*\nADMIN_USER_ID / SUPER_ADMIN_USER_IDS — LINE ids for bind\nLINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET — optional Admin OAuth'} />
      <CopyField label="Local file" value="repo .env (copy keys from .env.example)" />
      <CopyField label="Staging VPS file" value="/opt/cloudnex-connect/.env" />
      <CopyField label="Templates" value={'repo .env.example\ndeploy/env/staging.example'} />
      <p className="muted">Admin → Platform → Settings lists keys masked. Jobs uses <code>ADMIN_SECRET_TOKEN</code>, not the OPS token you sign in with.</p>
    </FaqItem>

    <FaqItem title="Messaging API — webhook URL for LINE chat">
      <p>
        Open <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer">LINE Developers Console</a>
        → provider → <strong>Messaging API</strong> channel (Sales or Customer) → Messaging API tab → Webhook URL. Enable Use webhook. This is not LINE Login.
      </p>
      <CopyField label="Sales OA webhook" url={`${hostOrigin}/webhook/sales`} value={`${hostOrigin}/webhook/sales`} />
      <CopyField label="Customer OA webhook" url={`${hostOrigin}/webhook/customer`} value={`${hostOrigin}/webhook/customer`} />
      <CopyField label="Default channel webhook" url={`${hostOrigin}/webhook`} value={`${hostOrigin}/webhook`} />
    </FaqItem>

    <FaqItem title="Official Account Manager — greeting and rich menu">
      <p>
        Open <a href="https://manager.line.biz/" target="_blank" rel="noreferrer">LINE Official Account Manager</a>
        → Sales or Customer OA → Response / bot settings. Link the OA to the same Messaging API channel. Greeting and rich menu live here; the webhook URL stays in Developers Console.
      </p>
    </FaqItem>

    <FaqItem title="LINE Login — optional Admin OAuth">
      <p>
        Same console → provider → <strong>Create a LINE Login channel</strong> (not Messaging API). App type: Web app. LINE Login tab → Callback URL. Set <code>LINE_LOGIN_CHANNEL_ID</code> and <code>LINE_LOGIN_CHANNEL_SECRET</code> on the VPS.
      </p>
      <CopyField label="Channel name" value="Cloudnex Connect" />
      <CopyField
        label="Channel description"
        value="Cloudnex Connect Admin web sign-in. LINE Login (OAuth 2.0 PKCE) identifies the operator’s LINE user id so a super-admin cookie can be issued after OPS token auth. Scopes: profile and openid. This channel does not receive Messaging API webhooks."
      />
      <CopyField
        label="LINE Login APIs"
        value={'https://access.line.me/oauth2/v2.1/authorize (authorization code + PKCE S256, scope=profile openid)\nhttps://api.line.me/oauth2/v2.1/token (grant_type=authorization_code)\nhttps://api.line.me/v2/profile (if id_token has no LINE sub)'}
      />
      <CopyField label="Callback URL" url={lineLoginCallback} value={lineLoginCallback} />
      <CopyField label="Web app URL" url={`${hostOrigin}${adminBase}`} value={`${hostOrigin}${adminBase}`} />
      {showStartLinks
        ? (idp?.lineLogin
          ? <p><a href={`${adminBase}/api/session/line/start`}>Start LINE Login</a></p>
          : <p className="muted">Start stays off until those env keys are set.</p>)
        : null}
    </FaqItem>

    <FaqItem title="LINE says a field contains an error">
      <p>
        That message is on access.line.me, not Admin. Use the <strong>QR code</strong> from your phone LINE (Home → scan). Email/password is the LINE-app email, not Odoo. Phone: Settings → Account → Allow login. Developers Console → Basic settings → Email must be real. App types: Web only unless you fill iOS/Android bundle IDs. Privacy policy / Terms: https URLs or empty while Developing.
      </p>
    </FaqItem>

    <FaqItem title="Okta OIDC — optional">
      <p>Okta Admin → Applications → OIDC app → Sign-in redirect URIs. Then <code>OKTA_ISSUER</code>, <code>OKTA_CLIENT_ID</code>, <code>OKTA_CLIENT_SECRET</code>.</p>
      <CopyField label="Sign-in redirect URI" url={oidcCallback} value={oidcCallback} />
      {showStartLinks
        ? (idp?.oktaOidc
          ? <p><a href={`${adminBase}/api/session/oidc/start`}>Start Okta OIDC</a></p>
          : <p className="muted">Start stays off until those env keys are set.</p>)
        : null}
    </FaqItem>

    <FaqItem title="SAML — optional">
      <p>IdP ACS / Single sign-on URL. Then <code>SAML_IDP_SSO_URL</code> and <code>SAML_IDP_CERT</code>.</p>
      <CopyField label="ACS URL" url={samlAcs} value={samlAcs} />
      {showStartLinks
        ? (idp?.saml
          ? <p><a href={`${adminBase}/api/session/saml/start`}>Start SAML</a></p>
          : <p className="muted">Start stays off until those env keys are set.</p>)
        : null}
    </FaqItem>
  </div>
);
