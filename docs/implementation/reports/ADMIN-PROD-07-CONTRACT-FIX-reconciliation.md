# ADMIN-PROD-07-CONTRACT-FIX-reconciliation

**FIX + RECHECK: frozen ADMIN-DECISION-02 / -04 vs repo and code.** Trigger: ADMIN-PROD-07 = FAIL / BLOCKER_REMAINS at preflight (CONTRACT_CONFLICT). No new PO decision; both decisions recorded verbatim as [DEC-ADM-D02 / D04](../../decisions/DECISION_LOG.md#dec-adm-d02). Stale-statement classification: [ADMIN-PROD-07-CONTRACT-FIX-stale-search.md](ADMIN-PROD-07-CONTRACT-FIX-stale-search.md).

## Preflight
Branch `feat/admin-portal`; start HEAD `546bfff` (ADMIN-PROD-06 candidate), unchanged through the task; tree clean except the pre-existing untracked `AGENTS.md`; origin/main `78f21f2`; production `78f21f2` (as recorded by PROD-06); no concurrent writer. A stale `next-server` left on the visual port 3972 since 17:57 (pre-task code) was stopped before the final browser run.

## DEC-ADM-D04 — no leader account escalation
| Layer | Change |
|---|---|
| capability | `account:escalate` removed from `CAPABILITIES` / `CAPABILITY_MATRIX` (17 capabilities). A stored row naming it is discarded by `resolveActor` (unknown → fail closed) |
| route | `POST /ops/organizations/{orgId}/members/{profileId}/account-requests` deleted (Next answers 404 / 405); no replacement |
| service | `fileAccountRequest`, `ESCALATABLE`, `mayEscalateAccountAction` removed |
| kept | PLATFORM_ADMIN `account:administer`: lock / unlock / deactivate / reactivate / soft-delete, the request queue and process / decline (reason rule PD-7.1). `account_action_requests` (017) kept, unwritten in P0 |

## DEC-ADM-D02 — exact-scope revoke
```
revocationSourceFor(actor, orgId) =
  'PLATFORM' if holdsPlatform(actor, access:delegate)
  orgId      if holdsAt(actor, access:delegate, orgId)   // exact unit, current
  null       otherwise                                    // → 403
revokeAccess: source → lock unit FOR UPDATE → grant row FOR UPDATE (404 if not on unit)
  → revoker's whole-role assignment re-read FOR SHARE (403 if lost) → CLOSED + ACCESS_REVOKED
listAccess.can_revoke = ACTIVE && revocationSourceFor(...) !== null
```
No parent / descendant reach, no grantorship branch, no cached authority. Grant (PD-6 reach, ceiling, no self-grant) unchanged. PLATFORM_ADMIN keeps platform-wide revocation (its `access:delegate` is PLATFORM-scoped). Consequence: a Chapter leader who granted on its CLB can no longer revoke it; the CLB's own leader or PLATFORM_ADMIN can.

## Results (targeted tests)
| Case | Result | Test |
|---|---|---|
| same-unit co-leader with `access:delegate` | PASS (CLOSED) | `admin-scope.db-test` D02 matrix |
| same unit, no capability (capability-only grantee) | 403 | idem |
| parent (HUB→Chapter, Chapter→CLB grantor) / child / sibling | 403 | idem; `access-api.db-test`; HTTP `admin-prod-04-api` |
| forged scope (other unit / wrong path) · forged stored `access:delegate` | 403 · 404 on own unit | idem |
| original grantor after losing `access:delegate` | 403 | idem |
| mutual co-leader revoke race | exactly one wins, other 403, no deadlock | idem |
| denied revoke writes no audit; each success one `ACCESS_REVOKED` | PASS | idem |
| grant reach unchanged; platform-only / non-delegable / `account:escalate` refused | PASS | idem |
| PLATFORM_ADMIN account action | allowed | `account-ops.db-test` |
| HUB / Chapter / CLB leader, member: lock / deactivate / soft-delete | 403 | idem |
| leader / member / admin POST to the withdrawn route | 404 / 405, no row | `admin-prod-05-api` |
| forged `account:escalate` row | confers nothing | `account-ops.db-test` |

## Focused regression (final tree)
| Gate | Result |
|---|---|
| format / lint / typecheck | PASS |
| unit (`pnpm test`) | 37 files / 367 tests, 0 fail |
| DB (`pnpm test:db`) | 47 files / 750 tests, 0 fail (was 746: +4 D02 / D04 tests net) |
| build | PASS |
| Playwright: admin-prod-03…06, auth-session, authz-session, api-contract, shell-routes, p0-shell-navigation, console-health, wf03-* | SPEC_COUNT 20 · TEST_COUNT 183 · PASS 183 · FAIL 0 · SKIP 0 · FLAKY 0 (console errors 0) |

A first browser run reported 55 failures; all came from Playwright reusing the stale pre-task server on port 3972 (`reuseExistingServer`: old route still answering, chunk-hash 400s). After stopping it, the identical selection passed 183 / 183. Full protected regression is ADMIN-PROD-07's, not run here.

## Related
- [ADMIN-PROD-07-CONTRACT-FIX-stale-search.md](ADMIN-PROD-07-CONTRACT-FIX-stale-search.md)
- [ADMIN-PROD-06-prod07-handoff.md](ADMIN-PROD-06-prod07-handoff.md)
- [AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md](../AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md)
