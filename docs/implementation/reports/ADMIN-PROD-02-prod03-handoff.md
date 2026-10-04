# ADMIN-PROD-02-prod03-handoff

**Evidence 25: exact handoff to ADMIN-PROD-03 (Role Verification APIs / queue).** Parent: [ADMIN-PROD-02-qa-handoff.md](ADMIN-PROD-02-qa-handoff.md). ADMIN-PROD-03 is not started.

## Service functions (ready)
| Function | File | Use in PROD-03 |
|---|---|---|
| `fileVerificationRequest(exec, { accountId, body, requestId })` | `src/lib/admin/verification.ts` | the only writer of new requests: user endpoint (S1-UAT-03B) and the onboarding cut-over |
| `parseDeclaredPosition(body)` | same | body shape `{ organization_id, position_title, period_from: 'YYYY-MM', period_to: 'YYYY-MM' \| null }` |
| `writeAdminAudit(exec, …)` | `src/lib/admin/admin-audit.ts` | every decision, edit, withdraw, resubmit |
| `notify(exec, …)`, `decisionNotification('VERIFICATION', status)` | `src/lib/admin/notifications.ts` | APPROVED / REJECTED → a row for the requester's account |
| `grantAccess` / `revokeAccess` | `src/lib/admin/delegation.ts` | CLB handlers (`verification:review` grants), routes in ADMIN-PROD-04 |

## Scope predicates
`canHandleVerification(actor, { routedToOrgId, requesterProfileId })` (handler on the routed unit, or PLATFORM_ADMIN; never the requester) · `verificationQueueScope(actor)` → `ALL` or the unit ids → `WHERE routed_to_org_id = ANY($ids)` · `holdsAt` / `holdsPlatform` (`src/lib/admin/scope.ts`). Authority never from the client; a request outside scope answers like an unknown one (403 `SCOPE_FORBIDDEN` / 404 as WF03 does).

## Routing / fallback helper
`nearestResponsibleUnit(exec, orgId, requesterProfileId)` → `{ routedTo, chain, fallback, handlerFound }` (a unit whose only handler is the requester is skipped); `fallbackChain`, `unitHasHolder(exec, orgId, 'verification:review', excludeProfileId)` (`src/lib/admin/hierarchy.ts`). Routing is fixed at submission; a resubmission may re-route (contract silent: PROD-03 decides and records it).

## States
`VERIFICATION_STATUSES`, `VERIFICATION_TRANSITIONS`, `canTransitionVerification(from, to, 'HANDLER' | 'REQUESTER')`. Decision writes: `status`, `handled_by_account_id`, `handled_at`, `reject_reason` (REJECTED only, ≤ 500), `version + 1`, `updated_at` — the table's checks enforce the pairing. Resubmit (REJECTED → PENDING) clears the three handled fields and bumps `version`; a decision carrying a stale `version` → 409 `MEMBERSHIP_INVALID_TRANSITION`.

## Approval effect
`approvalEffect({ periodTo })`: no end → `leadership_records` ACTIVE (+ ACTIVE `community_memberships`, source ORGANIZATION_VERIFIED); ended → ALUMNI (shown "Cựu …"), no membership. Never a `role_assignments` row. `uq_active_leadership` and `uq_open_membership` already exist: an existing open membership in the unit is reused, not duplicated (PROD-03 to specify the exact rule in its contract amendment).

## Audit hooks (typed, `AdminAuditAction`)
`VERIFICATION_REQUEST_SUBMITTED` (written now) · `_UPDATED` · `_WITHDRAWN` · `_RESUBMITTED` · `_APPROVED` · `_REJECTED`; ids, statuses, scope and the optional reason only — never the title, period text or requester data.

## Test fixtures
`seedAdminFixture()` / `clearAdminFixture()` / `insertGrant()` and `ADM_FX`, `ADM_PEOPLE` (`src/lib/admin/testing.ts`): HUB → CH_A (CLB_A1 with a leader, CLB_A2 without, CLB_ARCHIVED) and CH_B (CLB_B1 without); admin, four leaders, three members, one BLOCKED account, one DEACTIVATED profile. Suites to extend: `admin-scope.db-test.ts`, `admin-data.db-test.ts`.

## Open items PROD-03 must close (not decided here)
| Item | Fact | Owner |
|---|---|---|
| legacy `hub_declaration` memberships → requests (D6B supersession) | position and period are free text (`claimed_period` e.g. "2024 – nay"), some empty; `period_from` is required | ADMIN-PROD-03 proposal; PO if no deterministic mapping |
| onboarding still files memberships | `completeOnboarding` → `fileClaimedMemberships` unchanged in this task | cut-over with S1-UAT-03B |
| ops entry for a capability-only grantee | `/ops` entry needs `network:read` (not delegable); contract: entry for any operator capability | ADMIN-PROD-06 |
| queue index | none yet; add `(routed_to_org_id, status)` only with a query plan | ADMIN-PROD-03 |
| user-side limits | UAT 1 – 10 positions per member | S1-UAT-03B form |
| API | endpoints and errors as ADMIN-PROD-01 data / API handoff; API contract amendment §26 | ADMIN-PROD-03 |

## Related
- [ADMIN-PROD-02-qa-handoff.md](ADMIN-PROD-02-qa-handoff.md) · [ADMIN-PROD-02-data-foundation.md](ADMIN-PROD-02-data-foundation.md) · [ADMIN-PROD-01-runtime-contract.md](ADMIN-PROD-01-runtime-contract.md)
