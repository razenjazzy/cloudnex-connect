#!/usr/bin/env bash
# Production deploy may not run until staging was validated and a human set PRODUCTION_APPROVED.
set -euo pipefail

if [ "${STAGING_VALIDATED:-}" != "true" ]; then
  echo "[release] Run: npm run validate:staging && STAGING_VALIDATED=true PRODUCTION_APPROVED=true npm run deploy:prod" >&2
  echo "[release] STAGING_VALIDATED=true is required after a passing staging live check." >&2
  exit 1
fi

if [ "${PRODUCTION_APPROVED:-}" != "true" ]; then
  echo "[release] PRODUCTION_APPROVED=true is required after human signoff. This is not set by CI on push." >&2
  exit 1
fi

echo "[release] staging validated and production approved"
