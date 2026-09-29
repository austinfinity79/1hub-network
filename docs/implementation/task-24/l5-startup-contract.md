# L5 Startup Contract

TASK 24.4 contract freeze for the server-side Application ([DEC-L5-D1…D6](../../decisions/DECISION_LOG.md#dec-l5-d1)). Built on the proposal [application-persistence.md](../../design-revision/scope-refreeze/application-persistence.md), with the PO answers of 29/09: programme-configured questions (HD-A8), migration approved, member routes (HD-A10), venture type derived or asked (HD-A11); HD-A12 and HD-A13 take their defaults.

## Migration report (013, additive)
| # | Item |
|---|---|
| 1 | Capability: a founder's application must persist on the server (draft, resume on any device, submit once, read-only afterwards); the session-only demo cannot do it (DEC-2809-D6) |
| 2 | Today: no `applications` table; `programmes` has no applicant types or question set |
| 3 | Enums `application_status` (DRAFT, SUBMITTED), `applicant_type` (TEAM, STARTUP). Table `programme_application_forms` (`programme_id` PK → programmes, `applicant_types applicant_type[]`, `questions jsonb` [{id, prompt, required, step 1–4}], `version int`, `updated_at`). Table `applications` (id, programme_id → programmes, venture_id → projects, primary_applicant_type, status, answers jsonb, question_set_version, created_by_account_id, created_at, updated_at, submitted_at, submitted_by_account_id, snapshot jsonb); partial unique index (venture_id, programme_id) for DRAFT / SUBMITTED; CHECK SUBMITTED ⇔ submitted_at, submitted_by and snapshot set; trigger refusing any UPDATE of a SUBMITTED row (defence in depth under the service rule) |
| 4 | Backward compatible: new objects only; no existing column, type or row changes |
| 5 | One transaction, checksummed by the migration ledger; the seed adds the approved WF04 PUBLISHED programme (`d4000000-…01`) and its application form as deterministic fixture rows (no production roster data) |
| 6 | Rollback: drop `applications`, `programme_application_forms` and the two enums; nothing else depends on them; the previous release ignores them |

## API (`/api/v1`, frozen envelope)
| Call | Rule |
|---|---|
| `GET /me/applications` | the actor's applications (ventures they own): id, venture, programme, status, updated_at, submitted_at |
| `POST /applications` `{venture_id, programme_id}` | owner of a non-archived venture; programme PUBLISHED with an application form; venture's applicant type accepted; 201 DRAFT; an existing pair → 409 `APPLICATION_EXISTS` with its id; `Idempotency-Key` |
| `GET /applications/{id}` | owner only; anyone else, malformed or unknown → the same 404 |
| `PATCH /applications/{id}` `{answers: [{question_id, value}]}` | owner; DRAFT only (SUBMITTED → 409 `APPLICATION_SUBMITTED`); known question ids; value ≤ 2000 characters |
| `POST /applications/{id}/submit` | owner; row locked; eligibility re-checked; every required answer present (else 422 `APPLICATION_INCOMPLETE` with the missing ids); SUBMITTED + snapshot in one transaction; a second submit → 409; `Idempotency-Key` |

Authority: session, onboarding DONE, venture owner (relation rule, like `venture:manage`). Team members, organisers and operators read nothing (HD-A13; review is Future). Audit `APPLICATION_DRAFT_CREATED`, `APPLICATION_SUBMITTED`: ids and statuses only, never answers.

## Snapshot (`schema_version: 1`, written once)
`programme {id, name, type, question_set_version}` · `questions [{id, prompt, step}]` · `answers [{question_id, value}]` · `venture {id, type, name, summary, status, stage, domains}` · `team {owner, members}` (display names and role labels of ACTIVE members; no e-mail or account id) · `submitted_at`. The submitted view reads the snapshot, never live data.

## Question layout (HD-A8)
Each configured question carries `step` 1–4 (Hiểu đề, Cách giải, Đội & kế hoạch, Cần hỗ trợ gì). Step 3 always shows the venture team read-only (L40); a step with no question and no fixed content is skipped. The seeded programme: "Dự án của bạn giải quyết vấn đề gì?" → step 1, "Bạn cần chương trình hỗ trợ điều gì?" → step 4, both required.

## SUB0 (HD-A11)
Only when the member owns no eligible venture for the programme. Fields: name, domain (DOMAIN vocabulary, ≥ 1), one-line summary, and — required by the canonical venture ([DEC-L2R-D4](../../decisions/DECISION_LOG.md#dec-l2r-d4)) — stage; the type is derived when the programme accepts one applicant type and asked when it accepts both. It calls the existing `POST /ventures` (same audit and idempotency) and opens the form; the application is created by the form's first save (`POST /applications`, idempotent), never by opening it.

## Related
- [l5-startup-inventory.md](l5-startup-inventory.md) · [../../design-revision/scope-refreeze/application-persistence.md](../../design-revision/scope-refreeze/application-persistence.md)
