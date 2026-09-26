#!/usr/bin/env bash
# Production VPS: /opt/cloudnex-connect, Admin ${PUBLIC_BASE_URL}/admin/ (:8080, HMAC).
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/deploy-vps-lane.sh" production "$@"
