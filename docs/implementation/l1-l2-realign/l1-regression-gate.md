# L1 Regression Gate

Regression evidence and the pre-commit review behind the [L1 closure](l1-closure.md). Local run of 2026-09-29 on the final production build.

## Regression gate
PO rule of 2026-09-29: WF01, auth and security, L1 pixel and responsive in full; the other areas by targeted smoke; a full run only after a failure or a change to shared auth, session or RBAC infrastructure. The evidence below is wider than the rule asks: it comes from the full run on the final build, made before the rule arrived.

| Scope | Rule | Passed | Failed |
|---|---|---|---|
| WF01 (ten screens, UAT, e-mailed link, runtime) | full | 188 | 0 |
| Auth, session, token, RBAC, idempotency, release security matrix | full | 46 | 0 |
| L1 pixel and responsive | full | 6 frames, 28 | 0 |
| P0-LANDING, P0-SHELL | targeted | 10, 14 | 0 |
| WF02 | impacted routes | 102 | 0 |
| WF03, WF04, WF05 | representative | 69, 115, 66 | 0 |
| About, Library | route, render, navigation | 13; both answer 200 | 0 |
| Foundation (routes, primitives, typography, console, pixel harness) | targeted | 82 | 0 |

In that run one WF01 test failed: it looked for a new member on the first page of a unit's list, and the local database holds more members than a page. The test now reads the list page by page; the product was not changed for it. 24 tests of `pixel-qa-screens` are skipped as before this task. Real inbox delivery belongs to the deployed domain and was not run: nothing was deployed.

## Pre-commit review
Read-only review of the uncommitted screens before the commit: no security or authorization finding. Each defect was reproduced by a failing test first, then fixed.

| Finding | Severity | Fix |
|---|---|---|
| A skill typed and not confirmed was dropped by the save | major | the save sends the item the field names |
| The browser's Back drew a stage with the values of its first load; "Lưu và hoàn tất sau" could write them back | major | a stage refreshes before it is left; completion is a document load |
| A stored province or country that was archived since was not shown | minor | the profile's own item is kept in the list |
| Completion refused for an acceptance that went stale behind a confirmed screen gave no way on | minor | the documents are reloaded and the confirmation is asked again |
| The experience dialog did not hand the focus back; "current" without a start was dropped silently | minor | closed through the element; the start is required |
| Link count refusal read as an invalid link; the account's e-mail was read by SQL in the page | minor | own message; read through `src/lib/auth/account.ts` |

## Related
- [l1-closure.md](l1-closure.md) · [overview.md](overview.md) · [../PROCESS_P0_ACCELERATED_SAFE_V2.md](../PROCESS_P0_ACCELERATED_SAFE_V2.md)
