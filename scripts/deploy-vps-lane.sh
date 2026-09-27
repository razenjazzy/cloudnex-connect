#!/usr/bin/env bash
# Build+push image, rsync compose files, docker pull on one VPS lane.
#   staging    → /opt/cns-line-oa      Admin ${PUBLIC_BASE_URL}/admin/test  (:8081)
#   production → /opt/cloudnex-connect  Admin ${PUBLIC_BASE_URL}/admin/      (:8080, HMAC webhooks)
# Never copies .env. Does not tear down the other lane.
# Hub push is best-effort; on insufficient_scope the image is docker save | ssh docker load.
set -euo pipefail

LANE="${1:-}"
if [ "$LANE" != "staging" ] && [ "$LANE" != "production" ]; then
  echo "usage: $0 staging|production" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${VPS_HOST:-root@187.127.179.49}"
IMAGE="${DOCKER_IMAGE:-razenjazzy/cloudnex-connect:staging}"

if [ "$LANE" = "staging" ]; then
  REMOTE="${VPS_REMOTE_DIR:-/opt/cns-line-oa}"
  COMPOSE="deploy/hostinger/docker-compose.sibling.yml"
  COMPOSE_PROJECT="cns-line-oa-staging"
  HEALTH_PORT="8081"
  SEED_ENV_FROM="/opt/cloudnex-connect/.env"
else
  REMOTE="${VPS_REMOTE_DIR:-/opt/cloudnex-connect}"
  COMPOSE="deploy/hostinger/docker-compose.production.yml"
  COMPOSE_PROJECT="cloudnex-connect-production"
  HEALTH_PORT="8080"
  SEED_ENV_FROM=""
fi

cd "$ROOT"

if [ ! -f package-lock.json ] || [ ! -f package.json ] || [ ! -f deploy/docker/Dockerfile ]; then
  echo "[deploy] package.json, package-lock.json, and deploy/docker/Dockerfile are required." >&2
  exit 1
fi

IMAGE_VIA_LOAD=0
load_image_over_ssh() {
  echo "[deploy] docker save | ssh docker load ${IMAGE}"
  docker save "$IMAGE" | ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$HOST" "docker load"
  IMAGE_VIA_LOAD=1
}

if [ "${SKIP_BUILD:-}" != "1" ]; then
  echo "[deploy] verifying lockfile matches package.json (npm ci --dry-run)"
  npm ci --ignore-scripts --dry-run >/dev/null
  echo "[deploy] docker build --platform linux/amd64 ${IMAGE}"
  docker build --platform linux/amd64 -f deploy/docker/Dockerfile -t "$IMAGE" "$ROOT"
  echo "[deploy] docker push ${IMAGE}"
  if docker push "$IMAGE"; then
    echo "[deploy] hub push ok"
  else
    echo "[deploy] hub push failed; shipping image over SSH"
    load_image_over_ssh
  fi
elif docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "[deploy] SKIP_BUILD=1; shipping local image over SSH (no hub pull of an older tag)"
  load_image_over_ssh
fi

LOCK_SHA="$(openssl dgst -sha256 package-lock.json | awk '{print $2}')"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "[deploy] lane=${LANE} commit=${COMMIT} remote=${REMOTE} image=${IMAGE} health=${HEALTH_PORT}"

echo "[deploy] rsync allowlist → ${REMOTE} (never .env, never --delete)"
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$HOST" "mkdir -p '$REMOTE'"
rsync -az \
  --files-from="$ROOT/deploy/staging-rsync.allowlist" \
  --exclude '.env' \
  --exclude '.env.*' \
  -e "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" \
  "$ROOT/" \
  "$HOST:$REMOTE/"

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$HOST" bash -s -- "$REMOTE" "$LOCK_SHA" "$IMAGE" "$COMPOSE" "$HEALTH_PORT" "$COMPOSE_PROJECT" "$SEED_ENV_FROM" "$IMAGE_VIA_LOAD" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"
EXPECTED_LOCK="$2"
IMAGE="$3"
COMPOSE="$4"
HEALTH_PORT="$5"
COMPOSE_PROJECT="$6"
SEED_ENV_FROM="$7"
IMAGE_VIA_LOAD="$8"
if [ ! -f "$REMOTE_DIR/.env" ] && [ -n "$SEED_ENV_FROM" ] && [ -f "$SEED_ENV_FROM" ]; then
  cp "$SEED_ENV_FROM" "$REMOTE_DIR/.env"
  chmod 600 "$REMOTE_DIR/.env"
  echo "[deploy] seeded $REMOTE_DIR/.env from $SEED_ENV_FROM (server only)"
fi
test -f "$REMOTE_DIR/.env"
test -f "$REMOTE_DIR/package-lock.json"
REMOTE_LOCK="$(openssl dgst -sha256 "$REMOTE_DIR/package-lock.json" | awk '{print $2}')"
if [ "$REMOTE_LOCK" != "$EXPECTED_LOCK" ]; then
  echo "[deploy] remote package-lock.json sha256 mismatch" >&2
  exit 1
fi
bash "$REMOTE_DIR/scripts/check-line-channels.sh" "$REMOTE_DIR/.env"
cd "$REMOTE_DIR"
docker rm -f "$COMPOSE_PROJECT" "${COMPOSE_PROJECT}-redis" >/dev/null 2>&1 || true
PULL_POLICY=always
if [ "$IMAGE_VIA_LOAD" = "1" ]; then
  echo "[deploy] using SSH-loaded image (no hub pull)"
  PULL_POLICY=never
else
  echo "[deploy] docker pull ${IMAGE}"
  docker pull "$IMAGE"
fi
COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT" DOCKER_IMAGE="$IMAGE" docker compose -f "$COMPOSE" --env-file .env up -d --force-recreate --no-build --pull "$PULL_POLICY"
echo "[deploy] waiting for :${HEALTH_PORT}/healthz"
ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${HEALTH_PORT}/healthz" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" != 1 ]; then
  echo "[deploy] /healthz did not become ready on ${HEALTH_PORT}" >&2
  docker ps -a >&2 || true
  exit 1
fi
curl -fsS --max-time 5 "http://127.0.0.1:${HEALTH_PORT}/healthz"
echo
curl -fsS --max-time 10 "http://127.0.0.1:${HEALTH_PORT}/readyz" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('ready') is True, d; print('ready', d.get('flags',{}).get('appEnv'))"
REMOTE
