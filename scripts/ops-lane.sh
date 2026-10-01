#!/usr/bin/env bash
# DevOps probe for local (laptop :8080) or staging VPS (:8081). Never prints secrets.
#   npm run ops:local
#   npm run ops:local -- logs
#   npm run ops:staging
#   npm run ops:staging -- logs
#   npm run ops:local -- chat "NAV COMMERCE"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LANE="${1:-}"
ACTION="${2:-status}"
if [ "$ACTION" = "chat" ] && [ "$#" -ge 3 ]; then
  CHAT_TEXT="${*:3}"
else
  CHAT_TEXT="${3:-NAV COMMERCE}"
fi
HOST="${VPS_HOST:-amardhaka}"
REMOTE_ENV="/opt/cns-line-oa/.env"

if [ "$LANE" != "local" ] && [ "$LANE" != "staging" ]; then
  echo "usage: $0 local|staging [status|logs|chat [text]]" >&2
  exit 1
fi

python_env_get() {
  python3 -c '
from pathlib import Path
import sys
path, key = sys.argv[1], sys.argv[2]
for raw in Path(path).read_text(errors="replace").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    if k == key:
        print(v.strip().strip(chr(34) + chr(39)))
        break
' "$1" "$2"
}

summarize_flex() {
  python3 -c '
import json,sys
try:
    msgs=json.load(sys.stdin)
except Exception as e:
    print("parse_error", e)
    sys.exit(0)
if not isinstance(msgs, list):
    print(msgs if isinstance(msgs, dict) and "error" in msgs else type(msgs).__name__)
    sys.exit(0)
labels=[]
def walk(n):
    if isinstance(n, dict):
        if isinstance(n.get("label"), str): labels.append(n["label"])
        if isinstance(n.get("altText"), str): labels.append("[alt] "+n["altText"][:90])
        for v in n.values(): walk(v)
    elif isinstance(n, list):
        for v in n: walk(v)
walk(msgs)
print("types", [m.get("type") for m in msgs])
print("labels", labels[:24])
'
}

if [ "$LANE" = "local" ]; then
  BASE="http://127.0.0.1:8080"
  ENV_FILE="$ROOT/.env"
  if [ "$ACTION" = "logs" ]; then
    if [ -f "$ROOT/tmp/dev.log" ]; then
      echo "[ops] local tmp/dev.log (last 80 lines)"
      tail -n 80 "$ROOT/tmp/dev.log"
    else
      echo "[ops] no tmp/dev.log — foreground: npm run dev:fg   background: npm run dev"
    fi
    exit 0
  fi
  echo "[ops] local $BASE"
  curl -fsS --max-time 5 "$BASE/healthz"
  echo
  TOKEN="$(python_env_get "$ENV_FILE" OPS_API_TOKEN || true)"
  if [ -z "${TOKEN:-}" ]; then
    echo "[ops] OPS_API_TOKEN missing in .env" >&2
    exit 1
  fi
  curl -fsS --max-time 20 -H "Authorization: Bearer $TOKEN" "$BASE/ops/platform" | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("appEnv", (d.get("flags") or {}).get("appEnv"), "ready", d.get("ready"))
print("customerCommerce", d.get("customerCommerce"))
print("lineCustomerConfigured", (d.get("flags") or {}).get("lineCustomerConfigured"))
print("warnings", (d.get("warnings") or [])[:6])
'
  if [ "$ACTION" = "chat" ]; then
    WT="$(python_env_get "$ENV_FILE" WEBHOOK_TEST_TOKEN || true)"
    echo "[ops] webhook-test channel=customer text=${CHAT_TEXT}"
    HDR=(-H "Content-Type: application/json")
    if [ -n "${WT:-}" ]; then HDR+=(-H "x-webhook-test-token: $WT"); fi
    curl -fsS --max-time 60 "${HDR[@]}" -d "$(python3 -c 'import json,sys; print(json.dumps({"text":sys.argv[1],"channelId":"customer","userId":"ops_local_customer"}))' "$CHAT_TEXT")" \
      "$BASE/webhook-test" | summarize_flex
  fi
  exit 0
fi

echo "[ops] staging via ssh $HOST :8081"
if [ "$ACTION" = "logs" ]; then
  ssh -o BatchMode=yes "$HOST" 'echo "[docker] cns-line-oa-staging last 120 lines"; docker logs --tail 120 cns-line-oa-staging 2>&1; echo "[docker] redis last 20"; docker logs --tail 20 cns-line-oa-staging-redis 2>&1; echo "[errors]"; docker logs --since 2h cns-line-oa-staging 2>&1 | grep -Ei "error|fatal|unhandled" | tail -n 40 || true'
  exit 0
fi

CHAT_B64="$(printf '%s' "$CHAT_TEXT" | base64 | tr -d '\n')"
ssh -o BatchMode=yes "$HOST" bash -s -- "$ACTION" "$CHAT_B64" <<'REMOTE'
set -euo pipefail
ACTION="$1"
CHAT_TEXT="$(printf '%s' "$2" | base64 -d 2>/dev/null || true)"
ENV_FILE="/opt/cns-line-oa/.env"
python_env_get() {
  python3 -c '
from pathlib import Path
import sys
path, key = sys.argv[1], sys.argv[2]
for raw in Path(path).read_text(errors="replace").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    if k == key:
        print(v.strip().strip(chr(34) + chr(39)))
        break
' "$1" "$2"
}
curl -fsS --max-time 5 http://127.0.0.1:8081/healthz
echo
TOKEN="$(python_env_get "$ENV_FILE" OPS_API_TOKEN)"
curl -fsS --max-time 20 -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8081/ops/platform | python3 -c '
import json,sys
d=json.load(sys.stdin)
print("appEnv", (d.get("flags") or {}).get("appEnv"), "ready", d.get("ready"))
print("customerCommerce", d.get("customerCommerce"))
print("webhookTestEnabled", (d.get("flags") or {}).get("webhookTestEnabled"))
print("lineCustomerConfigured", (d.get("flags") or {}).get("lineCustomerConfigured"))
odoo=next((c for c in (d.get("checks") or []) if c.get("name")=="odoo"), None)
print("odoo", odoo)
print("warnings", (d.get("warnings") or [])[:6])
'
if [ "$ACTION" = "chat" ]; then
  echo "[ops] LINE OA uses HMAC POST /webhook/sales and /webhook/customer on production :8080. Staging :8081 does not serve OA webhooks."
fi
REMOTE
