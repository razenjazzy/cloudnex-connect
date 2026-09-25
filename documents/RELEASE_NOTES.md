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
