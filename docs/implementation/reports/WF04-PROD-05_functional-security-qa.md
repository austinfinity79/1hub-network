# WF04-PROD-05_functional-security-qa

**WF04-PROD-05 — functional and security QA.** 2026-10-02, branch `feat/wf04-prod-hardening` on `7ea892d` (PROD-04-FIX). Audit + QA only: no runtime code, API, DB, UI or business rule changed. Product bugs found 0; 14 test gaps closed with production tests and one local restart check. Impact map and journeys: [WF04-PROD-05_journey-matrix.md](WF04-PROD-05_journey-matrix.md); per-test inventory: [WF04-PROD-05_test-inventory.csv](WF04-PROD-05_test-inventory.csv) (261 rows). Not pushed, not deployed; production / UAT baseline `78f21f2` untouched.

## Preflight
| # | Check | Result |
|---|---|---|
| 1–2 | branch, HEAD | `feat/wf04-prod-hardening`, `7ea892d` (PROD-04-FIX) |
| 3 | migration 015 | `db/migrations/015_p0_programme_production.sql`, applied by `db:reset` (001–015 + seed) |
| 4 | PROD-03 API / RBAC | 5 route files under `api/v1/programmes`; `programme:manage` in `lib/authz/matrix.ts` |
| 5–6 | real API, fixture dependency | screens call `/api/v1/programmes*`; 0 runtime fixture / session-store / demo read-model imports (T00 scan) |
| 7 | frozen baselines | `origin/main` `78f21f2`, production `78f21f2` |
| 8–9 | concurrency, tree | no other writer (reflog, worktree list); tree clean except `AGENTS.md` |

## Evidence pack
| Gate | Result | Evidence |
|---|---|---|
| Preflight | PASS | table above |
| Impact map | PASS | journey-matrix A–G |
| Happy paths | PASS | journeys A–L on real DB / API; UAT-WF04 create → configure → publish → WF05 apply → locked → close |
| Negative paths | PASS | malformed / unknown id 404; invalid payload, missing field, 10k name, 51 stages, NUL, bad JSON 422; invalid transition, duplicate, closed, locked form, archived owner 409; never a 5xx |
| RBAC | PASS | guest 401, member 403 / 404, foreign leader 404, revoked role loses access at once, admin any operational unit; 6 actors × every route (T00) |
| IDOR | PASS | Chapter 01 leader → org B Challenge: read, PATCH basic, PATCH problems, PUT form, publish, close → 404; **success count 0**; B unchanged |
| Role spoofing | PASS | role / capability / owner / scope / status in headers, query, body: no elevation; unknown keys `not_accepted`; `organization_id` / `type` immutable |
| Lifecycle | PASS | DRAFT → PUBLISHED → CLOSED; DRAFT → CLOSED 409; no reopen, no edit when CLOSED; legacy ARCHIVED row readable, all actions false, writes 409, no archive route |
| Publish | PASS | §8 rules only (Q7); member / foreign refused; repeat 409; key replay 200; one audit; persisted |
| Close backend | PASS | `POST …/close` 200 once; repeat 409; concurrent `[200, 409]` with one audit; DRAFT refused |
| Close UI absent | PASS | S08 asserts no close control on DRAFT / PUBLISHED; CLOSED renders read only |
| Archived org | PASS | direct API: create, PATCH, form, publish, close 409; GET 200 with `owner_archived: true` |
| Challenge | PASS | `programmes.metadata.challenge` only; malformed 422, nothing stored; no secondary table; foreign 404 |
| Application/Form | PASS | canonical form + WF05 `applications`; TEAM / STARTUP; duplicate 409 `APPLICATION_EXISTS`; form locked 409; after close 409 `APPLICATION_NOT_ELIGIBLE`; "Thêm câu hỏi" disabled (Q3(b)) |
| Event boundary | PASS | `events` snapshot identical across a full operator journey; static scan: no WF04 runtime file writes events |
| Idempotency | PASS | per action in journey-matrix; create key replays one row, no key = new row (I5) |
| Audit | PASS | one row per write, matched to the response `x-request-id`; actor, `resource_id`, organization, type, action, `created_at`, resulting status |
| Persistence | PASS | refresh, logout + login, expired session, app restart, DB restart, fresh DB, upgrade 014 → 015 |
| Security/error surface | PASS | frozen envelope keys only; no stack / SQL / token / session / e-mail / metadata; demo APIs and `/dev/login` 404 in production mode |
| Targeted QA | PASS | 261 WF04 tests, 0 failures (below) |
| Protected regression | PASS | 63 specs / 673 tests, UAT 19/19, unit 307, DB 509; 5xx 0, console 0, hydration 0 |

## Targeted QA counts (primary category per test)
| Category | Tests | Category | Tests |
|---|---:|---|---:|
| Functional | 43 | Validation | 71 |
| Lifecycle | 20 | Idempotency | 13 |
| RBAC | 16 | Audit | 1 (+ 7 tests that also assert audit rows) |
| IDOR | 7 | Application integration | 10 |
| Role spoofing | 4 | Persistence / restart | 3 (+ 10-step restart check) |
| Security surface | 11 | Archived owner | 8 |
| Challenge | 2 | Event boundary | 3 |
| DB / migration | 20 | Visual / responsive | 15 |
| Test fixture | 7 | Residual demo lib | 7 |

Layers: unit 109, DB 56, HTTP / E2E 96 (`wf04-prod-qa` 17 new). Functional total 166 (functional, validation, lifecycle, idempotency, audit, application, persistence, Challenge, Event boundary), security total 46 (RBAC, IDOR, spoofing, security surface, archived owner); the other 49 are DB / migration, visual, fixture and residual helpers.

## Fix loop
| Finding | Class | Action |
|---|---|---|
| revoked role, Challenge IDOR, leader spoofing, legacy ARCHIVED row, concurrent close, archived owner over HTTP, malformed Challenge over HTTP, duplicate application + key replay, Event boundary journey, idempotency per action, audit correlation, relogin, expired session, error surface | TEST_GAP | 17 tests in `wf04-prod-qa.spec.ts` |
| app / DB restart and production-mode surface not automatable in the visual runner | TEST_GAP | `scripts/qa/wf04-restart-check.mjs` (local only), 10/10 |
| product behaviour | BUG | none found |
| SOT conflict / new business requirement | — | none |

Coverage audit: PROD-04-FIX left STILL_VALID_AND_MISSING = 0; re-checked against the 261-test inventory: still 0, and no obsolete fixture behaviour restored.

## Observations (no change made)
- `lib/programme-demo/programme-events` (`addEvent`, `updateEvent`, `removeEvent`, `validateEvent`, `canEditEvent`, `canRemoveEvent`) and `registration` (`validateRegistration`, `updateRegistration`, `isApplicantType`, accepts INDIVIDUAL) are former demo write helpers that no runtime file calls; the screens use only the read helpers `programmeEvents` / `registrationConfigured`. 7 unit tests cover them: PROD-07 cleanup candidate.
- Create without an Idempotency-Key makes a new DRAFT each time; the key is optional by contract (I5); the screen always sends one.

## Remaining decisions
Q3(b) operator-question `required` / `step`: DEFERRED / NEED PO DECISION BEFORE PROD-07. Close control on screen: design decision. Q4–Q6, Q8 (PROD-07), Q9 pixel method (PROD-06), Q10; discarding a DRAFT (Q2 remainder).

## Related
- [WF04-PROD-05_journey-matrix.md](WF04-PROD-05_journey-matrix.md) · [WF04-PROD-04-FIX_test-audit.md](WF04-PROD-04-FIX_test-audit.md) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
