# MGT implementation playbook (SOW v1.1)

Internal Cloudnex delivery notes. Commercial pricing stays in the separate proposal. This repo (**cloudnex-connect**) is LINE OA plus a small Odoo notify addon. Sales/catalog JSON-RPC stays `getErpAdapter()` using current `ODOO_*` env. Do not put e-Tax or carrier APIs here.

Working assumptions until the 28 Sep meeting (SOW §13): VERIFY by partner phone; no matching contact → no auto SO; internal approvals in **Odoo**; LINE notifies; invoice stays **manual**; tracking is free text; OEM = MGT supplies packaging to factory.

## Phase 1 — Odoo 19 foundation

Master data and BoMs stay in the **current** Odoo database (not duplicated in Node). LINE notify addon: [odoo/addons/cloudnex_connect_notify](../../odoo/addons/cloudnex_connect_notify).

Apps: Sales, Inventory, Purchase, Accounting, Manufacturing.

1. Master data: products (OEM + repack SKUs), BoMs, customers, suppliers, price lists.
2. Sales → delivery → invoice in Odoo.
3. BoMs: Abamectin-style packaging; Nutripak-style (kg weights TBD, OI-18).
4. Purchase: vendors by material, PO, reordering rules (alert only, OI-20).
5. Sales dashboard v1 (standard reporting).
6. UAT + sign-off (SOW §12).

## Phase 2 — LINE (this repo) + Odoo automation

LINE: two OAs, draft SO from Customer OA, staff quote on Sales OA, status Flex, delivery card from `stock.picking`, ops hook for shipped / approval notify. Staging: [documents/VPS_STAGING.md](../VPS_STAGING.md). UAT captures: [USER_JOURNEY.md](../USER_JOURNEY.md).

Odoo: three-stage approval (rep → supervisor → manager), subcontracting, executive dashboard, low-stock. Approvers act in Odoo; LINE “Open in Odoo” unless MGT chooses LINE approve (OI-7).

Odoo can POST `https://amardhaka.io/ops/odoo-hook` with `Authorization: Bearer $OPS_API_TOKEN` and `{ "event": "picking.done"|"approval.stage", "orderId": <sale.order id> }`.

## Section 13 working assumptions (pending MGT)

| OI | Working default |
|---|---|
| 2–3 | VERIFY by partner phone. No match → no auto SO; sales create partner. |
| 5 | No SLA timeout in LINE. |
| 6 | Reject stays in Odoo; LINE notify Sales OA via `approval.stage`. |
| 7 | Approvers act in Odoo (not LINE approve). |
| 8 | All orders three levels until MGT says otherwise. |
| 9 | Invoice stays manual (`QUOTE INVOICE` / Odoo). |
| 12 | Tracking = picking `carrier_tracking_ref` free text. No carrier HTTP. |
| 13 | Responsible = picking `user_id`. |
| 15 | MGT supplies packaging to factory. |
| 20 | Reorder = Odoo alert only. |

## UAT

- LINE Customer C0–C5 and Sales S1–S4: [USER_JOURNEY.md](../USER_JOURNEY.md).
- Delivery: `ORDER STATUS` shows picking state / dates / tracking text / responsible user.
- Internal approval: Odoo stage change → Sales OA notify (hook), not a second LINE router.

## SOW §12 sign-off (per phase)

Eligible when:

1. Environment matches that phase’s SOW scope (Phase 1 = Odoo; Phase 2 LINE = this staging OA + playbook automation).
2. MGT process owners finish UAT with no unresolved critical defects.
3. Agreed end-user training for that phase is delivered.

Keep a dated row (phase, testers, defects, training date) outside this git if it contains customer names.

## Out of scope

Thai e-Tax, carrier APIs, hardware, historical migration, committing `.env`.
