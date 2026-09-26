#!/usr/bin/env bash
# Staging VPS: /opt/cns-line-oa, Admin ${PUBLIC_BASE_URL}/admin/test (:8081).
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/deploy-vps-lane.sh" staging "$@"
