# Demo day — 19 September 2026

Presenter script for a walkable architecture demo. Live surface: `https://amardhaka.io/demo`. Web chat uses the same `resolveCommandReply` as LINE.

## Do not say

- GraphQL is how LINE events arrive.
- Mongo is the ERP or the user store.
- Admin is “just a LINE user who verified Odoo.”

## Stores in one sentence

Firestore holds LINE identity, PDPA, guided-form `pendingFlow`, group-buy sessions, audit, and chat history. Odoo holds partners, products, and quotations via `getErpAdapter()`. Mongo (optional) holds `skill_embeddings` and `chat_embeddings` only.

## Talk track (about 12 minutes)

1. Open `/demo`. You should see the HTML panel, not JSON. Paste `DEMO_CONTROL_TOKEN` (or `OPS_API_TOKEN` if they are the same), click **Login Session**, then **Refresh Connections**: LINE, Firestore, Odoo. Mongo may be “not configured” — that is fine.
2. Open **Interactive Bot — Web Chat**. Send any first message. Expect PDPA + home menu. Same router as `POST /webhook`.
3. Use **Try “create a quote”** or type `FORM QUOTE CREATE`. Complete the guided fields. A real `sale.order` is created when Odoo is up. On LINE, identity VERIFY comes first; staff mutations still need Action Verify (step-up OTP) on the final write.
4. Click **Run Full Simulation Flow**. Walk seed, partner, product, quotation readback.
5. Ops add-ons, not the bot: `/api-docs` and `POST /graphql` (ops token). Do not send LINE webhooks here.
6. Close: admin chain is LINE identity → Firestore profile → `odooVerified` → `ADMIN_USER_ID` allowlist → Odoo admin capability. Fail closed.
7. On LINE, **FORM VERIFY**: the phone field chips the number already on the LINE session (and the Odoo contact matching the LINE display name). Tap the chip, then OTP / magic link.
8. After VERIFY, the success card uses the Odoo partner name: **“Somchai is an Odoo Sales User.”** (or Sales Administrator / customer). Not a generic “verification completed.”

**Async LINE (BullMQ) stays off** unless Redis and a long-lived worker are running. Do not enable it on scale-to-zero for this demo. Staging compose already sets `LINE_WEBHOOK_ASYNC=false` and `RUN_BULLMQ_WORKER=false`.

## Commands worth typing live

| Command | Why |
|---|---|
| `NAV HOME` | Channel-gated Flex menu |
| `NAV commerce` | Sales actions or customer shop |
| `FORM PRODUCT FIND` | Catalog search in Odoo (staff) |
| `FORM QUOTE CREATE` | Commerce write path |
| `QUOTE LIST` | Readback |
| `QUOTE SEND <id>` | LINE / email / both to Customer OA |
| `VERIFY STATUS` | Identity, not admin |
| `ADMIN ENABLE` | Role privilege; fails closed off the allowlist |
| `SKILLS` | Markdown skills cannot override TS commands |

## Module map

`GET /demo/platform` and GraphQL `platformModules` (ops auth) return `src/platform/service-modules.ts`. That catalog is inventory and talk track, not a second command router.

## If something is red

- Odoo ping fails: still show chat + PDPA + home; skip quotation create.
- Firestore missing: identity and forms will fail; stop and fix `GOOGLE_CLOUD_PROJECT`.
- LINE token missing: `/demo/chat` still works; live OA webhook will not.
