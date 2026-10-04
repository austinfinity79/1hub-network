# ADMIN-PROD-07-CONTRACT-FIX-stale-search

**Evidence 14: every stale statement, classified.** Parent: [ADMIN-PROD-07-CONTRACT-FIX-reconciliation.md](ADMIN-PROD-07-CONTRACT-FIX-reconciliation.md). Searched: `account:escalate`, "leaders submit / escalate", leader escalation, `members/{profileId}/account-requests`, `fileAccountRequest`, "on the unit or its parent" (revoke), grantor-may-revoke, `can_revoke`.

## Account escalation (DEC-ADM-D04)

| Location | Was | Class |
|---|---|---|
| `src/lib/authz/matrix.ts` | `account:escalate` capability + rule (leader ALLOW, delegable) | STALE_REMOVED |
| `src/app/api/v1/ops/organizations/[orgId]/members/[profileId]/account-requests/route.ts` | leader filing route | STALE_REMOVED (file deleted) |
| `src/lib/admin/account-ops.ts` `fileAccountRequest`, `ESCALATABLE` | leader filing service | STALE_REMOVED |
| `src/lib/admin/account-actions.ts` `mayEscalateAccountAction` | leader predicate | STALE_REMOVED |
| `account-ops.ts` queue (`ESCALATION` kind), `/ops/account-requests*` routes, accounts queue / detail UI | reads `account_action_requests` | VALID_PLATFORM_ADMIN_ONLY (comments UPDATED: no P0 writer) |
| `src/lib/ops/nav.ts` comment | "a leader holding only `account:escalate`" | UPDATED |
| `src/lib/db/schema.db-test.ts` comment | "written by leaders' escalations" | UPDATED |
| `db/migrations/017_p0_admin_foundation.sql` comments + table | PD-7 escalation store | VALID_PLATFORM_ADMIN_ONLY (applied migration, never rewritten; table dormant) |
| `DECISION_LOG.md` PD-7 "leaders submit / escalate", PD-7.1 "a leader's SOFT_DELETE escalation", R16 | leader escalation | UPDATED (struck through, → D04; D04 added) |
| `05_API_CONTRACT_P0_v1.0.md` §28 intro, queue, decline, leader route | leader escalation | UPDATED (route marked WITHDRAWN) |
| `05_API_CONTRACT_P0_v1.0.yaml` `fileAccountRequest` path, queue description | leader route | STALE_REMOVED / UPDATED |
| `AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md` §A row | leader ALLOW | STALE_REMOVED + withdrawal note (all leaders / members DENY) |
| `ADMIN-PROD-01-rbac-matrix.md` (3 rows + lifecycle sentence), `ADMIN-PROD-01-runtime-contract.md` F | leader escalation | UPDATED |
| `ADMIN-PROD-06-prod07-handoff.md` capability row, gap row | `account:escalate` no UI / API exists | UPDATED |
| Archived evidence: PROD-01 data-api-handoff, PROD-02 ×4, PROD-03 prod04-handoff, PROD-04 ×3, PROD-05 ×4, PROD-06 frontend / modules | historical description | UPDATED (supersession banner; evidence kept as recorded) |
| "Privilege escalation" in WF / TASK-24 / l1-l2 reports, `authz.db-test.ts:178` | security-test wording, unrelated | not an account escalation (no action) |
| Generic support / feedback (`POST /feedback`, `/ops/feedback`) | leaders' operational channel | GENERIC_SUPPORT_ESCALATION (unchanged) |

## Delegation revoke (DEC-ADM-D02)

| Location | Was | Class |
|---|---|---|
| `src/lib/admin/delegation.ts` `revokeAccess` + header | grantor, or `access:delegate` on unit or parent | UPDATED (`revocationSourceFor`: exact unit or PLATFORM; re-read FOR SHARE) |
| `src/lib/admin/access-api.ts` `can_revoke` | `manager \|\| granted_by === actor` | UPDATED (same predicate as revoke) |
| `AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md` §B revoke | grantor / parent | UPDATED |
| `05_API_CONTRACT_P0_v1.0.md` §27 revoke | grantor / parent | UPDATED |
| `ADMIN-PROD-01-rbac-matrix.md` revoke row | grantor / parent | UPDATED |
| `ADMIN-PROD-06-prod07-handoff.md` co-leader row, decision row | "Allowed today, unresolved" | UPDATED |
| `ADMIN-PROD-02-rbac-scope-foundation.md`, `-qa-handoff.md`, `ADMIN-PROD-04-delegation.md`, `-qa.md` | historical revoke rule | UPDATED (supersession banner) |
| Grant reach "unit or its canonical parent" (delegation.ts, matrix §B "who grants", 05 §27 grant) | grant rule, not revoke | VALID (PD-6 grant unchanged) |

**Unresolved contradictory occurrences: 0.**

## Related
- [ADMIN-PROD-07-CONTRACT-FIX-reconciliation.md](ADMIN-PROD-07-CONTRACT-FIX-reconciliation.md)
- [DECISION_LOG.md](../../decisions/DECISION_LOG.md#dec-adm-d02) — DEC-ADM-D02 / D04
