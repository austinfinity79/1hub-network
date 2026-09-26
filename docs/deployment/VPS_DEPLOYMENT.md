# VPS Deployment

PRE-UAT / staging-like environment for 1hub.network P0. **Not Production Go-Live.**

## Architecture

```
Browser ─HTTPS─▶ OneShield/WAF ─▶ Nginx :80/:443 (origin) ─▶ 127.0.0.1:3100 ─▶ app container :3000
                                                                        │ compose network only
                                                                        ▼
                                                        PostgreSQL 17.6 (no published port)
```

| Item | Value |
|---|---|
| VPS | `103.252.93.145`, Ubuntu 24.04, SSH alias `hub-vps` (root, key only) |
| Domain | `1hubnetwork.io.vn` |
| Firewall | `ufw` allows 22, 80, 443 only |
| Compose project | `onehub` (`db`, `app`); restart `unless-stopped`; healthchecks; json-file logs 3 x 10 MB |
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

## DNS / TLS (OneShield)

| Item | State |
|---|---|
| Nameservers | `sapa.vclouddns.com`, `laocai.vclouddns.com` (do not change) |
| Public A/AAAA | OneShield edge IPs, not the VPS; the origin `103.252.93.145` is set in OneShield |
| Browser TLS | OneShield certificate; OneShield does the HTTP→HTTPS redirect and adds HSTS |
| Origin TLS | Let's Encrypt `1hubnetwork.io.vn` via `certbot certonly --nginx` (HTTP-01 through OneShield); renewed by `certbot.timer` |
| Origin port 80 | proxies, never redirects: OneShield reaches the origin over HTTP, so a redirect would loop |
| Forwarded proto | Nginx keeps OneShield's `X-Forwarded-Proto: https`, else its own `$scheme` |

The previous VPS `103.211.207.236` is expired and is not referenced by any active config.

## Host hardening

| Item | State |
|---|---|
| Other hosts / bare IP | `00-default-deny` closes the connection (444); TLS without a matching SNI is refused |
| Client IP | `conf.d/onehub-realip.conf` trusts `X-Real-IP` only from the 3 observed OneShield edges |
| Origin bypass | still OPEN: anyone may reach the origin with `Host: 1hubnetwork.io.vn`; restrict 80/443 to OneShield once its egress list is known |
| Upgrades | security updates stay on, at 20:30 UTC (03:30 ICT); `needrestart` lists, never auto-restarts |
| Images | `release.sh` keeps only the current and previous image and source; rollback is one step deep |

## Known release blockers

- No email delivery. The magic-link token is never sent, so nobody can sign in on this server.
- Production legal content (`LEGAL_CONTENT_DIR`) is missing.
- The real launch roster and the production REGION/DOMAIN/SKILL taxonomy are missing. The database is migrated but not seeded.
- The WF01 final UAT gate is still open.

## Related

- [compose.yaml](../../deploy/compose.yaml) — server stack
- [Dockerfile](../../deploy/Dockerfile) — app image
