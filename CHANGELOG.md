# Changelog

## v13.0.3 — Odoo LINE OA v10 (2026-10-02)

- Missing product images use the camera placeholder PNG; image fetch times out to the same PNG.
- Sales known commands still run after idle. Removed GitHub `ci.yml` (failed on v13.0.2); verify with laptop `npm test`.

## v13.0.2 — Odoo LINE OA v10 (2026-10-02)

- Customer Home catalog uses Sales `searchProducts` (many SKUs) and defers Odoo so LINE HMAC is not blocked. Shop chrome is env-only; add-to-cart still fail-closes without `website_sale`.
- Sales Home no longer awaits `syncStaffProfile`; staff sync + `QUOTE LIST` stay a follow-up push.

## v13.0.1 — Odoo LINE OA v10 (2026-10-02)

- Sales OA keeps quote/CRM commands (`QUOTE LIST` / `QUOTE CREATE` / `QUOTE SEND`). Customer OA is quote XOR shop: ecommerce published catalog + My Cart when `CUSTOMER_COMMERCE=shop` is live; otherwise Order Now and Send message to Sales as before.
- Shop: carousel Add to Cart, details Order Now, Remove only on in-cart SKUs, empty cart returns catalog. Staging sibling `:8081`.

## v12.0.6 — Odoo LINE OA v9 (2026-10-01)

- Staging sibling keeps `/webhook-test` off. LINE Sales/Customer stay on production HMAC `/webhook`. CI skips Dependabot. Laptop `ops:staging` for health/logs.

## v12.0.5 — Odoo LINE OA v9 (2026-10-01)

- CI: pin transitive `@grpc/grpc-js` / `brace-expansion`. Removed GitHub `staging-vps` workflow. Staging is laptop `npm run deploy:vps-staging` plus `ops:local` / `ops:staging`. Sibling compose enables `/webhook-test`.

## v12.0.4 — Odoo LINE OA v9 (2026-10-01)

- Customer Products & Orders: Find a product above Order History. Catalog short description uses the quote-waiting paper note.

## v12.0.3 — Odoo LINE OA v9 (2026-09-29)

- CI: PRODUCT FIND no longer asserts a staff-only `searchProducts` source string.

## v12.0.2 — Odoo LINE OA v9 (2026-09-29)

- CI: Customer PRODUCT FIND source assertion matches shop vs staff catalog search.

## v12.0.1 — Odoo LINE OA v9 (2026-09-29)

- Customer commerce is exclusive quote XOR shop (`CUSTOMER_COMMERCE`). Shop Flex: cart, order process, optional coupon, web Pay, payment callback, Order completed.
- Admin Tenants/Live/Studio surfaces; demo write gates use live `resolveDemoEnabled()`.

## v11.0.5 — Odoo LINE OA v8 (2026-09-28)

- Customer catalog Price uses the same teal highlight box as Order Total. Quote Received, Order History above Home, Sales More|Home, More Cancel|Back.

## v11.0.4 — Odoo LINE OA v8 (2026-09-28)

- VPS deploy ships the image over SSH when Docker Hub push is denied; staging and production Compose projects stay isolated.
- Jobs Save accepts a pasted token that matches the VPS `ADMIN_SECRET_TOKEN` without overlay overwrite while `ADMIN_CONFIG_LOCK` is on.
- `staging-vps` Actions job always runs (green when opt-in is off). Customer catalog amount stays Flex `xl`.

## v11.0.3 — Odoo LINE OA v8 (2026-09-27)

- CI tests match tenant-scoped channel overlay keys, catalog carousel channel args, and locked Admin bootstrap.

## v11.0.2 — Odoo LINE OA v8 (2026-09-27)

- Catalog product images use the public `/catalog` path; FIND by id no longer falls through to name search; details attach heroes when Odoo has `image_128`.
- `MONGO_USERS` follows runtime overlay like other optional flags; deferred catalog never pushes in group/room chats.
- Locked Admin settings PUT returns 403 instead of a false success; overlay i18n applies on the portal.

## v11.0.1 — Odoo LINE OA v8 (2026-09-27)

- Customer OA: HTTPS heroes only when image bytes exist; keyboard rich-menu; qty chips; glossary; `Sora:`.
- Sales OA: Home is commerce menu plus quote list (page 5); inbound Create quote RFQ; salesperson name after approve.
- Admin Commands: prefix read-only; optional inbound aliases; channel glossary labels prefer uiOnly rows.
- Agent contract: `documents/LINE_OA_AGENT.md` and `documents/AGENTIC_PROMPT.md`.

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
