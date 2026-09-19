# Production Readiness Checklist

Use this checklist after the reviewed release snapshot is committed. Do not put
credentials or secret values in this repository.

**Current staging path:** Hostinger VPS `https://amardhaka.io` ([VPS_STAGING.md](VPS_STAGING.md)), image `razenjazzy/cloudnex-connect:staging`. Certification snapshot: [ENTERPRISE_CERTIFICATION.md](ENTERPRISE_CERTIFICATION.md).

Cloud Run (`release.yml`) is optional `workflow_dispatch` only. Railway variable names remain in [RAILWAY_STAGING.md](RAILWAY_STAGING.md) for historical deploys. Do not treat Railway as the live host.

## Hostinger VPS staging (current path)

- [x] `npm test`, `npm run lint`, `npx tsc --noEmit` pass locally before push (re-run on each certification).
- [x] `deploy/docker/Dockerfile` (root `Dockerfile` symlink) copies `dist/` and `skills/`, runs `node dist/index.js`, healthchecks `/healthz`.
- [x] VPS `.env` (not in git) has `APP_ENV=staging`, Sales + Customer LINE keys, Firestore JSON, Odoo, `ADMIN_USER_ID`, `OPS_API_TOKEN`, `PUBLIC_BASE_URL=https://amardhaka.io`.
- [x] Staging demo flags: `ENABLE_DEMO_CONTROL_PANEL`, `ENABLE_WEBHOOK_TEST` (+ tokens), GraphQL / API docs on for this lane.
- [x] `LINE_WEBHOOK_ASYNC` is false (no Redis worker).
- [x] After deploy: `/healthz` 200, `/readyz` 200 (`service: cloudnex-connect`, `appEnv: staging`).
- [x] LINE webhooks: `POST https://amardhaka.io/webhook/sales` (Cloudnex Sales `@938qytwi`) and `POST https://amardhaka.io/webhook/customer` (Cloudnex Customer `@724tneri`). `POST /webhook` uses default Sales credentials.
- [x] Compact rich menus published on both OAs (ids in VPS `LINE_RICH_MENU_*` and `LINE_CHANNEL_CUSTOMER_RICH_MENU_JSON`).
- [x] USER_JOURNEY stills in `documents/journey/` (tray = published rich-menu PNGs; remaining Flex = studio from `scripts/export-journey-stills.ts` plus ten older on-device shots).
- [ ] GitHub Actions auto-deploy: repository variable `ENABLE_STAGING_VPS_DEPLOY=true` and environment `staging` secrets (`VPS_SSH_KEY`, `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, optional `VPS_HOST`). Until then, deploy with `npm run deploy:staging-vm`.

## Automated local evidence

- [x] `npm test` passes.
- [x] `npm run build` / `npx tsc --noEmit` passes.
- [x] `npm run lint` passes with no errors (unused-var warnings in quotation/guide cleaned).
- [x] `.github/workflows/release.yml` and `staging-vps.yml` parse as YAML.
- [x] `staging-vps.yml` does **not** use `secrets.*` in `job.if` (invalid workflow). Gate is `vars.ENABLE_STAGING_VPS_DEPLOY == 'true'`.
- [ ] `npm run preflight:staging` against a real staging YAML manifest if Cloud Run is used.
- [x] `npm run smoke -- https://amardhaka.io` after v5.0.1 deploy (2026-09-19; `/ops/workflow-audit` skipped without local `OPS_API_TOKEN`).
- [x] `npm run validate:staging` after v5.0.1 VPS pull (`/demo` HTML, session-gated APIs, `appEnv=staging`).

## GitHub (VPS Actions, optional)

Configure as GitHub **environment `staging`** secrets / repository variables, not committed files:

- [ ] Repository variable `ENABLE_STAGING_VPS_DEPLOY` = `true` to run deploy on `main` push.
- [ ] `VPS_SSH_KEY` (SSH private key only; never the VPS `.env`).
- [ ] `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`.
- [ ] Optional `VPS_HOST` (default `root@187.127.179.49` in the deploy script).

## GitHub (Cloud Run, optional)

Only if Cloud Run will be used:

- [ ] `DEPLOY_ENV_STAGING_YAML` / `DEPLOY_ENV_PRODUCTION_YAML`.
- [ ] `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `CLOUD_RUN_SECRETS`, WIF, service name, base URLs.
- [ ] `OPS_API_TOKEN` for smoke checks.
- [ ] Protected `staging` / `production` environments and reviewers.

Required Cloud Run secret mappings are validated by `scripts/validate-cutover.sh`.

## Runtime signoff

- [ ] Rotate any credential that was ever exposed outside the intended secret store (including LINE tokens pasted in chat).
- [x] Confirm `ERP_PROVIDER=odoo` (`readyz` `flags.erpProvider=odoo` on 2026-09-19).
- [x] Confirm `ENABLE_WEBHOOK_TEST=false` in production (`deliveryProduction` / `APP_ENV=production`) — enforced in code; `deploy/env/production.example`.
- [x] Confirm `ALLOW_DEMO_HEADER_TOKEN_FALLBACK=false` in production — `deploy/env/production.example`.
- [x] Confirm the demo control panel is disabled in production unless explicitly time-boxed — `ENABLE_DEMO_CONTROL_PANEL=false` in `deploy/env/production.example`; delivery production forces `/demo` off.
- [x] Confirm `PRODUCTION_APPROVED=true` is supplied only for an approved manual production run (`scripts/require-production-signoff.sh`; not set in git).
- [x] Verify `/healthz` and `/readyz` after staging deployment (2026-09-19, v5.0.1).
- [x] LINE webhook URLs registered and Messaging API webhook test OK (Sales + Customer).
- [ ] Exercise `VERIFY`, one product lookup, one Customer self-quote, one Sales send, one audit-log read on device.
- [x] Firestore composite index `users.phone` + `odooVerified` **READY** on project `cns-line-oa` (id `CICAgJiUpoMK`, 2026-09-19). Spec: `deploy/firestore.indexes.json`.
- [x] GCP org policy `constraints/iam.disableServiceAccountKeyCreation` **enforced** on `cns-line-oa` (2026-09-19).
- [x] Automated staging live check 2026-09-19 (`validate:staging`). `STAGING_VALIDATED` / `PRODUCTION_APPROVED` are **not** stored in git.
- [x] Rollback target: Docker image `razenjazzy/cloudnex-connect:staging` digest `sha256:e50637d55db5b1b8edad4ed1c69cdb2aadaaa85568ff096e0f7e331aded78154` (commit `e0197d99`, VPS `amardhaka.io`). Owner: staging operator. Cloud Run production has no live service until `deploy:prod` after human `PRODUCTION_APPROVED`.

## Release sequence (VPS staging)

1. Commit the reviewed snapshot (never `.env`).
2. `npm test` && `npm run lint` && `npx tsc --noEmit`.
3. `npm run deploy:staging-vm` **or** enable `ENABLE_STAGING_VPS_DEPLOY` and push `main`.
4. Confirm `https://amardhaka.io/healthz` and `/readyz`, then `npm run validate:staging`.
5. Obtain USER_JOURNEY signoff.
6. Production only after demo/webhook-test off and credential rotation.
