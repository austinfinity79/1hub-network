# Internal Alpha L1 L2 Deployment

Record of the Internal Alpha release that carries the L1 / L2 correction, the PO decision freeze, the Thảo business UAT and the Library layout hotfix. DEPLOYED GREEN. Governing records on `main`: `docs/implementation/l1-l2-realign/` and `docs/implementation/reports/INTERNAL-ALPHA-L1-L2_deploy.md`.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `b3feee7e354e9692e2eda05f099215c785c59681` (tag `internal-alpha-preview-09`, local) |
| Previous / rollback SHA | `935fd4ada12160f744d87c64bcf17409309401a0` (image and sources kept; `rollback.sh` returns to it) |
| Contents | L1 `5fcbae1`…`5d8cf56`, L2 `c9c7cb5`…`6686468`, PO freeze `0e39f94` `2999c04`, UAT `da685b3`, Library hotfix `b6aa0fa` (cherry-pick of `c1b60c3`), backlog `b3feee7` |
| Tooling | `deploy/vps-foundation` `401400f`; scripts unchanged |
| Image | `onehub-app:b3feee7e354e9692e2eda05f099215c785c59681` |
| Deployed | 2026-09-29, verified 10:03 UTC |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260929T100004Z.dump`, 119 447 bytes, sha256 `a2148896…7f3a`, verified by `pg_restore --list` |
| Migrations | 001–009 skip; `010_p0_onboarding_four_stage`, `011_p0_venture_lifecycle`, `012_p0_alpha_decision_freeze` applied; no seed |
| Reference data after | COUNTRY 1, SPECIALIZATION 8, VENTURE_STAGE 5 (IDEA … GROWTH); REGION 3, DOMAIN 2, SKILL 2 unchanged (review seed) |
| Env | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `DATABASE_URL`, `MEDIA_STORAGE_DIR`, `LEGAL_CONTENT_DIR` set; dev routes off. Values not printed |
| Domain smoke | 43 / 43: public pages at 1440 / 1024 / 768 / 390, Library layout (gutter 45, first card 358 at 1440 and 1728) and tabs, `startup.json`, sign-in request, callback, session, resume, onboarding → `/me`, profile edit, Project and Startup create / edit, e-mail invitation, publish rule, profile visibility, outsider and spoofed headers refused, DRAFT private |
| Runtime | #418 0; Nginx 5xx since deploy 0; app log errors 0; assets 200 at edge and origin |
| Restart | same SHA, image and env names; data kept; healthy; internal smoke OK |

## Smoke data left in the database

| Item | State |
|---|---|
| `smoke-alpha09-1790676212-owner@example.test`, `…-outsider@example.test` | accounts from the operator login link; the owner completed onboarding |
| `SMOKE PROJECT 1790676212` | DRAFT, PRIVATE |
| `SMOKE STARTUP 1790676212 (sửa)` | ACTIVE, PUBLIC (no public venture page exists) |
| Invitation to `delivered@resend.dev` (Resend sandbox) | REMOVED by the owner |

## Observations

| Item | State |
|---|---|
| Edge under burst | a scripted burst of parallel browsers saw a few `ERR_CONNECTION_CLOSED` on fonts / chunks from OneShield; spaced loads 0 failures (172 resources); the same files return 200 |
| `/health` 404 | OneShield probe; the app has no health route (open since the homepage deployment) |

## Related

- [INTERNAL_ALPHA_FAVICON_DEPLOYMENT.md](INTERNAL_ALPHA_FAVICON_DEPLOYMENT.md) — 935fd4a
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
