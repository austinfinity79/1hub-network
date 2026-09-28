# Internal Alpha Final Release Deployment

FINAL PRE-PRODUCTION CONSOLIDATION record: **HOMEPAGE + ABOUT + LIBRARY + L1 (real e-mail login) + L2**. Verdict NOT READY (open blockers below); not the final Internal Alpha release. Governing sheet: `docs/implementation/INTERNAL_ALPHA_PREVIEW_RELEASE.md` (`main` `da19a8b`).

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `08bbbb9e25a2d51f41323dd93dab33cfcf04001c` (tag `internal-alpha-preview-05`) |
| Previous / rollback SHA | `c535c3523472789a813c726815cfb32c513efd3e` (favicon on About; deployed from its own branch by another session, not recorded here before). Image and sources kept; `db/`, dependencies and `patches/` identical |
| Tooling | `deploy/vps-foundation` `3cbba52`; deploy scripts unchanged |
| Image | `onehub-app:08bbbb9…` = `sha256:3d616538131c…e68b87`; kept images: 08bbbb9 and c535c35 |
| Deployed | 2026-09-28 11:02 → 11:05 UTC |
| Identity proof | `releases/<sha>` content hash equals `git archive 08bbbb9` (911 files, `70970e994ea67b98`) |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260928T110146Z.dump` (107,419 B, 31 table-data entries) |
| Migrations / seed | 9 × skip; no seed; no schema change |
| Env | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL` set; `ENABLE_DEV_ROUTES`, `LEGAL_CONTENT_DIR` unset. Values not printed. Container reaches `startup.1hub.cloud` (200, 72 records) |
| Routes | `/`, `/about`, `/library`, `/auth`, `/icon.png`, `/api/v1/auth/providers` 200; homepage → `/about` and → `/library` |
| About | 46 images, 0 broken; 34 Humans of HUB portraits; overflow 0 at 1440 / 1024 / 768 / 390 |
| Library | Bài toán 6 · Startup 72 · Nhà sáng lập 84; overflow 0 at four widths; no e-mail, phone or raw field in the page |
| Auth | UI request for the operator inbox 202, Resend accepted; new persona → `/onboarding/purpose`; `member@example.test` → `/me`, L2 routes 200; guest `/me` → `/auth`. Real-inbox click not run (PO skipped) |
| Runtime | #418 0; Nginx 5xx since deploy 0; 404 only `/health`, legal pages, `/favicon.ico` |
| Restart | `docker compose restart app`: healthy, same image and SHA, env present, row counts unchanged |
| Rollback | `rollback.sh` → c535c35 (state `previous`, image and sources present) |

## Open items

| ID | Item |
|---|---|
| Legal (BLOCKER) | `/legal/terms`, `/legal/privacy` 404: no production copy |
| EDGE-H3-POST-RESEND | The edge advertises HTTP/3; Chrome's POST over it fails with `ERR_QUIC_PROTOCOL_ERROR` and is resent over TCP, so ~1 in 8 magic-link logins consume the token twice (Nginx: 200, then 409) and show "used" with no session. The origin sends no `Alt-Svc`. Disable HTTP/3 on the edge |
| Edge Referrer-Policy | rewritten to `strict-origin-when-cross-origin` by the edge; the origin sends `no-referrer` on `/auth/callback` |
| Monitor | polls `/health` (404); use `/api/v1/auth/providers` |

## Test data created by this smoke

- `final05-demo-…@example.test`: account from the operator link, onboarding not started.
- Sessions for `member@example.test`; one magic-link request for the operator inbox (unused).

## Related

- [INTERNAL_ALPHA_PREVIEW_ABOUT_DEPLOYMENT.md](INTERNAL_ALPHA_PREVIEW_ABOUT_DEPLOYMENT.md) — 0479579
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
