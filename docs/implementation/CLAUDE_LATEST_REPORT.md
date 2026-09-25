# Claude Task Report

## 1. Task
- Task ID / name: DECISION-AUTHZ-01B freeze, then M0-T09 — RBAC / authorization foundation
- Scope requested: Freeze the approved authorization decisions, then implement the server-side authorization foundation.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed.

## 2. Pre-flight
- Single writer: **PASS**, only this session holds the worktree.
- Starting HEAD: `21defe4`, re-checked before commit, unchanged. No concurrent mutation.
- M0-T07 seed and M0-T08 auth regression: **PASS**, 64 of 64 before any change.

## 3. Matrix frozen
`AUTHORIZATION_CAPABILITY_MATRIX_P0.md` now carries **HUMAN APPROVED — P0** and states role, capability, ALLOW/DENY, scope and predicate for all nine capabilities. It is an authorization overlay; no Product, Data, Workflow or Design SOT file was modified.

Two identifiers were named by the approved decision because the frozen sources granted the action but never named it: `membership:confirm` (action at 03:110) and `leadership:manage` (action at 03:111). The convention is `resource:action` throughout, with no second convention introduced.

## 4. What was implemented
| Module | Purpose |
|---|---|
| `authz/matrix.ts` | The approved matrix as data. No wildcard, no inheritance, no admin branch |
| `authz/actor.ts` | Resolves account, profile and only currently-valid assignments |
| `authz/authorize.ts` | `authorize` / `can` / `require`, the single decision entry point |
| `authz/session-authz.ts` | Derives `capabilities` and `managed_scopes` |

`GET /api/v1/session` now returns both fields, populated server-side. They were deliberately empty since M0-T08.

## 5. How the decision rule is enforced
The frozen rule (03:36-42) maps directly onto the code:

| Clause | Where enforced |
|---|---|
| authenticated | `authorize` rejects a null actor or one with no profile |
| assignment active | SQL: `state = 'ACTIVE' AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())` |
| role permits capability | lookup in the approved matrix; an unknown capability is denied, not defaulted |
| scope contains resource | an ORGANIZATION grant must match the requested `scope_id` exactly |
| lifecycle predicate | optional hook, run **only after** the permission check passes |

`PLATFORM_ADMIN` never appears in the decision logic. Its authority comes only from the data table, and a test asserts `authorize.ts` names no role at all.

## 6. Security results
| Property | How proven |
|---|---|
| Individual and HUB Member denied | All nine capabilities denied for a member actor |
| Cross-org denial | Leader denied all nine in Chapter 02 while allowed all nine in Chapter 01 |
| Leader cannot reach platform scope | All nine denied at PLATFORM |
| Membership alone grants nothing | The pending actor holds a membership and is denied all nine |
| Expired assignment ignored | `valid_to` in the past removes the role entirely |
| Future assignment ignored | `valid_from` in the future removes it |
| Non-ACTIVE assignment ignored | `state = CLOSED` removes it |
| Stray role code ignored | `role_code` is still untyped text; `SUPER_ADMIN` is discarded at the boundary |
| Forged role/scope ignored | localStorage, sessionStorage, a `role` cookie and forged headers all produce an empty capability list |
| Admin cannot edit another profile | No profile-write capability exists in the catalogue; `ADMIN_MAY_EDIT_OTHER_PROFILE` is false |
| No impersonation | Source scan of all four modules, comments stripped |
| Enumeration safe | No-permission and wrong-scope return an identical code and message, asserted equal |
| No raw ORM leakage | `managed_scopes` carries only the three contract fields; `individual_profile_id`, `valid_from`, `valid_to`, `assigned_by` are asserted absent from the wire |

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS, 0 errors 0 warnings |
| Unit tests | PASS — 61 of 61 |
| DB integration + authorization + permission matrix | PASS — 94 of 94 (30 new) |
| Build | PASS |
| Playwright authz smoke | PASS — 8 new tests |
| Playwright full regression | PASS — 86 of 86 |
| Deterministic seed regression | PASS |
| M0-T01–T08 regression | PASS |
| SOT untouched | PASS — `db/`, `docs/product/`, `docs/workflows/`, `docs/design/`, `docs/architecture/` all unchanged |

Three test failures occurred and all three were **my own test bugs**, fixed rather than worked around: a wildcard scan matching JSDoc `/**`; an impersonation scan flagging my own comment saying impersonation is absent; and an unsound regex that matched the legitimate success `return`. The first two were fixed by stripping comments before scanning. The third was replaced, because a regex cannot distinguish a legitimate single success path from a blanket allow; that property is now proven behaviourally by the denial suites instead.

## 8. Gaps
- Blocking authorization gaps remaining: **0**.
- Still open, unchanged and out of scope: `role_code` and `scope_type` remain untyped `text` columns. The engine discards non-catalogue values at the boundary, so this is defence in depth rather than a hole, but constraining them would need a migration and a catalogue decision.
- WF01/WF02 self-service capabilities remain outside the ops catalogue by decision D4, using an ownership predicate instead.

## 9. Pre-UAT security decisions, unchanged
| Item | Provisional value | Status |
|---|---|---|
| CSRF mechanism | none implemented; SameSite=lax is the only mitigation | no frozen source names a mechanism |
| Session TTL | 30 days | no frozen source states a value |
| SameSite | `lax` | 03:200 requires it but names no value |

None was invented or promoted to final in this task.

## 10. Git
- Branch: `main`
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `2390ce2`, deliberately behind local
- Working tree: clean after commit

## 11. Recommended next task
**M0-T10 — idempotency store foundation.** It carries one open item: the schema SOT contains no key store, so adding one needs authorization for migration 003.
