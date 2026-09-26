#!/usr/bin/env bash
# Server side: internal smoke against 127.0.0.1:3100 (app + database).
set -euo pipefail
B=http://127.0.0.1:3100
check() { local want=$1 path=$2 got; got=$(curl -s -o /dev/null -w '%{http_code}' "$B$path"); [[ "$got" == "$want" ]] || { echo "  SMOKE FAIL $path: $got (want $want)" >&2; exit 1; }; echo "  ok $got $path"; }
check 200 /auth
check 200 /api/v1/auth/providers
check 200 /api/v1/session
check 404 /dev/typography
# DB-backed: a controlled-vocabulary read (empty until taxonomy is imported).
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/v1/vocabularies/REGION")
[[ "$code" != 5* ]] || { echo "  SMOKE FAIL vocabularies: $code" >&2; exit 1; }
echo "  ok $code /api/v1/vocabularies/REGION"
