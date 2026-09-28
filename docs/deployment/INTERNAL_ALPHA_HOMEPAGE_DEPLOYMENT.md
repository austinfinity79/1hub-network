# Internal Alpha Homepage Deployment

TASK 22-HOMEPAGE-FINAL-DEPLOY record: homepage aligned to the latest export, on top of the deployed release. Homepage DEPLOYED GREEN; overall release NOT READY (edge items open). Governing sheet: `docs/implementation/INTERNAL_ALPHA_PREVIEW_RELEASE.md` (`main` `af1185a`).

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `3fd00e4c30103aa6ffcc36753c6b5f11324948e9` (tag `internal-alpha-preview-07`) |
| Previous / rollback SHA | `2033264b9f8314cee8e8c1bf9c0022d2906ac4e9` (image and sources kept; same schema, env and legal content) |
| Tooling | `deploy/vps-foundation` `9f59252`; deploy scripts unchanged |
| Image | `onehub-app:3fd00e4…` = `sha256:34f4403f6936…50f3f` |
| Deployed | 2026-09-28 15:20 → 15:23 UTC |
| Identity proof | `releases/<sha>` content hash equals `git archive 3fd00e4` (923 files, `b562fb474bafa4b2`) |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260928T152004Z.dump` |
| Migrations / seed | 9 × skip; no seed; no schema change |
| Env | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `LEGAL_CONTENT_DIR` set; dev routes off. Values not printed |
| Homepage | domain capture equals the verified local capture (0 differing pixels); PO removals absent; 13 sections; partner matrix with five labelled placeholder rows |
| Navigation | `/about`, `/library`, `/auth`, legal links |
| Preserved | About 46 images; Library 6 · 72 · 84; container reaches `startup.json` (200, 72); favicon; guest `/me` → `/auth` |
| Auth | UI request for the operator inbox 202, Resend accepted; new persona → `/onboarding/purpose`; `member@example.test` → `/me`, L2 routes 200 |
| Restart | `docker compose restart app` 15:30 UTC: healthy, same image and SHA, env present, row counts unchanged |
| Rollback | `rollback.sh` → 2033264 (state `previous`, image and sources present) |

## HTTP 5xx

| When (UTC) | What |
|---|---|
| 15:27:27 | 2 × 504 on `/_next/image` (two About photos): upstream timed out once with an empty image cache under a burst; not reproduced (69 / 69 image responses 200 later) |
| 15:30:16 | 1 × 502 on `/health` from the edge health check during the restart |
| after 15:31 | none; 404 only for `/health` and internet scanners (`/.env*`, `/wp-json`) |

## Open on the edge (checked 28/09 16:14 UTC)

| Item | Public value | Required |
|---|---|---|
| HTTP/3 | `alt-svc: h3=":443"; ma=7200` | off for this domain |
| Referrer-Policy | `strict-origin-when-cross-origin` | origin value passed through |
| Health check | `GET /health` 404 | `GET /api/v1/auth/providers` |

## Test data created by this smoke

- `final07-demo-…@example.test`: account from the operator link, onboarding not started.
- Sessions for `member@example.test`; one magic-link request for the operator inbox (unused).

## Related

- [INTERNAL_ALPHA_LEGAL_DEPLOYMENT.md](INTERNAL_ALPHA_LEGAL_DEPLOYMENT.md) — 2033264
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
