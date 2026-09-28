#!/usr/bin/env bash
# Operator-only: pre-provision Internal Alpha login accounts (invite-only magic
# link). Account only: onboarding stays incomplete; no role, membership,
# leadership, profile or project. Safe to re-run (existing → ALREADY EXISTS).
# Usage (from your machine): ssh hub-vps /opt/1hub-network/app/bin/provision-account.sh a@x.vn [b@y.vn ...]
set -euo pipefail
[[ $# -gt 0 ]] || { echo "usage: provision-account.sh <email> [email ...]" >&2; exit 2; }
for e in "$@"; do
  [[ "$e" != *,* ]] || { echo "Refusing: one address per argument." >&2; exit 2; }
done
EMAILS=$(IFS=,; echo "$*")
cd /opt/1hub-network/app
docker compose exec -T -e PROVISION_EMAILS="$EMAILS" \
  app node --no-warnings --input-type=module - < "$(dirname "$0")/provision-account.mjs"
