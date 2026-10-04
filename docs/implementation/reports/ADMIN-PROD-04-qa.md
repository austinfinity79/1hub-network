# ADMIN-PROD-04-qa

**Evidence 18 – 22, 24 – 26, 28 – 33 and the self-audit.** Parent: [ADMIN-PROD-04-venture-review.md](ADMIN-PROD-04-venture-review.md).

## 18. Audit
| Code | When | Payload (allowlisted ids / codes / numbers; reason via its own field) |
|---|---|---|
| `VENTURE_REVIEW_SUBMITTED` / `_RESUBMITTED` | first / later submission | status, kind, venture_id, version |
| `VENTURE_REVIEW_UPDATED` | a save while pending | status, kind, venture_id, version, changed_count |
| `VENTURE_REVIEW_APPROVED` / `_REJECTED` | decision | before status / version (/ visibility), after status / version / kind / venture_id (/ visibility); reason on reject |
| `VENTURE_REVIEW_SELF_ACTION_REFUSED` | own venture | status, action, venture_id |
| `VENTURE_PUBLISHED` (venture resource) | first publication approved | status, visibility |
| `ACCESS_GRANTED` / `ACCESS_REVOKED` | grant / revoke | grantor, grantee, role, capability, source, scope, state |
Actor, target, scope (where scoped) and time on every row; no names, e-mails, text fields, URLs or files. Task names mapped to the frozen families (R10).

## 19. Notifications
Venture approve / reject → one `notifications` row for the owner's account, in the decision's transaction. Grant / revoke → none: deferred, the notification contract has no such type.

## 20. Concurrency
Two reviewers (two PLATFORM_ADMINs) → one 200, one 409 · approve vs reject → one decision event · owner edit vs approve → both orders tested, the older candidate is never published, no deadlock (one lock order) · identical grants → one 201, one 409 (unit row lock) · grant vs revoke → at most one live identical grant · duplicate decisions / grants with an Idempotency-Key replay the first answer.

## 21. IDOR / scope
Non-reviewer: venture-review list 403, every review id 404 (unknown, malformed, foreign alike) · a reviewer's own venture → 403 · access list / grant / history of a foreign unit 403; a grant id through another unit 404; HUB_MEMBER roster rows not listed or revocable · forged `scope_id` / `organization_id` / `routed_to` keys 422; `x-role` / `x-organization-id` headers ignored · media: a non-reviewer never fetches a logo; avatar rules unchanged.

## 22. DB / migration
**NO_SCHEMA_CHANGE** (no 018): `venture_reviews`, `projects.website` / `logo_asset_id`, `role_assignments.capability` are 017's. Code-only additions: two idempotent operations (A10), two audit codes, the `visibility` audit key. 017 fresh / upgrade / recovery suite unchanged and green.

## 24. Targeted tests
| Suite | Tests |
|---|---|
| `src/lib/admin/venture-review.db-test.ts` (new) | 18: submission, public-version preservation, approve first publication / core change, reject + resubmit, edit while pending (sequential both ways + race), website, logo, no tax code, queue / detail / scope, self-review, concurrency, review hardening |
| `src/lib/admin/access-api.db-test.ts` (new) | 6: list / history scope, immediate revocation, IDOR, strict body, grant races |
| `tests/visual/specs/admin-prod-04-api.spec.ts` (new) | 5: auth, reviewer-only, diff + logo + idempotent approve, validation, own venture; access list / grant / revoke / history over HTTP |
| updated | `contract.test.ts`, `idempotency.db-test.ts` (A10 operations) |

## 25. Protected regression
| Gate | Result |
|---|---|
| format · lint · typecheck | PASS |
| unit | 37 files / 366 tests PASS |
| DB (`pnpm test:db`, resets the DB; WF01 – WF06, auth, RBAC, DB, audit, admin) | 44 files / 709 tests PASS (was 42 / 685) |
| production build | PASS |
| full visual / workflow suite, 85 specs, fresh DB + QA vocabulary | 1,121 passed, 26 skipped, 0 failed (19.1 min) — the PROD-03 baseline plus the 5 new HTTP tests |
| after the review fixes (admin code + the media route's rule order) | final build: admin APIs, every avatar / media spec, WF02 venture, Library, authz, contract, idempotency — 13 specs, 285 / 285 |

## 26. Bugs found / fixed
| Class | Item (found by) | Fix |
|---|---|---|
| DATA_MODEL_BUG | lock order venture → review (save) vs review → venture (decision) could deadlock (self-review while writing tests) | decisions lock the venture first; race test |
| DATA_MODEL_BUG | a website lengthened by normalisation passed the 500 check, then broke the save / every approval with a 500 (review, MEDIUM) | bound after normalisation; test |
| DATA_MODEL_BUG | a current avatar used as a logo is deleted when the avatar changes (review) | a current avatar is refused as a logo; test |
| RBAC_BUG | a cursor with an impossible date reached PostgreSQL → 500, in both queues (review) | real-instant check, 422; tests |
| DATA_MODEL_BUG | first-publication edits while pending lived only in the candidate; a rejection lost them (review) | the private draft follows the candidate; test |
| (performance) | N+1 reads per queue page; the reviewer lookup ran on every avatar view (review) | batched page reads; avatar rule first |
| CONTRACT_CONFLICT · SPRINT1_CONFLICT | none (task audit names, notices and leader review scope reconciled as R7 – R10) | — |
For the PO (policy, unchanged): co-leaders of one unit may revoke each other's whole role, as PD-6 reads (reducing access only). Documented, not code: WF02 self-publish / direct edit stay until the S1-UAT-06 cut-over; nothing creates a review in production before it.

## 28 – 33. Files, git, confirmations
New: `src/lib/admin/{venture-submission,venture-review-queue,access-api,admin-route}.ts`, 7 route files, 2 DB suites, 1 HTTP spec, 4 reports. Changed: `venture-review.ts` (website bound, cursor check), `verification-queue.ts` (cursor check), `delegation.ts` (executor, role filter), `admin-audit.ts`, `audit.ts`, `idempotency.ts`, media asset route, `contract.test.ts`, `idempotency.db-test.ts`, API contract (md + yaml), `DECISION_LOG.md`, `CLAUDE_LATEST_REPORT.md`. Local commit on `feat/admin-portal` (SHA in the chat report); tree clean except `AGENTS.md`; origin/main and production `78f21f2`. No frontend, no push, no merge, no deploy; ADMIN-PROD-05 not started.

## Self-audit
| Check | | Check | |
|---|---|---|---|
| canonical Venture reused (same id) | ✓ | delegation scoped | ✓ |
| one review record shared with S1-UAT-06 | ✓ | no upward / cross-branch privilege | ✓ |
| public version live during re-review | ✓ | grantor cannot grant more than owned | ✓ |
| unapproved edits never public | ✓ | revoked grant stops immediately | ✓ |
| website safe | ✓ | audit complete | ✓ |
| logo uses the canonical asset model | ✓ | IDOR blocked; concurrency safe | ✓ |
| no business-registration field | ✓ | no frontend · push · merge · deploy; PROD-05 not started | ✓ |

## Related
- [ADMIN-PROD-04-venture-review.md](ADMIN-PROD-04-venture-review.md) · [ADMIN-PROD-04-delegation.md](ADMIN-PROD-04-delegation.md) · [ADMIN-PROD-04-prod05-handoff.md](ADMIN-PROD-04-prod05-handoff.md)
