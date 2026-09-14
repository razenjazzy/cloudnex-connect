#!/usr/bin/env bash
# Alias: lockfile-enforced staging deploy (cloudnex-connect).
exec "$(cd "$(dirname "$0")" && pwd)/deploy-cloudnex-connect-staging.sh" "$@"