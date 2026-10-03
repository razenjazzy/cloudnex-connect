#!/usr/bin/env bash
# Validate LINE channel credentials in an env file against LINE itself. Never prints secrets.
#   bash scripts/verify-line-tokens.sh [.env|.env.staging]
# Run it from an IP allowed on each channel (VPS or an allowlisted PC).
set -uo pipefail

ENV_FILE="${1:-.env}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }

get() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2-; }
fail=0

check() {
  local label="$1" token_key="$2" basic_key="$3" secret_key="$4" token basic secret info name actual
  token="$(get "$token_key")"
  basic="$(get "$basic_key")"
  secret="$(get "$secret_key")"
  if [ -z "$token" ]; then echo "[skip] $label: $token_key is blank"; return; fi
  if printf %s "$token" | grep -q '[[:space:]"'"'"']'; then
    echo "[FAIL] $label: $token_key has a space or quote inside (remove it)"; fail=1; return
  fi
  info="$(curl -4 -s -m 10 https://api.line.me/v2/bot/info -H "Authorization: Bearer $token")"
  actual="$(printf %s "$info" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("basicId",""))' 2>/dev/null)"
  name="$(printf %s "$info" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("displayName",""))' 2>/dev/null)"
  if [ -z "$actual" ]; then
    echo "[FAIL] $label: LINE rejected the token ($(printf %s "$info" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("message",""))' 2>/dev/null))"; fail=1; return
  fi
  if [ -n "$basic" ] && [ "$(printf %s "$basic" | tr 'A-Z' 'a-z')" != "$(printf %s "$actual" | tr 'A-Z' 'a-z')" ]; then
    echo "[FAIL] $label: token belongs to $name $actual but $basic_key is $basic"; fail=1; return
  fi
  [ -z "$secret" ] && echo "[warn] $label: $secret_key is blank"
  echo "[ok]   $label: $name $actual webhook=$(curl -4 -s -m 10 https://api.line.me/v2/bot/channel/webhook/endpoint -H "Authorization: Bearer $token" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("endpoint"),"active="+str(d.get("active")))' 2>/dev/null)"
}

check "default (Sales OA)" LINE_CHANNEL_ACCESS_TOKEN LINE_CHANNEL_BASIC_ID LINE_CHANNEL_SECRET
check "sales-only"        LINE_CHANNEL_SALES_ACCESS_TOKEN LINE_CHANNEL_SALES_BASIC_ID LINE_CHANNEL_SALES_SECRET
check "customer"          LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN LINE_CHANNEL_CUSTOMER_BASIC_ID LINE_CHANNEL_CUSTOMER_SECRET
exit $fail
