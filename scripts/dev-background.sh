#!/usr/bin/env bash
# Start local HTTPS Admin in the background (Caddy :443 + Express :8080).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p tmp

PIDFILE="$ROOT/tmp/dev.pid"
LOG="$ROOT/tmp/dev.log"
CADDYFILE="$ROOT/deploy/local/Caddyfile.example"
ACTION="${1:-start}"

port_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

stop_express() {
  if [[ -f "$PIDFILE" ]]; then
    local pid
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      pkill -P "$pid" 2>/dev/null || true
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PIDFILE"
  fi
}

start_caddy() {
  if ! command -v caddy >/dev/null 2>&1; then
    echo "Install Caddy (brew install caddy)." >&2
    return 1
  fi
  if port_busy 443; then
    echo "Caddy already on :443"
    return 0
  fi
  caddy start --config "$CADDYFILE"
}

start_express() {
  if port_busy 8080; then
    echo "Express already on :8080"
    return 0
  fi
  : >"$LOG"
  APP_ENV=development nohup npm run dev:fg >>"$LOG" 2>&1 &
  echo $! >"$PIDFILE"
  disown $! 2>/dev/null || true
}

case "$ACTION" in
  stop)
    stop_express
    echo "Stopped background npm run dev (Caddy left running). npm run dev:stop does not run caddy stop."
    ;;
  status)
    if port_busy 8080; then echo "express: up"; else echo "express: down"; fi
    if port_busy 443; then echo "caddy: up"; else echo "caddy: down"; fi
    ;;
  start|*)
    start_caddy
    start_express
    echo "Background dev: https://site.local/cloudnex-connect/admin/"
    echo "Logs: $LOG   Stop Express: npm run dev:stop"
    ;;
esac
