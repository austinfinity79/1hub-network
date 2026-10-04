# P0 Authorization Capability Matrix — Admin Portal addendum

**PO APPROVED — DEC-ADM.** Section A and the rules of B come from PD-1 … PD-8 (ADMIN-DECISION-01) and the frozen contract [ADMIN-PROD-01-rbac-matrix.md](reports/ADMIN-PROD-01-rbac-matrix.md); implemented by ADMIN-PROD-02 in `src/lib/authz/matrix.ts`. Rows marked *(impl.)* are ADMIN-PROD-02 implementation notes inside that contract, not PO decisions. Extends [AUTHORIZATION_CAPABILITY_MATRIX_P0.md](AUTHORIZATION_CAPABILITY_MATRIX_P0.md); every rule there still holds. No new role.

## A. Admin capabilities

| Capability | INDIVIDUAL_USER | HUB_MEMBER | HUB_COMMUNITY_LEADER | PLATFORM_ADMIN | Scope | Delegable |
|---|---|---|---|---|---|---|
| `verification:review` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | yes |
| `access:delegate` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | no |
| `venture:review` | DENY | DENY | DENY | ALLOW | PLATFORM | no |
| `org:lifecycle` | DENY | DENY | DENY | ALLOW | PLATFORM | no |
| `feedback:manage` | DENY | DENY | DENY | ALLOW | PLATFORM | no |
| `vocabulary:manage` | DENY | DENY | DENY | ALLOW | PLATFORM | no |
| `account:administer` | DENY | DENY | DENY | ALLOW | PLATFORM | no |

Delegable existing capabilities: `org:read`, `member:read`, `membership:confirm`, `event:manage`, `programme:read`, `programme:manage`, `org:manage`. Never delegable: `org:manage_relationship`, `leadership:manage`, `access:delegate`, every platform capability. *(impl.)* `network:read` is on neither contract list and is treated as not delegable (fail closed).

**Withdrawn — [DEC-ADM-D04](../decisions/DECISION_LOG.md#dec-adm-d04):** `account:escalate` (HUB_COMMUNITY_LEADER: was ALLOW) no longer exists. Account Ops: PLATFORM_ADMIN ALLOW (`account:administer`); HUB / Chapter / CLB leader, HUB_MEMBER, INDIVIDUAL_USER: DENY — no capability, no account-request route. A stored row naming it is discarded as unknown (fail closed).

## B. Delegated grants (PD-6)

| Rule | Implementation |
|---|---|
| record | `role_assignments` + nullable `capability` (migration 017): null = the whole role, set = that capability only, ORGANIZATION scope only |
| reading *(impl.)* | `assignmentGrants` is the one predicate for `authorize`, `organizationScope` and the session; a capability-only row carries its one capability. `resolveActor` discards a row naming an unknown or non-delegable capability (fail closed) |
| session *(impl.)* | `capabilities` lists a delegated capability; `managed_scopes` does not list a capability-only grant (it does not hold the role) |
| who grants | PLATFORM_ADMIN, or `access:delegate` on the target unit or on its canonical parent |
| reach | own unit and direct children: HUB Tổng → Chapter, Chapter → CLB, CLB → itself; never a parent, sibling, other branch or grandchild |
| ceiling | the whole role only by a whole-role holder at the source unit; a capability only if delegable and held there |
| revoke | [DEC-ADM-D02](../decisions/DECISION_LOG.md#dec-adm-d02): only a CURRENT holder of `access:delegate` on exactly the grant's unit (same-unit co-leader), or PLATFORM_ADMIN; never a parent, child or sibling unit, never grantorship alone, never after losing `access:delegate` (re-read FOR SHARE in the transaction); ACTIVE → CLOSED, `valid_to` now |
| audit | `ACCESS_GRANTED` / `ACCESS_REVOKED`: grantor, grantee, role, capability, scope |

## C. Authority and reach

Authority is exact (no inheritance, DL:764): a capability held on a unit is exercised on that unit only, or everywhere for PLATFORM. Reach — where a leader may delegate (B) and where verification requests fall back (PD-1: CLB → Chapter → HUB Tổng) — moves grants and requests, never authority.

## D. Operational rule

The release before 017 (`78f21f2`) reads `role_assignments` without `capability`. Before rolling the application back below 017, close capability-only grants (statement in the migration header); none exist until the access API ships (ADMIN-PROD-04).

## Related

- [AUTHORIZATION_CAPABILITY_MATRIX_P0.md](AUTHORIZATION_CAPABILITY_MATRIX_P0.md) — the base matrix
- [ADMIN-PROD-01-rbac-matrix.md](reports/ADMIN-PROD-01-rbac-matrix.md) — the frozen Admin RBAC contract
- [DECISION_LOG.md](../decisions/DECISION_LOG.md#dec-adm) — DEC-ADM
