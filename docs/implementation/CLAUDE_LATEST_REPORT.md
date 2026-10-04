# Claude Task Report

## Task
ADMIN-PROD-02 — Admin Portal RBAC / scope / data foundation (IMPLEMENT; no frontend, no API route). Reports: [scope / RBAC](reports/ADMIN-PROD-02-rbac-scope-foundation.md) · [data](reports/ADMIN-PROD-02-data-foundation.md) · [DB / migration](reports/ADMIN-PROD-02-db-migration.md) · [QA](reports/ADMIN-PROD-02-qa-handoff.md) · [PROD-03 handoff](reports/ADMIN-PROD-02-prod03-handoff.md); matrix [addendum](AUTHORIZATION_CAPABILITY_MATRIX_P0_ADMIN.md).

## Verdict
**PASS_WITH_EVIDENCE.** No new role; 8 scoped capabilities (10 → 18) with a `delegable` flag; delegation on the existing `role_assignments` + `capability`, read through one predicate so a capability-only grant never acts as the role; exact authority, one-level reach (HUB Tổng → Chapter → CLB); PD-1 routing with CLB → Chapter → HUB Tổng fallback; foundations for verification requests, venture review (public version stays live), website / logo, feedback, account actions, categories, notifications and audit. Migration 017. No SOT / Sprint1 / contract conflict. STOP.

## Scope implemented
- `src/lib/authz`: capability matrix + `assignmentGrants`; `resolveActor` reads `capability` and fails closed on unknown / non-delegable values; session derivation; `src/lib/ops/scope.ts`.
- `src/lib/admin`: scope, hierarchy, delegation (`grantAccess` / `revokeAccess`), verification (`fileVerificationRequest`, predicates, states), venture review, feedback, account actions, categories, notifications, admin audit, test fixture.
- Independent security review before commit: 6 findings in the new code fixed (self-grant chain, self-verification routing, archived source, grant race, audit allowlist, malformed id → 500).

## Files changed
- `db/migrations/017_p0_admin_foundation.sql`; 6 `src/lib/authz` / `ops` / `audit` files; 15 new `src/lib/admin` files (4 test suites); 4 updated DB test files; matrix docs, `DB_SCHEMA_GAPS_P0.md`, five reports, this report.

## Migrations / data
017: `role_assignments.capability`; new `role_verification_requests`, `venture_reviews`, `account_action_requests`, `notifications`; `projects.website` / `logo_asset_id`; feedback triage columns (status renamed in place NEW / IN_REVIEW / DONE); deletion request status. STOP check, lossless-or-refused rollback, fresh / upgrade / recovery tested. No seed change, no data deleted. Rollback rule: close capability-only grants before an app rollback below 017.

## Tests / build
format, lint, typecheck PASS · unit 37 files / 365 PASS · DB 41 files / 662 PASS · build PASS · full visual / workflow suite 1,111 passed, 26 skipped, 0 failed (fresh DB) · final-build authz smoke 24 / 24.

## Visual QA
Not applicable (no UI change); the full suite is the protected regression.

## Deviations / blockers
None. Carried to later tasks: legacy `hub_declaration` memberships → requests and the onboarding cut-over (ADMIN-PROD-03 / S1-UAT-03B); ops entry for capability-only grantees (ADMIN-PROD-06); membership check on escalation targets and the 90-day screenshot job (ADMIN-PROD-05); schema gap D3 with `POST /feedback`.

## Git
- Branch: `feat/admin-portal`; base `a5d60f4`; HEAD unchanged during the task
- Implementation commit: `feat(admin): RBAC / scope / data foundation, migration 017 (ADMIN-PROD-02)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of ADMIN-PROD-02; then ADMIN-PROD-03 (role verification APIs / queue) per the handoff.
