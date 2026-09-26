#!/usr/bin/env bash
# Deploy ONE committed SHA from this machine to the VPS.
# Usage: deploy/bin/deploy.sh <commit-sha> [ssh-host]
# Ships `git archive <sha>` (never a working tree), syncs deploy tooling,
# then runs bin/release.sh on the server.
set -euo pipefail
REF=${1:?usage: deploy.sh <commit-sha> [ssh-host]}
HOST=${2:-hub-vps}
ROOT=/opt/1hub-network
HERE=$(cd "$(dirname "$0")/.." && pwd)

SHA=$(git rev-parse --verify "${REF}^{commit}")
[[ "$REF" == "$SHA" || "$SHA" == "$REF"* ]] || { echo "Pass an explicit commit SHA, not a branch: $REF" >&2; exit 1; }
echo "deploy $SHA -> $HOST"

rsync -a --delete --exclude .env "$HERE/" "$HOST:$ROOT/app/"
if ssh "$HOST" "test -d $ROOT/releases/$SHA"; then
  echo "  release dir exists; reusing"
else
  git archive --format=tar "$SHA" | ssh "$HOST" "mkdir -p $ROOT/releases/$SHA.tmp && tar -x -C $ROOT/releases/$SHA.tmp && mv $ROOT/releases/$SHA.tmp $ROOT/releases/$SHA"
fi
ssh "$HOST" "$ROOT/app/bin/release.sh $SHA"
