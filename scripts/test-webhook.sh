#!/usr/bin/env bash
# Send a correctly SIGNED empty LINE webhook to prove the channel secret and the URL path work.
# LINE's IP allowlist only limits calls from this app TO the LINE API; it does not affect webhooks.
# Webhooks are authenticated only by the X-Line-Signature HMAC, so an unsigned request is always 401.
#   bash scripts/test-webhook.sh [sales|customer|default|all] [base-url] [env-file]   (no channel = Sales and Customer)
#   npm run test:webhook -- sales https://amardhaka.io/cloudnex-connect .env
# Two OAs are live (Sales, Customer). "default" is the legacy /webhook alias: it uses the flat LINE_CHANNEL_* values,
# which are the Sales OA's credentials, so it is the same OA as /webhook/sales.
set -uo pipefail

CHANNEL="${1:-all}"
if [ "$CHANNEL" = all ]; then
  rc=0
  for c in sales customer; do bash "$0" "$c" "${2:-https://amardhaka.io/cloudnex-connect}" "${3:-.env}" || rc=1; done
  exit $rc
fi
BASE="${2:-https://amardhaka.io/cloudnex-connect}"
ENV_FILE="${3:-.env}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }

case "$CHANNEL" in
  default) SECRET_KEY=LINE_CHANNEL_SECRET; URL="$BASE/webhook" ;;
  sales)   SECRET_KEY=LINE_CHANNEL_SALES_SECRET; URL="$BASE/webhook/sales" ;;
  customer) SECRET_KEY=LINE_CHANNEL_CUSTOMER_SECRET; URL="$BASE/webhook/customer" ;;
  *) echo "channel must be default, sales or customer" >&2; exit 1 ;;
esac

SECRET="$(grep -m1 "^$SECRET_KEY=" "$ENV_FILE" | cut -d= -f2- | tr -d '"[:space:]')"
# Sales falls back to the default channel secret when it has none of its own (same rule as the app).
[ -z "$SECRET" ] && [ "$CHANNEL" = sales ] && SECRET="$(grep -m1 '^LINE_CHANNEL_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"[:space:]')"
[ -n "$SECRET" ] || { echo "no secret for $CHANNEL in $ENV_FILE" >&2; exit 1; }

BODY='{"destination":"U0000000000000000000000000000000","events":[]}'
SIG="$(printf %s "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)"
CODE="$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST "$URL" -H 'content-type: application/json' -H "x-line-signature: $SIG" -d "$BODY")"
UNSIGNED="$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST "$URL" -H 'content-type: application/json' -d "$BODY")"
echo "$CHANNEL  $URL"
echo "  signed   -> $CODE   (200 = the secret in $ENV_FILE matches the server)"
echo "  unsigned -> $UNSIGNED   (401 = signature check is on, as it should be)"
[ "$CODE" = 200 ]
