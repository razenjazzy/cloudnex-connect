# Environments

Three lanes. Same codebase. Different `APP_ENV`. The Docker image always sets `NODE_ENV=production` for staging and delivery so Node runs optimized and ClawFramework stays off.

| Lane | `APP_ENV` | Host | `/demo` | `/webhook-test` | GraphiQL | GraphQL / `/api-docs` |
|---|---|---|---|---|---|---|
| Dev | `development` | laptop (`npm run dev`) | on | on | on | on |
| Staging | `staging` | Hostinger sibling `/opt/cns-line-oa` `:8081` | sibling compose off | sibling compose off | if GraphQL enabled | if `ENABLE_*` |
| Production | `production` | final delivery | **off** | **off** | **off** | only if `ENABLE_GRAPHQL` / `ENABLE_API_DOCS` + ops token |

If `APP_ENV` is unset and `NODE_ENV=production`, the process **fails closed to production**. HMAC on `amardhaka.io` is the production VPS process (`APP_ENV=production`). Staging Admin is the sibling (`APP_ENV=staging`).

Optional flags (default false): `GCS_MEDIA_BUCKET`, `LINE_MEDIA_MAX_BYTES`, `CLAMAV_URL`, `AV_SCAN_REQUIRED`, `LINE_GROUP_ROOMS`, `LINE_SECOND_WEBHOOK` (second HMAC ingress, same handler), `MONGO_USERS` (Mongo identity SoR when true; fail closed without `MONGODB_URI`; never Odoo SoR), `GRAPHQL_LINE_INGEST` (ops GraphQL ingest → same processor). `TENANT_KEY` scopes overlay docs (default `default`). `ERP_PROVIDER` other than `odoo` is an unimplemented placeholder.

## 1. Development (local + API test)

```bash
APP_ENV=development
NODE_ENV=development
```

Use `.env` locally (never commit). Hit `/webhook-test` and `/demo` without extra flags. Cursor MCP (`.cursor/mcp.json`) points at `http://127.0.0.1:8080` and uses `OPS_API_TOKEN` from your shell, not from git.

## 2. Staging (Hostinger VPS + demo)

```text
APP_ENV=staging
NODE_ENV=production          # from Dockerfile
ENABLE_DEMO_CONTROL_PANEL=true
ENABLE_WEBHOOK_TEST=true
WEBHOOK_TEST_TOKEN=...
ENABLE_GRAPHQL=true          # optional
ENABLE_API_DOCS=true         # optional
```

Plus LINE **Cloudnex Sales** and **Cloudnex Customer** credentials, Firestore JSON credentials, sandbox Odoo, `ADMIN_USER_ID` (Sales OA LINE user ids), `OPS_API_TOKEN`, `PUBLIC_BASE_URL=https://amardhaka.io/cloudnex-connect`. Staging Admin env is `PUBLIC_ADMIN_BASE=/admin/test` (HTTP `/cloudnex-connect/admin/test` on `:8081`). Production Admin is `PUBLIC_ADMIN_BASE=/admin` (HTTP `/cloudnex-connect/admin/` on `:8080`). Local defaults remain `/admin` and `/demo` (demo GET redirects to Admin `/testing`). See `documents/VPS_STAGING.md`.

Two Official Accounts (staging and production):

| OA | Webhook | Env |
|---|---|---|
| Cloudnex Sales `@938qytwi` | `POST /webhook/sales` (also `POST /webhook`) | `LINE_CHANNEL_SECRET` / `_ACCESS_TOKEN` / `_BASIC_ID`, or `LINE_CHANNEL_SALES_*` |
| Cloudnex Customer `@724tneri` | `POST /webhook/customer` | `LINE_CHANNEL_CUSTOMER_SECRET` / `_ACCESS_TOKEN` / `_BASIC_ID` / `_SERVICES=commerce,catalog` |

Do not commit tokens. Copy keys from `deploy/env/staging.example` into the host `.env`. `npm run check:line-channels` confirms they are non-empty without printing values.

## 3. Production (final delivery)

```text
APP_ENV=production
NODE_ENV=production
ENABLE_DEMO_CONTROL_PANEL=   # ignored; demo stays off
ENABLE_WEBHOOK_TEST=         # ignored; stays off
```

VPS production is `/opt/cloudnex-connect` (`npm run deploy:vps-prod`): HMAC `/webhook*` on `:8080`, Admin `https://amardhaka.io/cloudnex-connect/admin/`. Cloud Run `deploy:prod` still requires signoff. Railway is not production.

Use a **production** LINE OA, production Odoo, and a separate `ADMIN_USER_ID` / token set from staging when cutting over from sandbox. Do not enable Claw, async LINE, or Mongo unless those systems are provisioned and reviewed.

## Identity and ERP (all lanes)

Firestore is identity SoR. Odoo is ERP via `getErpAdapter()`. Mongo is optional LINE FAQ only. `SALES_SESSION_TTL_HOURS` (default 24) is the gold VERIFY sales-login window.

Variable names for each lane: `src/http/env-params.ts`. Railway copy-paste keys: `deploy/env/staging.example`. Delivery keys: `deploy/env/production.example`. `GET /ops/platform` reports `env.missingRequired`.
