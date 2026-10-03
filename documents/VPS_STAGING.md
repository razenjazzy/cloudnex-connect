# Cloudnex Connect on amardhaka.io (two VPS lanes)

Secrets stay on the VM — never commit `.env`. Laptop **builds and pushes** `razenjazzy/cloudnex-connect:staging`. The VPS **docker pull**s that image (no `npm install` / `npm ci` on the host).

LINE HMAC → Firestore profile → one `resolveCommandReply` → Flex. Webhooks (`/webhook*` and `/cloudnex-connect/webhook*`) are proxied to **staging** `:8081` by nginx, so the staging `.env` must hold the Sales and Customer OA credentials. `webhook-test` stays off on staging.

| Lane | Directory | Port | Admin | Compose | `APP_ENV` |
|---|---|---|---|---|---|
| Production | `/opt/cloudnex-connect` | `127.0.0.1:8080` | `https://amardhaka.io/cloudnex-connect/admin/` | `docker-compose.production.yml` | `production` |
| Staging | `/opt/cns-line-oa` | `127.0.0.1:8081` | `https://amardhaka.io/cloudnex-connect/admin/test` | `docker-compose.sibling.yml` | `staging` |

| | |
|---|---|
| Domain | `https://amardhaka.io` |
| Host | `root@187.127.179.49` |
| Image | `razenjazzy/cloudnex-connect:staging` |
| Sales webhook | `POST https://amardhaka.io/cloudnex-connect/webhook/sales` (8081; `/webhook/sales` also works) |
| Customer webhook | `POST https://amardhaka.io/cloudnex-connect/webhook/customer` (8081; `/webhook/customer` also works) |

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

Merge [deploy/hostinger/nginx-amardhaka.conf.example](../deploy/hostinger/nginx-amardhaka.conf.example) into the `amardhaka.io` server. `proxy_pass http://127.0.0.1:8080` **without** a `/webhook` URI suffix so `/webhook/sales` and `/webhook/customer` are preserved. Forward `X-Line-Signature`. Put `location ^~ /cloudnex-connect/admin/test` and `^~ /cloudnex-connect/catalog/test` **before** `/cloudnex-connect/admin/` and `/cloudnex-connect/catalog/` so the sibling (8081) wins. LINE product images are `/cloudnex-connect/catalog/…`, not Admin. Old `/admin`, `/demo`, `/cloudnex-connect/admin`, and `/cloudnex-admin` 301 to `/cloudnex-connect/`.

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

## 8. Repeat deploy from laptop

SSH key that can `ssh amardhaka` (or `root@187.127.179.49`):

```bash
npm run deploy:vps-staging
npm run ops:staging
```

That rsync uses `deploy/staging-rsync.allowlist` only. It never uses `--delete` and never copies `.env`. GitHub does not deploy staging. Production later: `SKIP_BUILD=1 npm run deploy:vps-prod`. Operator loop: [DEVOPS.md](DEVOPS.md).

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

## Logs (one consolidated archive, hourly, 30-day retention)

`/var/log/cloudnex-connect/<source>/<YYYY-MM-DD>/<HH>.log` (current UTC hour) and `<HH>.log.gz` (closed hours). Sources:

| Source | What |
|---|---|
| `staging-app`, `production-app` | App container stdout: webhooks, verification, Odoo, replies, `http_access` for every route including Admin, `admin_action` for Admin changes |
| `staging-redis`, `production-redis` | Redis containers |
| `edge-nginx-access`, `edge-nginx-error` | nginx for the amardhaka.io vhost only (own log files, `cnx` format in `/etc/nginx/conf.d/cnx-log-format.conf`) |

Every line starts with a UTC ISO timestamp. Folder is `750 root:<gid 101>` (LINE user ids inside), so the app container can read it through the read-only mount.

- Written hourly (minute 5) by root's crontab: `/usr/local/bin/cloudnex-log-archive` (source `scripts/vps-log-archive.sh`; cron line in `deploy/hostinger/crontab.example`). Hours older than 2 h are gzipped; files older than `RETENTION_DAYS` (default 30) are deleted. `.archive-last-run` shows the last successful run.
- **Admin -> Logs -> Application logs** reads it (compose mounts the folder read-only): source, hours, level, text and request id filters, with top problems and HTTP error counts.
- Docker's own json-file log is capped at 50 MB x 5 per container (compose `logging:` block).
- Read it from this machine: `npm run logs:pull` mirrors the folder to `./logs/vps` (git-ignored). Then e.g. `grep webhook_signature_invalid logs/vps/staging-app/*/*.log`.
- Live: `ssh amardhaka 'docker logs -f --since 30m cns-line-oa-staging'`.
- The Firestore audit log (Admin -> Logs -> Ops audit) is separate: who did what, kept per `AUDIT_RETENTION_DAYS`.
