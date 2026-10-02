# WF05-PROD-01_domain-lifecycle

**WF05 production contract — canonical model, applicant, lifecycle, immutability, form, visibility, cross-WF invariants.** FROZEN 2026-10-02. Main contract: [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md).

## Canonical model (one copy of each; no V2, no WF05 store)
| Concept | Canonical entity / table | Canonical ID | Owner / relation |
|---|---|---|---|
| User | `user_accounts` | `user_accounts.id` | authenticates by session |
| Profile | `individual_profiles` (1:1 account, `account_id` unique) | `individual_profiles.id` | one root profile per account |
| Venture / Project / Startup | `projects`, `type` PROJECT \| STARTUP, `status` DRAFT \| ACTIVE \| ARCHIVED, `visibility` | `projects.id` | `owner_profile_id` → `individual_profiles` (the founder); WF02 owns create / edit / publish |
| ProjectMember | `project_members` (`state` PENDING_CONFIRMATION → ACTIVE → LEFT / REMOVED, REJECTED; `permission` EDIT \| VIEW) | `project_members.id` | `project_id` → `projects`, `profile_id` → `individual_profiles`; never a row for the owner (DEC-WF02-S05-G5) |
| Programme | `programmes` (`programme_status` DRAFT \| PUBLISHED \| CLOSED, ARCHIVED read-compatible) | `programmes.id` | `organization_id` → one operational unit; WF04 owns its lifecycle |
| ProgrammeApplicationForm | `programme_application_forms` (PK `programme_id`, `applicant_types`, `questions [{id, prompt, required, step 1–4}]`, `version`) | `programme_id` | written by WF04 (`PUT …/registration`), read by WF05 |
| ProgrammeApplication | `applications` | `applications.id` | `venture_id` → `projects`, `programme_id` → `programmes`, `created_by_account_id` / `submitted_by_account_id` → `user_accounts` |
Mapping to the Data SOT: Team ≡ a PROJECT venture with its members; Startup ≡ a STARTUP venture; TeamMembership / StartupMembership ≡ confirmed `project_members`; INDIVIDUAL applicant and Solution are FUTURE.

## Primary applicant
| Rule | Contract |
|---|---|
| submitting actor | the authenticated account whose profile is the venture's `owner_profile_id`, onboarding DONE |
| application belongs to | exactly one venture (`venture_id`) and one programme (`programme_id`) |
| applicant type | derived at create: PROJECT → TEAM, STARTUP → STARTUP; must be in the form's `applicant_types`; never stored on the venture |
| owner / team validation | on every call, server side, from the session; team members of any permission get no application access (HD-A13) |
| one venture, several programmes | allowed (one application per programme) |
| same venture + programme | at most one active (DRAFT or SUBMITTED) application: `uq_applications_active_pair`; another create → `409 APPLICATION_EXISTS` with `application_id` |
| separate Applicant domain | none |

## Lifecycle
DRAFT → SUBMITTED, final. No other status exists (`application_status`); readiness is derived (`missing`), never stored. The DRAFT is created on the first save; submit re-checks eligibility and every required answer, then writes SUBMITTED, `submitted_at`, `submitted_by_account_id` and the snapshot in one transaction. No reopen, withdraw, discard or review in P0.

### Programme-state matrix
| Programme state | Create | Edit draft | Submit | Read own draft | Read own submitted |
|---|---|---|---|---|---|
| DRAFT | no (`404`) | — | — | — | — |
| PUBLISHED (with a form) | yes, eligible venture | yes | yes | yes | yes, snapshot |
| CLOSED | no (`404`) | no (`409 APPLICATION_NOT_ELIGIBLE`, `NOT_PUBLISHED`) | no (same) | yes, read only, saved answers shown | yes, snapshot |
| ARCHIVED (compatibility) | no | no | no | yes, read only | yes, snapshot |
Venture ARCHIVED: create, edit and submit refused (`409 APPLICATION_NOT_ELIGIBLE`, `ARCHIVED`); reads as above.

## Submitted immutability
After SUBMITTED nothing on the row changes: answers, `programme_id`, `venture_id`, `primary_applicant_type`, `created_by_account_id`, `submitted_at`, `submitted_by_account_id`, `question_set_version`, status and snapshot (trigger `trg_applications_submitted_final`). The row is never deleted (guard required, DB contract D1). The snapshot (`schema_version` 1: programme, questions, answers, venture, team without e-mails or account ids, `submitted_at`) is written once; later venture, team or form edits never change it. `PATCH` → `409 APPLICATION_SUBMITTED`. Amendment or resubmission: OUT OF P0.

## Form consistency (WF04 ↔ WF05)
WF05 reads the programme's canonical form by `programme_id`, validates answers against its question ids and records `question_set_version`; it keeps no copy of the schema except inside the submit snapshot. Once an application exists, `PUT …/registration` is refused (`409`, DEC-W4P-D12 / D13 #3); create must read the form under a share lock so a concurrent `PUT` cannot bump the version after an application exists. Q3(b) stays NOT_REQUIRED_FOR_P0 (WF04-PROD-07).

## Visibility
| Object | Visible to |
|---|---|
| venture | WF02 rules: DRAFT ventures are PRIVATE (`ck_projects_draft_private`); owner and ACTIVE members read; WF05 lists only the actor's own ventures; applying never changes venture visibility |
| draft application | the owner only |
| submitted application | the owner only; never public, never in audit rows, logs or replay bodies past expiry |
| closed-programme history | the owner only, read only, in S01 / S02 and by id |
| programmes offered to apply | PUBLISHED with a form, every onboarded member, only through S01 / S02 / L5 (DEC-W4P-D10) |
| operators | no application read; WF04 sees only that the form is locked |

## Cross-WF invariants
| Pair | Invariant |
|---|---|
| WF02 ↔ WF05 | same `projects.id`; same owner (`owner_profile_id`) and membership (`project_members`); no copy on entering WF05 (SUB0 uses `POST /ventures`); venture edits happen in WF02 and show live in DRAFT applications |
| WF04 ↔ WF05 | same `programmes.id`; same form row and version; one `applications` store; WF05 never invents or caches programme data; programme state drives the matrix above |

## Related
- [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md) · [WF05-PROD-01_rbac-api-frontend.md](WF05-PROD-01_rbac-api-frontend.md) · [WF05-PROD-01_db-contract.md](WF05-PROD-01_db-contract.md)
