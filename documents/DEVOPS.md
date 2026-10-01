# Local and staging DevOps

Production HMAC (`:8080`, LINE Sales/Customer) stays as-is until staging is signed off. Do not run `npm run deploy:vps-prod` until then.

| Lane | Where | Port | `APP_ENV` | LINE HMAC | Admin |
|---|---|---|---|---|---|
| Local | laptop `npm run dev` | `127.0.0.1:8080` | `development` | `/webhook-test` (no HMAC) | `/admin` |
| Staging | `ssh amardhaka` → `/opt/cns-line-oa` | `127.0.0.1:8081` | `staging` | **off** (same OA tokens as prod — do not dual-bind) | `https://amardhaka.io/cloudnex-connect/admin/test` |
| Production | `/opt/cloudnex-connect` | `127.0.0.1:8080` | `production` | `https://amardhaka.io/webhook/sales` and `/webhook/customer` | `/cloudnex-connect/admin/` |

One Odoo per process (`ODOO_URL` in that lane’s `.env`). Staging and production `.env` files are independent. Public `https://amardhaka.io/healthz` is **production**.

## Daily loop

```bash
# local
npm run dev                 # or npm run dev:fg
npm run ops:local
npm run ops:local -- logs

# ship to staging (laptop SSH + Docker Hub)
npm test && npm run lint
npm run deploy:vps-staging
npm run ops:staging
npm run ops:staging -- logs
```

GitHub Actions is **CI only** (`lint` / `build` / `test` / `npm audit --omit=dev --audit-level=high` on `main` and PRs). Staging deploy is not an Actions workflow.

## SSH and logs

```bash
ssh amardhaka
cd /opt/cns-line-oa
docker ps --filter name=cns-line-oa-staging
docker logs --tail 120 cns-line-oa-staging
docker logs --since 2h cns-line-oa-staging 2>&1 | grep -Ei 'error|fatal|unhandled' | tail
curl -sS http://127.0.0.1:8081/healthz
set -a; . ./.env; set +a
curl -sS -H "Authorization: Bearer $OPS_API_TOKEN" http://127.0.0.1:8081/ops/platform \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('flags',{}).get('appEnv'), d.get('ready'), d.get('customerCommerce'))"
```

`OPS_API_TOKEN` lives in `.env`, not in the SSH session, until you `set -a; . ./.env`.

## Staging vs LINE

Customer/Sales OA use production HMAC `POST /webhook/sales` and `POST /webhook/customer` on `:8080`. Staging `:8081` does not bind those OAs (`ENABLE_WEBHOOK_TEST` off). After staging is stable, update production `.env` Odoo if needed, then `SKIP_BUILD=1 npm run deploy:vps-prod`.

Never commit `.env`. Compose rsync never uses `--delete`.
