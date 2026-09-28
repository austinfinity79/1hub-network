# Internal Alpha Favicon Deployment

Favicon hotfix record. Favicon DEPLOYED GREEN; overall release NOT READY (edge items open). Governing sheet: `docs/implementation/INTERNAL_ALPHA_PREVIEW_RELEASE.md` on `main`.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `935fd4ada12160f744d87c64bcf17409309401a0` (tag `internal-alpha-preview-08`) |
| Previous / rollback SHA | `3fd00e4c30103aa6ffcc36753c6b5f11324948e9` (image and sources kept) |
| Tooling | `deploy/vps-foundation` `e89f5e3`; deploy scripts unchanged |
| Image | `onehub-app:935fd4a…` = `sha256:b66cfffdd49d…1e31e` |
| Deployed | 2026-09-28 16:45 → 16:48 UTC |
| Difference from the previous release | `src/app/icon.png` and docs |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260928T164551Z.dump` |
| Migrations / seed | 9 × skip; no seed; no schema change |
| Env | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `LEGAL_CONTENT_DIR` set; dev routes off. Values not printed |
| Icon in the container | sha256 `654523e7ca1b…`, equal to the supplied file |
| Public asset | `/icon.png?18acfe949f7832f0` 200 `image/png`, new bytes on all three edge nodes |
| Pages | `/`, `/auth`, `/about`, `/library` 200, each with one icon link |
| Runtime | #418 0; Nginx 5xx since deploy 0; DB row counts unchanged |
| Rollback | `rollback.sh` → 3fd00e4 (state `previous`, image and sources present) |

## Open on the edge

| Item | State |
|---|---|
| Bare `/icon.png` | previous icon from cache on two of three nodes (`max-age=31536000`); purge it in the panel |
| HTTP/3, Referrer-Policy, health check | unchanged, see [INTERNAL_ALPHA_HOMEPAGE_DEPLOYMENT.md](INTERNAL_ALPHA_HOMEPAGE_DEPLOYMENT.md) |

## Related

- [INTERNAL_ALPHA_HOMEPAGE_DEPLOYMENT.md](INTERNAL_ALPHA_HOMEPAGE_DEPLOYMENT.md) — 3fd00e4
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
