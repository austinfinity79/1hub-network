# ADMIN-PROD-03-qa

**Evidence 14 – 16, 18 – 20, 22 – 27 and the self-audit.** Parent: [ADMIN-PROD-03-verification-api.md](ADMIN-PROD-03-verification-api.md).

## 14. IDOR / scope (`verification-queue.db-test.ts`, `admin-prod-03-verification-api.spec.ts`)
| Case | Result |
|---|---|
| HUB Tổng handler | sees and decides only requests routed to HUB Tổng |
| Chapter handler | its own positions and fallback from its handler-less CLBs; not a request routed to its CLB (no inheritance) |
| CLB handler | its CLB only; a delegated CLB handler acts, and stops once revoked |
| wrong Chapter / sibling CLB / unrelated unit | not listed; detail and decisions 404 |
| client-spoofed scope | `routed_to` outside scope 403; `x-organization-id` / `x-role` headers ignored; extra body keys 422 |
| raw request id | unknown, malformed, injection-shaped and foreign ids are the same 404; no lock is taken or waited on outside scope |
| self-approval | 403 for everyone, PLATFORM_ADMIN included, audited (with and without Idempotency-Key) |
| member without a grant | list 403, detail 404 |

## 15. Concurrency
Three simultaneous approvals (two handlers) → exactly one 200, two 409, one membership, one leadership; approve vs reject → one terminal transition, one decision event; duplicate approve → 409; an Idempotency-Key retry replays the stored 200; the same key with another body → 409; two positions of one person approved at once share one membership; a membership inserted by another writer during the approval is re-read (EXISTING), never a 500; a revocation committed during a decision refuses it.

## 16. Validation / errors
Unknown, malformed or out-of-scope request → 404 · no grant → 403 · non-PENDING or stale version → 409 `MEMBERSHIP_INVALID_TRANSITION` · body not an object, missing / non-integer / < 1 version, unknown key (`role`, `organization_id`, `routed_to`, `reason` on approve), reason > 500 → 422 with `fields` · list: unknown or repeated parameter, bad status, malformed unit, `limit` outside 1 – 50, malformed cursor → 422 · unpublished unit, suspended membership, inactive requester → 409. Every refusal in the frozen envelope; the HTTP spec asserts no 5xx.

## 18. Targeted tests
| Suite | Tests |
|---|---|
| `src/lib/admin/verification-queue.db-test.ts` (new) | 23: queue scope, filters, keyset paging, detail scope and content, approve current / ended term, existing membership (ACTIVE, PENDING, SUSPENDED, inactive requester), reject with / without / blank reason, self-approval, delegated and revoked handler, validation, concurrency, routing, S1 resubmission, legacy conversion, review hardening |
| `tests/visual/specs/admin-prod-03-verification-api.spec.ts` (new) | 5: authentication, scope over HTTP, idempotent approve, reject + validation, self-approval (with and without a key) |
| `src/lib/admin/admin-foundation.test.ts` | + legacy period parsing |
| `src/lib/api/contract.test.ts`, `src/lib/idempotency/idempotency.db-test.ts` | A9 operation count |

## 19. Protected regression
| Gate | Result |
|---|---|
| format · lint · typecheck | PASS |
| unit | 37 files / 366 tests PASS (was 37 / 365) |
| DB (`pnpm test:db`, resets the DB; WF01 – WF06, auth, RBAC, DB, audit, admin) | 42 files / 685 tests PASS (was 41 / 662) |
| production build | PASS |
| full visual / workflow suite, 84 specs, fresh DB + QA vocabulary | 1,116 passed, 26 skipped, 0 failed (19.6 min) — the WF06 baseline plus the 5 new HTTP tests |
| after the review fixes (queue code only, imported by the 4 new routes alone) | final build: admin API, authz session, WF03 membership review, API contract, idempotency specs 37 / 37 |

## 20. Bugs found / fixed
| Class | Item (found by) | Fix |
|---|---|---|
| DATA_MODEL_BUG | offset paging over a shrinking PENDING queue skipped requests after decisions (review, MEDIUM) | keyset cursor on (`submitted_at`, id), microsecond precision; test |
| RBAC_BUG | a forged cursor (`1e21`) reached PostgreSQL → 500; invalid `limit` silently clamped (review) | 422 for both; test |
| SCOPE_BUG | the decision locked a request row before the scope check: an out-of-scope caller could wait on it (timing oracle) (review) | scope inside the locking statement; test |
| AUDIT_GAP | the self-decision audit opened a second connection inside the idempotent transaction (pool exhaustion → 500, lost audit) (review) | refusal checked and audited before any transaction, in the routes too; test |
| DATA_MODEL_BUG | a membership / leadership inserted concurrently by another writer → 23505 → 500 (review) | `ON CONFLICT DO NOTHING` + re-read; test |
| DATA_MODEL_BUG | ALUMNI reuse compared the start day, not the month (review) | month comparison; test |
| MIGRATION_BUG | a legacy period with year 0000 aborted the whole conversion (review) | years before 1900 refused as `period_unparsed`; test |
| CONTRACT_CONFLICT · SPRINT1_CONFLICT | none (task names vs frozen audit family and "submitted" notice reconciled as R6 / R4) | — |
Not changed (INFO): an Idempotency-Key replay returns the stored answer to the same actor for 24 h even after a revocation — the repository-wide idempotency design.

## 22 – 27. Files, git, confirmations
New: `src/lib/admin/{verification-queue,verification-route,legacy-declarations}.ts`, 4 routes under `src/app/api/v1/ops/verification-requests/`, `verification-queue.db-test.ts`, `admin-prod-03-verification-api.spec.ts`, four `ADMIN-PROD-03-*` reports. Changed: `src/lib/audit/audit.ts` (codes, system actor), `src/lib/admin/admin-audit.ts` (code keys, system actor), `src/lib/api/idempotency.ts` (A9), `admin-foundation.test.ts`, `contract.test.ts`, `idempotency.db-test.ts`, `05_API_CONTRACT` (§26 + YAML), `DECISION_LOG.md` (R1–R6), `CLAUDE_LATEST_REPORT.md`. Local commit on `feat/admin-portal` (SHA in the chat report); tree clean except `AGENTS.md`; origin/main and production `78f21f2`. No frontend, no push, no merge, no deploy; ADMIN-PROD-04 not started.

## Self-audit
| Check | | Check | |
|---|---|---|---|
| one position = one request | ✓ | legacy conversion never auto-approves | ✓ |
| correct receiving unit; fallback CLB → Chapter → HUB Tổng | ✓ | shared S1-UAT-03B model preserved | ✓ |
| no highest-role routing | ✓ | server-side scope enforced | ✓ |
| no self-approval | ✓ | concurrency safe | ✓ |
| existing membership idempotent; no duplicate | ✓ | audit / history complete | ✓ |
| reject reason optional | ✓ | notifications emitted (approve / reject; submission = queue count) | ✓ |
| no frontend · push · merge · deploy | ✓ | PROD-04 not started | ✓ |

## Related
- [ADMIN-PROD-03-verification-api.md](ADMIN-PROD-03-verification-api.md) · [ADMIN-PROD-03-legacy-boundary.md](ADMIN-PROD-03-legacy-boundary.md) · [ADMIN-PROD-03-prod04-handoff.md](ADMIN-PROD-03-prod04-handoff.md)
