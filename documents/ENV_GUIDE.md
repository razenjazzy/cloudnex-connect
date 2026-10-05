# Environment guide

How the env files are organised and where to get each value. The same groups, in the same order, appear in `.env.example`, `.env`, `.env.staging`, `deploy/env/staging.example` and `deploy/env/production.example`. Never commit `.env` or `.env.staging` (git-ignored). Secrets in this repo are never printed in logs; Admin -> Channels verifies LINE credentials against LINE.

| File | Use |
|---|---|
| `.env.example` | Master template with every key and notes. |
| `.env` | Local development values. |
| `.env.staging` | Staging VPS values; copy to `/opt/cns-line-oa/.env` (the deploy script never copies it). |
| `deploy/env/*.example` | Templates for the VPS/Cloud Run lanes. |

After adding a key to the code, add it to `.env.example` and to the group list used when regrouping env files.


## 1. Runtime and public URLs

- PUBLIC_BASE_URL: the public https origin LINE and users reach (e.g. https://host or https://host/cloudnex-connect). LINE refuses http.
- APP_ENV: development | staging | production. NODE_ENV: development locally, production on any server image.
- PUBLIC_ADMIN_BASE: path where Admin is mounted (/admin locally; behind a path prefix, see documents/ENVIRONMENTS.md).

Keys: `PORT`, `APP_ENV`, `NODE_ENV`, `LOG_LEVEL`, `DEFAULT_LANGUAGE`, `TENANT_KEY`, `PUBLIC_BASE_URL`, `PUBLIC_ADMIN_BASE`, `PUBLIC_DEMO_BASE`, `MAX_JSON_BODY`, `READYZ_TIMEOUT_MS`, `SHUTDOWN_TIMEOUT_MS`


## 2. LINE: default channel (POST /webhook; Sales falls back to it if no Sales-only credentials)

- Where: https://developers.line.biz -> Provider -> your Messaging API channel.
- LINE_CHANNEL_ID and LINE_CHANNEL_SECRET: Basic settings tab (Channel ID, Channel secret).
- LINE_CHANNEL_ACCESS_TOKEN: Messaging API tab -> Channel access token (long-lived) -> Issue. Reissuing revokes the old token.
- LINE_CHANNEL_BASIC_ID: Messaging API tab -> Bot basic ID (keep the leading @).
- Admin -> Channels can also save and verify these (an Admin value overrides this file).

Keys: `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_BASIC_ID`, `LINE_CHANNEL_DEFAULT_SERVICES`


## 3. LINE: Sales OA (POST /webhook/sales)

- Same console steps as the default channel, but for the Sales OA channel.
- Set the channel Webhook URL to <PUBLIC_BASE_URL origin>/webhook/sales and turn "Use webhook" on.
- Leave SECRET/ACCESS_TOKEN empty only if Sales should reuse the default channel (not recommended).
- _SERVICES: comma-separated service keys enabled for this OA. _RICH_MENU_JSON: output of npm run rich-menu:upload.

Keys: `LINE_CHANNEL_SALES_ID`, `LINE_CHANNEL_SALES_SECRET`, `LINE_CHANNEL_SALES_ACCESS_TOKEN`, `LINE_CHANNEL_SALES_BASIC_ID`, `LINE_CHANNEL_SALES_SERVICES`, `LINE_CHANNEL_SALES_RICH_MENU_JSON`


## 4. LINE: Customer OA (POST /webhook/customer)

- Same console steps, for the Customer OA channel. Webhook URL: <origin>/webhook/customer.
- CUSTOMER_COMMERCE: quote (default) or shop. Shop needs Odoo website_sale and ODOO_WEBSITE_ID.
- LINE_CHANNEL_CUSTOMER_KEYBOARD_RICH_MENU: blank rich-menu id shown during quantity/form input (richmenu-... from rich-menu:upload).

Keys: `LINE_CHANNEL_CUSTOMER_ID`, `LINE_CHANNEL_CUSTOMER_SECRET`, `LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN`, `LINE_CHANNEL_CUSTOMER_BASIC_ID`, `LINE_CHANNEL_CUSTOMER_SERVICES`, `LINE_CHANNEL_CUSTOMER_RICH_MENU_JSON`, `LINE_CHANNEL_CUSTOMER_KEYBOARD_RICH_MENU`, `CUSTOMER_QTY_CHIPS`, `CUSTOMER_COMMERCE`


## 5. LINE: bot behavior and rich menus

- LINE_RICH_MENU_EN / _TH / _JSON: printed by npm run rich-menu:upload after you upload the tray images (ids are per OA).
- LINE_WEBHOOK_ASYNC=true needs REDIS_URL and RUN_BULLMQ_WORKER=true (replies are sent by a worker).
- LINE_AGENT_NAME_EN/TH: persona name shown as the reply prefix.
- LINE_DEFAULT_CUSTOMER_NAME / _PHONE / _EMAIL: EN sample in GUIDE (default Razen / +8801787671962 / baizid.a@cloudnexsolutions.com).
- LINE_DEFAULT_CUSTOMER_NAME_TH / _PHONE_TH / _EMAIL_TH: Thai GUIDE sample (default Ashfaq / +66635153342 / ashfaq.kc@cloudnexsolutions.com).
- LINE_DEFAULT_GUEST_NAME: name on a guest Odoo contact when LINE display name is empty (default Razen / Ashfaq by chat language).

Keys: `LINE_AGENT_NAME_EN`, `LINE_AGENT_NAME_TH`, `LINE_DEFAULT_CUSTOMER_NAME`, `LINE_DEFAULT_CUSTOMER_PHONE`, `LINE_DEFAULT_CUSTOMER_EMAIL`, `LINE_DEFAULT_CUSTOMER_NAME_TH`, `LINE_DEFAULT_CUSTOMER_PHONE_TH`, `LINE_DEFAULT_CUSTOMER_EMAIL_TH`, `LINE_DEFAULT_GUEST_NAME`, `LINE_RICH_MENU_EN`, `LINE_RICH_MENU_TH`, `LINE_RICH_MENU_JSON`, `LINE_WEBHOOK_ASYNC`, `LINE_IDLE_HOME_SECONDS`, `LINE_MEDIA_MAX_BYTES`, `LINE_GROUP_ROOMS`, `LINE_SECOND_WEBHOOK`, `GUIDED_FORM_TTL_MINUTES`, `SALES_SESSION_TTL_HOURS`, `SALES_IDLE_SIGNOUT_SECONDS`


## 6. Admin access and secrets

- ADMIN_USER_ID / SUPER_ADMIN_USER_IDS: comma-separated LINE user ids (U...). Your own id: LINE Developers -> Basic settings -> "Your user ID".
- ADMIN_SECRET_TOKEN, OPS_API_TOKEN, CONNECT_BOOTSTRAP_TOKEN: generate yourself, e.g. openssl rand -hex 32. Keep them private.
- SECRETS_ENCRYPTION_KEY: generate once (openssl rand -hex 32) and back it up; without it Admin cannot store encrypted channel credentials, and losing it makes stored ones unreadable.
- ADMIN_CONFIG_LOCK=true locks Admin edits except LINE channel credentials. ADMIN_ALLOWED_CIDRS: optional IP allowlist.

Keys: `ADMIN_USER_ID`, `SUPER_ADMIN_USER_IDS`, `ADMIN_SECRET_TOKEN`, `OPS_API_TOKEN`, `CONNECT_BOOTSTRAP_TOKEN`, `SECRETS_ENCRYPTION_KEY`, `SECRET_REVEAL_TTL_SECONDS`, `ADMIN_CONFIG_LOCK`, `ADMIN_ALLOWED_CIDRS`


## 7. Admin sign-in: LINE Login, Okta, SAML (optional)

- LINE_LOGIN_CHANNEL_ID / _SECRET: a separate LINE Login channel (LINE Developers -> Provider -> LINE Login channel -> Basic settings). Callback URL: <origin>/admin/api/auth/line/callback.
- OKTA_*: Okta Admin -> Applications -> your OIDC app (Issuer, Client ID, Client secret). OKTA_LINE_CLAIM names the claim holding the LINE user id.
- SAML_*: your IdP metadata (SSO URL, signing certificate) and the SP entity id you register with the IdP.

Keys: `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `OKTA_ISSUER`, `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `OKTA_LINE_CLAIM`, `OKTA_LINE_USER_MAP`, `SAML_IDP_SSO_URL`, `SAML_IDP_CERT`, `SAML_SP_ENTITY_ID`, `SAML_LINE_ATTRIBUTE`


## 8. Odoo / ERP

- ODOO_URL / ODOO_DB: your Odoo base URL and database name.
- ODOO_USERNAME + ODOO_API_KEY: Odoo -> user menu -> Preferences -> Account Security -> New API Key (the user needs the sales/product access you expect).
- One Odoo database per process; partner ids in Firestore belong to the previous DB until users VERIFY again.

Keys: `ERP_PROVIDER`, `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`, `ODOO_WEBSITE_ID`, `ODOO_RPC_TIMEOUT_MS`, `ODOO_READ_RETRY_ATTEMPTS`, `ODOO_READ_RETRY_BASE_DELAY_MS`, `ODOO_WRITE_RETRY_ATTEMPTS`, `ODOO_LOGIN_CACHE_MS`, `PRODUCT_CATALOG_CACHE_MS`, `PRODUCT_IMAGE_CACHE_MS`


## 9. Odoo user verification (OTP and magic link)

- No external value needed; tune only if the defaults do not fit. PUBLIC_BASE_URL (above) is used for the magic link.

Keys: `ODOO_VERIFY_OTP_TTL_MINUTES`, `ODOO_VERIFY_OTP_MAX_ATTEMPTS`, `ODOO_VERIFY_DEBUG_INCLUDE_OTP`, `ACTION_OTP_TTL_MINUTES`


## 10. Group-Buy rollout

- Feature flags; no external value.

Keys: `GROUPBUY_ENABLED`, `GROUPBUY_ROLLOUT_PERCENT`, `GROUPBUY_ALLOWED_USER_IDS`, `GROUPBUY_DEFAULT_HOURS`


## 11. Data stores, queue and storage

- GOOGLE_CLOUD_PROJECT: Google Cloud Console project id (Firestore/BigQuery).
- GOOGLE_APPLICATION_CREDENTIALS_JSON: only on a non-GCP host. GCP Console -> IAM -> Service accounts -> Keys -> JSON, pasted as one line.
- MONGODB_URI: Atlas/Mongo connection string; required when MONGO_USERS=true.
- REDIS_URL: redis://host:6379 (the staging compose starts Redis for you).

Keys: `GOOGLE_CLOUD_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS_JSON`, `MONGODB_URI`, `MONGO_DB_NAME`, `MONGO_VECTOR_ENABLED`, `MONGO_USERS`, `REDIS_URL`, `RATE_LIMIT_STORE`, `RATE_LIMIT_REDIS_PREFIX`, `RATE_LIMIT_REDIS_CONNECT_TIMEOUT_MS`, `RATE_STORE_MAX_KEYS`, `RUN_BULLMQ_WORKER`, `BULLMQ_PREFIX`, `OPS_JOBS_ASYNC`, `USER_STATE_CACHE_MAX`, `USER_STATE_CACHE_TTL_MS`, `GCS_MEDIA_BUCKET`


## 12. AI providers (optional)

- GOOGLE_AI_STUDIO_API_KEY / GEMINI_API_KEY: https://aistudio.google.com/app/apikey. On GCP, Vertex uses the service account instead.
- GROQ_API_KEY: https://console.groq.com/keys. OPENROUTER_API_KEY: https://openrouter.ai/keys.
- OLLAMA_* / FLOWISE_*: your own LAN/VPS services (Admin only proxies authed prompts).
- AI_OFF=true disables every AI call.

Keys: `GOOGLE_CLOUD_LOCATION`, `GOOGLE_AI_STUDIO_API_KEY`, `GEMINI_API_KEY`, `AI_OFF`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CLAWFRAMEWORK_ENABLED`, `CLAWFRAMEWORK_PROVIDER`, `CLAWFRAMEWORK_SEARCH`, `CLAWFRAMEWORK_PYTHON`, `CLAWFRAMEWORK_HTTP_URL`, `CLAWFRAMEWORK_MOCK`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `FLOWISE_BASE_URL`, `FLOWISE_CHATFLOW_ID`, `FLOWISE_API_KEY`, `SKILLS_DIR`


## 13. Feature toggles, demo and test tools

- ENABLE_WEBHOOK_TEST needs WEBHOOK_TEST_TOKEN on a production image; ignored when APP_ENV=production.
- DEMO_CONTROL_TOKEN / DEMO_SESSION_SECRET: generate yourself (openssl rand -hex 32).

Keys: `ENABLED_SERVICES`, `DISABLED_COMMANDS`, `ENABLE_WEBHOOK_TEST`, `WEBHOOK_TEST_TOKEN`, `ENABLE_DEMO_CONTROL_PANEL`, `DEMO_CONTROL_TOKEN`, `DEMO_SESSION_SECRET`, `DEMO_SESSION_TTL_MINUTES`, `DEMO_SESSION_ROTATE_GRACE_MINUTES`, `DEMO_SESSION_CONFIG_KEY`, `ALLOW_DEMO_HEADER_TOKEN_FALLBACK`, `ENABLE_API_DOCS`, `ENABLE_GRAPHQL`, `GRAPHQL_LINE_INGEST`, `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`


## 14. Media scanning (optional)

- CLAMAV_URL: your ClamAV REST endpoint. AV_SCAN_REQUIRED=true rejects uploads if the scanner is down.

Keys: `CLAMAV_URL`, `AV_SCAN_REQUIRED`


## 15. Audit trail archive and rotation

- See documents/AUDIT_LOG_POLICY.md. Archive needs GOOGLE_CLOUD_PROJECT; rotation no-ops safely without it.

Keys: `AUDIT_RETENTION_DAYS`, `AUDIT_ARCHIVE_ENABLED`, `AUDIT_ARCHIVE_DATASET`, `AUDIT_ARCHIVE_TABLE`, `AUDIT_ROTATE_BATCH_SIZE`, `AUDIT_ROTATE_MAX_BATCHES`


## 16. Pricing and cost model

- Internal estimates for the Admin cost/pricing views; no external value.

Keys: `AI_INPUT_COST_PER_1M_USD`, `AI_OUTPUT_COST_PER_1M_USD`, `LINE_MESSAGE_COST_USD`, `ODOO_RPC_COST_USD`, `FIRESTORE_READ_COST_USD`, `FIRESTORE_WRITE_COST_USD`, `INFRA_FIXED_MONTHLY_USD`, `SUPPORT_PER_CUSTOMER_MONTHLY_USD`, `PRICING_BASE_MARKUP_PERCENT`, `PRICING_ADVANCED_MARKUP_PERCENT`, `PRICING_ENTERPRISE_MARKUP_PERCENT`, `PRICING_RISK_BUFFER_PERCENT`, `PRICING_TARGET_MARGIN_PERCENT`, `PRICING_MONTHLY_BUDGET_CAP_USD`
