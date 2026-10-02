# WF05-PROD-01_implementation-handoff

**Allowed implementation scope for WF05-PROD-02 (persistence / schema) and WF05-PROD-03 (API / lifecycle / RBAC)**, derived from the frozen [production contract](WF05-PROD-01_production-contract.md). Anything not listed needs a new authorization. Gap IDs refer to the [PROD-00 gap matrix](WF05-PROD-00_gap-matrix.md).

## WF05-PROD-02 — persistence / schema only
| # | Current state | Required target | Files / modules | Migration / API impact | Risk |
|---|---|---|---|---|---|
| P2-1 (G16, G17) | 013 trigger refuses UPDATE of SUBMITTED only; DRAFT identity columns and snapshot shape unchecked | migration 016: refuse DELETE of SUBMITTED; refuse changing `venture_id`, `programme_id`, `primary_applicant_type`, `created_by_account_id` on any row; `snapshot` is an object when present; pre-checks STOP on violation; one transaction; rollback note | `db/migrations/016_*.sql`, new `src/lib/db/application-integrity.db-test.ts`, `DB_SCHEMA_GAPS_P0.md` | migration 016 (additive); no API change | production holds applications: pre-checks, rehearsal on a production-shaped copy |
| P2-2 (G15) | replay bodies keep application DTOs with answers; `purgeExpiredIdempotencyKeys` never runs | expired keys purged so no answers outlive the 24 h window (purge on write in the store, or a scheduled call), with a test | `src/lib/idempotency/store.ts`, `src/lib/idempotency/idempotency.db-test.ts` | none | shared store (WF01–WF04): targeted regression |
| P2-3 (G19) | seed has one venture and no application; specs mutate the shared d4 form | deterministic test helpers: PROJECT venture, EDIT and VIEW members, second owner, ARCHIVED venture, DRAFT and SUBMITTED applications, CLOSED programme with applications, programme without a form, TEAM-only and STARTUP-only forms; cleanup; no shared-row mutation | new `tests/visual/support/ventures.ts`, DB-test helpers | none | test isolation |
| P2-4 (G20) | seeded venture ACTIVE + PRIVATE (unreachable) without DEC-L2R-D4 fields; seed re-run rewrites the d4 form even with applications | seed venture in a reachable state; the form upsert never rewrites a form that has applications | `db/seed/seed_p0_deterministic.sql` | local / CI only, never production | specs that rely on the current seeded state need updating |

## WF05-PROD-03 — API / lifecycle / RBAC only
| # | Current state | Required target | Files / modules | Migration / API impact | Risk |
|---|---|---|---|---|---|
| P3-1 (G06) | loose id regex → `500` on `/ventures/{id}`, publish, team, `/demo/projects/{id}` | strict UUID → `404` | `src/lib/venture/venture.ts` (WF02 PROTECTED: the PROD-03 contract must authorize it) | none (conformance) | WF02 targeted regression |
| P3-2 (G07, D3) | `GET /me/applications` bare array, no programme status | §2.4 envelope `{items}`; each item carries its programme status; S01 consumer adapted in the same change | `src/app/api/v1/me/applications/route.ts`, `src/lib/application/application.ts`, `src/components/project-demo/project-list.tsx` | API §21 amendment A6 | S01 regression |
| P3-3 (G09) | PATCH skips the ARCHIVED-venture check; `answers` unbounded | `409 APPLICATION_NOT_ELIGIBLE` `ARCHIVED`; at most one entry per form question | `src/lib/application/application.ts` | A6 (refusals) | low |
| P3-4 (G10) | create reads the form without a lock | create and `PUT …/registration` serialize on the same form row (share vs update lock); `PUT` re-counts applications under the lock | `src/lib/application/application.ts`; `src/lib/programme/programme.ts` (WF04 candidate code: authorize) | none | WF04 registration regression |
| P3-5 (G11) | a draft of a non-PUBLISHED programme reads with no questions | reads load the form whatever the programme state; DTO adds `editable` + `reason`; PATCH / submit refuse as today | `src/lib/application/application.ts`, `types.ts` | A6 (additive DTO fields) | low |
| P3-6 (G12) | unexpected errors become `500` without a log | log class, message, stack and `request_id` (never bodies) | `src/lib/api/handler.ts` (shared) | none | all workflows: targeted regression |
| P3-7 (G13, application part) | create / submit read through a second pool connection inside their transaction | every read inside the transaction uses its executor | `src/lib/application/application.ts`; executor parameter on WF02 read helpers (authorize) | none | medium: WF02 helpers |
| P3-8 (G28) | `lib/application` imports `applicantTypeFor` from `project-demo`; applicant type defined three times | one definition in `lib/application`; demo modules import it | `src/lib/application/*`, `src/lib/project-demo/*` | none | low |
| P3-9 (G34, API part) | no WF05 API / security spec | `wf05-prod-api.spec.ts` (actors, IDOR, spoofing, malformed ids, envelope, idempotency per action, closed programme, archived venture) + DB tests for P3-2…P3-7 | `tests/visual/specs/`, `src/lib/application/*.db-test.ts` | none | — |
| P3-10 (G05) | API contract and capability matrix lag the code | API §21 amendment A6; matrix rows for application ownership; `venture:manage` incl. EDIT (DEC-L2R-D7); OpenAPI YAML for `/applications*`, `/ventures/{id}/publish` | `docs/architecture/05_API_CONTRACT_P0_v1.0.md` / `.yaml`, `AUTHORIZATION_CAPABILITY_MATRIX_P0.md` | docs | — |

## Not in PROD-02 / PROD-03
- WF05-PROD-04 (frontend): demo artifacts removal, MemberShell labels, own applications in every programme state on S01 / S02, `401` → `/auth?redirect`, read-only closed drafts, save retry, back targets, step numbers, QuickTeam errors, copy (G21–G29).
- WF02 follow-ups, outside WF05 unless the PO authorizes: team invitation `Idempotency-Key` (G08); invitation e-mail sent inside a row-locked transaction (G13, team part).
- Global: rate limiting, CSRF beyond SameSite, framework 400 / 405 envelope (G14); application DB role (D10, infra lane).

## Promotion runbook items
1. After WF04 is promoted (migration 015 live): a `programme:manage` actor closes `d4…0001` through `POST /api/v1/programmes/{id}/close`; verify it leaves member discovery and its applications stay readable to their owners. No deletion.
2. Owner document updates: CLAUDE.md §2 WF05 wording; Data SOT annotation of the Venture mapping; superseded notes on DEC-WF05-G3 / T00-D2 / T00-D3, the WF05 completion audit, UAT matrix and P0_STATUS "(DEMO)".
3. Merge order with the unmerged `fix/member-shell-mobile` lane (same `(demo)` layout) settled before PROD-04.

## Testing boundary
Tests create their own data through the helpers (P2-3); the local seed `d4…0001` is used only as explicit deterministic setup; no production test depends on it; restart / relogin persistence is proven as in WF04 (local restart check).

## Related
- [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md) · [WF05-PROD-01_db-contract.md](WF05-PROD-01_db-contract.md) · [WF05-PROD-01_rbac-api-frontend.md](WF05-PROD-01_rbac-api-frontend.md)
