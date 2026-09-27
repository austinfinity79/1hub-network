# Internal Alpha Release Manifest

**Status: READY — Internal Alpha RELEASE CANDIDATE / GREEN** (frozen 2026-09-28; [freeze report](reports/INTERNAL-ALPHA_release-freeze.md)).

Deploy EXACTLY the release SHA with the deploy tooling SHA below. Never a branch name, "latest main" or HEAD at deploy time (CLAUDE.md §14).

Not deployed yet: deployment is Task 20, not started. Team UAT: **PENDING** (after deployment). Audit: [INTERNAL_ALPHA_COMPLETION_AUDIT.md](INTERNAL_ALPHA_COMPLETION_AUDIT.md).

## Release
| Field | Value |
|---|---|
| **Release SHA** (app, branch `main`) | **`9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`** — all accepted product and build code, including IA-P2-01, the IA-P2-02 hydration patch (`patches/next@15.5.26.patch`) and IA-P2-03. Later `main` commits are docs only |
| **Deploy tooling SHA** (branch `deploy/vps-foundation`) | **`68488cfe9732b46aad297e24ab6f2811ce6d9caf`** — `deploy/Dockerfile` copies `patches/` before the install. Local branch in the worktree `/Users/thanosvn/workspace/1hub-network-deploy`; not on `origin` |
| **Rollback SHA** | `0a2df094b941f6d0f0fc87cdb7767b2e92272198` — the review build running now. `rollback.sh` reuses its kept image `onehub-app:<sha>` (no rebuild). Schema-safe: no migration since. A rollback brings back the recoverable #418 |
| Runtime | Node 22 (engine-strict), pnpm 11.23.0 via corepack (`packageManager`), PostgreSQL 17 (review: `postgres:17.6-alpine`) |
| Migrations | `db/migrations/001`→`009`: 9 files, sha256 ledger `schema_migrations`, applied in order, rerun-safe. None added since `0a2df09` |
| Seed / bootstrap | `db/seed/seed_p0_deterministic.sql` through `node scripts/db.mjs seed`, only if the DB is not yet seeded. Idempotent (× 2 identical). Non-production fixtures: 5 personas, Chapter 01 / 02, Club 01, HUB, vocabulary, legal rows, Demo Startup |
| Scope | P0-LANDING, P0-SHELL, WF01, WF02, WF03, WF04 DEMO, WF05 DEMO. WF06 excluded (DEC-WF06-INTERNAL-ALPHA-SCOPE) |
| Protected workflows | M0, WF01, WF02, WF03, WF04 (DEMO), WF05 (DEMO): PROTECTED / CLOSED / GREEN. P0-LANDING, P0-SHELL: DONE / GREEN |

## Commands (from the deploy worktree at `68488cf`)
| Step | Command |
|---|---|
| Backup (before) | `/opt/1hub-network/app/bin/backup.sh` (pg_dump; copy `/opt/1hub-network/shared/media` separately) |
| Deploy | `deploy/bin/deploy.sh 9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (refuses branch names; ships `git archive <sha>`, syncs `deploy/`, runs `release.sh`) |
| Install + build (image, by `release.sh`) | `docker build -f $APP/Dockerfile /opt/1hub-network/releases/<sha>`, which runs: `corepack enable` → `COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./` → `COPY patches ./patches` → `pnpm install --frozen-lockfile` → `COPY . .` → `NODE_ENV=production pnpm build` |
| **patches/ requirement** | **Deployment build MUST copy patches/ before pnpm install --frozen-lockfile.** Satisfied by `68488cf`. Verified by a local docker build of `git archive 9c61458`: the image installs `next@15.5.26_patch_hash=989560c2…` and serves the patched runtime. The previous Dockerfile stops at the install (`ENOENT … patches/next@15.5.26.patch`), so it can never ship unpatched React |
| Migrate | by `release.sh`: `docker compose run --rm --no-deps app node scripts/db.mjs migrate` (expect 9 × skip on the review DB). Never `reset` on a server |
| Seed | only if not seeded: `docker compose run --rm --no-deps app node scripts/db.mjs seed` |
| Start | `node_modules/.bin/next start -H 0.0.0.0 -p 3000` in the container, published on `127.0.0.1:3100` behind nginx; `restart: unless-stopped` |
| Health / smoke | `deploy/bin/smoke.sh` on the server, then the checks below over HTTPS |
| Rollback | `rollback.sh` (defaults to the previous release, `0a2df09`) |

## Environment
| Variable | Required | Value / rule |
|---|---|---|
| `DATABASE_URL` | yes (secret, server `.env` only) | PostgreSQL connection string; without it every DB route answers 500 |
| `NODE_ENV` | yes | `production` (image default); makes the session cookie `Secure` |
| `MEDIA_STORAGE_DIR` | yes | a mounted volume (e.g. `/data/media`) |
| `MEDIA_AVATAR_MAX_BYTES` | no | default 2 MiB (proxy body limit must be ≥ it) |
| `ENABLE_DEV_ROUTES` | **must be unset** | `=1` opens `/dev/login`; never copy `.env.example` to a server |
| `LEGAL_CONTENT_DIR` | no (decision) | unset → legal links 404 (`PRODUCTION_LEGAL_CONTENT_REQUIRED`) |

## Deployment assumptions
| Assumption | Detail |
|---|---|
| Domain / TLS | `1hubnetwork.io.vn` resolves; Let's Encrypt `*.1hubnetwork.io.vn` valid to 2026-12-24; `GET https://1hubnetwork.io.vn/api/v1/auth/providers` → 200 (read-only check, 2026-09-28). nginx 80 + 443 ssl http2 (deploy branch) |
| Database | PostgreSQL 17 reachable through `DATABASE_URL`, seeded once; `backup.sh` before each deploy; sessions and idempotency live in PostgreSQL (restart-safe) |
| Proxy | passes path + query unchanged (the callback reads the token in the browser; no token in HTML) |
| Sign-in (email limitation) | no email provider: an operator issues one-time links (`issue-login-link.sh <name>@example.test`, 15 min, single use) |
| Demo state | WF04 / WF05 demo data lives in each tab's `sessionStorage`; "Đặt lại demo" resets it |
| Widths | every screen usable at 1440 / 1024 / 768 / 390; member / ops shells stay desktop-first (page-level sideways scroll at 390, IA-P3-08) |

## Health / smoke (verified against the release image, 2026-09-28)
| Check | Expect |
|---|---|
| `GET /api/v1/auth/providers` (liveness) | 200 |
| `GET /api/v1/session` | 200 `{"authenticated":false}` |
| `GET /`, `GET /auth` | 200 |
| `GET /api/v1/vocabularies/REGION` (seeded) | 200 with 3 items |
| `GET /dev/typography`, `POST /dev/login` | 404 |
| `GET /me` as guest | 307 → `/auth` |

## Known defects
P0 / P1 / P2: none (IA-P2-01, IA-P2-02 and IA-P2-03 closed). Accepted P3 (documented, none blocking): IA-P3-01..08, IA-L1, WF04-P3-01..06, WF05-P3-01..05. Watch: IA-OBS-01. Details are in the audit's Defects table.

## External dependencies (not product-code defects)
| Item | Class | State for the review deploy |
|---|---|---|
| Deploy image copies `patches/` before the install | DEPLOY BLOCKER | **Resolved** (`68488cf`, verified) |
| Server secrets (`DATABASE_URL` in the server `.env`), `ENABLE_DEV_ROUTES` unset | DEPLOY BLOCKER | Provisioned for the running review build; Task 20 verifies them with `smoke.sh` and the `/dev/login` 404 check |
| DNS + TLS for `1hubnetwork.io.vn` | DEPLOY BLOCKER | **Resolved** (checked above) |
| Email provider (operator-issued links, `@example.test` only) | TEAM-UAT LIMITATION | Accepted |
| Real legal content (`PRODUCTION_LEGAL_CONTENT_REQUIRED`) | TEAM-UAT LIMITATION | Accepted |
| Proxy security headers (CSP, HSTS, X-Frame-Options); media outside `pg_dump` | TEAM-UAT LIMITATION | Accepted |
| Real production roster / taxonomy | POST-ALPHA ITEM | — |
| Auth rate limiting, CSRF beyond SameSite, session TTL decision, server error logging / monitoring | POST-ALPHA ITEM (go-live blockers) | — |
| Deploy-branch docs stale (not seeded, WF01 open, PO checklist without landing / shell / WF04 / WF05) | Task 20 housekeeping | — |

## Related
- [reports/INTERNAL-ALPHA_release-freeze.md](reports/INTERNAL-ALPHA_release-freeze.md) — freeze evidence
- [INTERNAL_ALPHA_COMPLETION_AUDIT.md](INTERNAL_ALPHA_COMPLETION_AUDIT.md) — audit and verdict
- [INTERNAL_ALPHA_UAT_MATRIX.md](INTERNAL_ALPHA_UAT_MATRIX.md) — journeys and security cases
- [P0_STATUS.md](P0_STATUS.md) — status
