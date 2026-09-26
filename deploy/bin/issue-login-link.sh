#!/usr/bin/env bash
# Operator-only: print one single-use magic link for a PRE-UAT review persona.
# Usage (from your machine): ssh hub-vps /opt/1hub-network/app/bin/issue-login-link.sh leader@example.test
# Nothing is written to disk or to container logs (exec output is not logged).
set -euo pipefail
EMAIL=${1:?usage: issue-login-link.sh <persona-email>}
case "$EMAIL" in
  *@example.test) ;;
  *) echo "Refusing: only @example.test review personas (no real accounts)." >&2; exit 2 ;;
esac
cd /opt/1hub-network/app
docker compose exec -T -e LOGIN_EMAIL="$EMAIL" -e LOGIN_BASE_URL=https://1hubnetwork.io.vn \
  app node --input-type=module - < "$(dirname "$0")/issue-login-link.mjs"
