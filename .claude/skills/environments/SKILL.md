---
name: environments
description: Use when changing APP_ENV, Railway staging, production flags, .env.example, or deploy variables.
---

# Environment lanes

Read `documents/ENVIRONMENTS.md` and `src/http/env-params.ts`. Keyboard tray, catalog images, and env Action→Result: `documents/LINE_OA_AGENT.md`.

- `development`: laptop R&D — `/demo`, `/webhook-test`, mocks, stubs, experiments
- `staging`: client demo, running clients, event showcase — sibling `/opt/cns-line-oa` (`:8081`, Admin `/cloudnex-connect/admin/test`). Same app as production; demo/webhook-test off. Pack: `documents/DEMONSTRATION.md`.
- `production`: same product as staging until client cutover — `/opt/cloudnex-connect` (`:8080`, HMAC + Admin `/cloudnex-connect/admin/`). Demo and webhook-test stay off even if `ENABLE_*` is set.

Do not commit secrets. Audit coverage with `auditEnvParams` / `GET /ops/platform`.
