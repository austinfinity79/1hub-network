#!/usr/bin/env bash
# OPS-DOCKER-IMAGE-RETENTION-01 — keep the demo app images to: the LIVE image
# (APP_SHA in .env) + the newest KEEP (default 2) earlier releases that were
# live before (a .env.rollback-<sha7> file exists) and whose image is present.
# Everything else in repository hubnetwork-demo-0710-app with a 40-hex SHA tag
# is obsolete. Dry run by default; --apply removes with `docker image rm`
# (never -f). Safe to rerun.
#
#   bin/image-retention.sh [--apply] [--keep N]
#
# Never touched: volumes, containers, the build cache, any other repository
# (onehub-app, postgres, node, …), releases/ and .env.rollback-* files. An image
# used by any container, running or not, is never removed.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(awk '/^name:/{print $2}' compose.yaml)" == hubnetwork_demo_0710 ]] || { echo "REFUSED: not the demo project" >&2; exit 3; }
REPO=hubnetwork-demo-0710-app
APPLY=0 KEEP=2
while (( $# )); do
  case "$1" in
    --apply) APPLY=1 ;;
    --keep) KEEP=${2:?--keep needs N}; shift ;;
    *) echo "usage: bin/image-retention.sh [--apply] [--keep N]" >&2; exit 2 ;;
  esac
  shift
done
if ! [[ "$KEEP" =~ ^[0-9]+$ ]] || (( KEEP < 2 )); then echo "REFUSED: --keep must be >= 2" >&2; exit 2; fi

LIVE=$(grep -E '^APP_SHA=' .env | cut -d= -f2-)
[[ "$LIVE" =~ ^[0-9a-f]{40}$ ]] || { echo "REFUSED: no APP_SHA in .env" >&2; exit 3; }
docker image inspect "$REPO:$LIVE" >/dev/null || { echo "REFUSED: live image $REPO:$LIVE missing" >&2; exit 3; }
RUNNING=$(docker ps --filter label=com.docker.compose.project=hubnetwork_demo_0710 --filter label=com.docker.compose.service=app --format '{{.Image}}')
[[ "$RUNNING" == "$REPO:$LIVE" ]] || { echo "REFUSED: running app ($RUNNING) is not APP_SHA ($LIVE)" >&2; exit 3; }
# Image ids any container (running or stopped) still uses.
IN_USE=$(docker ps -aq | xargs -r docker inspect --format '{{.Image}}' | sort -u)

# App images, newest first: "<created> <sha>".
mapfile -t ROWS < <(docker images "$REPO" --format '{{.Tag}}' | grep -E '^[0-9a-f]{40}$' |
  while read -r t; do echo "$(docker image inspect --format '{{.Created}}' "$REPO:$t") $t"; done | sort -r)

declare -a KEPT=() REMOVE=()
for row in "${ROWS[@]}"; do
  sha=${row##* }
  [[ "$sha" == "$LIVE" ]] && continue
  if (( ${#KEPT[@]} < KEEP )) && [[ -f ".env.rollback-${sha:0:7}" ]]; then KEPT+=("$sha"); else REMOVE+=("$sha"); fi
done
(( ${#KEPT[@]} >= 2 )) || { echo "REFUSED: fewer than 2 known-good rollback images (${#KEPT[@]}); nothing removed" >&2; exit 4; }

echo "LIVE      $LIVE"
for s in "${KEPT[@]}"; do echo "ROLLBACK  $s  (cp .env.rollback-${s:0:7} .env && docker compose up -d --no-deps app)"; done
for s in "${REMOVE[@]}"; do
  id=$(docker image inspect --format '{{.Id}}' "$REPO:$s")
  if grep -qx "$id" <<<"$IN_USE"; then echo "IN_USE    $s (kept)"; continue; fi
  if (( APPLY )); then docker image rm "$REPO:$s" >/dev/null && echo "REMOVED   $s"; else echo "OBSOLETE  $s (dry run)"; fi
done
(( ${#REMOVE[@]} )) || echo "OBSOLETE  none"
df -h / | awk 'NR==2 {print "DISK_FREE " $4 " (" $5 " used)"}'
