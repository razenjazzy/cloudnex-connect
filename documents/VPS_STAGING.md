# Staging VM: Cloudnex Connect on amardhaka.io

Formerly `/opt/cns-line-oa`. App directory is **`/opt/cloudnex-connect`**. Secrets stay on the VM — never commit `.env`.

LINE HMAC → Firestore profile → one `resolveCommandReply` → Flex. Laptop/CI **builds and pushes** `razenjazzy/cloudnex-connect:staging`. The VPS **docker pull**s that image (no `npm install` / `npm ci` on the host).

| | |
|---|---|
| Domain | `https://amardhaka.io` |
| Host | `root@187.127.179.49` |
| App | `/opt/cloudnex-connect` |
| Env | `/opt/cloudnex-connect/.env` (server only) |
| Image | `razenjazzy/cloudnex-connect:staging` |
| Compose | `deploy/hostinger/docker-compose.staging.yml` |
| Lane | `APP_ENV=staging`, image `NODE_ENV=production` |
| Sales webhook | `POST https://amardhaka.io/webhook/sales` |
| Customer webhook | `POST https://amardhaka.io/webhook/customer` |

Existing VM: `mv /opt/cns-line-oa /opt/cloudnex-connect` and keep the same `.env`. Then update nginx if it still points at the old path (compose `env_file` is `/opt/cloudnex-connect/.env`).

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
mkdir -p /opt/cloudnex-connect
```

From a laptop with this repo (rsync excludes `.env`):

```bash
npm run deploy:staging-vm
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
- `APP_ENV=staging`, `PUBLIC_BASE_URL=https://amardhaka.io`

Rotate channel secrets that were pasted in chat.

## 4. Compose (Docker Hub pull)

Compose bind is `127.0.0.1:8080` only. Set `DOCKER_IMAGE=razenjazzy/cloudnex-connect:staging` on the server `.env` (optional; compose defaults to that name).

```bash
cd /opt/cloudnex-connect
docker pull razenjazzy/cloudnex-connect:staging
docker compose -f deploy/hostinger/docker-compose.staging.yml --env-file .env up -d --no-build --pull always
curl -sS http://127.0.0.1:8080/healthz
curl -sS http://127.0.0.1:8080/readyz
```

Repeat deploys from a machine logged into Docker Hub: `npm run deploy:staging-vm` (builds, pushes, VPS pulls). Cloud Run: `scripts/deploy-cloudrun.sh`. Local tunnel: `scripts/deploy-cloudflare.sh`.

## 5. Nginx + TLS

Merge [deploy/hostinger/nginx-amardhaka.conf.example](../deploy/hostinger/nginx-amardhaka.conf.example) into the `amardhaka.io` server. `proxy_pass http://127.0.0.1:8080` **without** a `/webhook` URI suffix so `/webhook/sales` and `/webhook/customer` are preserved. Forward `X-Line-Signature`.

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

## 7. Smoke

- `GET https://amardhaka.io/healthz` — `service` is `cloudnex-connect`
- `GET https://amardhaka.io/readyz`
- `GET https://amardhaka.io/demo` (ops/demo tokens)
- `GET /ops/platform` — `lineCustomerConfigured` true when Customer env is set

## 8. Repeat deploy from laptop / GitHub

Laptop (SSH key that can `ssh root@187.127.179.49`):

```bash
npm run deploy:staging-vm
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
