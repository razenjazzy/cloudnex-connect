import type { AppEnv } from './env';

export type EnvParam = {
  key: string;
  requiredIn: AppEnv[];
  note: string;
};

/** Canonical variable names for all three lanes. Values stay in the host secret store. */
export const ENV_PARAMS: EnvParam[] = [
  { key: 'APP_ENV', requiredIn: ['development', 'staging', 'production'], note: 'development | staging | production' },
  { key: 'PORT', requiredIn: [], note: 'Defaults to 8080' },
  { key: 'NODE_ENV', requiredIn: ['staging', 'production'], note: 'production on Railway and delivery images' },
  { key: 'LINE_CHANNEL_ID', requiredIn: [], note: 'Numeric Messaging API channel id' },
  { key: 'LINE_CHANNEL_SECRET', requiredIn: ['staging', 'production'], note: 'Cloudnex Sales (or default OA); POST /webhook and fallback for /webhook/sales' },
  { key: 'LINE_CHANNEL_ACCESS_TOKEN', requiredIn: ['staging', 'production'], note: 'Paired with LINE_CHANNEL_SECRET' },
  { key: 'LINE_CHANNEL_BASIC_ID', requiredIn: [], note: 'Sales OA @handle when LINE_CHANNEL_SALES_BASIC_ID is unset (e.g. @938qytwi)' },
  { key: 'LINE_CHANNEL_SALES_SECRET', requiredIn: [], note: 'Optional; POST /webhook/sales uses this instead of LINE_CHANNEL_SECRET' },
  { key: 'LINE_CHANNEL_SALES_ACCESS_TOKEN', requiredIn: [], note: 'Paired with LINE_CHANNEL_SALES_SECRET' },
  { key: 'LINE_CHANNEL_SALES_BASIC_ID', requiredIn: [], note: 'Cloudnex Sales @handle' },
  { key: 'LINE_CHANNEL_SALES_SERVICES', requiredIn: [], note: 'Optional Sales OA service ceiling' },
  { key: 'LINE_CHANNEL_SALES_RICH_MENU_JSON', requiredIn: [], note: 'Sales OA tray ids from rich-menu:upload' },
  { key: 'LINE_CHANNEL_CUSTOMER_SECRET', requiredIn: ['staging', 'production'], note: 'Cloudnex Customer; webhook POST /webhook/customer' },
  { key: 'LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN', requiredIn: ['staging', 'production'], note: 'Paired with LINE_CHANNEL_CUSTOMER_SECRET' },
  { key: 'LINE_CHANNEL_CUSTOMER_BASIC_ID', requiredIn: ['staging', 'production'], note: 'Cloudnex Customer @handle (e.g. @724tneri)' },
  { key: 'LINE_CHANNEL_CUSTOMER_SERVICES', requiredIn: [], note: 'Typically commerce,catalog' },
  { key: 'LINE_CHANNEL_CUSTOMER_RICH_MENU_JSON', requiredIn: [], note: 'Customer OA tray ids from rich-menu:upload' },
  { key: 'LINE_RICH_MENU_EN', requiredIn: [], note: 'Default English tray (all tiles equal)' },
  { key: 'LINE_RICH_MENU_TH', requiredIn: [], note: 'Default Thai tray (all tiles equal)' },
  { key: 'LINE_RICH_MENU_JSON', requiredIn: [], note: 'Per-cell active rich-menu ids from npm run rich-menu:upload' },
  { key: 'LINE_AGENT_NAME_EN', requiredIn: [], note: 'English persona name; defaults to Sora' },
  { key: 'LINE_AGENT_NAME_TH', requiredIn: [], note: 'Thai persona name; defaults to โซระ' },
  { key: 'LINE_IDLE_HOME_SECONDS', requiredIn: [], note: 'Idle inbound → persona Home; default 3600. Form TTL is at least this many minutes.' },
  { key: 'GCS_MEDIA_BUCKET', requiredIn: [], note: 'Optional GCS bucket for inbound LINE files; fail-closed Flex if unset' },
  { key: 'LINE_MEDIA_MAX_BYTES', requiredIn: [], note: 'Default 10485760' },
  { key: 'CLAMAV_URL', requiredIn: [], note: 'Optional AV scan endpoint' },
  { key: 'AV_SCAN_REQUIRED', requiredIn: [], note: 'Default false; fail closed if true and scanner down' },
  { key: 'LINE_GROUP_ROOMS', requiredIn: [], note: 'Default false; group/room buttons stay off' },
  { key: 'LINE_SECOND_WEBHOOK', requiredIn: [], note: 'Default false; POST /webhook-alt is the same handleWebhook' },
  { key: 'MONGO_USERS', requiredIn: [], note: 'Default false; Mongo LINE/Odoo SoR stays unimplemented as live path' },
  { key: 'GRAPHQL_LINE_INGEST', requiredIn: [], note: 'Default false; ingestLineEvents is disabled' },
  { key: 'GUIDED_FORM_TTL_MINUTES', requiredIn: [], note: 'Guided form pendingFlow TTL; default 60, raised to cover LINE_IDLE_HOME_SECONDS' },
  { key: 'SALES_SESSION_TTL_HOURS', requiredIn: [], note: 'Sales VERIFY gold session; default 24' },
  { key: 'ADMIN_USER_ID', requiredIn: ['staging', 'production'], note: 'Fail-closed allowlist for ADMIN ENABLE' },
  { key: 'GOOGLE_CLOUD_PROJECT', requiredIn: ['staging', 'production'], note: 'Firestore project' },
  { key: 'GOOGLE_APPLICATION_CREDENTIALS_JSON', requiredIn: ['staging'], note: 'Required off-GCP (Railway). Omit on Cloud Run ADC' },
  { key: 'ODOO_URL', requiredIn: ['staging', 'production'], note: 'Sandbox on staging' },
  { key: 'ODOO_DB', requiredIn: ['staging', 'production'], note: '' },
  { key: 'ODOO_USERNAME', requiredIn: ['staging', 'production'], note: '' },
  { key: 'ODOO_API_KEY', requiredIn: ['staging', 'production'], note: '' },
  { key: 'ERP_PROVIDER', requiredIn: ['staging', 'production'], note: 'Must be odoo' },
  { key: 'PUBLIC_BASE_URL', requiredIn: ['staging', 'production'], note: 'https://host for verify links' },
  { key: 'OPS_API_TOKEN', requiredIn: ['staging', 'production'], note: 'Protects /ops, GraphQL, docs' },
  { key: 'DEMO_CONTROL_TOKEN', requiredIn: ['staging'], note: 'Demo login; may equal OPS_API_TOKEN' },
  { key: 'ENABLE_DEMO_CONTROL_PANEL', requiredIn: ['staging'], note: 'true on Railway demo; ignored in production' },
  { key: 'ENABLE_WEBHOOK_TEST', requiredIn: ['staging'], note: 'true on Railway; ignored in production' },
  { key: 'WEBHOOK_TEST_TOKEN', requiredIn: ['staging'], note: 'Required when webhook-test is on a production Node image' },
  { key: 'ENABLE_GRAPHQL', requiredIn: [], note: 'Optional ops' },
  { key: 'ENABLE_API_DOCS', requiredIn: [], note: 'Optional ops' },
  { key: 'GOOGLE_AI_STUDIO_API_KEY', requiredIn: [], note: 'Gemini without Vertex ADC' },
  { key: 'SECRET_REVEAL_TTL_SECONDS', requiredIn: [], note: 'Unmask window; default 10, max 60' },
  { key: 'ADMIN_CONFIG_LOCK', requiredIn: [], note: 'Default true; blocks overlay PUT' },
  { key: 'SECRETS_ENCRYPTION_KEY', requiredIn: [], note: 'AES key for runtime overlay; required if ADMIN_CONFIG_LOCK=false' },
  { key: 'SUPER_ADMIN_USER_IDS', requiredIn: [], note: 'LINE ids allowed to reveal secrets; fail closed if unset' },
  { key: 'CONNECT_BOOTSTRAP_TOKEN', requiredIn: [], note: 'One-shot install token for POST /admin/api/bootstrap' },
  { key: 'ADMIN_ALLOWED_CIDRS', requiredIn: [], note: 'Optional IPv4 CIDR allowlist for /admin' },
  { key: 'AUDIT_RETENTION_DAYS', requiredIn: [], note: 'Hot auditLog retention; default 30' },
  { key: 'LINE_LOGIN_CHANNEL_ID', requiredIn: [], note: 'LINE Login channel id for admin web OAuth' },
  { key: 'LINE_LOGIN_CHANNEL_SECRET', requiredIn: [], note: 'LINE Login channel secret' },
  { key: 'OKTA_ISSUER', requiredIn: [], note: 'Okta OIDC issuer, e.g. https://example.okta.com/oauth2/default' },
  { key: 'OKTA_CLIENT_ID', requiredIn: [], note: 'Okta OIDC client id' },
  { key: 'OKTA_CLIENT_SECRET', requiredIn: [], note: 'Okta OIDC client secret' },
  { key: 'OKTA_LINE_CLAIM', requiredIn: [], note: 'OIDC claim that holds LINE user id; default line_user_id' },
  { key: 'OKTA_LINE_USER_MAP', requiredIn: [], note: 'JSON map of Okta sub/email to LINE user id' },
  { key: 'SAML_IDP_SSO_URL', requiredIn: [], note: 'Okta/other SAML SSO URL' },
  { key: 'SAML_IDP_CERT', requiredIn: [], note: 'IdP X.509 cert PEM for assertion signatures' },
  { key: 'SAML_SP_ENTITY_ID', requiredIn: [], note: 'SP entity ID; defaults to metadata URL' },
  { key: 'SAML_LINE_ATTRIBUTE', requiredIn: [], note: 'SAML attribute with LINE user id; default line_user_id' },
];

export const auditEnvParams = (appEnv: AppEnv, env: NodeJS.ProcessEnv = process.env) => {
  const missingRequired = ENV_PARAMS
    .filter(param => param.requiredIn.includes(appEnv) && !env[param.key]?.trim())
    .map(param => param.key);
  const present = ENV_PARAMS.filter(param => Boolean(env[param.key]?.trim())).map(param => param.key);
  return {
    appEnv,
    missingRequired,
    present,
    railwayStagingReady: appEnv !== 'staging' || missingRequired.length === 0,
  };
};
