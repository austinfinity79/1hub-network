#!/usr/bin/env bash
# Server side: build, migrate, switch, health-check one release.
# Usage: /opt/1hub-network/app/bin/release.sh <full-sha>
set -euo pipefail
SHA=${1:?usage: release.sh <full-sha>}
ROOT=/opt/1hub-network
APP=$ROOT/app
STATE=$ROOT/shared/state
cd "$APP"
[[ -d $ROOT/releases/$SHA ]] || { echo "missing $ROOT/releases/$SHA" >&2; exit 1; }
mkdir -p "$STATE"

PREV=$(cat "$STATE/current" 2>/dev/null || true)

echo "  build onehub-app:$SHA"
docker build -q -t "onehub-app:$SHA" -f "$APP/Dockerfile" "$ROOT/releases/$SHA" >/dev/null

echo "  start db"
APP_SHA=$SHA docker compose up -d --wait db

echo "  migrate"
APP_SHA=$SHA docker compose run --rm --no-deps app node scripts/db.mjs migrate

echo "  switch app"
echo "APP_SHA=$SHA" > "$APP/.env"
docker compose up -d --wait --wait-timeout 120 app || {
  echo "  HEALTH FAILED for $SHA" >&2
  if [[ -n "$PREV" && "$PREV" != "$SHA" ]]; then
    echo "APP_SHA=$PREV" > "$APP/.env"
    docker compose up -d --wait app && echo "  reverted app to $PREV (schema NOT reverted)" >&2
  fi
  exit 1
}

"$APP/bin/smoke.sh"
ln -sfn "$ROOT/releases/$SHA" "$ROOT/current"
[[ -n "$PREV" && "$PREV" != "$SHA" ]] && echo "$PREV" > "$STATE/previous"
echo "$SHA" > "$STATE/current"
echo "DEPLOYED_SHA=$SHA"
