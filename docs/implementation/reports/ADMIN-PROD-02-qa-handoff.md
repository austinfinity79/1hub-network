# ADMIN-PROD-02-qa-handoff

**Evidence 19, 20, 23 – 31 and the self-audit: security and data-integrity tests, protected regression, bugs, files, git, confirmations.** Parent: [ADMIN-PROD-02-rbac-scope-foundation.md](ADMIN-PROD-02-rbac-scope-foundation.md). PROD-03 handoff: [ADMIN-PROD-02-prod03-handoff.md](ADMIN-PROD-02-prod03-handoff.md).

## 19. Security tests (`src/lib/admin/admin-scope.db-test.ts`, 20)
| Case | Proven |
|---|---|
| PLATFORM_ADMIN full scope | all 18 capabilities platform-wide; reach ALL; grants on any unit; never a platform capability (422); unknown unit 404 |
| HUB leader allowed scope | acts on HUB Tổng only (not its Chapter: no inheritance); reach HUB Tổng + Chapters; grants on a Chapter |
| Chapter → descendant CLB | reach = Chapter + its CLBs; grants a capability and the whole role on its CLBs; fallback handler only via routing |
| CLB own-only | reach = the CLB; a sibling CLB → 403 |
| cross-branch denied | Chapter A → Chapter B / CLB B1: 403, no audit row |
| upward escalation denied | CLB → Chapter / HUB, Chapter → HUB, HUB → grandchild CLB: 403 |
| greater permission denied | 7 non-delegable / unknown capabilities → 422; a capability-only grantee holds that one capability only, cannot grant (403), has no managed scope |
| client-spoofed scope denied | forged stored rows (`access:delegate`, unknown capability) read as nothing; foreign, unknown and malformed unit ids answer alike (403) |
| revoked capability denied | revoke → gone; second revoke 409; expired or CLOSED rows grant nothing |
| delegation lifecycle and audit | archived unit 409; blocked / deactivated grantee 422; duplicate 409; revoke authority (grantor, unit, parent, admin; not a sibling, the HUB above the parent or a member); audit rows exact, no e-mail or names |
| review hardening | self-grant refused for leaders and admin (no chain to a grandchild); ARCHIVED source unit 409; a revocation committed during a grant → 403 (two-connection test); malformed unit id 403 for every actor; nobody handles their own request |
| existing meaning kept | a whole-role leader holds the 13 organization capabilities in its unit only, none platform-only |

## 20. Data-integrity tests (`admin-data.db-test.ts`, 20; `admin-foundation.test.ts`, 21)
Canonical ids preserved (requests join canonical organizations and profiles; grants reference canonical units and profiles) · no duplicate organization (no write path creates one) · no duplicate venture (two fixture ventures stay two; a review needs an existing venture, FK) · one request per declared position (case-insensitive title, start month; WITHDRAWN frees it; a different term is a different position) · review rows map canonical ventures, one PENDING each; the Library shows the approved name while a renamed core change waits; no public module reads `venture_reviews` · feedback on the canonical account or none (guest), guest e-mail only for guests, length / asset / deletion checks, old statuses refused · account actions only on canonical accounts, one pending per account and action, handled pairing enforced · notifications tied to their resource · category policy = the six vocabulary types · routing: 5 unit cases, delegated CLB handler, a handler's own position routed past them, blocked / closed handlers skipped, admin fallback; a pending request creates no membership, leadership or role.

## 23. Protected regression
| Gate | Result |
|---|---|
| format · lint · typecheck | PASS · PASS · PASS |
| unit (`pnpm test`) | 37 files / 365 tests PASS (was 36 / 344) |
| DB (`pnpm test:db`, resets the DB) | 41 files / 662 tests PASS (was 38 / 611): WF01 – WF06, auth, RBAC, DB, audit suites included |
| production build | PASS (final code); authz / session / ops smoke on it 24 / 24 |
| full visual / workflow suite (`tests/visual/specs`, 83 specs, fresh DB + QA vocabulary) | 1,111 passed, 26 skipped, 0 failed (19.4 min) — identical to the WF06 closure baseline; the review fixes after it touch only `src/lib/admin`, which no route imports |
No existing workflow changed: no frontend, route, API or seed file touched; session `capabilities` gains the new values for leaders and admins (contract: GET /session HARDEN), `managed_scopes` unchanged for every seeded actor.

## 24. Bugs found / fixed
| Class | Item (found by) | Action |
|---|---|---|
| RBAC_BUG | self-grant let a leader chain authority to a grandchild: HUB → own role on a Chapter → own role on its CLB (review) | self-grant refused, 422 `self`; test |
| RBAC_BUG | a handler's own position was routed to themselves; PROD-03 would let them self-verify and self-create an ACTIVE membership (review) | requester excluded from routing and from `canHandleVerification`; tests |
| SCOPE_BUG | an ARCHIVED (read-only) source unit could still delegate to its children (review) | 409; test |
| RBAC_BUG | grantor authority read outside the transaction: a concurrent revocation could still grant (review) | source assignment re-read FOR SHARE; two-connection test |
| AUDIT_GAP | the audit guard was a key denylist: camelCase / plural keys and free-text values passed (review) | allowlist on keys and values; tests |
| RBAC_BUG | a malformed unit id from PLATFORM_ADMIN reached PostgreSQL (22P02 → 500) (review) | 403 like any foreign id; test |
| MIGRATION_BUG (test harness) | `application-integrity.db-test.ts` assumed 016 is the newest file; `programme-persistence.db-test.ts` (11) counted later migrations' tables as 015's | made independent of later migrations |
| CONTRACT_CONFLICT · SPRINT1_CONFLICT | none | — |
All review findings were in this task's new code, found by an independent read-only security review before the commit; no pre-existing runtime bug. Declined: DB CHECKs on `capability` values and on grantor ≠ grantee — the reader already fails closed and is tested, and a value list in the schema would duplicate the code catalogue. Carried: escalation targets must be members of the filing unit (ADMIN-PROD-05); schema gap D3 (`RECEIVED` response label, API:690) with the `POST /feedback` task.

## 26. Files changed
| Area | Files |
|---|---|
| migration | `db/migrations/017_p0_admin_foundation.sql` (new) |
| RBAC | `src/lib/authz/{matrix,actor,authorize,session-authz}.ts`, `src/lib/ops/scope.ts`, `src/lib/audit/audit.ts` |
| admin foundation (new) | `src/lib/admin/{scope,hierarchy,delegation,verification,venture-review,feedback,account-actions,categories,notifications,admin-audit,testing}.ts` |
| tests | new `src/lib/admin/{admin-foundation.test,admin-scope.db-test,admin-data.db-test,admin-migration.db-test}.ts`; updated `src/lib/authz/authz.db-test.ts`, `src/lib/db/{schema,application-integrity,programme-persistence}.db-test.ts` |
| docs | `AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md` (new), `AUTHORIZATION_CAPABILITY_MATRIX_P0.md` (link), `DB_SCHEMA_GAPS_P0.md` (017), five `ADMIN-PROD-02-*` reports, `CLAUDE_LATEST_REPORT.md` |

## 27 – 31. Git and confirmations
Local commit on `feat/admin-portal` (SHA in the chat report and `CLAUDE_LATEST_REPORT.md`); working tree clean after it except `AGENTS.md`; origin/main `78f21f2`; production `78f21f2`. No frontend, no API route, no push, no merge, no deploy; ADMIN-PROD-03 not started.

## Self-audit
| Check | | Check | |
|---|---|---|---|
| only existing roles reused | ✓ | feedback states frozen | ✓ |
| server-side scope enforced | ✓ | screenshot retention represented | ✓ |
| no privilege escalation | ✓ | PLATFORM_ADMIN-only account actions | ✓ |
| delegation hierarchy correct | ✓ | audit hooks exist | ✓ |
| canonical Organization reused | ✓ | Sprint1 models not forked | ✓ |
| canonical Venture reused | ✓ | fresh DB GREEN | ✓ |
| RoleVerificationRequest reused (one canonical store) | ✓ | regression GREEN | ✓ |
| pending venture edits never replace the public version | ✓ | no frontend · push · merge · deploy | ✓ |
| website + logo, no business-registration field | ✓ | PROD-03 not started | ✓ |

## Related
- [ADMIN-PROD-02-prod03-handoff.md](ADMIN-PROD-02-prod03-handoff.md) · [ADMIN-PROD-02-data-foundation.md](ADMIN-PROD-02-data-foundation.md) · [ADMIN-PROD-02-db-migration.md](ADMIN-PROD-02-db-migration.md)
