# Cloudnex Connect — demonstration pack

**Release:** v15.0.6 · **Persona:** Sora / โซระ · **Product:** LINE Official Account + Odoo, one command router, fail-closed Admin.

This is the pack for a client meeting, a live event, or a running-client walkthrough. It is not a lab notebook. Local mocks stay on the laptop.

| Document | Use in the room |
|---|---|
| This file | Talk track, URLs, fail-closed proof |
| [USER_JOURNEY.md](USER_JOURNEY.md) + `documents/journey/` | LINE stills and tap order |
| [LINE_OA_AGENT.md](LINE_OA_AGENT.md) | Canonical command vs EN/TH label |
| [ENVIRONMENTS.md](ENVIRONMENTS.md) | Lane contract |
| [DEMO_DAY.md](DEMO_DAY.md) | Laptop `/demo` only (R&D) |

If this file disagrees with running TypeScript, **the code wins**.

---

## 1. Environment contract

| Lane | Who uses it | What it is for | What it is not |
|---|---|---|---|
| **Local** (`APP_ENV=development`) | Engineers | Development, mock LINE (`/webhook-test`), stubs, experimental flags, R&D | Not a client demo. Not HMAC. |
| **Staging** (`APP_ENV=staging`) | Presenters, current clients, events | Showcase of the full product: same Admin and API as production at `/cloudnex-connect/admin/test` | Not a place to enable `/webhook-test` or mock LINE |
| **Production** (`APP_ENV=production`) | Operators after client sign-off | Same image and product as staging, Admin `/cloudnex-connect/admin`, live HMAC `/webhook*` | Do not treat as a second product. Cut over LINE/Odoo URLs when the client is ready |

Staging and production stay **the same software** until a client cutover. The Admin URL is the visible difference. LINE Messaging API webhooks currently land on production `:8080` (`/webhook/sales`, `/webhook/customer`). Staging Admin is the console you open in the meeting. Secrets stay in each host `.env` (never committed).

---

## 2. Surfaces for a professional walkthrough

| Surface | URL | What to show |
|---|---|---|
| Health | https://amardhaka.io/healthz | Process is up |
| Ready | https://amardhaka.io/readyz | LINE + Firestore + Odoo |
| Staging Admin (showcase) | https://amardhaka.io/cloudnex-connect/admin/test | OPS login, Help FAQs, Home, Identity, CRM |
| Production Admin (cutover hold) | https://amardhaka.io/cloudnex-connect/admin | Same SPA; different path |
| Cloudnex Sales OA | LINE `@938qytwi` · HMAC `POST /webhook/sales` | Staff: VERIFY, quotes, send |
| Cloudnex Customer OA | LINE `@724tneri` · HMAC `POST /webhook/customer` | Guest catalog, Order Now, approve |

Do not open laptop `/demo` or `/webhook-test` in a client room.

---

## 3. Architecture in 60 seconds

1. LINE signs every chat event (HMAC). Invalid signature is 401.
2. Identity lives in Firestore (LINE user → profile → `odooVerified`).
3. One function, `resolveCommandReply`, builds every reply. Extra ingresses (second webhook, GraphQL ingest) reuse it.
4. Partners, products, and `sale.order` stay in Odoo through `getErpAdapter()`. Mongo is never Odoo.
5. Admin role is fail-closed: LINE id → profile → verified → `ADMIN_USER_ID` → Odoo admin capability → `role=admin`.
6. Flex buttons send **canonical English prefixes**. Users see EN/TH labels from Admin Commands.

---

## 4. Twelve-minute LINE showcase

Use dummy partners. Never screenshot OTP or live PII. English default; Thai only after Language.

| Min | OA | Action | Result |
|---|---|---|---|
| 0–1 | Customer | Add friend / first message | PDPA + product carousel Home |
| 1–3 | Customer | Find product → Order Now with a new phone | New guest `res.partner` (`guestPartnerId` only), draft SO, cap 3/24h. No `odooVerified`. |
| 3–4 | Sales | First message without VERIFY | Verify card only (help/language allowed) |
| 4–6 | Sales | `FORM VERIFY` with Sales User phone | Gold Verify; Home commerce + quote list. Miss: **Ask admin** + Another phone. |
| 6–8 | Sales | Create quote → Create now | Draft quotation card. Skip / Add more / Send |
| 8–10 | Sales | Send LINE | Odoo `sent`. Customer OA receives Quote Received + Confirm (or Add friend) |
| 10–12 | Customer | Confirm | Sales Order. Staff notified. Invoice path on staff card |

Stills: [USER_JOURNEY.md](USER_JOURNEY.md) C0–C5 (Customer), B1–B11 (Sales create/send), C1–C4 (approve/invoice).

---

## 5. Eight-minute Admin showcase

Open **staging** Admin. Sign in with `OPS_API_TOKEN` (panel password). Bind is a separate cookie (Identity → OTP on Sales OA).

| Min | Page | Show |
|---|---|---|
| 0–1 | Help | FAQ toggles. Lane table: Local R&D, Staging showcase, Production hold |
| 1–3 | Home | App / Firestore / Odoo pills. Traffic is real HMAC, not Admin clicks |
| 3–5 | Identity | Bind steps behind FAQ (warn, then steps). Actor pill |
| 5–6 | Products / CRM | Live Odoo catalogue and quotes |
| 6–8 | Commands / Settings | Overlay labels; secrets masked until reveal |

Runbooks always follow one pattern: **generic FAQ title → open → warn → numbered steps**. JSON dumps stay collapsed.

---

## 6. Proof points (say these, then stop)

- Same image on staging and production (`razenjazzy/cloudnex-connect:staging`).
- Demo control panel and `/webhook-test` are **off** on both VPS lanes even if flags are set in production.
- Guest Order Now never attaches to an existing contact by phone.
- Sales unmatched phone notifies `ADMIN_USER_ID`; it does not create `res.users`.
- `GET /ops/platform` (OPS token) reports `env.missingRequired` without printing secrets.

---

## 7. If something is red

| Symptom | Stay in the room | Do not do |
|---|---|---|
| Odoo ping fail | Show Home Flex and Admin Help | Do not invent prices |
| Firestore unset | Stop identity demo | Do not claim VERIFY works |
| Wrong LINE signature | Admin Logs “bad signatures” | Do not paste channel secrets on a slide |
| Staging Admin 404 | Confirm `/admin/test` not `/admin` | Do not switch HMAC ports |

---

## 8. Cutover (when the client is ready)

Production is already the live HMAC process. Cutover is configuration, not a second codebase:

1. Client Odoo (`ODOO_*`) and LINE credentials on `/opt/cloudnex-connect/.env`.
2. Messaging API webhook URLs remain `https://amardhaka.io/webhook/sales` and `/webhook/customer` unless the client brings their own host.
3. Recreate the production container. Do not copy laptop `.env`.
4. Staging stays the showcase copy (`/admin/test`) until the next event.
