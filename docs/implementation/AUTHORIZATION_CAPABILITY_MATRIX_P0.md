# P0 Authorization Capability Matrix

**HUMAN APPROVED — P0.** Frozen by DECISION-AUTHZ-01B and implemented by M0-T09.

This is the approved P0 authorization **overlay**. It does not modify Product, Data, Workflow or Design SOT; it supplies the role-to-capability mapping those documents never joined, which is why M0-T09 was originally blocked.

Naming convention, frozen: **`resource:action`**. No second convention.

## A. Role catalogue

P0-active only, per `1HUB_DATA_SOT_v1.1.md:316` filtered by `03_AUTH_RBAC:80-83`.

| Role code | P0 status |
|---|---|
| `INDIVIDUAL_USER` | active |
| `HUB_MEMBER` | active |
| `HUB_COMMUNITY_LEADER` | active |
| `PLATFORM_ADMIN` | active |

`ORG_ADMIN` and `PLATFORM_OPS` are not roles. The eight later roles at `03:86-93` stay inactive in P0.

## B. Capability inventory

Nine P0 ops capabilities. Seven carry identifiers from frozen sources; two were named by DECISION-AUTHZ-01B because the frozen sources granted the action but never named it.

| Capability | Source | Resource | Read/Write |
|---|---|---|---|
| `network:read` | WF03:28 (S01) | Organization list | read |
| `org:read` | WF03:29 (S02) | Organization dashboard | read |
| `member:read` | WF03:30-31, API:1087 | Membership/profile in org | read |
| `programme:read` | WF03:32 (S05) | Programme | read |
| `org:manage` | WF03:33, API:1088 | Organization profile | write |
| `event:manage` | WF03:34, API:1089 | Event | write |
| `org:manage_relationship` | WF03:35, API:1090 | OrganizationRelationship | write |
| `membership:confirm` | **named by D2**; action granted at 03:110 | CommunityMembership | write |
| `leadership:manage` | **named by D2**; action granted at 03:111 | LeadershipRecord | write |

## C. Role capability matrix — HUMAN APPROVED

Scope `ORGANIZATION` means the actor must hold an active `HUB_COMMUNITY_LEADER` assignment for **that specific organization**. Scope `PLATFORM` means platform-wide.

| Capability | INDIVIDUAL_USER | HUB_MEMBER | HUB_COMMUNITY_LEADER | PLATFORM_ADMIN | Scope | Predicate |
|---|---|---|---|---|---|---|
| `network:read` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `org:read` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `member:read` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `programme:read` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `org:manage` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `event:manage` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `org:manage_relationship` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `membership:confirm` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active assignment for the requested org |
| `leadership:manage` | DENY | DENY | ALLOW | ALLOW | ORGANIZATION / PLATFORM | active `HUB_COMMUNITY_LEADER` assignment for that exact scope |

An assignment is active when its `state` is `ACTIVE`, `valid_from` is not in the future, and `valid_to` is null or in the future.

## D. Frozen constraints

| # | Constraint | Source |
|---|---|---|
| 1 | A Leader scoped to Organization A has **no** authority over Organization B | D1, 03:131, WF03:59 |
| 2 | Membership alone never grants any capability in this matrix | D1/D2, 03:169 |
| 3 | Leadership **history** is not permission; `RoleAssignment` is the permission-bearing record | D2, 03:169 |
| 4 | `PLATFORM_ADMIN` must **not** edit another user's canonical IndividualProfile in P0 | D3 |
| 5 | No impersonation is implemented | D3 |
| 6 | Frontend route access grants no capability | 03:214-224, 04:24 |
| 7 | Authorization is server-side on every protected call | API:1094 |

## E. Out of scope for this matrix — D4

WF01 and WF02 own-account and own-profile actions are **not** in this catalogue and do not block M0-T09. They use an explicit ownership predicate (`actor.profile_id == resource.profile_id`) rather than a session capability identifier. No identifier is minted for them here; that happens when their workflow implementation freezes them.

**WF02 venture relation capabilities (minted with WF02-S05, DEC-WF02-H7).** They are granted by a relation to the venture, never by a RoleAssignment. They are not part of the ops catalogue above and never appear in the session `capabilities`.

| Capability | Held by | Enforced in |
|---|---|---|
| `venture:read` | the owner (`projects.owner_profile_id`) and ACTIVE `project_members` | `GET /ventures/{id}`, `/projects/:id/edit`, `GET /ventures/{id}/team`, `/projects/:id/team` (members: read-only, no pending data) |
| `venture:manage` | the owner only | `PATCH /ventures/{id}` |
| `venture:team_manage` | the owner only | `POST /ventures/{id}/team/invitations`, `PATCH`/`DELETE /ventures/{id}/team/{membershipId}` (WF02-S06) |

`role_label` never grants anything. Creating a venture needs no capability: onboarding DONE is enough (DEC-WF02-S05-G2). Accepting or declining a team invitation (`POST …/team/invitations/{membershipId}/accept|decline`, DEC-WF02-S06-G2) needs no capability either: only the signed-in recipient whose normalised account email equals the invitation email may act, and an ACTIVE membership grants `venture:read` only, never a RoleAssignment.

The three `:self` identifiers in the session DTO example (`profile:read:self`, `profile:update:self`, `network:read:self`, API:135-137) are therefore **not** part of the ops catalogue. They remain frozen aliases in that contract example only, and D5 forbids adopting that convention as a second naming scheme.

## F. Still open — PRE-UAT SECURITY DECISIONS

Unchanged, and deliberately not resolved by this task:

| Item | Current provisional value | Status |
|---|---|---|
| CSRF mechanism | none implemented; SameSite=lax is the only mitigation | no frozen source names a mechanism (03:201 "when applicable") |
| Session TTL | 30 days | no frozen source states a value |
| SameSite | `lax` | 03:200 requires SameSite but names no value |

## Related

- [authorization-contract-gap.md](AUTHORIZATION_CONTRACT_GAP.md) — the gap this matrix closes
- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
