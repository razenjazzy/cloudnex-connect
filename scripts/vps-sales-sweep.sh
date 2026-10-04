#!/usr/bin/env bash
# Every 5 minutes from root's crontab on the VPS: sign out expired Sales sessions and reset their native menu.
#   */5 * * * * /usr/local/bin/cloudnex-sales-sweep >> /var/log/cloudnex-connect/.sweep.log 2>&1
# Reads OPS_API_TOKEN from the lane's .env at run time (the token is never written into the crontab).
set -uo pipefail
ENV_FILE="${ENV_FILE:-/opt/cns-line-oa/.env}"
PORT="${PORT:-8081}"
TOKEN="$(grep -m1 '^OPS_API_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"[:space:]')"
[ -n "$TOKEN" ] || { echo "$(date -u +%FT%TZ) no OPS_API_TOKEN in $ENV_FILE" >&2; exit 1; }
echo "$(date -u +%FT%TZ) $(curl -s -m 60 -X POST -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$PORT/ops/sales-session-sweep")"
