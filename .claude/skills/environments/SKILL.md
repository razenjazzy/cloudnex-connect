---
name: environments
description: Use when changing APP_ENV, Railway staging, production flags, .env.example, or deploy variables.
---

# Environment lanes

Read `documents/ENVIRONMENTS.md` and `src/http/env-params.ts`.

- `development`: local + `/demo` + `/webhook-test`
- `staging`: Hostinger sibling `/opt/cns-line-oa` (`:8081`, Admin `/cloudnex-connect/admin/test`). Must set `APP_ENV=staging` (image `NODE_ENV=production` otherwise fail-closes). Keys: `deploy/env/staging.example`. Plan: `documents/VPS_STAGING.md`.
- `production`: VPS `/opt/cloudnex-connect` (`:8080`, HMAC + Admin `/cloudnex-connect/admin/`). Demo and webhook-test stay off even if `ENABLE_*` is set. Cloud Run still uses `deploy:prod` signoff.

Do not commit secrets. Audit coverage with `auditEnvParams` / `GET /ops/platform`.
