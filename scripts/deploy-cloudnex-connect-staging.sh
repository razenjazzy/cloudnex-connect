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

rsync -az --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.cursor' \
  --exclude '.claude' \
  --exclude 'agent-transcripts' \
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
docker rm -f cns-line-oa-staging >/dev/null 2>&1 || true
echo "[deploy] docker pull ${IMAGE}"
docker pull "$IMAGE"
DOCKER_IMAGE="$IMAGE" docker compose -f deploy/hostinger/docker-compose.staging.yml --env-file .env up -d --no-build --pull always
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:8080/healthz >/dev/null; then
    break
  fi
  sleep 2
done
curl -fsS http://127.0.0.1:8080/healthz
echo
curl -fsS http://127.0.0.1:8080/readyz | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ready') is True, d; print('ready', d.get('flags',{}).get('appEnv'), 'lineCustomer', d.get('flags',{}).get('lineCustomerConfigured'))"
REMOTE
