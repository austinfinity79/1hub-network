# ADMIN-PROD-07-modules-ui

**Evidence 12–20, 25–31: feedback, categories, account ops, sessions, audit, parity, UI states, deep links, responsive, accessibility, console, DB.** Parent: [ADMIN-PROD-07-qa-summary.md](ADMIN-PROD-07-qa-summary.md).

## 12–17. Modules
| Area | Result | Evidence |
|---|---|---|
| Feedback NEW → IN_REVIEW → DONE (NEW → DONE only with a note, no reopen); queue, detail, owner, priority, note, guest e-mail, screenshot, weekly summary | PASS | `feedback-ops.db-test`, `admin-prod-05-api`, `admin-prod-06-frontend` |
| Screenshot 90 days: served inside, cleared and file removed after (bounded run + script), shared file kept; UI "expired" state, no broken image | PASS | `feedback-ops.db-test` retention, PROD-06 UI test |
| Guest e-mail private (detail for managers only, never in lists, audits or public reads); screenshot / context only to `feedback:manage` | PASS | feedback tests; actor matrix (403 / 404 for all others) |
| Categories: list, rename, archive / activate, reorder (whole type, atomic, concurrent-safe); no create, no delete, no new type; archived referenced items keep every reference | PASS | `category-ops.db-test`, PROD-06 UI |
| Account Ops PLATFORM_ADMIN only: LOCK / UNLOCK / DEACTIVATE / REACTIVATE / SOFT_DELETE; no hard delete anywhere | PASS | `account-ops.db-test`, matrix |
| Deletion request PENDING → PROCESSED or → DECLINED (= PO REJECTED); decline without reason 422; decided is final (409); process ≠ physical deletion | PASS | `account-ops.db-test`, HTTP error-contract test, PROD-06 UI |

## 19–21. Sessions, self-action, audit
| Area | Result |
|---|---|
| LOCK and DEACTIVATE (HTTP): the live session 401 on its next call; a new magic-link sign-in refused; UNLOCK / REACTIVATE: sign-in works again | PASS (`admin-prod-07-qa`) |
| Session refresh / extension | not offered by the contract (fixed-expiry sessions, no refresh endpoint); a non-ACTIVE account never authenticates (`account-ops.db-test`) |
| Admin self-lock / deactivate / soft-delete | 403, account stays ACTIVE; deciding a request about oneself 403; two admins locking each other: one wins — the admin pool cannot be emptied by itself |
| Audit: verification approve / reject, venture approve / reject, grant / revoke, feedback, category, account actions | every one present with actor, target, scope, before / after, reason where relevant (DB tests per module + HTTP hygiene test) |
| Audit hygiene | no e-mail, token, session, password, cookie, feedback body or image data in any admin audit row |

## 26–28. Parity, UI states, deep links
| Area | Result |
|---|---|
| Every visible action has its API; every P0 mutation API has its UI; no stale escalation route; frontend never widens (revoke shown iff `can_revoke`, decide iff `can_act`) | PASS |
| Loading, empty, error, denied, not-found, session-expired on every module | PASS (shared `AdminLoading` / `AdminEmpty` / `AdminFailureNotice`; empty asserted on a provably empty filter; no raw JSON, no stuck spinner) |
| Deep link + reload: 7 queues and 5 detail screens | 200 and settled |
| Filtered / malformed query URLs (`?status=bogus`, `?cursor=garbage`) | 200, default filter (queues do not read filters from the URL — known, unchanged) |
| Unknown detail id | inline "not found" state; member deep links 404; leader on a foreign unit's access page: denied state, no rows |

## 29. Responsive smoke (all 12 screens, admin)
| Width | Result |
|---|---|
| 1440 / 1024 / 768 | no page overflow on any screen |
| 390 | before fix: page overflow 6–269 px on 11 / 12 screens; after: 0 everywhere |

Classification at 390: PRE_EXISTING_OPSSHELL_DEBT — the fixed 216 px shell sidebar leaves `main` 174 px wide (WF03 identical). NEW_ADMIN_REGRESSION (fixed) — admin CSS lacked the WF03 IA-P2-03 "basic responsive safety" containment, so its rows pushed the page sideways where WF03's scroll inside their column. Usable mobile layout stays shell debt for PROD-08.

## 30. Accessibility smoke (12 screens)
One `h1`; every button / link named; Tab reaches the content with a visible focus style; inline confirm forms (no modal dialogs exist — the WF03 idiom) for reject, decline, revoke, lock / deactivate. Two defects fixed: six filter controls had no accessible name (placeholder / first option only); opening a confirm form by keyboard dropped focus to `<body>` — focus now lands in the reason field, or on Cancel where the form has only buttons (a stray Enter never executes). Approve is one step (not destructive), unchanged.

## 31. Console / hydration / 5xx
New QA spec: 0 / 0 / 0 over 4,780 responses; every other spec asserts the same per test (full regression in the summary).

## Related
- [ADMIN-PROD-07-qa-summary.md](ADMIN-PROD-07-qa-summary.md) · [ADMIN-PROD-07-access-security.md](ADMIN-PROD-07-access-security.md) · [ADMIN-PROD-07-prod08-handoff.md](ADMIN-PROD-07-prod08-handoff.md)
