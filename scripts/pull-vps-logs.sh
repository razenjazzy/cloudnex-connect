#!/usr/bin/env bash
# Mirror the VPS log archive to this machine so it can be read locally (read-only on the server).
#   bash scripts/pull-vps-logs.sh [dest-dir]        (default ./logs/vps)
#   npm run logs:pull                               same thing
# Env: VPS_HOST (default "amardhaka" from ~/.ssh/config), LOG_RETENTION_DAYS (local copy, default 30).
set -euo pipefail

HOST="${VPS_HOST:-amardhaka}"
DEST="${1:-logs/vps}"
KEEP_DAYS="${LOG_RETENTION_DAYS:-30}"

mkdir -p "$DEST"
rsync -az --exclude '.last' -e "ssh -o BatchMode=yes" "$HOST:/var/log/cloudnex-connect/" "$DEST/"
find "$DEST" -type f \( -name '*.log' -o -name '*.log.gz' \) -mtime +"$KEEP_DAYS" -delete
find "$DEST" -mindepth 1 -type d -empty -delete
echo "[logs] synced $HOST:/var/log/cloudnex-connect -> $DEST ($(find "$DEST" -type f | wc -l | tr -d ' ') files)"
echo "[logs] latest staging hour: $(ls -1 "$DEST"/staging-app/*/*.log* 2>/dev/null | tail -1)"
echo "[logs] read:  zcat \"$DEST\"/staging/\$(date -u +%F)/*.log.gz; cat \"$DEST\"/staging/\$(date -u +%F)/*.log | grep -E 'webhook_signature_invalid|error'"
