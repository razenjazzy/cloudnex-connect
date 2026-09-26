# Release notes — v10.0.2

**Date:** 2026-09-26  
**Package version:** `10.0.2`  
**Lane:** VPS production `/opt/cloudnex-connect` (`:8080` HMAC) + staging sibling `/opt/cns-line-oa`  
**Commit title:** `Release: v10.0.2 - Odoo Line OA v7 Bug Fix`

Customer catalog Flex uses a public Admin HTTPS image proxy (Odoo `image_128` over RPC). LINE no longer drops the whole reply on gated Odoo `/web/image` URLs. Cloud Run `deploy:prod` still requires signoff.

---

# Release notes — v10.0.1

**Date:** 2026-09-26  
**Package version:** `10.0.1`  
**Lane:** VPS production `/opt/cloudnex-connect` + staging sibling `/opt/cns-line-oa`  
**Commit title:** `Release: v10.0.1 - Odoo Line OA v7 Staging Deploy`

Admin is the operator console on the one `resolveCommandReply` path: bilingual overlay labels, Work CRUD (preview then confirm), Directory LINE↔Odoo fields, campaign EN/TH bodies. Promo LINE Broadcast remains blocked (`PROMO OFF`). Optional Mongo/GraphQL ingest stay off until [PLATFORM_FULFILLMENT.md](PLATFORM_FULFILLMENT.md) secrets exist. Cloud Run `deploy:prod` still requires signoff.

Remaining limits: EN/TH only; placeholder ERP; sibling `.env` operator-owned; Mongo identity / GraphQL ingest not enabled in compose.

---

# Release notes — v9.0.10

**Date:** 2026-09-26  
**Package version:** `9.0.10`  
**Lane:** VPS production `/opt/cloudnex-connect` + staging sibling `/opt/cns-line-oa`  
**Commit title:** `Release: v9.0.10 - Odoo Line OA v6 Staging Deploy`

Separate VPS deploys: staging rsyncs `/opt/cns-line-oa` (Admin `{PUBLIC_BASE_URL}/admin/test`, `:8081`) without tearing down production; production rsyncs `/opt/cloudnex-connect` (Admin `{PUBLIC_BASE_URL}/admin/`, HMAC `:8080`). IdP callback URLs in development follow the browser/request origin (`https://site.local`), not a mismatched `PUBLIC_BASE_URL`. Cloud Run `deploy:prod` still requires signoff.

---

# Release notes — v9.0.9

**Date:** 2026-09-26  
**Package version:** `9.0.9`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.9 - Odoo Line OA v6 Bug Fix`

Admin Identity/login lists where to register Messaging API, LINE Login, Okta, and SAML URLs. Empty Directory lookup no longer 400s. Super-admin bind errors name the missing VPS allowlist. Small-screen nav is a 3-bar drawer.

---

# Release notes — v9.0.8

**Date:** 2026-09-26  
**Package version:** `9.0.8`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.8 - Odoo Line OA v6 Bug Fix`

Express mounts Admin at `/cloudnex-connect/admin` when `PUBLIC_BASE_URL` includes that path and env is still `PUBLIC_ADMIN_BASE=/admin`. Nginx must not strip the prefix.

---

# Release notes — v9.0.7

**Date:** 2026-09-26  
**Package version:** `9.0.7`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.7 - Odoo Line OA v6 Bug Fix`

Public site is `https://amardhaka.io/cloudnex-connect` with `PUBLIC_ADMIN_BASE=/admin` and `PUBLIC_DEMO_BASE=/demo`. Demo lives in the Admin Demo menu (same chrome). HMAC `/webhook*` stays on the host origin.

---

# Release notes — v9.0.6

**Date:** 2026-09-26  
**Package version:** `9.0.6`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.6 - Odoo Line OA v6 Bug Fix`

Admin Overview tracks live LINE traffic (active users, inbound volume, last 12 hours) instead of the last 50 audit rows. Identity documents OTP bind as the working path and marks LINE Login / Okta / SAML off until their env keys are set.

---

# Release notes — v9.0.5

**Date:** 2026-09-26  
**Package version:** `9.0.5`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.5 - Odoo Line OA v6 Bug Fix`

Demo uses a sticky header nav (Home / Modules / Ops / Chat / Pricing / Journey) matching Admin chrome. Content cards have gap above and below.

Admin Overview replaces empty CSS bars with an SVG column chart (axes, counts, share table; no zero-height columns) and a status grid for app, Firestore, Odoo, Redis, LINE, queue, and actor.

---

# Release notes — v9.0.4

**Date:** 2026-09-26  
**Package version:** `9.0.4`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.4 - Odoo Line OA v6 Bug Fix`

Admin nav groups are dropdowns. Pills use light text on teal. Overview volume hides zero-count channel bars (no empty “other”).

---

# Release notes — v9.0.3

**Date:** 2026-09-26  
**Package version:** `9.0.3`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.3 - Odoo Line OA v6 Bug Fix`

CSP for Admin/demo follows `PUBLIC_ADMIN_BASE` / `PUBLIC_DEMO_BASE`. Prefixed Admin was getting `default-src 'none'`, which blocked Vite assets and the injected `__ADMIN_BASE__` script. Admin CSP now allows `'self'` scripts/styles plus `'unsafe-inline'` for that inject.

---

# Release notes — v9.0.2

**Date:** 2026-09-26  
**Package version:** `9.0.2`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.2 - Odoo Line OA v6 Staging Deploy`

VPS Admin URLs are `https://amardhaka.io/cloudnex-connect/admin` (primary) and `/cloudnex-connect/admin/test` (sibling). Demo stays `/cloudnex-connect/demo`. SPA infers any `PUBLIC_ADMIN_BASE` from `__ADMIN_BASE__`, `<base href>`, or the path leaf map.

---

# Release notes — v9.0.1

**Date:** 2026-09-26  
**Package version:** `9.0.1`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.1 - Odoo Line OA v6 Staging Deploy`

`PUBLIC_ADMIN_BASE` / `PUBLIC_DEMO_BASE` (defaults `/admin`, `/demo`) mount Admin SPA+API and demo. VPS primary: `/cloudnex-connect/admin` and `/cloudnex-connect/demo`. Sibling compose on 8081 with `/cloudnex-connect/admin/test`. Grouped hamburger Admin nav, auto-load Overview with CSS/SVG channel bars (no chart npm), scoped bind banner, Admin-styled demo. Cookie Path and OAuth callbacks follow the Admin prefix. HMAC `/webhook*` stays host root on the primary process. Dashboard `queueReady` is `flags.queueReady` (`isQueueBackendReady()`), not Redis config aliased.

Remaining limitations: EN/TH only; placeholder ERP (no SAP RPC); e-sign/payment need installed Odoo modules; Mongo SoR default off and requires `MONGODB_URI`; no production cutover; Flex/tray not restyled. Sibling `.env` is operator-owned. Do not dual-bind the same LINE OA to 8080 and 8081.

---

# Release notes — v9.0.0

**Date:** 2026-09-26  
**Package version:** `9.0.0`  
**Lane:** staging (no production deploy)  
**Commit title:** `Release: v9.0.0 - Odoo Line OA v6 Staging Deploy`

Included architecture: HMAC `/webhook` and `/webhook/:channelId` plus gated `/webhook-alt`; GraphQL `ingestLineEvents` → `processLineMessageJob`; one `resolveCommandReply`. `MONGO_USERS` on uses Mongo as identity SoR (Firestore may mirror; Odoo stays on `getErpAdapter()`). Non-odoo ERP is an unimplemented placeholder. Admin command overlay, `TENANT_KEY` overlay scoping, Directory/Privileges/Audit, e-sign/payment status fail-closed without fake PDFs.

Remaining limitations: EN/TH only; placeholder ERP (no SAP RPC); e-sign/payment need installed Odoo modules; Mongo SoR default off and requires `MONGODB_URI`; no production cutover; Flex/tray not restyled. Overview volume uses CSS/SVG bars (no extra chart npm).

---

# Release notes — v8.0.8

**Date:** 2026-09-26  
**Package version:** `8.0.8`  
**Lane:** staging VPS (`APP_ENV=staging`, `https://amardhaka.io`)  
**Commit title:** `Release: v8.0.8 - Odoo Line OA v5 Staging Deploy`

Inbound files upload to GCS when `GCS_MEDIA_BUCKET` is set and reply with a timed `/media` link; otherwise Flex stays fail-closed. Admin campaigns surface LINE-bind 403s, layout wraps on small screens, and JSON/text dumps are copyable fields.

---

# Release notes — v8.0.7

**Date:** 2026-09-26  
**Package version:** `8.0.7`  
**Lane:** staging VPS (`APP_ENV=staging`, `https://amardhaka.io`)  
**Commit title:** `Release: v8.0.7 - Odoo Line OA v5 Staging Deploy`

Inbound chips use `RELAY TO U…`. `/webhook-alt` 404s unless `LINE_SECOND_WEBHOOK`. Campaign send stores recipients and updates the campaign blob in a Firestore transaction. Admin login loads `/session/me`; Send is disabled without Redis; CRM assign reloads quotes. GraphQL ingest (flag on) uses `processLineMessageJob`.

---

# Release notes — v8.0.6

**Date:** 2026-09-26  
**Package version:** `8.0.6`  
**Lane:** staging VPS (`APP_ENV=staging`, `https://amardhaka.io`)  
**Commit title:** `Release: v8.0.6 - Odoo Line OA v5 Staging Deploy`

Promo LINE Broadcast is rejected (multicast Send honors `PROMO OFF`). Campaign send is HTTP super-admin only (no GraphQL `sendCampaign`). Inbound files fail closed until a real signed URL exists; `GCS_MEDIA_BUCKET` is not treated as stored.

---

# Release notes — v8.0.5

**Date:** 2026-09-26  
**Package version:** `8.0.5`  
**Lane:** staging VPS (`APP_ENV=staging`, `https://amardhaka.io`)  
**Commit title:** `Release: v8.0.5 - Odoo Line OA v5 Staging Deploy`

Campaigns (preview/test/queued send/broadcast), quoted customer relay, sales chips, media allowlist, enterprise Admin IA, optional forks implemented but not enabled. Production deploy is not this cut.

---

# Release notes — v5.0.1

**Date:** 2026-09-19  
**Package version:** `5.0.1`  
**Lane:** staging VPS (`APP_ENV=staging`, `https://amardhaka.io`)  
**Commit title:** `Release: v5.0.1 - Odoo Line OA v3 Staging - Deploy`

Cloudnex Connect LINE OA v3 staging wrap. Architecture unchanged: webhook HMAC → Firestore → one `resolveCommandReply` → Flex.

## Concrete surface

| Surface | Role |
|---|---|
| `POST /webhook`, `/webhook/sales`, `/webhook/customer` | LINE bot |
| `GET /demo` | Presenter HTML; APIs session-gated |
| `GET /healthz`, `/readyz` | Live lane snapshot |
| `/api-docs`, `POST /graphql` | Ops only |
| Odoo | Partners, products, `sale.order` via `getErpAdapter()` |
| Firestore | LINE identity, VERIFY, pendingFlow |
| Mongo | Optional embeddings only |

## Walk (no new features)

Customer OA: home identity after VERIFY → catalog carousel → product+qty quote → wait for sales → Confirm (`QUOTE APPROVE`) → Sales Order.  
Sales OA: create/send/confirm/invoice/cancel → status + card.  
Demo: Refresh Connections → web chat PDPA → `FORM QUOTE CREATE` → Full Simulation Flow.

## Out of scope (explicit)

Production deploy, screenshot UAT signoff, LIFF, payments, a second router, `src/app/core`.

## v1.0.0

2026-09-06 initial production cut. Full history is in git and `CHANGELOG.md`.
