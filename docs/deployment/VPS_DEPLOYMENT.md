# VPS Deployment

PRE-UAT / staging-like environment for 1hub.network P0. **Not Production Go-Live.**

## Architecture

```
Internet ─▶ Nginx :80 (:443 after DNS + certbot) ─▶ 127.0.0.1:3100 ─▶ app container :3000
                                                                        │ compose network only
                                                                        ▼
                                                        PostgreSQL 17.6 (no published port)
```

| Item | Value |
|---|---|
| VPS | `103.252.93.145`, Ubuntu 24.04, SSH alias `hub-vps` (root, key only) |
| Domain | `1hubnetwork.io.vn` |
| Firewall | `ufw` allows 22, 80, 443 only |
| Compose project | `onehub` (`db`, `app`); restart `unless-stopped`; both have healthchecks |
| Image | `onehub-app:<full-sha>`, built from `git archive <sha>` with `deploy/Dockerfile` |

## Server paths

| Path | Purpose |
|---|---|
| `/opt/1hub-network/app/` | deploy tooling (this `deploy/` directory, rsynced); `.env` holds `APP_SHA` |
| `/opt/1hub-network/releases/<sha>/` | exact source of each release |
| `/opt/1hub-network/current` | symlink to the running release |
| `/opt/1hub-network/shared/env/` | `db.env`, `app.env` (mode 600, never committed) |
| `/opt/1hub-network/shared/media/` | avatar storage, mounted at `/data/media` (uid 1000); never web-served |
| `/opt/1hub-network/shared/backups/` | `pg_dump` files |
| `/opt/1hub-network/shared/state/` | `current`, `previous` release SHAs |
| volume `onehub_pgdata` | PostgreSQL data |

## Environment variable names

| File | Names |
|---|---|
| `db.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `app.env` | `NODE_ENV=production`, `DATABASE_URL`, `MEDIA_STORAGE_DIR`, `MEDIA_AVATAR_MAX_BYTES` |
| unset on purpose | `ENABLE_DEV_ROUTES` (dev routes 404), `LEGAL_CONTENT_DIR` (legal text 404 until supplied) |

The session cookie is `Secure` because `NODE_ENV=production`, so login only works over HTTPS.

## Commands

| Task | Command |
|---|---|
| Deploy | from a checkout: `deploy/bin/deploy.sh <commit-sha>` (rejects branch names) |
| Migrate only | `cd /opt/1hub-network/app && docker compose run --rm --no-deps app node scripts/db.mjs migrate` |
| Status | `docker compose ps` in `/opt/1hub-network/app` |
| Smoke (internal) | `/opt/1hub-network/app/bin/smoke.sh` |
| Rollback | `/opt/1hub-network/app/bin/rollback.sh [sha]` (default: `shared/state/previous`) |
| Backup | `/opt/1hub-network/app/bin/backup.sh` |

The deploy steps are: build, migrate, switch the app, wait for health, smoke, then update `current`. If the new app is unhealthy, it reverts to the previous image.

Rollback never reverts the schema. There are no down-migrations. After a release that adds a migration, rolling back is safe only if the old code still runs on the new schema.

Restore a backup into a new database, never over the live one without approval:

```
docker compose exec -T db createdb -U "$POSTGRES_USER" restore_check
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d restore_check < FILE
```

## Health

- The container healthcheck calls `GET /api/v1/auth/providers`. The app has no dedicated health endpoint.
- The smoke test checks that `/auth` and `/api/v1/session` return 200 and `/dev/typography` returns 404. It also reads `/api/v1/vocabularies/REGION`, which is DB-backed.

## DNS / TLS

1. Set `1hubnetwork.io.vn A 103.252.93.145` and remove the AAAA record (the VPS has no IPv6).
2. Then run `certbot --nginx -d 1hubnetwork.io.vn --redirect`, then `certbot renew --dry-run`.

## Known release blockers

- No email delivery. The magic-link token is never sent, so nobody can sign in on this server.
- Production legal content (`LEGAL_CONTENT_DIR`) is missing.
- The real launch roster and the production REGION/DOMAIN/SKILL taxonomy are missing. The database is migrated but not seeded.
- The WF01 final UAT gate is still open.

## Related

- [compose.yaml](../../deploy/compose.yaml) — server stack
- [Dockerfile](../../deploy/Dockerfile) — app image
