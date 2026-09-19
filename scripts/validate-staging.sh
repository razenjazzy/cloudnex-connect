#!/usr/bin/env bash
# Live staging gate for amardhaka.io (or STAGING_BASE_URL). No secrets printed.
set -euo pipefail

BASE_URL="${1:-${STAGING_BASE_URL:-https://amardhaka.io}}"
BASE_URL="${BASE_URL%/}"

echo "[validate-staging] ${BASE_URL}"

health="$(curl -fsS "${BASE_URL}/healthz")"
echo "$health" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('ok') is True, d
assert d.get('appEnv') == 'staging', d
print('healthz appEnv=staging')
"

ready="$(curl -fsS "${BASE_URL}/readyz")"
echo "$ready" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('ready') is True, d
print('readyz ready')
"

demo_headers="$(curl -fsS -D - -o /tmp/cns-demo-body.html "${BASE_URL}/demo")"
echo "$demo_headers" | python3 -c "
import sys
hdr=sys.stdin.read()
assert '200' in hdr.splitlines()[0], hdr.splitlines()[0]
csp=[l for l in hdr.splitlines() if l.lower().startswith('content-security-policy:')]
assert csp, 'missing CSP'
assert \"script-src 'unsafe-inline'\" in csp[0], csp[0]
print('GET /demo HTML + demo CSP')
"
python3 -c "
p=open('/tmp/cns-demo-body.html','r',encoding='utf-8',errors='replace').read(200)
assert '<!DOCTYPE html>' in p or '<html' in p.lower(), p[:80]
print('GET /demo is HTML')
"

conn_code="$(curl -sS -o /tmp/cns-demo-conn.json -w '%{http_code}' "${BASE_URL}/demo/connections")"
python3 -c "
import json,sys
code=int(sys.argv[1])
body=open('/tmp/cns-demo-conn.json','r',encoding='utf-8').read()
d=json.loads(body)
assert code in (401, 503), (code, d)
assert 'error' in d, d
print('GET /demo/connections gated', code)
" "$conn_code"

echo "[validate-staging] passed"
