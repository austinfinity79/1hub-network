# ADMIN-PROD-03-verification-api

**ADMIN-PROD-03 — Role verification APIs / queue (IMPLEMENT, no frontend).** Evidence 1 – 9, 12, 13. Contract: [05 §26, A9](../../architecture/05_API_CONTRACT_P0_v1.0.md) · rules [DEC-ADM-R1…R6](../../decisions/DECISION_LOG.md#dec-adm-r) · foundation [ADMIN-PROD-02](ADMIN-PROD-02-rbac-scope-foundation.md). Companions: [legacy / S1 boundary](ADMIN-PROD-03-legacy-boundary.md) · [QA](ADMIN-PROD-03-qa.md) · [PROD-04 handoff](ADMIN-PROD-03-prod04-handoff.md).

## 1. Preflight
`feat/admin-portal` at `8bdcaae` (ADMIN-PROD-02), migration 017 present, tree clean except `AGENTS.md`, HEAD unchanged until the commit; origin/main and production `78f21f2`; no other branch or worktree touches the verification model; Sprint1 S1-UAT-03B has no code (scope read from UAT 655 – 680).

## 2. Queue API — `GET /api/v1/ops/verification-requests`
Scope from the session's grants: requests whose **routed** unit (fixed at submission) is one where the viewer holds `verification:review`; all for PLATFORM_ADMIN; no grant anywhere → 403. Filters `status` (default PENDING), `organization_id` (position unit), `routed_to` (outside scope → 403, never silently widened), `cursor` (keyset on `submitted_at`, id: decisions between pages never skip a request), `limit` (1 – 50, default 20); unknown / repeated parameter, bad limit or cursor → 422. Order `submitted_at`, id. Item: id, status, version, position (title, unit, months, current), routed_to, fallback, requester (profile id + discovery name), submitted_at, handled_at, can_act. `counts.pending` = the viewer's pending total (how a submission reaches handlers).

## 3. Detail API — `GET …/{requestId}`
Summary + requester identity through PROFILE_DISCOVERY for a network viewer (name, headline, avatar; hidden → null; no ops bypass, as WF03), reject_reason, handler_profile_id, the requester's memberships and leadership records **in the position's unit only** (states, sources, dates), history. No e-mail, phone, full name, account id. Out of scope, unknown, malformed → the same 404.

## 4. Approve — `POST …/{requestId}/approve` `{ version }`
Self-decision refused and audited before any transaction (403). Then one transaction: request row `FOR UPDATE` with the scope in the same statement (else 404, nothing locked) → PENDING (409) → same version (409) → handler grant re-read `FOR SHARE` (revoked → 403) → routed unit not ARCHIVED for a unit handler (409) → requester profile `FOR UPDATE` (serializes approvals of one person), ACTIVE profile and account (409) → unit PUBLISHED (409) → effects → `APPROVED`, handler, handled_at, version + 1 → audit → notification. Effects (R1, never a RoleAssignment): current term → ACTIVE LeadershipRecord (start month) + ACTIVE membership of the position's unit; ended term → ALUMNI LeadershipRecord (start and end months), no membership.

## 5. Reject — `POST …/{requestId}/reject` `{ version, reason? }`
Same checks; reason optional (trimmed, ≤ 500, blank → none); `REJECTED` with handler, handled_at, reason, version + 1; the row is kept; audit with the reason; notification. The requester edits and resubmits through S1-UAT-03B (no admin-side recreation).

## 6. Existing membership (task §7 → R2)
| Found in the position's unit | Approval |
|---|---|
| ACTIVE membership | reused (`EXISTING`), audited `VERIFICATION_REQUEST_APPROVED_EXISTING_MEMBERSHIP` |
| PENDING_APPROVAL membership (self-request or legacy declaration) | activated: ACTIVE, source ORGANIZATION_VERIFIED (`ACTIVATED`) |
| none open | one new ACTIVE membership (`CREATED`) |
| SUSPENDED membership | 409, nothing changes (no automatic reinstatement) |
| equal ACTIVE title (case-insensitive) / ALUMNI title with the same start month | reused (`EXISTING`) |
No duplicate rows: the checks run under the requester lock; `uq_open_membership` and `uq_active_leadership` back them.

## 7. Routing / fallback matrix (PD-1, unchanged helper)
| Position at | Handler at the unit | Chapter handler | Routed to |
|---|---|---|---|
| HUB Tổng | any | — | HUB Tổng (none → PLATFORM_ADMIN) |
| Chapter | yes / no | — | Chapter / HUB Tổng |
| CLB | yes (leader or delegated `verification:review`) | — | CLB |
| CLB | no | yes / no | Chapter / HUB Tổng |
A unit whose only handler is the requester is skipped; never the requester's highest role; never higher than the first unit with a handler.

## 8. Handler eligibility
`verification:review` (whole role or capability-only grant) on exactly the routed unit, or PLATFORM_ADMIN; active, currently valid assignment, re-read in the decision's transaction. No inheritance: a Chapter handler cannot decide a request routed to its CLB, a HUB Tổng handler one routed to a Chapter. Revoked or expired → 404 on the request (out of scope).

## 9. Self-approval
Refused for everyone, PLATFORM_ADMIN included: `403 SCOPE_FORBIDDEN`, `can_act: false`, `VERIFICATION_REQUEST_SELF_ACTION_REFUSED` written outside the refused transaction (survives it).

## 12. Notifications
APPROVED / REJECTED → one `notifications` row (VERIFICATION_APPROVED / _REJECTED) for the requester's account, in the decision's transaction. Submission: no row; the frozen contract §22 routes it to handlers as the queue count (`counts.pending`). Withdrawal: none (not in the contract). No e-mail / Slack.

## 13. History / audit
Request row keeps submitted_at, status, routed unit, handler, handled_at, reason, version; nothing is deleted. Audit (`audit_events`, ids / codes / reason only): `…_SUBMITTED` (requester), `…_MIGRATED` (system, provenance), `…_APPROVED` or `…_APPROVED_EXISTING_MEMBERSHIP` (outcomes and ids of membership / leadership), `…_REJECTED` (reason), `…_SELF_ACTION_REFUSED`. The detail's `history` reads them: event, time, by REQUESTER / HANDLER / SYSTEM, status, routed unit, reason. Task names mapped to the frozen `VERIFICATION_REQUEST_*` family (R6).

## Related
- [ADMIN-PROD-03-legacy-boundary.md](ADMIN-PROD-03-legacy-boundary.md) · [ADMIN-PROD-03-qa.md](ADMIN-PROD-03-qa.md) · [ADMIN-PROD-03-prod04-handoff.md](ADMIN-PROD-03-prod04-handoff.md) · [ADMIN-PROD-02-prod03-handoff.md](ADMIN-PROD-02-prod03-handoff.md)
