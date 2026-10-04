# ADMIN-PROD-05-qa

**Evidence 14 – 20, 22 – 27 and the self-audit.** Parent: [ADMIN-PROD-05-feedback-categories.md](ADMIN-PROD-05-feedback-categories.md).

## 14. Audit
| Domain | Codes (ids, codes, counts, reason via its field — never text, e-mail, token or screenshot) |
|---|---|
| feedback | `FEEDBACK_STATUS_CHANGED`, `FEEDBACK_PRIORITY_CHANGED`, `FEEDBACK_ASSIGNED`, `FEEDBACK_UPDATED` (type, `resolution_changed`) |
| categories | `VOCABULARY_ITEM_UPDATED` (sort order, `label_changed`), `VOCABULARY_ITEM_ARCHIVED`, `VOCABULARY_ITEM_ACTIVATED` |
| accounts | `ACCOUNT_LOCKED`, `_UNLOCKED`, `_DEACTIVATED`, `_REACTIVATED`, `_SOFT_DELETE_REQUESTED`, `_SELF_ACTION_REFUSED`; `ACCOUNT_REQUEST_FILED`, `_PROCESSED`, `_DECLINED` |
Task names mapped where the frozen families differ (CATEGORY_* → `VOCABULARY_ITEM_*`, SOFT_DELETE_REQUESTED → `ACCOUNT_SOFT_DELETE_REQUESTED`; R14, R15). Tests assert the text never reaches the audit.

## 15. IDOR / security
Non-admin feedback: list 403, ids 404 (unknown, malformed, foreign alike; PATCH authorizes before reading the body) · category mutation without `vocabulary:manage` 403 · leader lock attempt 403 (also with an unknown id: no enumeration) · leader queue / detail / process 403 / 404 · escalation for a non-member 404, another unit 403 · revoked / absent capability: authority read from the database per request · spoofed keys (`body`, `guest_email`, `slug`, `type_code`, `hard`, `delete`) 422 · the media route serves screenshots to managers inside 90 days only (not the uploader), logos to reviewers only, avatars unchanged · an admin cannot decide a request about their own account (403, audited).

## 16. Concurrency
Two status updates (IN_REVIEW vs DONE) → final DONE, at most one 409; two identical updates → one change, one audit · duplicate account lock → one change · lock vs deactivate → always DEACTIVATED · two whole-type reorders → exactly one wins · equal `sort_order` collisions → deterministic (order, label, id) · request processed twice → 409 · two admins locking each other at once → one wins, the other 403 (actor and target accounts locked together; the actor must still be ACTIVE) · retention `SKIP LOCKED`, bounded.

## 17. DB / migration
**NO_SCHEMA_CHANGE** (no 018 / 019): every column, enum and table is 017's (feedback triage fields, deletion-request status, `account_action_requests`). Code-only: auth status checks, one idempotent operation (A11), nine audit codes, one allowlist key. 017 fresh / upgrade / recovery suite green.

## 18. Targeted tests
| Suite | Tests |
|---|---|
| `src/lib/admin/feedback-ops.db-test.ts` (new) | 10: scope, filters / paging, detail privacy, triage + audit, lifecycle, owner eligibility + validation, races, 90-day retention, shared file kept + cron script (same SQL, runs), weekly summary |
| `src/lib/admin/category-ops.db-test.ts` (new) | 6: scope / shape, label / order / status, referential safety, whole-type reorder, concurrent reorders, collisions |
| `src/lib/admin/account-ops.db-test.ts` (new) | 13: admin-only, LOCK + sessions + sign-in, DEACTIVATE / REACTIVATE, SOFT_DELETE, transitions, self-action, races, escalations + processing + audit; self-deletion decline 409 + requester attribution, own-request decision 403, admins locking each other, profile-less deletion, session vs any non-ACTIVE status |
| `tests/visual/specs/admin-prod-05-api.spec.ts` (new) | 4: auth and refusal everywhere, feedback + summary + screenshot rule (uploader refused), categories, a locked user's live session refused, idempotent lock, self-lock |
| `admin-foundation.test.ts` | + guest e-mail, context projection |

## 19. Protected regression
| Gate | Result |
|---|---|
| format · lint · typecheck | PASS |
| unit | 37 files / 367 tests PASS |
| DB (`pnpm test:db`, resets the DB; WF01 – WF06, auth, RBAC, DB, audit, notifications, admin) | 47 files / 738 tests PASS |
| production build | PASS |
| full visual / workflow suite, 86 specs, fresh DB + QA vocabulary (auth layer changed → full run) | 1,124 passed, 26 skipped, 1 failed: `api-contract.spec.ts` still asserted `/ops/feedback` absent (stale by design; updated) |
| final build, 16 affected specs (admin 03 – 05, API contract, auth / authz / session, WF01 auth, WF02 S01 / S02 / S03 / S07 / L2, WF01 UAT, WF05 visual) | 320 / 320 PASS |

## 20. Bugs found / fixed
| # | Found by | Issue | Fix |
|---|---|---|---|
| 1 | security review | two admins could lock each other at the same instant | actor + target accounts locked together; actor must be ACTIVE (403) |
| 2 | security review | retention could remove a file still used as an avatar / logo / another screenshot | `shared` guard in the one retention statement |
| 3 | security review | a screenshot's uploader could fetch it through the owner rule | screenshot branch: managers only |
| 4 | security review | an admin could decline a request about their own account; idempotent replay could skip the self check | pre-check before the idempotent run + in-transaction 403, audited |
| 5 | security review | a user's own deletion request could be declined, stranding WF02 | processed only (409); flagged for the PO |
| 6 | security review | a profile-less account's deletion request could not be processed | account-only soft delete |
| 7 | security review | an admin-recorded deletion request named the user as requester | requester only with WF02's audit |
| 8 | security review | feedback PATCH validated the body before authorizing (422 hint) | authorize first (404) |
| 9 | testing | category test left VENTURE_STAGE order changed | afterAll restores DOMAIN / VENTURE_STAGE |
| 10 | full regression | `api-contract.spec.ts` asserted `/ops/feedback` unimplemented | assertion updated (implemented by this task) |

## 22 – 27. Files, git, confirmations
New: `src/lib/admin/{feedback-ops,category-ops,account-ops,paging,identity}.ts`, `scripts/admin/feedback-retention.mjs` (+ `.d.mts`), 3 DB suites, 1 HTTP spec, 16 route files, 4 reports. Changed: `src/lib/auth/{magic-link,sessions}.ts`, `src/lib/admin/{feedback,admin-audit}.ts`, `audit.ts`, `idempotency.ts`, media asset route, `admin-foundation.test.ts`, `contract.test.ts`, `idempotency.db-test.ts`, `api-contract.spec.ts`, API contract (md + yaml), `DECISION_LOG.md`, `CLAUDE_LATEST_REPORT.md`. Local commit on `feat/admin-portal` (SHA in the chat report); tree clean except `AGENTS.md`; origin/main and production `78f21f2`. No frontend, no push, no merge, no deploy; ADMIN-PROD-06 not started.

## Self-audit
| Check | | Check | |
|---|---|---|---|
| feedback lifecycle correct | ✓ | no hard delete | ✓ |
| screenshot retention = 90 days | ✓ | session invalidation works | ✓ |
| guest e-mail optional / private | ✓ | self-lock / deactivate protected | ✓ |
| weekly summary supported | ✓ | audit complete | ✓ |
| no enterprise CMS; categories lightweight | ✓ | IDOR blocked; concurrency safe | ✓ |
| referenced categories safe | ✓ | no frontend · push · merge · deploy | ✓ |
| PLATFORM_ADMIN-only account execution | ✓ | PROD-06 not started | ✓ |

## Related
- [ADMIN-PROD-05-feedback-categories.md](ADMIN-PROD-05-feedback-categories.md) · [ADMIN-PROD-05-accounts.md](ADMIN-PROD-05-accounts.md) · [ADMIN-PROD-05-prod06-handoff.md](ADMIN-PROD-05-prod06-handoff.md)
