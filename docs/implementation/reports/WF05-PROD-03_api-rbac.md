# WF05-PROD-03_api-rbac

**WF05-PROD-03 — lifecycle / API / RBAC hardening.** 2026-10-02, branch `feat/wf05-prod-hardening` on `9842b70` (PROD-02). Scope = handoff P3-1 … P3-10 of the [implementation handoff](WF05-PROD-01_implementation-handoff.md); no migration, UI redesign, new endpoint, error code, role or lifecycle. Evidence: [WF05-PROD-03_evidence.md](WF05-PROD-03_evidence.md).

## Preflight
Branch `feat/wf05-prod-hardening`, HEAD `9842b70` (PROD-02), tree clean except `AGENTS.md`; migrations 001–016 applied; `origin/main` / production `78f21f2`; no other lane in HEAD; no runtime fixture or `d4…0001` reference.

## API inventory (production WF05)
| Method | Route | Auth | Owner check | Lifecycle check | Validation | Idempotency | Audit | Errors |
|---|---|---|---|---|---|---|---|---|
| GET | `/me/applications` | session, onboarding | own ventures | every state | — | — | — | 401; `{items}` |
| POST | `/applications` | idem | venture owner (member 403) | programme PUBLISHED with form, rows FOR SHARE; venture not ARCHIVED; type accepted | allowlist `venture_id`, `programme_id`; strict UUID | `application.create` | `APPLICATION_DRAFT_CREATED` | 401, 403, 404, 409 EXISTS / NOT_ELIGIBLE, 422 |
| GET | `/applications/{id}` | idem | owner, else 404 | DRAFT live (read only when not editable), SUBMITTED snapshot | strict UUID | — | — | 401, 404 |
| PATCH | `/applications/{id}` | idem | owner, row lock | DRAFT; programme PUBLISHED (FOR SHARE); venture not ARCHIVED | allowlist `answers`; known ids, one per question, string ≤ 2000 | by value | none (frozen) | 401, 404, 409 SUBMITTED / NOT_ELIGIBLE, 422 |
| POST | `/applications/{id}/submit` | idem | owner, row lock | DRAFT; eligibility re-checked; required answers | no body | `application.submit` | `APPLICATION_SUBMITTED` | 401, 404, 409, 422 INCOMPLETE |
| GET | `/demo/projects`, `/demo/projects/{id}` | idem | owner or ACTIVE member | — | strict UUID (P3-1) | — | — | 401, 404 |
| GET / PATCH | `/ventures/{id}` (WF02) | idem | read owner / member; edit owner / EDIT | ARCHIVED read only | WF02 allowlist; strict UUID (P3-1) | — | WF02 | 401, 403, 404, 409, 422 |
| POST | `/ventures`, `/ventures/{id}/publish` (WF02) | idem | onboarding / owner | WF02 | WF02 | `venture.create` | WF02 | unchanged |
| GET / POST / PATCH / DELETE | `/ventures/{id}/team*` (WF02) | idem | owner manages; members read | ARCHIVED read only | WF02 | — (G08, WF02 follow-up) | WF02 | unchanged |
No member programme read API (DEC-W4P-D10): the form is read server side inside the calls above.

## Changes
| # | Finding | Class | Change | Files |
|---|---|---|---|---|
| P3-1 (G06) | 36-character non-UUID venture id → 500 | API_BUG | strict UUID in the WF02 read helper → 404 | `lib/venture/venture.ts` |
| P3-2 (G07) | `/me/applications` bare array | API_BUG | `{items}` envelope; item `programme.status`; S01 / S02 readers adapted | route, `application.ts`, `types.ts`, `project-list.tsx`, `project-detail.tsx` |
| P3-3 (G09) | PATCH accepted an ARCHIVED venture's draft; unbounded / repeated answers | LIFECYCLE_BUG | 409 `ARCHIVED`; 422 `too_many` / `duplicate` | `application.ts` |
| P3-4 (G10) | create read the form unlocked; a registration change could follow an application | LIFECYCLE_BUG | create, save, submit hold programme then form FOR SHARE (WF04's lock order); WF04 code unchanged | `application.ts` |
| P3-5 (G11) | a CLOSED / ARCHIVED programme's draft read with no questions and "nothing missing" | LIFECYCLE_BUG | read mode loads the form in any state; DTO `editable` + `reason` | `application.ts`, `types.ts` |
| P3-6 (G12) | unexpected errors not logged | API_BUG | server log with `request_id`, class, message, stack; no body | `lib/api/handler.ts` |
| P3-7 (G13) | write transactions borrowed a second pool connection | API_BUG | WF02 `getVenture` / `getTeam` take the caller's executor (default unchanged); proven: 12 concurrent creates 12 / 12 (9 / 12 before) | `venture.ts`, `team.ts`, `application.ts` |
| P3-8 (G28) | application service imported the demo module; applicant type defined thrice | API_BUG (structure) | `lib/application/applicant.ts`; demo modules import it | `applicant.ts`, `project-demo/eligibility.ts`, `project-demo/types.ts` |
| P3-9 (G34) | no WF05 API / security tests | — | `wf05-prod-api.spec.ts` (9), `application-hardening.db-test.ts` (19) | tests |
| P3-10 (G05) | contract docs lagged | — | API §23 amendment A6; matrix rows (application relation rule, `venture:manage` incl. EDIT); OpenAPI paths | docs |

## Contract notes (frozen contract applied, flagged)
| Task clause | Frozen contract | Applied |
|---|---|---|
| §14 audit "Draft save/update" | WF05 contract and API §21.2: audit create and submit only; "no audit for draft saves" (autosave every 20 s) | frozen rule kept; PO may add `APPLICATION_DRAFT_SAVED` (ids, no answers) as a contract change |
| §15 "400 validation" | frozen envelope: validation is `422` (`APPLICATION_VALIDATION_FAILED`) | `422` |

## Old tests classified
| Test | Finding | Class | Action |
|---|---|---|---|
| `l5-startup-journey` ownership, `wf05-s01` case 3, `wf05-uat-journey` SEC-WF05-01 | asserted the pre-A6 bare array of `/me/applications` | old test vs frozen contract (P3-2, A6 envelope) | expected value wrapped in `{items}`; the intent (nothing created, nothing leaked) unchanged |

## Deferred
- PROD-04 (FRONTEND_GAP): render `editable` / `reason` (read-only closed drafts), list closed-programme applications on S01 / S02 (`programme.status` now provided), SUB1 page for a non-PUBLISHED draft, `401` → `/auth?redirect`, demo artifacts, back targets, save retry, error copy by `reason`, QuickTeam errors, step numbers, MemberShell labels.
- OUT_OF_SCOPE (WF02 follow-ups): team invitation `Idempotency-Key` (G08), invitation e-mail inside a row-locked transaction (G13 team part); global rate limit / CSRF (G14).

## Related
- [WF05-PROD-03_evidence.md](WF05-PROD-03_evidence.md) · [WF05-PROD-01_rbac-api-frontend.md](WF05-PROD-01_rbac-api-frontend.md) · [WF05-PROD-02_persistence.md](WF05-PROD-02_persistence.md)
