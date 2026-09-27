# Internal Alpha Release Manifest

**Status: DRAFT — NOT READY. Do not deploy.** The final recheck of `dcbde62` (clean install, fresh DB; [report](reports/INTERNAL-ALPHA_final-recheck.md)) was **NOT GREEN** on basic responsive safety — **IA-P2-03**, since **CLOSED** by `9c61458` ([report](reports/IA-P2-03_basic-responsive-safety.md)). IA-P2-02 is closed and its patch reproduces from tracked files. No release SHA is frozen: the final release recheck freezes it here. When frozen: deploy EXACTLY that SHA, never a branch name or "latest main" (CLAUDE.md §14). Audit: [INTERNAL_ALPHA_COMPLETION_AUDIT.md](INTERNAL_ALPHA_COMPLETION_AUDIT.md).

## Release
| Field | Value |
|---|---|
| Branch | `main` |
| Release SHA | **none — not frozen.** Audited candidate `dcbde62d94b3e6fa0fcc3cb361acf66023d6ad9f` (final recheck: all gates PASS except IA-P2-03); not approved for deploy |
| Audit / manifest commit | the commit containing this file (docs only) |
| Rollback SHA | `0a2df094b941f6d0f0fc87cdb7767b2e92272198` (`0a2df09`, the build on the review VPS per the deploy-branch docs; no `db/`, `scripts/` or `next.config.ts` change since, so schema-safe; the lockfile changed only for the IA-P2-02 `next` patch, so a rollback brings back the recoverable #418) |
| Runtime | Node 22 (engine-strict), pnpm via corepack (`package.json` `packageManager`), PostgreSQL 17 |
| Migrations | `db/migrations/001`→`009` (9 files, sha256 ledger `schema_migrations`); **no new migration since `0a2df09`** |
| Seed | `db/seed/seed_p0_deterministic.sql` (deterministic, idempotent upsert; non-production fixtures: 5 personas, Chapter 01 / 02, Club 01, HUB, vocabulary, legal document rows, Demo Startup) |
| Scope | P0-LANDING, P0-SHELL, WF01, WF02, WF03, WF04 DEMO, WF05 DEMO. WF06 excluded (DEC-WF06-INTERNAL-ALPHA-SCOPE) |
| Protected workflows | WF01, WF02, WF03, WF04 (DEMO), WF05 (DEMO): PROTECTED / CLOSED / GREEN |

## Commands (deploy tooling lives on branch `deploy/vps-foundation`)
| Step | Command |
|---|---|
| Backup (before) | `/opt/1hub-network/app/bin/backup.sh` (pg_dump; media are not included — copy `/opt/1hub-network/shared/media` separately) |
| Deploy | from the deploy worktree: `deploy/bin/deploy.sh <frozen release SHA>` (refuses branch names; ships `git archive <sha>`) |
| Install + build (inside the image) | `corepack enable && pnpm install --frozen-lockfile && NODE_ENV=production pnpm build`. **Deployment build MUST copy patches/ before pnpm install --frozen-lockfile.** (`patchedDependencies` → `patches/next@15.5.26.patch`, IA-P2-02.) `deploy/Dockerfile` copies only `package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc` today: the install then fails with `ENOENT … patches/next@15.5.26.patch` (verified; it never installs unpatched React). Add `COPY patches ./patches` before the install in the deploy task |
| Migrate | run by `release.sh`: `node scripts/db.mjs migrate` (expect 9 × skip on the review DB) — never `reset` on a server |
| Seed / bootstrap | only if the DB is not yet seeded: `docker compose run --rm --no-deps app node scripts/db.mjs seed` (re-seeding resets fixture rows to their seed state) |
| Start | `next start -H 0.0.0.0 -p 3000` (container), published on `127.0.0.1:3100` behind nginx; `restart: unless-stopped` |
| Health / smoke | `deploy/bin/smoke.sh` on the server (checks below), then the public checks over HTTPS |
| Rollback | `rollback.sh` (defaults to the previous release, i.e. `0a2df09`) |

## Environment
| Variable | Required | Value / rule |
|---|---|---|
| `DATABASE_URL` | yes (secret) | PostgreSQL connection string; without it every DB route answers 500 |
| `NODE_ENV` | yes | `production` (default under `next start`); sets the session cookie `Secure` |
| `MEDIA_STORAGE_DIR` | yes | a mounted volume (e.g. `/data/media`); the default `.data/media` is inside the container |
| `MEDIA_AVATAR_MAX_BYTES` | no | default 2 MiB (proxy body limit must be ≥ it) |
| `ENABLE_DEV_ROUTES` | **must be unset** | `=1` opens `/dev/login` (sign-in as any email) and other dev pages; `.env.example` sets it for local use — never copy that file to a server |
| `LEGAL_CONTENT_DIR` | no (decision) | unset → legal links (landing footer, onboarding "Đọc") answer 404 (`PRODUCTION_LEGAL_CONTENT_REQUIRED`); set only to approved or clearly marked content |
| `PORT` | no | `next start` default 3000 |

## Deployment assumptions
| Assumption | Why |
|---|---|
| HTTPS in front of the app | the session cookie `1hub_session` is `Secure` (HttpOnly, SameSite=Lax, 30 days); over plain HTTP no sign-in holds |
| Reverse proxy passes the path + query unchanged | the callback page reads the token from the query in the browser (static page, no token in HTML) |
| Sign-in for testers | no email provider: an operator issues one-time links (`issue-login-link.sh <name>@example.test`, 15 min, single use); a new `@example.test` address creates a new account |
| Demo state | WF04 / WF05 demo data lives in each browser tab's `sessionStorage`; a new tab or browser starts clean; "Đặt lại demo" resets it |
| Sessions / idempotency | in PostgreSQL; an app or DB restart keeps users signed in (audited) |
| Database | PostgreSQL 17 reachable through `DATABASE_URL`; migrations 001→009 (9, in order, rerun-safe); seeded once; `backup.sh` before each deploy |
| Domain / TLS | review domain `1hubnetwork.io.vn` (nginx on the deploy branch: 80 + 443 ssl http2); a valid certificate must be in place before sign-in testing |
| Supported width | every screen usable at 1440 / 1024 / 768 / 390 (IA-P2-03 closed); member / ops shells stay desktop-first with page-level sideways scroll at 390 (IA-P3-08) |

## Health / smoke (after deploy)
| Check | Expect |
|---|---|
| `GET /api/v1/auth/providers` (container healthcheck, liveness) | 200 |
| `GET /api/v1/session` | 200 `{"authenticated":false}` |
| `GET /` (DB-backed) | 200 |
| `GET /api/v1/vocabularies/REGION` (seeded) | 200 with 3 items |
| `GET /dev/typography`, `POST /dev/login` | 404 |
| `GET /me` as guest | 307 → `/auth` |

## Known defects
Open P0 / P1 / P2: none (IA-P2-02, IA-P2-03 closed). Accepted P3 (documented, none blocking): IA-P3-01..08, IA-L1, WF04-P3-01..06, WF05-P3-01..05 — see the audit's Defects table. Watch: IA-OBS-01.

## External dependencies (not product-code defects)
| Item | Class |
|---|---|
| `deploy/Dockerfile` copies `patches/` before the install | DEPLOY BLOCKER (deploy-branch change) |
| Production secrets on the server (`DATABASE_URL`), `ENABLE_DEV_ROUTES` unset | DEPLOY BLOCKER |
| DNS for `1hubnetwork.io.vn` and a valid TLS certificate (cookie `Secure`) | DEPLOY BLOCKER (verify in the deploy task) |
| Email provider (operator-issued one-time links, `@example.test` only) | TEAM-UAT LIMITATION |
| Real legal content (`PRODUCTION_LEGAL_CONTENT_REQUIRED`; legal links 404 unless `LEGAL_CONTENT_DIR`) | TEAM-UAT LIMITATION |
| Proxy security headers (CSP, HSTS, X-Frame-Options); media outside `pg_dump` | TEAM-UAT LIMITATION |
| Real production roster / taxonomy (seed fixtures now) | POST-ALPHA ITEM |
| Auth rate limiting, CSRF beyond SameSite, session TTL decision, server error logging | POST-ALPHA ITEM (go-live blockers) |

## Related
- [INTERNAL_ALPHA_COMPLETION_AUDIT.md](INTERNAL_ALPHA_COMPLETION_AUDIT.md) — audit and verdict
- [INTERNAL_ALPHA_UAT_MATRIX.md](INTERNAL_ALPHA_UAT_MATRIX.md) — journeys and security cases
- [P0_STATUS.md](P0_STATUS.md) — status
