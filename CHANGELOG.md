# Changelog

## v10.0.4 — Odoo LINE OA v7 (2026-09-26)

- Attach product photos only when Odoo has `image_128` so LINE does not render a blank hero or stampede Odoo on 404s.
- Product Details always shows the short sales description on Customer OA (`description_sale` / `description`).

## v10.0.3 — Odoo LINE OA v7 (2026-09-26)

- Customer OA commerce: Products & Orders, My Orders, and Ask for Quotations (`QUOTE ASK`) with status and sales replies.
- Catalog card UI gated from Admin Commands; overlay labels apply to Flex CTAs without changing command prefixes.

## v10.0.2 — Odoo LINE OA v7 (2026-09-26)

- Serve product thumbnails at `{PUBLIC_BASE_URL}/admin/catalog/product/{id}/image` via Odoo RPC instead of session-gated `/web/image`.
- Retry LINE replies without Flex heroes if LINE rejects the image URL so Customer OA messages still get an answer.

## v10.0.1 — Odoo LINE OA v7 (2026-09-26)

- Admin overlay saves EN/TH labels, roles, and channels; `pickLocale` never returns empty copy.
- `POST /admin/api/command` preview/confirm uses the bound actor and `resolveCommandReply`.
- Directory shows LINE↔Odoo dossier; campaigns take `textEn`/`textTh`; promo Broadcast still blocked.
- Fulfillment playbook: `documents/PLATFORM_FULFILLMENT.md`. Cloud Run `deploy:prod` still requires signoff.

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
