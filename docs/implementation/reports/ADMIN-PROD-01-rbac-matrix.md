# ADMIN-PROD-01-rbac-matrix

**Roles, capabilities, delegation, write authority, server-side RBAC, account lifecycle, auth and OpsShell boundaries** (evidence 4, 10, 14, 18, 19, 23, 24). Parent: [ADMIN-PROD-01-runtime-contract.md](ADMIN-PROD-01-runtime-contract.md).

## Role model (evidence 4)
No new role. Roles stay `INDIVIDUAL_USER`, `HUB_MEMBER`, `HUB_COMMUNITY_LEADER`, `PLATFORM_ADMIN` (CAP §A). Task terms map: Admin Master = PLATFORM_ADMIN; HUB Tổng / Chapter BĐH = HUB_COMMUNITY_LEADER on the HUB / Chapter; delegated CLB handler = a delegated capability grant on the CLB. No Data / Content Admin role (no SOT basis). New **capabilities** only:

| Capability | Meaning | Scope | Delegable |
|---|---|---|---|
| `verification:review` | approve / reject role verification requests routed to the unit | organization | yes |
| `access:delegate` | grant / revoke roles and delegable capabilities (delegation contract below) | organization | no |
| `account:escalate` | file a lock / deactivate / deletion request for a member of the unit | organization | yes |
| `venture:review` | approve / reject venture reviews | platform | no |
| `org:lifecycle` | create, activate, deactivate organizations | platform | no |
| `feedback:manage` | triage feedback, weekly summary | platform | no |
| `vocabulary:manage` | categories | platform | no |
| `account:administer` | lock, unlock, deactivate, reactivate, soft-delete accounts | platform | no |
Existing capabilities unchanged; delegable among them: `org:read`, `member:read`, `membership:confirm`, `event:manage`, `programme:read`, `programme:manage`, `org:manage`. Never delegable: `org:manage_relationship`, `leadership:manage`, `access:delegate`, every platform capability.

## Capability matrix (evidence 4)
| Role | Platform scope | HUB | Chapter | CLB | Review | Delegation |
|---|---|---|---|---|---|---|
| PLATFORM_ADMIN | all capabilities | all | all | all | verification (any unit), venture | any scope |
| HUB_COMMUNITY_LEADER on HUB Tổng | — | existing + `verification:review`, `access:delegate`, `account:escalate` | — | — | HUB positions | HUB + its Chapters |
| HUB_COMMUNITY_LEADER on a Chapter | — | — | same set | — | that Chapter's positions + fallback from its CLBs | the Chapter + its CLBs |
| HUB_COMMUNITY_LEADER on a CLB | — | — | — | same set | that CLB's positions | the CLB only |
| delegated grant (any level) | — | the granted capability on the granted org only | ← | ← | if `verification:review` granted | none |
| member / owner | — | — | — | — | own requests and ventures | — |
No inheritance (DL:764): a HUB leader does not act on a Chapter unless granted there; fallback routing moves the **request**, not authority.

## Delegation contract (evidence 10) — PD-6
| Rule | Contract |
|---|---|
| record | the existing `role_assignments`: grantor = `assigned_by`, grantee = `individual_profile_id`, scope_org = `scope_id` (scope_type ORGANIZATION), created_at = `valid_from`, revoked_at = `valid_to` + `state` CLOSED; one new nullable `capability` column: null = the whole role, set = only that capability |
| who may grant | a holder of `access:delegate` (HUB_COMMUNITY_LEADER role on that org) or PLATFORM_ADMIN |
| target scope | the grantor's own organization or a direct child (HUB → Chapter, Chapter → CLB); CLB: own only; never a parent, sibling or other branch |
| ceiling | a capability must be delegable and held by the grantor on its own scope; a whole-role grant (`HUB_COMMUNITY_LEADER`) only by a holder of that role; nothing platform-scoped |
| chains | grantees of single capabilities cannot delegate (`access:delegate` is not delegable) |
| revoke | the grantor, a holder of `access:delegate` on the target organization or its parent, or PLATFORM_ADMIN; sets `valid_to` and CLOSED |
| enforcement | server side on every grant, revoke and use; scope from the database, never from the client |
| audit | `ACCESS_GRANTED`, `ACCESS_REVOKED` with grantor, grantee, capability / role, scope |

## Write authority matrix (evidence 18)
| Actor | Entity | Read | Create | Edit | Approve | Reject | Delegate | Deactivate |
|---|---|---|---|---|---|---|---|---|
| PLATFORM_ADMIN | RoleVerificationRequest | all | — | — | ✓ | ✓ | — | — |
| unit handler (`verification:review`) | RoleVerificationRequest | routed to its unit | — | — | ✓ | ✓ | — | — |
| requester | RoleVerificationRequest | own | ✓ | own pending / rejected | — | — | — | withdraw |
| PLATFORM_ADMIN | Organization | all | ✓ (DRAFT) | ✓ | activate | — | ✓ | ✓ (ARCHIVED) |
| leader (`org:manage`, `access:delegate`) | Organization | own scope | — | own profile | — | — | own / child | — |
| PLATFORM_ADMIN | Venture review | all | — | — | ✓ | ✓ | — | — |
| owner | Venture | own | ✓ | ✓ (core → review) | — | — | — | — |
| PLATFORM_ADMIN | Feedback | all | — | type, priority, owner, status, note | — | — | — | DONE |
| PLATFORM_ADMIN | Category | all | ✓ (allowed types) | label, order | — | — | — | archive |
| PLATFORM_ADMIN | Account lifecycle | requests + accounts | — | — | process request | decline | — | lock / deactivate / soft-delete |
| leader (`account:escalate`) | Account request | own submissions | ✓ (members of its unit) | — | — | — | — | — |

## Account lifecycle (evidence 14) — PD-7
LOCK → `user_accounts.status` BLOCKED + all sessions revoked (sign-in already answers `AUTH_ACCOUNT_BLOCKED`); UNLOCK → ACTIVE. DEACTIVATE → account and profile DEACTIVATED, sessions revoked, scoped role assignments closed; REACTIVATE reverses the status only. SOFT_DELETE_REQUEST → the user's existing deletion request (or a leader escalation) processed by PLATFORM_ADMIN as a deactivation flagged for the separate hard-deletion / retention procedure. Hard delete is never a portal action. Leaders only file or escalate requests.

## Server-side RBAC, auth and OpsShell (evidence 19, 23, 24)
| Rule | Contract |
|---|---|
| authorization | every admin read and mutation checks actor + capability + resource scope + lifecycle on the server; hidden or disabled controls are UX only |
| scope | resolved from the database (the request's routed unit, the target organization's id and ancestry); no client-provided scope, role or header is trusted |
| auth | the platform's accounts and sessions; admin access decided after sign-in by capabilities; no separate account store, credential system or role in the URL; Sprint1 auth replacement applies unchanged |
| entry | the existing member-nav "Vận hành tổ chức" → `/ops`; shown when the session holds any operator capability |
| shell | one `OpsShell` with capability-scoped sections; WF03 / WF04 tools stay as they are |

## Related
- [ADMIN-PROD-01-runtime-contract.md](ADMIN-PROD-01-runtime-contract.md) · [ADMIN-PROD-01-data-api-handoff.md](ADMIN-PROD-01-data-api-handoff.md) · [AUTHORIZATION_CAPABILITY_MATRIX_P0.md](../AUTHORIZATION_CAPABILITY_MATRIX_P0.md)
