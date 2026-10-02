# WF05-PROD-01_db-contract

**WF05 production contract — database.** FROZEN 2026-10-02 from the live catalog (local DB at migration 015). No migration is written here; the one required change set goes to WF05-PROD-02. No new table. Main contract: [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md).

## Tables
| Table | PK | FK | Ownership link | Uniqueness | Lifecycle field | Indexes | Constraints | NOT NULL |
|---|---|---|---|---|---|---|---|---|
| `user_accounts` | `id` | — | self | `email_normalized` | `status` (`account_status`) | PK, unique | — | id, email, email_normalized, status, timestamps |
| `individual_profiles` | `id` | `account_id` → user_accounts (cascade), vocab ids | `account_id` | `account_id` (1:1) | `status` (`profile_status`) | PK, unique | — | id, account_id, status, no_experience_yet, onboarding_hub_claims, timestamps |
| `projects` (Venture) | `id` | `owner_profile_id` → individual_profiles; `region_id`, `stage_id` → vocabulary | `owner_profile_id` | `slug` | `status` DRAFT \| ACTIVE \| ARCHIVED; `visibility` | PK, slug, `(owner_profile_id, status)` | `ck_projects_draft_private`, `ck_projects_visibility` (PRIVATE \| PUBLIC) | id, type, owner_profile_id, slug, name, status, metadata, visibility, timestamps |
| `project_members` | `id` | `project_id` → projects (cascade), `profile_id`, `invited_by_profile_id` → individual_profiles | `project_id` + `profile_id` | one ACTIVE row per (project, profile); one PENDING invite per (project, e-mail) | `state` (5 values) | PK, two partial uniques, pending-email index | `ck_pm_active` / `left` / `pending` / `rejected` / `removed`, `ck_pm_permission` (EDIT \| VIEW), `ck_pm_email_normalized` | id, project_id, state, permission, updated_at |
| `programmes` | `id` | `organization_id` → organizations | `organization_id` (NOT NULL, 015) | `slug` | `status` (`programme_status`) | PK, slug, `(organization_id, status)` | `ck_programmes_dates`, `ck_programmes_metadata` | id, organization_id, programme_type, slug, name, status, metadata, timestamps |
| `programme_application_forms` | `programme_id` | `programme_id` → programmes | via programme | one form per programme (PK) | `version` | PK | questions is an array, ≥ 1 applicant type, version > 0 | all columns |
| `applications` | `id` | `programme_id` → programmes, `venture_id` → projects, `created_by_account_id` / `submitted_by_account_id` → user_accounts | `venture_id` (owner via the venture) | `uq_applications_active_pair (venture_id, programme_id)` where DRAFT or SUBMITTED | `status` DRAFT \| SUBMITTED | PK, active-pair unique, `(programme_id, status)` | answers is an array; `ck_applications_submitted` (SUBMITTED ⇔ submitted_at, submitted_by and snapshot); trigger `trg_applications_submitted_final` refuses UPDATE of SUBMITTED | id, programme_id, venture_id, primary_applicant_type, status, answers, question_set_version, created_by_account_id, timestamps |
| `idempotency_keys` (shared) | `id` | — | `actor_account_id` | key + operation + actor | `state`, `expires_at` (24 h) | existing | existing | existing |
| `audit_events` (shared) | `id` | — | `actor_account_id` | — | — | existing | existing | existing |

## Required changes
| # | Item | Class | Why | Current failure | Migration |
|---|---|---|---|---|---|
| D1 | refuse DELETE of a SUBMITTED application (trigger extends the 013 guard) | CONSTRAINT_REQUIRED | submitted immutability | a DELETE drops it without audit | 016 |
| D2 | refuse changes to `venture_id`, `programme_id`, `primary_applicant_type`, `created_by_account_id` on a DRAFT | CONSTRAINT_REQUIRED | applicant identity fixed at create | only the service refuses | 016 |
| D3 | `CHECK (snapshot IS NULL OR jsonb_typeof(snapshot) = 'object')` (pre-check every row) | CONSTRAINT_REQUIRED | snapshot shape | no shape check | 016 |
| D4 | form read under a share lock at create | NO_CHANGE (service, PROD-03) | form locked once applied | race with `PUT …/registration` | no |
| D5 | venture type fixed | EXISTING (service: WF02 `PATCH` refuses `type` as `immutable` after create) | applicant type must match | — (0 mismatches) | no |
| D6 | indexes on `created_by_account_id` / `submitted_by_account_id` | NO_CHANGE in P0 | account deletion is a request, not a cascade | — | no |
| D7 | purge expired `idempotency_keys` (replays hold answers) | NO_CHANGE in schema (service, PROD-02) | answers never outlive the 24 h replay window | `purgeExpiredIdempotencyKeys` is never called | no |
| D8 | one active application per pair | EXISTING | duplicates | — | no |
| D9 | `programme_status` with CLOSED (WF04 015) | EXISTING (WF04 candidate) | D3 matrix, `d4…0001` closing | — | no (015) |
| D10 | application DB role not table owner | out of WF05 (infra lane) | triggers cannot be disabled by the app | local role owns tables | — |
Every other column, key, index and constraint above: EXISTING / NO_CHANGE. Migration 016 is additive, pre-checks existing rows (STOP on any violation), runs in one transaction and records a rollback note, as 015 did.

## Related
- [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md) · [WF05-PROD-01_domain-lifecycle.md](WF05-PROD-01_domain-lifecycle.md) · [WF05-PROD-01_implementation-handoff.md](WF05-PROD-01_implementation-handoff.md)
