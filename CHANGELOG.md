# Changelog

## v9.0.10 — Odoo LINE OA v6 VPS lanes (2026-09-26)

- Staging deploy updates `/opt/cns-line-oa` (`APP_ENV=staging`, Admin `{PUBLIC_BASE_URL}/admin/test`).
- Production VPS deploy updates `/opt/cloudnex-connect` (`APP_ENV=production`, Admin `{PUBLIC_BASE_URL}/admin/`, HMAC on `:8080`).
- Scripts: `npm run deploy:vps-staging`, `npm run deploy:vps-prod`. Cloud Run `deploy:prod` still requires signoff.

## v5.0.1 — Odoo LINE OA v3 staging (2026-09-19)

Staging cut of Cloudnex Connect on `https://amardhaka.io`. No new product domains. Dual OA, catalog carousels, customer C0–C5 / staff send-approve-invoice, demo talk track.

### Platform (frozen)

- LINE HMAC webhook → Firestore profile → one `resolveCommandReply` → Flex.
- ERP only via `getErpAdapter()`. No LINE on GraphQL. No users/Odoo in Mongo.
- Admin fail-closed: LINE → `odooVerified` → `ADMIN_USER_ID` → Odoo admin capability → `role=admin`.
- Production still requires `STAGING_VALIDATED` + `PRODUCTION_APPROVED`.

### This cut

- Guest product/service kilo carousel; Quote is `FORM QUOTE CREATE FROM CARD <id>`; VERIFY stashes the SKU.
- Customer quote is product + qty; draft waits for sales send; Confirm is `QUOTE APPROVE` on LINE.
- Staff finals (send, confirm, invoice, cancel) are status Flex + journey card; Home on the card.
- Home shows Odoo name/phone after VERIFY. Success copy: “\<name\> is an Odoo Sales User.”
- `FORM VERIFY` chips LINE-session / Odoo-contact phone. Talk track on `/demo`.

### Not in this cut (no new scope)

- Production Cloud Run, credential rotation, on-device screenshot book, LIFF phone API, payments.

## v1.0.0 — Initial Release (2026-09-06)

Production cut of the Cloudnex LINE Official Account bot for Odoo sales.

### Features

- Odoo quotation lifecycle in LINE: Confirm, Send (composer + mail adapter + LINE card if linked), Invoice, customer Confirm (`QUOTE APPROVE`).
- Journey card shows `invoice_status` and `amount_invoiced` from the same order read.
- Unified LINE Flex visual language: tap-rows, footer CTAs, chips, `paddingBottom: lg`, tappable next step on cards.
- Opaque quote-list pagination (`date_order,id` cursor) with Next 5; date From/To pickers.
- Product-id form seeding (`FORM QUOTE CREATE FROM CARD` / `QUOTE CREATE id:<n>,...`) so product names with commas cannot break CSV.

### Security

- HMAC LINE webhook; Firestore identity; admin chain LINE id → profile → `odooVerified` → `ADMIN_USER_ID` → Odoo admin capability → `role=admin`.
- Postbacks allowlisted and bound as `kind|userId|exp` (15-minute TTL). Mutations such as Confirm/Send never run from raw `data`.
- OTP is not written to logs. Email on the send composer is admin-only.

### UX

- No “type the command” as the only recovery: PDPA (My data / Delete), voice fail (Home), missing product (Find product), reload fail (Check status).
- Optional form fields hide empty values; payment-term lists; LINE date picker for validity.

### Out of scope (v2)

- Register payment, deliveries/pickings, credit notes, CRM.
- Live Odoo `fields_get` of entire models (curated `skills/odoo-fields` only).
- LIFF / web mini-app.

### Verification

- `npx tsc --noEmit`
- Targeted Vitest including postback, Flex UX, quote-list cursor, guided forms, command validators, ERP adapter, service catalog.
