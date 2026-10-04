# ADMIN-PROD-04-delegation

**Evidence 13 – 17: organization delegation APIs, scope matrix, grant / revoke validation, privilege escalation.** Parent: [ADMIN-PROD-04-venture-review.md](ADMIN-PROD-04-venture-review.md). Rules: PD-6 and the ADMIN-PROD-01 delegation contract on the existing `role_assignments` (+ `capability`, migration 017); services `grantAccess` / `revokeAccess` (ADMIN-PROD-02), readers new here.

## 13. Delegation APIs
| Call | Behaviour |
|---|---|
| `GET /ops/organizations/{orgId}/access` | the unit's HUB_COMMUNITY_LEADER assignments (whole role or one capability), `?state=ACTIVE` (default) / `CLOSED` / `ALL`; grantee by discovery name; `effective`, `can_revoke` |
| `POST …/access` `{ grantee_profile_id, capability? }` | grant → 201; Idempotency-Key optional (`access.grant-or-revoke`) |
| `POST …/access/{grantId}/revoke` | ACTIVE → CLOSED, `revoked_at` now |
| `GET …/access/history` | every grant / revocation of the unit from the audit trail (actor, grantee, role, capability) |
Readers = grantors (PLATFORM_ADMIN, or `access:delegate` on the unit or its canonical parent); anyone else, an unknown or a malformed unit → 403. Roster HUB_MEMBER role rows are not access: never listed or revocable here (R11).

## 14. Scope matrix (server-derived; canonical PARENT relationships only)
| Actor | Read / grant on | Denied |
|---|---|---|
| PLATFORM_ADMIN | every community unit | platform-scoped grants, self-grant |
| HUB Tổng leader | HUB Tổng, its Chapters | CLBs (grandchildren), other roots |
| Chapter leader | the Chapter, its CLBs | HUB Tổng (upward), other Chapters and their CLBs |
| CLB leader | the CLB | sibling CLBs, the Chapter |
| capability-only grantee | nothing (no `access:delegate`) | any grant |

## 15. Grant validation (server)
Grantor ACTIVE assignment re-read FOR SHARE in the transaction · grantee an ACTIVE profile of an ACTIVE account, not the grantor (422) · capability delegable (`org:read`, `member:read`, `membership:confirm`, `event:manage`, `programme:read`, `programme:manage`, `org:manage`, `verification:review`, `account:escalate`) or null for the whole role; anything else 422 · target = own unit or direct child, not ARCHIVED, source not ARCHIVED (409) · grantor holds the capability (or the whole role) at the source · no live identical grant (409, the controlled conflict convention) · strict body (unknown keys 422) · target unit row locked so identical concurrent grants serialize.

## 16. Revoke validation
The grantor, `access:delegate` on the unit or its parent, or PLATFORM_ADMIN; the grant must belong to the unit in the path (another unit's grant 404, a foreign unit 403); ACTIVE only (409 otherwise); `state = CLOSED`, `valid_to = now()`; `ACCESS_REVOKED`. Effective immediately: authority is resolved from the database on every request, so the grantee's next call is refused (tested with `can()` and `holdsAt`).

## 17. Privilege escalation (tests)
| Case | Result | Where |
|---|---|---|
| Chapter → HUB Tổng | 403 | `admin-scope.db-test.ts`, HTTP spec |
| CLB → sibling CLB | 403 | `admin-scope.db-test.ts` |
| Chapter A → Chapter B / its CLB | 403 (list, grant, history) | both + `access-api.db-test.ts` |
| capability not owned / not delegable | 422 / 403 | `admin-scope.db-test.ts`, HTTP spec (`access:delegate`) |
| revoked grant | no authority on the next call | `access-api.db-test.ts`, `admin-scope.db-test.ts` |
| forged scope | `scope_id` in the body 422; headers ignored; foreign path ids 403 / 404 | HTTP spec, `access-api.db-test.ts` |
| self-grant chain to a grandchild | 422 | `admin-scope.db-test.ts` |

## Notifications and audit
`ACCESS_GRANTED` / `ACCESS_REVOKED` (frozen names; the task's ORG_CAPABILITY_* mapped, R10): grantor, grantee, role, capability, source, scope, state. Grant / revoke notices: deferred — the notification contract (§22) has no such type, so none is invented.

## Related
- [ADMIN-PROD-04-venture-review.md](ADMIN-PROD-04-venture-review.md) · [ADMIN-PROD-04-qa.md](ADMIN-PROD-04-qa.md) · [ADMIN-PROD-02-rbac-scope-foundation.md](ADMIN-PROD-02-rbac-scope-foundation.md)
