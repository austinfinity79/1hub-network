# WF05-PROD-01_rbac-api-frontend

**WF05 production contract — authority, API, idempotency, audit, frontend.** FROZEN 2026-10-02. Server-side authorization is mandatory; hiding a control is never the security boundary. Main contract: [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md).

## Authority
| Action | Owner | ACTIVE member EDIT | ACTIVE member VIEW | other signed-in user | guest | programme operator |
|---|---|---|---|---|---|---|
| read venture | yes | yes | yes | `404` | `401` | `404` |
| edit venture (WF02) | yes | yes, except `owner_role_label` | `403` | `404` | `401` | `404` |
| manage team (WF02) | yes | `403` | `403` | `404` | `401` | `404` |
| start application | yes | `403 SCOPE_FORBIDDEN` | `403 SCOPE_FORBIDDEN` | `404` | `401` | `404` |
| edit / submit application | yes | `404` | `404` | `404` | `401` | `404` |
| read own application | yes (any programme state) | — | — | — | `401` | — |
| read another user's application | `404` | `404` | `404` | `404` | `401` | `404` (HD-A13) |
Pages: a guest is sent to `/auth?redirect=<original path>`; an onboarding-incomplete account to its onboarding step. Owner, role, scope or status sent by the client are never read.

## API (production behaviour; existing routes, no new endpoint)
| Endpoint | Auth / ownership | Payload | Server validation | Lifecycle | Idempotency | Audit | Errors |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/demo/projects` | session, onboarding DONE | — | — | own ventures (owner or ACTIVE); PUBLISHED programmes with a form | — | — | `401` |
| `GET /api/v1/demo/projects/{ventureId}` | owner or ACTIVE member | — | strict UUID | venture, ACTIVE team, programme rows with eligibility, own application status | — | — | `401`, `404` (malformed, unknown, foreign; never `500`) |
| `GET /api/v1/ventures/{id}`, `PATCH`, `POST /ventures` (WF02) | WF02 rules | WF02 | WF02; strict UUID | WF02 | `venture.create` | WF02 | malformed id `404`, never `500` |
| programme / form read | no member programme API (DEC-W4P-D10) | — | form read server side inside the calls below | PUBLISHED only for create / edit / submit | — | — | — |
| `GET /api/v1/me/applications` | session | — | — | every own application, any programme state, with programme status | — | — | `401`; §2.4 list envelope `{items: […]}` |
| `POST /api/v1/applications` | owner | `{venture_id, programme_id}` only | unknown keys `422`; strict UUID; venture not ARCHIVED; type accepted | programme PUBLISHED with a form, form read under share lock | `application.create` (key replay = same `201`) | `APPLICATION_DRAFT_CREATED` (ids, never answers) | `403` member, `404`, `409 APPLICATION_NOT_ELIGIBLE` (`ARCHIVED`, `TYPE_NOT_ACCEPTED`), `409 APPLICATION_EXISTS` + `application_id` |
| `GET /api/v1/applications/{id}` | owner | — | strict UUID | DRAFT: live venture, team, form (read only when the programme is not PUBLISHED, saved answers shown); SUBMITTED: snapshot only | — | — | `404` |
| `PATCH /api/v1/applications/{id}` | owner, row lock | `{answers: [{question_id, value}]}`, at most one entry per form question | known ids, `value` ≤ 2000, empty clears | DRAFT, programme PUBLISHED, venture not ARCHIVED | by value (same answers = same state) | none (contract §21.2) | `422 APPLICATION_VALIDATION_FAILED`, `409 APPLICATION_SUBMITTED`, `409 APPLICATION_NOT_ELIGIBLE` |
| `POST /api/v1/applications/{id}/submit` | owner, row lock | none | every required answer | DRAFT, eligibility re-checked; SUBMITTED + snapshot in one transaction | `application.submit` | `APPLICATION_SUBMITTED` | `422 APPLICATION_INCOMPLETE`, `409 APPLICATION_SUBMITTED`, `409 APPLICATION_NOT_ELIGIBLE` |
Common: `401` without a session; malformed JSON or body `422`, never `500`; every refusal uses the frozen envelope (`code`, `message`, `request_id`, `fields` / `reason` where defined); every `5xx` is logged server side.

## Idempotency and duplicates
| Case | Behaviour |
|---|---|
| repeated create, same key | the first `201` replayed, one row |
| repeated create, no key | `409 APPLICATION_EXISTS` with the existing `application_id` |
| repeated save | same answers → same state, no audit (a changing save: `APPLICATION_DRAFT_UPDATED`, DEC-W5P-D12) |
| repeated submit, same key | the first `200` replayed |
| repeated submit, no key | `409 APPLICATION_SUBMITTED` |
| concurrent submit | row lock: exactly one SUBMITTED, the other `409` (or the replay with the same key) |
| duplicate venture → programme | `uq_applications_active_pair`: one active application per pair |
| replay retention | replay bodies (they contain answers) never outlive their 24 h expiry: expired keys are purged |

## Audit
Kept as frozen (API §21.2): `APPLICATION_DRAFT_CREATED`, `APPLICATION_SUBMITTED` with ids and statuses, never answers; venture and team events per WF02. No audit for draft saves. Operational logs record 5xx without request bodies. *Superseded 2026-10-03 by DEC-W5P-D12 (WF05-PROD-05): a changing draft save writes `APPLICATION_DRAFT_UPDATED` (ids, changed question ids, no values).*

## Frontend
| Rule | Contract |
|---|---|
| state | real API only: no fixture, fake submit, demo reset, actor-key control, browser-stored business state or client-computed status that overrides the server |
| loading / empty | S01 / S02 loading and empty states; L5 as drawn |
| validation | `422` fields shown next to the field; QuickTeam shows the server reason, not a blanket "Bắt buộc" |
| permission | `403` / `404` render the ordinary refusal; a `401` returns through `/auth?redirect=<path>` instead of looping |
| server error | safe message + "Thử lại" on lists and on a failed save |
| closed / ineligible | a draft of a non-PUBLISHED programme renders read only with its answers and the reason; no enabled submit |
| submitted | read only from the snapshot; reachable from S01 / S02 in every programme state |
| navigation | cancel / back returns to where the journey started (S01, S02 or the apply link); step numbers consistent |
| refresh / relogin | everything saved survives; unsaved typing is flushed on step change, blur and page hide |
| design | approved L5 frames and current S01 / S02 are the baseline; no redesign; only the demo artifacts above are removed |

## Related
- [WF05-PROD-01_production-contract.md](WF05-PROD-01_production-contract.md) · [WF05-PROD-01_domain-lifecycle.md](WF05-PROD-01_domain-lifecycle.md) · [WF05-PROD-01_implementation-handoff.md](WF05-PROD-01_implementation-handoff.md)
