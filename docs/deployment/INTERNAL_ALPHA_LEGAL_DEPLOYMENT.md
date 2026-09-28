# Internal Alpha Legal Deployment

FINAL RELEASE BLOCKER CLOSURE record: approved legal text and `/legal/<kind>` links. Verdict NOT READY: the OneShield edge items are still open. Governing sheet: `docs/implementation/INTERNAL_ALPHA_PREVIEW_RELEASE.md` (`main` `83b2e12`).

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `2033264b9f8314cee8e8c1bf9c0022d2906ac4e9` (tag `internal-alpha-preview-06`) |
| Previous / rollback SHA | `08bbbb9e25a2d51f41323dd93dab33cfcf04001c` (image and sources kept; no `content/legal`, so legal links answer 404 after a rollback) |
| Tooling | `deploy/vps-foundation` `b4fd5cb`; deploy scripts unchanged |
| Image | `onehub-app:2033264…` = `sha256:2f5e2f9bc326…b8cc8` |
| Deployed | 2026-09-28 12:27 → 12:30 UTC |
| Identity proof | `releases/<sha>` content hash equals `git archive 2033264` (917 files, `b18b26bf715b1947`) |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260928T122736Z.dump`; `app.env.bak-20260928T122736Z` |
| Env change | `LEGAL_CONTENT_DIR=content/legal` added to `shared/env/app.env` (mode 600); other keys untouched, values not printed |
| Migrations / seed | 9 × skip; no seed; no schema change |
| Legal | `/legal/terms`, `/legal/privacy` 307 → `…/p0-2026-09` 200; unknown kind 404; files in the container equal the repository copies |
| Routes | `/`, `/about`, `/library`, `/auth`, `/api/v1/auth/providers` 200; About 46 images; Library 6 · 72 · 84 |
| Runtime | #418 0; Nginx 5xx since deploy 0 |
| Restart | `docker compose restart app`: healthy, same image and SHA, env present, row counts unchanged |
| Rollback | `rollback.sh` → 08bbbb9; env: copy `app.env.bak-20260928T122736Z` back and recreate the container |

## Open on the edge (checked 28/09 15:03 UTC)

| Item | Public value | Required |
|---|---|---|
| HTTP/3 | `alt-svc: h3=":443"; ma=7200` on all four nodes | off for this domain |
| Referrer-Policy | `strict-origin-when-cross-origin` | origin value passed through (`no-referrer` on `/auth/callback`) |
| Health check | `GET /health` 404 from 103.72.96–98.x | `GET /api/v1/auth/providers` |

## Related

- [INTERNAL_ALPHA_FINAL_RELEASE_DEPLOYMENT.md](INTERNAL_ALPHA_FINAL_RELEASE_DEPLOYMENT.md) — 08bbbb9
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
