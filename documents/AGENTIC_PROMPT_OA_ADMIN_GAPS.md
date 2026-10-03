# Agent prompt — Fix Customer OA, Sales OA, and Admin panel gaps

Companion to [`AGENTIC_PROMPT.md`](AGENTIC_PROMPT.md) (storyboard, non-negotiables, language layers) and [`LINE_OA_AGENT.md`](LINE_OA_AGENT.md) (command Action→Result tables). **Read those rules; do not copy them here.** If any doc disagrees with TypeScript, the code wins; fix both in the same change.

You are a principal engineer on `cloudnex-connect` (TypeScript Express + LINE OAs + Odoo + React Admin in `admin/`). Mission: **close every verified gap in Customer OA, Sales OA, and the Admin panel, with proof, not claims.**

## Hard rules

- No new npm packages. No production deploy (`deploy:vps-prod`, Cloud Run, `release.yml`). Never read or print `.env` values. Commit only when asked, style `Release: vX.Y.Z - Odoo Line OA vN …`.
- One `resolveCommandReply`. Flex buttons emit **canonical** command text. ERP access only via `getErpAdapter()`. Do not weaken the admin chain or step-up OTP.
- Flex/tray are **frozen** per `USER_JOURNEY.md`: fix defects, do not restyle. A visual change needs a failing journey step to justify it.
- Smallest reads first (grep → ranged read). Smallest test first; full `npx vitest run` + `npx tsc --noEmit` + `npm run lint` only before reporting done.
- A fix without a regression test and live evidence is not done. Past failures here were silent `catch {}` blocks hiding real errors; **never add a catch that swallows without a log line.**

## Phase 0 — Verify before you fix (output a Gap Ledger)

Build a table `ID | Surface | Symptom | Root cause (file:line) | Evidence | Status`. Reproduce each item against the **live staging Odoo** (read-only RPC from `dist/` via a throwaway node script outside the repo) or `/webhook-test`/`npm run cli -- chat`. Mark each: `CONFIRMED`, `ALREADY FIXED`, or `CANNOT REPRODUCE` (say why). Do not fix anything unledgered.

Seed items (verified or reported; confirm each):

| ID | Item | Where to look |
|---|---|---|
| G1 | **Camera placeholder on every product card** (Customer/Sales home carousel, catalog, product details). Cause found: `productIdsWithImage128` searched computed `image_*` fields on `product.product`, Odoo raised, a silent catch returned "no photos". Fix exists in working tree (`src/services/odoo/product-image.ts`, test `tests/product-image-detection.test.ts`). | Confirm it is committed, deployed, and that staging cards show photos. Product with no photo must still show the camera. |
| G2 | Hero image is fetched at **128px** (`readImageField` tries `image_128` first) → blurry on full-width hero. | `product-image.ts`; prefer 256/512 only if the PNG stays under LINE's 1 MB hero cap and the 8 s fetch timeout in `media-routes.ts`. Measure size and latency, don't guess. |
| G3 | WebP→PNG relies on external `dwebp` (`libwebp-tools`). Missing binary ⇒ silent null ⇒ camera. | Both Dockerfiles install it; confirm the **actual VPS/staging** runtime has it, and that a missing binary logs once at startup/readyz instead of failing silently. |
| G4 | `PUBLIC_BASE_URL` not https ⇒ `publicCatalogProductImageUrl` returns undefined ⇒ no hero at all. | `src/erp/product-image-url.ts`; surface this in `/readyz` or `/ops/platform` as a named check. |
| G5 | **Sales OA "not fixed"** — reporter did not say what. | Walk the Sales storyboard in `AGENTIC_PROMPT.md` beat by beat (dual Home, unassigned→`QUOTE ASSIGN`, RFQ `FROM CARD`, `QUOTE SEND`, `QUOTE CONFIRM`, page-5 list, salesperson name after approve). Report each beat pass/fail with the actual reply payload. If every beat passes, say so and list what you ran. |
| G6 | **Customer OA** beats: carousel, Order Now qty chips, View Details, Send Message, Ask for Quotations, Order History page 5, Approve. Plus the "must not run" list (`ADMIN *`, `QUOTE ASSIGN`, `RELAY *`, etc.) actually refused on `/webhook/customer`. | `process-message.ts`, `service-catalog.ts`, `handlers/*`. |
| G7 | EN default / TH only after Language; no mixed-language chrome (e.g. `FORM FIELD 8` with no open form). Agent prefix `Sora:` / `โซระ:` only once and never inside product names. | `src/services/i18n.ts`, `withAgentColon`. |
| G8 | Dark-mode legibility: every Flex bubble forces light surfaces and explicit ink colors. | `src/line/templates/*` (grep for text elements without explicit `color` on a non-forced background). |
| G9 | Quick-reply limits: ≤13 items, labels ≤20 chars, ≤5 messages per reply, hero URLs https and public. LINE rejects the **whole** reply otherwise. | `message-limits.ts`; add a test that builds each card type with worst-case data. |
| G10 | Rich menu / keyboard tray: unlink-then-link ids, compact 2×3 tray, blank keyboard menu during qty/form input. | `scripts/*rich-menu*`, `LINE_RICH_MENU_*` env (names only). |

## Phase 1 — Admin panel gap audit (`admin/src/*`, `src/http/admin-api-routes.ts`)

For every nav item (Overview, Bind, Directory, Privileges, Language, Channels, Campaigns, Products, Catalog, CRM, Group-Buy, Approvals, Commands, Jobs, Reporting, Settings, Audit) record: backend route exists? UI wired? loading/empty/error state? EN/TH keys present (`admin/src/i18n.ts`)? auth/role gate correct? Then check these specific suspected gaps and confirm or discard each:

| ID | Suspected gap |
|---|---|
| A1 | **No catalog health view**: admin cannot see which products have a photo vs fall back to the camera, nor the placeholder count, nor why. Add read-only photo coverage to the existing `/live/products` response and the Products/Catalog page (id, name, hasPhoto, source), no new route unless unavoidable. |
| A2 | Admin Commands: prefix column read-only; EN/TH edits ≤20 chars validated **server-side**, not just in the UI; alias collisions rejected with a readable message; a "preview as LINE button" for the edited label. |
| A3 | Per-channel scoping: Sales OA vs Customer OA vs Unscoped is visible and consistent on Commands, Toggles, Campaigns, Audit. A toggle or command edit cannot silently apply to the wrong OA. |
| A4 | Every mutating admin action (`PUT /commands|toggles|settings|pricing|tenant|i18n`, `POST /jobs/:name|campaigns/*|line-channels`) writes an audit event with actor, channel, request id, and diff summary; `GET /audit-log` shows it. |
| A5 | Secrets: `PUT /secrets` and reveal flows never log or return secret values outside the reveal path; reveal is rate-limited and audited. |
| A6 | UI states: every panel has loading, empty, error, and permission-denied states; no raw JSON error dumps; keyboard focus and mobile width (≥360px) usable. |
| A7 | Health/ops visibility: `/readyz` and `/ops/platform` report Odoo reachability, `dwebp` presence, https `PUBLIC_BASE_URL`, rich-menu ids configured, and webhook channel config per OA, as named checks the Overview page renders. |
| A8 | Campaign send: preview and test-send before broadcast, recipient count shown, idempotency key honored, quota/failure surfaced. |

## Phase 2 — Fix in risk order

1. Anything that makes LINE reject a whole reply or drops a channel (G9, G4, G10).
2. Customer-visible wrong or missing data (G1–G3, G6, G7).
3. Sales workflow breaks (G5).
4. Admin correctness/security (A4, A5, A3, A2).
5. Admin visibility and UX (A1, A7, A6, A8).

Per fix: failing test first, minimal root-cause change, test passes, then one live check. Keep the diff surgical; barrel files stay import-compatible (`firestore.ts`, `odoo.ts`, `templates.ts`, `index.ts` are split).

## Phase 3 — Prove it

- Run the full suite, typecheck, lint, `npm run build` (includes the admin Vite build).
- Walk both storyboards through `/webhook-test` or the `cns` CLI with a **new** userId for Customer and a verified Sales admin for Sales; paste the key reply payloads (card titles, button `action.text`, quick-reply counts).
- For images: fetch `{PUBLIC_BASE_URL}/catalog/product/{id}/image?v=png` for one product with a photo and one without; the first must differ from the placeholder.
- Update `USER_JOURNEY.md` only for steps whose behavior changed, `BACKLOG.md` for anything deferred, and `LINE_OA_AGENT.md` where a command/label/env changed.

## Output contract (final message)

1. Gap Ledger (final statuses). 2. Files changed, one line each. 3. Tests added and commands run with results. 4. Live evidence. 5. Required env/config/deploy steps (names only). 6. Remaining limitations and anything you could not verify, stated plainly.

Done means: no `CONFIRMED` item left open without a written reason, `tsc`/lint/tests green, staging evidence attached.
