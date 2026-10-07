#!/usr/bin/env bash
# OPS-DOCKER-IMAGE-RETENTION-01 — pre-deploy disk check for the demo app
# (project hubnetwork_demo_0710). Read-only: prints free space and the app
# images, then fails below the safe threshold so a build never fills the disk.
#
#   bin/disk-precheck.sh [min_free_gib]     default 6 (one build ≈ 1.6 GB image + build cache)
#
# Exit 0 = OK, 1 = FAIL (below the minimum), 0 with "WARN" below twice the minimum.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(awk '/^name:/{print $2}' compose.yaml)" == hubnetwork_demo_0710 ]] || { echo "REFUSED: not the demo project" >&2; exit 3; }
MIN_GIB=${1:-6}
[[ "$MIN_GIB" =~ ^[0-9]+$ ]] || { echo "usage: bin/disk-precheck.sh [min_free_gib]" >&2; exit 2; }
DOCKER_ROOT=$(docker info --format '{{.DockerRootDir}}')
free_kib() { df -Pk "$1" | awk 'NR==2 {print $4}'; }
FREE_GIB=$(( $(free_kib "$DOCKER_ROOT") / 1024 / 1024 ))
echo "DOCKER_ROOT=$DOCKER_ROOT"
df -h / "$DOCKER_ROOT" | awk '!seen[$0]++'
echo "APP_IMAGES=$(docker images --format '{{.Tag}}' hubnetwork-demo-0710-app | grep -cE '^[0-9a-f]{40}$' || true)"
docker system df --format '{{.Type}}: {{.Size}} (reclaimable {{.Reclaimable}})'
if (( FREE_GIB < MIN_GIB )); then
  echo "DISK_PRECHECK=FAIL free=${FREE_GIB}GiB < ${MIN_GIB}GiB — run bin/image-retention.sh first" >&2
  exit 1
elif (( FREE_GIB < 2 * MIN_GIB )); then
  echo "DISK_PRECHECK=WARN free=${FREE_GIB}GiB (< $(( 2 * MIN_GIB ))GiB); consider bin/image-retention.sh --apply after the deploy"
else
  echo "DISK_PRECHECK=OK free=${FREE_GIB}GiB"
fi
