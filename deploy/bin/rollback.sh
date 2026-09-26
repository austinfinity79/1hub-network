#!/usr/bin/env bash
# Server side: switch the app back to the previous release. Never touches the
# database schema; a release whose migration the old code cannot run on is NOT
# safe to roll back this way.
set -euo pipefail
ROOT=/opt/1hub-network
APP=$ROOT/app
STATE=$ROOT/shared/state
cd "$APP"
TARGET=${1:-$(cat "$STATE/previous")}
CUR=$(cat "$STATE/current")
docker image inspect "onehub-app:$TARGET" >/dev/null
echo "rollback $CUR -> $TARGET"
echo "APP_SHA=$TARGET" > "$APP/.env"
docker compose up -d --wait --wait-timeout 120 app
"$APP/bin/smoke.sh"
ln -sfn "$ROOT/releases/$TARGET" "$ROOT/current"
echo "$CUR" > "$STATE/previous"
echo "$TARGET" > "$STATE/current"
echo "ROLLED_BACK_TO=$TARGET"
