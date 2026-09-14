#!/usr/bin/env bash
# Confirm two-OA keys exist and are non-empty. Never prints secret values.
set -euo pipefail

ENV_FILE="${1:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "[check-line-channels] missing $ENV_FILE" >&2
  exit 1
fi

has_value() {
  local key="$1"
  local raw
  raw="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  if [ -z "$raw" ]; then
    return 1
  fi
  local val="${raw#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="$(printf '%s' "$val" | tr -d '[:space:]')"
  [ -n "$val" ]
}

missing=0
for key in \
  LINE_CHANNEL_SECRET \
  LINE_CHANNEL_ACCESS_TOKEN \
  LINE_CHANNEL_CUSTOMER_SECRET \
  LINE_CHANNEL_CUSTOMER_ACCESS_TOKEN \
  LINE_CHANNEL_CUSTOMER_BASIC_ID \
  ADMIN_USER_ID
do
  if ! has_value "$key"; then
    echo "[check-line-channels] missing or empty: $key" >&2
    missing=1
  fi
done

if ! has_value LINE_CHANNEL_BASIC_ID && ! has_value LINE_CHANNEL_SALES_BASIC_ID; then
  echo "[check-line-channels] missing or empty: LINE_CHANNEL_BASIC_ID or LINE_CHANNEL_SALES_BASIC_ID" >&2
  missing=1
fi

if [ "$missing" -ne 0 ]; then
  echo "[check-line-channels] fill keys in $ENV_FILE (do not commit). Copy from deploy/env/staging.example" >&2
  exit 1
fi

echo "[check-line-channels] Sales + Customer LINE keys are present in $ENV_FILE"
