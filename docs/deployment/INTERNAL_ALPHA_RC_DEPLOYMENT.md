# Internal Alpha RC Deployment

Record of the TASK 24 Internal Alpha release candidate (L2 delta, L3, L4, L5 server-side applications, L6 check) with DEP-1 closed. DEPLOYED. Governing record on `main`: `docs/implementation/reports/INTERNAL-ALPHA-RC_deploy.md`.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Release SHA (deployed) | `ff052d70fe418cb092bd5e33fcc03ee712c76d14` |
| Previous / rollback SHA | `c02cdd9ba4ab6b84bf87a569c02c608cc62804a0` (`rollback.sh`; 013 is additive and unused by it) |
| Image | `onehub-app:ff052d70fe418cb092bd5e33fcc03ee712c76d14` |
| Deployed | 2026-09-30, 01:54–01:58 UTC; smoke by 02:10 UTC |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260930T015416Z.dump` (130 017 bytes, sha256 `a0e46dca…ee2c39`) before any change |
| Migrations | 001–012 skip, `013_p0_applications.sql` applied; existing rows unchanged (counts and content hash) |
| DEP-1 data | the L5 seed block only: programme `d4000000-…01` PUBLISHED under `chapter-01` + its form (TEAM, STARTUP; 2 questions); re-applied: identical |
| Env | `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `LEGAL_CONTENT_DIR`, `MEDIA_STORAGE_DIR` kept; `ENABLE_DEV_ROUTES` unset |
| Domain smoke | 35 / 35: public pages, auth, `/me`, Library tabs, L3 leader pages, L5 founder journey, cross-user refusals |
| Runtime | #418 0; 5xx 0 (app and Nginx since deploy); broken assets 0 |

Smoke data left: `smoke-rc-a-…` / `smoke-rc-b-…@example.test`, venture `SMOKE RC STARTUP …` (DRAFT), one SUBMITTED application.

## Related

- [ABOUT_HUB_LEAD_DEPLOYMENT.md](ABOUT_HUB_LEAD_DEPLOYMENT.md) — c02cdd9
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
