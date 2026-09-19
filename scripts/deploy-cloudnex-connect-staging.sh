#!/usr/bin/env bash
# Build+push razenjazzy/cloudnex-connect:staging (or $DOCKER_IMAGE), then VPS docker pull.
# Never copies .env. VPS does not run npm ci.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${VPS_HOST:-root@187.127.179.49}"
REMOTE="${VPS_REMOTE_DIR:-/opt/cloudnex-connect}"
IMAGE="${DOCKER_IMAGE:-razenjazzy/cloudnex-connect:staging}"

cd "$ROOT"

if [ ! -f package-lock.json ] || [ ! -f package.json ] || [ ! -f deploy/docker/Dockerfile ]; then
  echo "[deploy] package.json, package-lock.json, and deploy/docker/Dockerfile are required." >&2
  exit 1
fi

echo "[deploy] verifying lockfile matches package.json (npm ci --dry-run)"
npm ci --ignore-scripts --dry-run >/dev/null

LOCK_SHA="$(openssl dgst -sha256 package-lock.json | awk '{print $2}')"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "[deploy] commit=${COMMIT} package-lock.sha256=${LOCK_SHA} image=${IMAGE}"

echo "[deploy] docker build --platform linux/amd64 ${IMAGE}"
docker build --platform linux/amd64 -f deploy/docker/Dockerfile -t "$IMAGE" "$ROOT"

echo "[deploy] docker push ${IMAGE}"
docker push "$IMAGE"

echo "[deploy] rsync staging allowlist (never .env, never --delete)"
rsync -az \
  --files-from="$ROOT/deploy/staging-rsync.allowlist" \
  --exclude '.env' \
  --exclude '.env.*' \
  -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  "$ROOT/" \
  "$HOST:$REMOTE/"

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$HOST" bash -s -- "$REMOTE" "$LOCK_SHA" "$IMAGE" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"
EXPECTED_LOCK="$2"
IMAGE="$3"
test -f "$REMOTE_DIR/.env"
test -f "$REMOTE_DIR/package-lock.json"
REMOTE_LOCK="$(openssl dgst -sha256 "$REMOTE_DIR/package-lock.json" | awk '{print $2}')"
if [ "$REMOTE_LOCK" != "$EXPECTED_LOCK" ]; then
  echo "[deploy] remote package-lock.json sha256 mismatch" >&2
  exit 1
fi
bash "$REMOTE_DIR/scripts/check-line-channels.sh" "$REMOTE_DIR/.env"
cd "$REMOTE_DIR"
docker rm -f cns-line-oa-staging cloudnex-connect-staging cloudnex-connect-staging-redis >/dev/null 2>&1 || true
echo "[deploy] docker pull ${IMAGE}"
docker pull "$IMAGE"
DOCKER_IMAGE="$IMAGE" docker compose -f deploy/hostinger/docker-compose.staging.yml --env-file .env up -d --force-recreate --no-build --pull always
echo "[deploy] waiting for /healthz (Node listen after recreate)"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" != 1 ]; then
  echo "[deploy] /healthz did not become ready" >&2
  docker logs --tail 80 cloudnex-connect-staging >&2 || true
  exit 1
fi
curl -fsS --max-time 5 http://127.0.0.1:8080/healthz
echo
curl -fsS --max-time 10 http://127.0.0.1:8080/readyz | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ready') is True, d; print('ready', d.get('flags',{}).get('appEnv'), 'lineCustomer', d.get('flags',{}).get('lineCustomerConfigured'))"
REMOTE
