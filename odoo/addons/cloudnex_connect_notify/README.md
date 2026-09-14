# Cloudnex Connect — LINE notify (current Odoo)

Uses the same Odoo database already configured as `ODOO_URL` / `ODOO_DB` on `/opt/cloudnex-connect/.env`. Does not add a second ERP.

## Install

Add this directory to the Odoo addons path, update apps list, install **Cloudnex Connect LINE notify**.

Settings → Technical → Parameters:

- `cloudnex.public_base_url` = `https://amardhaka.io` (staging)
- `cloudnex.ops_token` = same value as VPS `OPS_API_TOKEN` (never commit)

Outgoing `stock.picking` → `done` POSTs `{ "event": "picking.done", "orderId": <sale.order id> }` to `/ops/odoo-hook`.

For internal approval stages, add an automated action on `sale.order` that runs Python: `records.cloudnex_notify_approval()`.

LINE still talks to this Odoo only through `getErpAdapter()` in the Node app.
