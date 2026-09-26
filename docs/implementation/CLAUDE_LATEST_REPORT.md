# Claude Task Report

## 1. Task
- Task ID / name: WF02-S04 — Roles / Network (`/me/roles`), resumed after the G1–G5 freeze
- Status: **DONE**
- Mode: LOCAL REVIEW. No migration, no push.

## 2. Decisions
- [DEC-WF02-S04-G1..G5](../decisions/DECISION_LOG.md#dec-wf02-s04-g1): human approved; OPEN-WF02-S04 CLOSED; remaining S04 decisions 0.
- [DEC-WF02-S04-D1..D4](../decisions/DECISION_LOG.md#dec-wf02-s04-d1): rows, provenance labels, request-card copy/behaviour, pixel fixture.

## 3. Scope implemented
| Part | Result |
|---|---|
| Roles card | Read-only rows from `GET /me/network`: ventures, memberships (every stored state), leadership; chip = type; right = stored source + start date; no approver names |
| Request card (G5) | One organisation selector + "Gửi yêu cầu" → `POST /me/membership-requests` with Idempotency-Key; view reloads the read model after each attempt |
| API | `POST /me/membership-requests`: session profile; only `organization_id` read; target must be HUB/CHAPTER/CLB and PUBLISHED (G1), else 404; ACTIVE/PENDING_APPROVAL/SUSPENDED/ALUMNI → 409 `MEMBERSHIP_INVALID_TRANSITION` (G3/G4); REJECTED/WITHDRAWN → new record; creates PENDING_APPROVAL + SELF_DECLARED only; audit `MEMBERSHIP_REQUESTED` once (G2) |
| Concurrency | Profile row lock + `uq_open_membership`; a unique violation maps to 409 |
| Not rendered | Activity journal (H5, P0 scope); bell counter |

## 4. Files changed
- New: `src/lib/network/membership-request.ts` (+ `.db-test.ts`, 12), `src/app/api/v1/me/membership-requests/route.ts`, `src/app/(member)/me/roles/{roles-view.tsx,roles.module.css,roles-model.ts,roles-model.test.ts}`, `tests/visual/specs/wf02-s04-roles-network.spec.ts` (12)
- Changed: `src/app/(member)/me/roles/page.tsx`, `src/lib/audit/audit.ts` (`MEMBERSHIP_REQUESTED`), `tests/visual/pixel-qa/qa-screens.ts`, `wf02-t00-member-foundation.spec.ts` (placeholder check → `/me/settings`)

## 5. Migrations / data
None. Existing `community_memberships`, `uq_open_membership`, `audit_events`, idempotency store.

## 6. Tests / build
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 152/152 |
| DB | 229/229 |
| Playwright (full) | 313 passed, 24 skipped by design |
| WF01 pixel runs | 8 screens PASS |
| S01 / S03 / T00 specs | PASS (in the full suite) |
| Restart | `GET /me/network` + `/session` identical after app + PostgreSQL restart; the pending request persists; a repeat is still 409; no email/token in logs |

## 7. Security
| Check | Result |
|---|---|
| Owner derivation | Session only; body `profile_id`/`account_id`/`state`/`source` ignored → the caller's own PENDING_APPROVAL/SELF_DECLARED |
| IDOR | `?profile_id=` shows only the caller's rows |
| Duplicate / concurrent / replay | 1 record each (409 for repeats and 5 of 6 parallel; same key replays the same id) |
| Invalid target | Unknown, malformed, DRAFT, ARCHIVED, COMPANY, missing, nested object → 404; no audit |
| Capability | `/session` capabilities and managed_scopes `[]` before and after ACTIVE, PENDING, leadership and a request; no leadership or RoleAssignment rows created |
| Leakage | No bootstrap batch/email, other member email, metadata or slug in the page |

## 8. Visual QA
| Class | Result |
|---|---|
| Structural / Major / Component | 0 (row pitch, name column, chip box fixed to the reference) |
| Raster | 58 px outside text (0.006%): chip right edges following label width in the frozen font (TYPOGRAPHY-MIGRATION) |
| Intentional-P0-Scope | activity journal card, bell counter |
| Intentional-Contract | request card (G5); provenance text without approver names |
| Verdict | **PASS** (viewport authoritative; full page 1594 > 900) |

## 9. Deviations / blockers
None. Request-card copy awaits PO review.

## 10. Git
- Branch: `main`; start HEAD `9523859`
- Implementation commit: `39c4e57`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `fed0b25`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decisions
- [P0_STATUS.md](P0_STATUS.md) — status
