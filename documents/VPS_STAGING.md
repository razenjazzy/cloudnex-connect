# Cloudnex Connect on amardhaka.io (two VPS lanes)

Secrets stay on the VM — never commit `.env`. Laptop **builds and pushes** `razenjazzy/cloudnex-connect:staging`. The VPS **docker pull**s that image (no `npm install` / `npm ci` on the host).

LINE HMAC → Firestore profile → one `resolveCommandReply` → Flex. Webhooks stay on **production** `:8080`.

| Lane | Directory | Port | Admin | Compose | `APP_ENV` |
|---|---|---|---|---|---|
| Production | `/opt/cloudnex-connect` | `127.0.0.1:8080` | `https://amardhaka.io/cloudnex-connect/admin/` | `docker-compose.production.yml` | `production` |
| Staging | `/opt/cns-line-oa` | `127.0.0.1:8081` | `https://amardhaka.io/cloudnex-connect/admin/test` | `docker-compose.sibling.yml` | `staging` |

| | |
|---|---|
| Domain | `https://amardhaka.io` |
| Host | `root@187.127.179.49` |
| Image | `razenjazzy/cloudnex-connect:staging` |
| Sales webhook | `POST https://amardhaka.io/webhook/sales` (8080) |
| Customer webhook | `POST https://amardhaka.io/webhook/customer` (8080) |

Each lane has its own `/opt/.../.env`. Staging deploy seeds `/opt/cns-line-oa/.env` from production only if the sibling file is missing.

---

## 1. First boot (Ubuntu)

Do not edit other vhosts (`golpocom.com`, `shahbaizidarefin.com`).

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

DNS: A `@` → `187.127.179.49`. CNAME `www` → `amardhaka.io`.

## 2. App directory (no secrets)

```bash
mkdir -p /opt/cloudnex-connect /opt/cns-line-oa
```

From a laptop with this repo (rsync excludes `.env`):

```bash
npm run deploy:vps-staging   # /opt/cns-line-oa
npm run deploy:vps-prod      # /opt/cloudnex-connect (SKIP_BUILD=1 after the first build)
```

Or copy the tree once without `.env`, then fill env (step 3) before compose.

## 3. Server `.env` (never git)

```bash
cd /opt/cloudnex-connect
cp deploy/env/staging.example .env
# edit .env on the server: LINE Sales + Customer tokens, Firestore JSON, Odoo, ADMIN_USER_ID, OPS/DEMO/WEBHOOK tokens
bash scripts/check-line-channels.sh .env
```

Required for two OAs:

- Sales: `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_BASIC_ID=@938qytwi` (or `LINE_CHANNEL_SALES_*`)
- Customer: `LINE_CHANNEL_CUSTOMER_SECRET` / `_ACCESS_TOKEN` / `_BASIC_ID=@724tneri` / `_SERVICES=commerce,catalog`
- `ADMIN_USER_ID` = Cloudnex Sales LINE user ids
- `SUPER_ADMIN_USER_IDS` = LINE ids allowed to bind/reveal (fail closed if unset)
- `CONNECT_BOOTSTRAP_TOKEN` from `scripts/bootstrap-cloudnex-connect.sh` (printed once)
- `APP_ENV=production` on `/opt/cloudnex-connect`, `APP_ENV=staging` on `/opt/cns-line-oa`, `PUBLIC_BASE_URL=https://amardhaka.io/cloudnex-connect`
- Production: `PUBLIC_ADMIN_BASE=/admin`. Staging sibling: `PUBLIC_ADMIN_BASE=/admin/test`.

Install (one-shot): `POST https://amardhaka.io/cloudnex-connect/api/bootstrap` with the bootstrap token (Swagger tag `install`). Second call is 410. Google credential JSON stays a mounted file/env secret on this same path.

Rotate channel secrets that were pasted in chat.

## 4. Compose (Docker Hub pull)

Compose bind is `127.0.0.1:8080` only. Set `DOCKER_IMAGE=razenjazzy/cloudnex-connect:staging` on the server `.env` (optional; compose defaults to that name).

```bash
cd /opt/cloudnex-connect
docker pull razenjazzy/cloudnex-connect:staging
docker compose -f deploy/hostinger/docker-compose.production.yml --env-file .env up -d --no-build --pull always
curl -sS http://127.0.0.1:8080/healthz
```

Repeat deploys from a machine logged into Docker Hub: `npm run deploy:vps-staging` then `SKIP_BUILD=1 npm run deploy:vps-prod`. Cloud Run: `npm run deploy:prod` (signoff). Local tunnel: `scripts/deploy-cloudflare.sh`.

## 5. Nginx + TLS

Merge [deploy/hostinger/nginx-amardhaka.conf.example](../deploy/hostinger/nginx-amardhaka.conf.example) into the `amardhaka.io` server. `proxy_pass http://127.0.0.1:8080` **without** a `/webhook` URI suffix so `/webhook/sales` and `/webhook/customer` are preserved. Forward `X-Line-Signature`. Put `location ^~ /cloudnex-connect/admin/test` **before** `/cloudnex-connect/` so the sibling (8081) wins. Old `/admin`, `/demo`, `/cloudnex-connect/admin`, and `/cloudnex-admin` 301 to `/cloudnex-connect/`.

```bash
nginx -t && systemctl reload nginx
certbot --nginx -d amardhaka.io -d www.amardhaka.io
```

## 6. LINE Developers

| OA | Webhook |
|---|---|
| Cloudnex Sales `@938qytwi` | `https://amardhaka.io/webhook/sales` |
| Cloudnex Customer `@724tneri` | `https://amardhaka.io/webhook/customer` |

`POST /webhook` still uses default Sales credentials.

After a tray layout change (`assets/rich-menu/layout.json`), from a machine with LINE tokens:

```bash
node --env-file=.env scripts/upload-rich-menu.mjs
```

Paste the printed `LINE_RICH_MENU_JSON` / `LINE_CHANNEL_CUSTOMER_RICH_MENU_JSON` into the VPS `.env` and restart compose. Staging compose starts Redis and sets `LINE_WEBHOOK_ASYNC=true` + `RUN_BULLMQ_WORKER=true` (overrides `.env`). Do not enable async on a host without Redis.

## 7. Smoke

- `GET https://amardhaka.io/healthz` — production lane (`appEnv=production`)
- `GET https://amardhaka.io/cloudnex-connect/admin/` — production Admin
- `GET https://amardhaka.io/cloudnex-connect/admin/test` — staging Admin
- `GET https://amardhaka.io/readyz` (`bootstrapComplete`)
- `GET /ops/platform` — `lineCustomerConfigured` true when Customer env is set

## 7b. Sibling process (`/opt/cns-line-oa`, port 8081)

`APP_ENV=staging`, `PUBLIC_ADMIN_BASE=/admin/test` (joined to `/cloudnex-connect/admin/test`). Own Redis in `deploy/hostinger/docker-compose.sibling.yml` so queue keys do not collide.

```bash
npm run deploy:vps-staging
curl -sS http://127.0.0.1:8081/healthz
```

Keep HMAC webhooks on **production 8080** unless the sibling has **distinct** LINE credentials. Do not dual-bind the same OA to both ports.

## 8. Repeat deploy from laptop / GitHub

Laptop (SSH key that can `ssh root@187.127.179.49`):

```bash
npm run deploy:vps-staging
SKIP_BUILD=1 npm run deploy:vps-prod
```

That rsync uses `deploy/staging-rsync.allowlist` only (compose + channel check + lockfile). It never uses `--delete` and never copies `.env`.

GitHub → repository variable `ENABLE_STAGING_VPS_DEPLOY=true`, Environments → **staging**: `VPS_SSH_KEY` (SSH private key only), `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`, optional `VPS_HOST`. Then push `main` runs `.github/workflows/staging-vps.yml`. Unset variable → job skipped. It **never** writes `.env`.

## 9. Rollback

`.env` stays put. Recreate from a previous git checkout on the VM, or `docker compose ... up -d` after `git checkout <commit>` of the app dir.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| LINE 400 HMAC | Wrong secret for that OA (`sales` vs `customer`) |
| `/webhook/customer` 404 | Empty `LINE_CHANNEL_CUSTOMER_SECRET` / token |
| Webhook 200 but no `/webhook/sales` | nginx `proxy_pass .../webhook` stripped the path — use the example location |
| Deploy refuses | `check-line-channels.sh` or lockfile SHA mismatch |

Out of scope: extra npm packages on the VM, other vhosts, committing VPS secrets.
