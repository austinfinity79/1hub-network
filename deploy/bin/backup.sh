#!/usr/bin/env bash
# Server side: custom-format pg_dump into shared/backups, keeping the newest
# BACKUP_KEEP (default 7). Scheduled daily by onehub-backup.timer.
# Restore (into a NEW database, never over the live one without approval):
#   docker compose exec -T db createdb -U "$POSTGRES_USER" restore_check
#   docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d restore_check < FILE
set -euo pipefail
ROOT=/opt/1hub-network
cd "$ROOT/app"
OUT=$ROOT/shared/backups/onehub-$(date -u +%Y%m%dT%H%M%SZ).dump
umask 077
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$OUT"
docker compose exec -T db pg_restore --list < "$OUT" >/dev/null
echo "BACKUP=$OUT ($(du -h "$OUT" | cut -f1))"

# Retention: keep the newest BACKUP_KEEP dumps (default 7). Runs only after the
# new dump is verified, so a failed backup never deletes a good one.
KEEP=${BACKUP_KEEP:-7}
ls -1t "$ROOT"/shared/backups/onehub-*.dump | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f -- "$old" && echo "PRUNED=$old"
done
