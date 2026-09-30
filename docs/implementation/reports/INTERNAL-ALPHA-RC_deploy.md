# INTERNAL-ALPHA-RC Deploy

**DEP-1 CLOSURE + FINAL RELEASE DEPLOY: DEPLOYED GREEN.** `ff052d70fe418cb092bd5e33fcc03ee712c76d14` (the TASK 24 FINAL RC, [freeze](TASK-24-FINAL_release-freeze.md)) runs on https://1hubnetwork.io.vn since 2026-09-30 01:58 UTC. DEP-1 is closed with PO option A: only the L5 programme and its application form were added. Internal Alpha = DEPLOYED GREEN; human / team UAT pending.

## Release
| Item | Value |
|---|---|
| Previous SHA | `c02cdd9ba4ab6b84bf87a569c02c608cc62804a0` (verified live before the deploy) |
| Deployed SHA | `ff052d70fe418cb092bd5e33fcc03ee712c76d14` (server `state/current`, `APP_SHA`) |
| Rollback | `rollback.sh` → `c02cdd9` (image kept; 013 additive, unused by it) |
| Deploy tooling | `deploy/vps-foundation` `4519a84`; record `dc2ae21` (`docs/deployment/INTERNAL_ALPHA_RC_DEPLOYMENT.md`) |
| DB backup | `/opt/1hub-network/shared/backups/onehub-20260930T015416Z.dump`, 2026-09-30 01:54:17 UTC, 130 017 bytes, sha256 `a0e46dca08fee7a87299430d2fe193681faeb342344fcc0f13255cec78ee2c39`, readable (33 table-data entries) |
| Env | `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `LEGAL_CONTENT_DIR`, `MEDIA_STORAGE_DIR` kept (presence counted, values never printed); `ENABLE_DEV_ROUTES` unset; the container sees `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL` |

## Migration
`release.sh`: 001–012 skip, `013_p0_applications.sql` applied; ledger 13. `applications` and `programme_application_forms` exist. The row counts of 13 existing tables and a content hash over accounts, profiles, ventures, memberships, organisations, programmes and events are identical before and after.

## DEP-1
| Item | Result |
|---|---|
| Source | the L5 block of `db/seed/seed_p0_deterministic.sql` at `ff052d7` (2 `INSERT … ON CONFLICT`, no `DELETE`), wrapped in one transaction; sha256 `39f71d50…ac66ed` |
| Rehearsal | a copy of the `c02cdd9` schema + 013: apply 1 adds 1 programme + 1 form, apply 2 changes nothing |
| Production | programme `d4000000-0000-0000-0000-000000000001` PUBLISHED, `organization_id` = `chapter-01`, "Chương trình ươm tạo (demo)"; form TEAM + STARTUP, 2 required questions, version 1 |
| Idempotency | re-applied: row hashes identical; programme count 1, form count 1 |
| Other data | unchanged (content hash without the new row = baseline) |

## Domain smoke (35 / 35)
| Area | Result |
|---|---|
| Public | `/`, `/about`, `/auth`, `/organizations/chapter-01` 200; `/library` 200 with its 3 tabs; guest `/me` and the apply route → `/auth`; guest API 401 |
| Auth · L1 | operator magic link (token never logged) → onboarding completed → `/me` 200 |
| L3 | leader: `/ops/org/chapter-01`, members, events 200; a member gets 404 |
| L5 | programme visible with its entry; apply page (SUB0) opens; quick team → form; opening creates nothing; first save → one DRAFT; autosave; reload resumes step 04 with the answer; review ready; double-click submit → exactly one SUBMITTED (snapshot, 2 audit events); PATCH / re-submit 409, second start 409; form route → read-only view; venture detail "Đã nộp" |
| Authorization | a second member (spoofed headers) gets 404 on reading, saving, submitting, attaching and opening the first member's application; own list empty |
| Runtime | #418 0; HTTP 5xx 0 (app log and Nginx since deploy); broken assets 0; console: only the two document 404s of the refusal probes |

Smoke data left: `smoke-rc-a-…`, `smoke-rc-b-…@example.test`; venture `SMOKE RC STARTUP …` (DRAFT, private); one SUBMITTED application.

## Related
- [TASK-24-FINAL_release-freeze.md](TASK-24-FINAL_release-freeze.md) · [../INTERNAL_ALPHA_RELEASE_MANIFEST.md](../INTERNAL_ALPHA_RELEASE_MANIFEST.md) · [ABOUT-HUB-LEAD_deploy.md](ABOUT-HUB-LEAD_deploy.md)
