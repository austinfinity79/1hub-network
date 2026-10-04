# ADMIN-PROD-02-rbac-scope-foundation

**ADMIN-PROD-02 — Admin Portal RBAC / scope / data foundation (IMPLEMENT, no frontend, no API route).** Evidence 1 – 6: preflight, role-model audit, scope model, capability model, delegation, hierarchy helpers. Contract: [ADMIN-PROD-01](ADMIN-PROD-01-runtime-contract.md) (frozen), [DEC-ADM](../../decisions/DECISION_LOG.md#dec-adm). Companions: [data](ADMIN-PROD-02-data-foundation.md) · [DB / migration](ADMIN-PROD-02-db-migration.md) · [QA / handoff](ADMIN-PROD-02-qa-handoff.md).

> **Superseded in part (ADMIN-PROD-07-CONTRACT-FIX):** revoke authority is now exact-unit only ([DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02)); `account:escalate` and the leader account-request route are withdrawn ([DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04)). Historical evidence below is kept as recorded.

## 1. Preflight
| Check | Result |
|---|---|
| branch / HEAD | `feat/admin-portal` at `a5d60f4` (ADMIN-PROD-01) on `9a52bb4` → WF06 closure `1ed6010`; unchanged until the commit |
| working tree | clean except the untracked `AGENTS.md` (left alone) |
| origin/main · production | `78f21f2` · `78f21f2` (`ssh hub-vps` state file) |
| WF06 candidate | `feat/wf06-prod-hardening` = `1ed6010`, ancestor of HEAD |
| concurrent writer | none: no other branch or worktree touches admin, RBAC or the tables below |
| Sprint1 code | none on any branch (`git grep` over all refs: no `role_verification`, no feedback writer, no venture review) |
| contract vs task | consistent; the task's "HUB + allowed descendant scope" is the contract's reach (§3), not inheritance |

## 2. Existing role model (audit)
Roles stay `INDIVIDUAL_USER`, `HUB_MEMBER`, `HUB_COMMUNITY_LEADER`, `PLATFORM_ADMIN`. `role_assignments` already holds grantee (`individual_profile_id`), scope (`scope_type` / `scope_id`), grantor (`assigned_by`), validity (`valid_from` / `valid_to`) and `state`; it lacked only "which capability". Authority was read in four places (`authorize`, `organizationScope`, `deriveCapabilities`, `deriveManagedScopes`), each comparing role lists directly. No new role, no Reviewer / Moderator / Data / Content admin.

## 3. Scope model (`src/lib/admin/scope.ts`)
| Actor | Authority (acts on) | Reach (delegates to; receives fallback from) |
|---|---|---|
| PLATFORM_ADMIN | everything | everything |
| HUB Tổng leader | HUB Tổng only | HUB Tổng + its Chapters |
| Chapter leader | the Chapter only | the Chapter + its CLBs (fallback from CLBs without a handler) |
| CLB leader | the CLB only | the CLB only |
| capability-only grantee | that capability on that unit | nothing (cannot delegate) |
Authority is exact (DL:764, DEC-WF03-G11); reach moves grants and requests, never authority. Inputs are the session actor (`resolveActor`, database only) and server-loaded ids; a client-named organization is only the resource checked. Helpers: `holdsPlatform`, `holdsAt`, `holdsRoleAt`, `delegationSources`, `delegationReach`, `inScope`.

## 4. Capability model (`src/lib/authz/matrix.ts`)
Task names → frozen `resource:action`: ROLE_VERIFY = `verification:review`, ORG_DELEGATE = `access:delegate`, ORG_MANAGE = `org:manage` (existing) + `org:lifecycle`, VENTURE_REVIEW = `venture:review`, FEEDBACK_REVIEW = `feedback:manage`, CATEGORY_MANAGE = `vocabulary:manage`; plus `account:escalate`, `account:administer`. 10 → 18 capabilities; five platform-only (no organization role); each rule carries `delegable`. Storage: existing `role_assignments` + nullable `capability` (no new table). One predicate, `assignmentGrants`, now feeds all four readers: a capability-only row carries that capability and nothing else of its role. `resolveActor` discards a row naming an unknown or non-delegable capability, or a non-organization one (fail closed). Session: `capabilities` lists delegated capabilities; `managed_scopes` omits capability-only rows (they do not hold the role). Document: [matrix addendum](../AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md).

Grant record fields: grantee `individual_profile_id` · capability `capability` · scope_org `scope_id` · grantor `assigned_by` · created_at `valid_from` · revoked_at `valid_to` (+ state CLOSED).

## 5. Delegation rules (`src/lib/admin/delegation.ts`)
| Rule | Server-side check |
|---|---|
| authority | PLATFORM_ADMIN, or `access:delegate` on the target unit or its canonical parent (`delegationSourceFor`) |
| hierarchy | own unit or a direct child; parent, sibling, other branch, grandchild → 403 `SCOPE_FORBIDDEN` (unknown / malformed alike, for every actor) |
| ceiling | whole role only from a whole-role holder at the source; a capability only if delegable (else 422) and held at the source |
| escalation | `access:delegate` is not delegable, so a grantee cannot re-delegate; nothing platform-scoped is grantable; no self-grant (422 `self`), so nobody chains authority down to a grandchild |
| lifecycle | target and source units not ARCHIVED (409); grantee an ACTIVE profile of an ACTIVE account (422); no live identical grant (409); target row locked; the grantor's source assignment re-read FOR SHARE (a revocation committed first → 403) |
| revoke | grantor, `access:delegate` on the unit or its parent, or PLATFORM_ADMIN; ACTIVE → CLOSED, `valid_to` now; not active → 409 |
| audit | `ACCESS_GRANTED` / `ACCESS_REVOKED`: grantor, grantee, role, capability, source, scope; a refused call writes nothing |
Service functions only (`grantAccess`, `revokeAccess`); the routes are ADMIN-PROD-04's.

## 6. Organization hierarchy helpers (`src/lib/admin/hierarchy.ts`)
Built on the canonical reader `parentsOf` (ACTIVE PARENT relationships; DEC-WF03-G9); no admin tree. `isSameScope`, `ancestorChain` (bounded, cycle-safe), `isDescendant`, `isDirectChild`, `parentOf`, `fallbackChain` (community units only: CLB → Chapter → HUB Tổng), `unitHasHolder` (an ACTIVE, valid holder of a capability on exactly that PUBLISHED unit, ACTIVE profile and account, optionally excluding one person; PLATFORM_ADMIN never counts), `nearestResponsibleUnit` (first unit with a `verification:review` holder other than the requester; none → HUB Tổng, handled by PLATFORM_ADMIN).

## Related
- [ADMIN-PROD-02-data-foundation.md](ADMIN-PROD-02-data-foundation.md) · [ADMIN-PROD-02-db-migration.md](ADMIN-PROD-02-db-migration.md) · [ADMIN-PROD-02-qa-handoff.md](ADMIN-PROD-02-qa-handoff.md) · [ADMIN-PROD-01-rbac-matrix.md](ADMIN-PROD-01-rbac-matrix.md)
