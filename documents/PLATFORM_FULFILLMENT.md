# Platform fulfillment (10/10)

Adapters below already exist in this repo. Completeness is **env + probe**, not a second LINE router. Secrets stay on the VPS `.env` (never git). HMAC `/webhook*` stays on production `:8080` (`/opt/cloudnex-connect`) unless the sibling has **distinct** `LINE_CHANNEL_*` credentials.

Admin Advanced lists live flags from `GET /admin/api/settings` (`optionalFlags`, `missingRequired`, `queueReady`). See `GET /readyz` and `GET /ops/platform`.

| Scope | Done when | Operator steps (fail closed) |
|---|---|---|
| 1. LINE HMAC + dual OA | `POST /webhook/sales` and `/webhook/customer` 200 | Set `LINE_CHANNEL_*` on `/opt/cloudnex-connect/.env`. Run `bash scripts/check-line-channels.sh .env`. Do not point the same OA at `:8081`. |
| 2. Identity SoR | VERIFY + profile persist | Firestore default. `MONGO_USERS=true` only with `MONGODB_URI`. Mongo is never Odoo SoR. Recreate compose after env change. |
| 3. Odoo ERP | Quotes/partners/catalog via `getErpAdapter()` | `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`, `ERP_PROVIDER=odoo`. Admin → ERP → Refresh. Placeholder SAP/QB stays unimplemented. |
| 4. Admin + overlay | v7 console | `ADMIN_USER_ID`, `SUPER_ADMIN_USER_IDS`, `OPS_API_TOKEN` (≥16), `ADMIN_SECRET_TOKEN` (Jobs). `ADMIN_CONFIG_LOCK=false` plus `SECRETS_ENCRYPTION_KEY` to save overlay. Bind actor cookie on Identity. |
| 5. Redis / BullMQ | `/readyz` `queueReady` | Compose already starts Redis and sets `LINE_WEBHOOK_ASYNC` + `RUN_BULLMQ_WORKER`. Campaign Send needs Redis. |
| 6. GraphQL + Swagger | `/graphql`, `/api-docs` | VPS compose sets `ENABLE_GRAPHQL` / `ENABLE_API_DOCS`. Use OPS token. Not a LINE ingress. |
| 7. GraphQL LINE ingest | Extra ingest path | `GRAPHQL_LINE_INGEST=true` → `ingestLineEvents` → `processLineMessageJob` → **same** `resolveCommandReply`. |
| 8. Mongo FAQ/RAG | Optional unmatched-chat fallback | `MONGODB_URI` + vector flags. Never store users, OTP, or ERP masters. |
| 9. Extra LINE ingress | `/webhook-alt`, group chats | `LINE_SECOND_WEBHOOK=true` (same handler). `LINE_GROUP_ROOMS=true` to allow group buttons. Default off. |
| 10. Media / IdP / Cloud Run | Files, web bind, GCP | `GCS_MEDIA_BUCKET` + https `PUBLIC_BASE_URL`. LINE Login / Okta / SAML env. Cloud Run remains `npm run deploy:prod` signoff. |

VPS lanes: staging `/opt/cns-line-oa` Admin `{PUBLIC_BASE_URL}/admin/test`; production `/opt/cloudnex-connect` Admin `{PUBLIC_BASE_URL}/admin/`. `npm run deploy:vps-staging` then `SKIP_BUILD=1 npm run deploy:vps-prod`.
