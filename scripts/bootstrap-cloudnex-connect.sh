#!/usr/bin/env bash
# One-shot install token for Cloudnex Connect. Print once; do not commit.
set -euo pipefail
TOKEN="$(openssl rand -hex 32)"
cat <<EOF
CONNECT_BOOTSTRAP_TOKEN=${TOKEN}

Add that line to the host .env, restart the app, then:

  curl -sS -X POST "\${PUBLIC_BASE_URL}/admin/api/bootstrap" \\
    -H 'content-type: application/json' \\
    -d '{"token":"${TOKEN}"}'

A second call returns 410. Operators use Cloudnex Connect Admin after that.
Google credentials remain a mounted secret (GCP constraint).
EOF
