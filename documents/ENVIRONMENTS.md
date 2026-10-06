# Environments

Three lanes. Same codebase and the same Admin/API image. `APP_ENV` selects the lane. The Docker image always sets `NODE_ENV=production` for staging and production so Node runs optimized and ClawFramework stays off.

| Lane | `APP_ENV` | Host | Admin URL | HMAC `/webhook*` | Experimental (`/demo`, `/webhook-test`, mock LINE) |
|---|---|---|---|---|---|
| Local | `development` | laptop (`npm run dev`) | `/admin` | optional; prefer `/webhook-test` | **on** |
| Staging (UAT) | `staging` | Hostinger sibling `/opt/cns-line-oa` `:8081` | `/cloudnex-connect/admin/test` | off on this process (live HMAC is production `:8080`) | **off** |
| Production | `production` | `/opt/cloudnex-connect` `:8080` | `/cloudnex-connect/admin` | **on** (`POST /webhook`, `/webhook/sales`, `/webhook/customer`) | **off** (ignored even if `ENABLE_*` is set) |

Staging and production ship the **same** API, Admin SPA, LINE command router, and Odoo adapter. The Admin path is the product difference (`PUBLIC_ADMIN_BASE=/admin/test` vs `/admin`). LINE credentials and `ODOO_*` stay on each host `.env` and are not copied from the laptop. Until you cut staging over to a **live** LINE webhook URL, keep Messaging API webhooks on production `https://amardhaka.io/webhook/sales` and `/webhook/customer`.

If `APP_ENV` is unset and `NODE_ENV=production`, the process **fails closed to production**. HMAC on `amardhaka.io` is the production VPS process (`APP_ENV=production`). Staging Admin is the sibling (`APP_ENV=staging`).

Optional flags (default false): `GCS_MEDIA_BUCKET`, `LINE_MEDIA_MAX_BYTES`, `CLAMAV_URL`, `AV_SCAN_REQUIRED`, `LINE_GROUP_ROOMS`, `LINE_SECOND_WEBHOOK` (second HMAC ingress, same handler), `MONGO_USERS` (Mongo identity SoR when true; fail closed without `MONGODB_URI`; never Odoo SoR), `GRAPHQL_LINE_INGEST` (ops GraphQL ingest → same processor). `TENANT_KEY` scopes overlay docs (default `default`). It does not select a second Odoo. Paying clients are **silo processes** (own env, own `ODOO_*`, own LINE secrets). Admin → Tenants shows the live silo. `ERP_PROVIDER` other than `odoo` is an unimplemented placeholder. Admin Home studio is optional: `OLLAMA_BASE_URL` / `FLOWISE_BASE_URL` (OPS-authed proxy only; not LINE).

## 1. Development (local + mock LINE)

```bash
APP_ENV=development
NODE_ENV=development
```

Use repo `.env` locally (never commit). Hit `/webhook-test` (signature-free, same `resolveCommandReply`) and `/demo` without extra flags. This is the experimental lane: mock LINE OAs, presenter chat, GraphiQL. Cursor MCP (`.cursor/mcp.json`) points at `http://127.0.0.1:8080` and uses `OPS_API_TOKEN` from your shell, not from git.

## 2. Staging (UAT Admin; same app as production)

```text
APP_ENV=staging
NODE_ENV=production          # from Dockerfile
ENABLE_DEMO_CONTROL_PANEL=false
ENABLE_WEBHOOK_TEST=false
ENABLE_GRAPHQL=true          # ops, same as production compose
ENABLE_API_DOCS=true
PUBLIC_ADMIN_BASE=/admin/test
```

Sibling compose: `deploy/hostinger/docker-compose.sibling.yml`. Admin: `https://amardhaka.io/cloudnex-connect/admin/test`. Do not point the same LINE OA HMAC at `:8081` unless that process has **distinct** `LINE_CHANNEL_*` credentials. UAT LINE/Odoo may share production OAs until you configure staging to a live URL.

Plus LINE **Cloudnex Sales** and **Cloudnex Customer** credentials (when this process owns HMAC), Firestore JSON credentials, sandbox or lab Odoo, `ADMIN_USER_ID` (Sales OA LINE user ids), `OPS_API_TOKEN`, `PUBLIC_BASE_URL=https://amardhaka.io/cloudnex-connect`. See `documents/VPS_STAGING.md`. Laptop vs staging probes: `documents/DEVOPS.md` (`npm run ops:local` / `ops:staging`).

Two Official Accounts (until cutover):

| OA | Webhook | Env |
|---|---|---|
| Cloudnex Sales `@938qytwi` | `POST /webhook/sales` (also `POST /webhook`) | `LINE_CHANNEL_SECRET` / `_ACCESS_TOKEN` / `_BASIC_ID`, or `LINE_CHANNEL_SALES_*` |
| Cloudnex Customer `@724tneri` | `POST /webhook/customer` | `LINE_CHANNEL_CUSTOMER_SECRET` / `_ACCESS_TOKEN` / `_BASIC_ID` / `_SERVICES=commerce,catalog` |

Do not commit tokens. Copy keys from `deploy/env/staging.example` into the host `.env`. `npm run check:line-channels` confirms they are non-empty without printing values.

## 3. Production (live HMAC + Admin `/admin`)

```text
APP_ENV=production
NODE_ENV=production
PUBLIC_ADMIN_BASE=/admin
ENABLE_DEMO_CONTROL_PANEL=   # ignored; stays off
ENABLE_WEBHOOK_TEST=         # ignored; stays off
```

VPS production is `/opt/cloudnex-connect` (`npm run deploy:vps-prod`): HMAC `/webhook*` on `:8080`, Admin `https://amardhaka.io/cloudnex-connect/admin/`. Same image tag as staging (`razenjazzy/cloudnex-connect:staging`). Cloud Run `deploy:prod` still requires signoff. Railway is not production.

Use production LINE OA, production Odoo, and a separate `ADMIN_USER_ID` / token set when cutting over from sandbox. Do not enable Claw, async LINE, or Mongo unless those systems are provisioned and reviewed.

## Identity and ERP (all lanes)

Firestore is identity SoR. Odoo is ERP via `getErpAdapter()`. Mongo is optional LINE FAQ only. `SALES_SESSION_TTL_HOURS` (default 24) is the gold VERIFY sales-login window.

Variable names for each lane: `src/http/env-params.ts`. Copy-paste keys: `deploy/env/staging.example`. Delivery keys: `deploy/env/production.example`. `GET /ops/platform` reports `env.missingRequired`.
