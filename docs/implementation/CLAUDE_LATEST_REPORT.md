# Claude Task Report

## Task
ADMIN-PROD-06 — Admin Portal frontend / OpsShell integration (IMPLEMENT; no new shell, no new auth, no CMS). Reports: [frontend](reports/ADMIN-PROD-06-frontend.md) · [modules](reports/ADMIN-PROD-06-modules.md) · [QA](reports/ADMIN-PROD-06-qa.md) · [PROD-07 handoff](reports/ADMIN-PROD-06-prod07-handoff.md); uses only the real APIs of ADMIN-PROD-03/04/05 (05 §26–28).

## Verdict
**PASS_WITH_EVIDENCE.** The six frozen Admin Portal queues — Verification, Venture Review, Organization Access/Delegation, Feedback, Categories, Account Operations — are integrated into the existing OpsShell under a new `/ops/admin/*` route tree, sharing its sidebar, nav markup and CSS tokens (two optional, backward-compatible props added to `OpsShell`; every existing WF03 call site unchanged). Navigation is capability-gated end to end, including the previously-flagged PD-6 gap: a capability-only grantee (no `network:read`) now reaches exactly its one queue instead of a 404. Venture review clearly separates the public-current version from the pending candidate and renders the server's own diff, never a fabricated one. Account-deletion decline still requires a reason (DEC-ADM-PD7.1); no hard-delete control exists anywhere. Full protected regression on the final build: 1164 tests, 1138 pass, 0 fail, 0 flaky, 26 pre-existing environment-gated skips. STOP.

## Scope implemented
- `requireOpsAdmin()` (`src/lib/ops/guard.ts`): entry by any of the six admin capabilities, not `network:read`.
- `OpsShell` (+2 optional props), `ADMIN_NAV_ITEMS`/`ADMIN_HOME_NAV` (`src/lib/ops/nav.ts`): the new "Quản trị nền tảng" sidebar group, capability-filtered.
- 25 new files under `src/app/(ops)/ops/admin/*`: layout, Admin Home (composed counts, no `GET /ops/summary`), and the six modules (queue + detail client components, Vietnamese copy, shared `admin.module.css`/`shared.tsx` for loading/empty/denied/error states).
- `listDelegationOrganizations` (`src/lib/admin/access-api.ts`, new): the Access tab's entry list, scoped by `access:delegate` (PD-6 reach), not `network:read`.
- 1 Playwright spec (14 tests, real DB-backed fixtures, no runtime mocks) + 3 new DB tests for `listDelegationOrganizations`.
- Two real bugs found and fixed while writing the tests (a stale-data race on fast tab/filter switches; a loading-flash that hid the row mid-interaction) — see the QA report's bug table.

## Files changed
New: 25 files under `src/app/(ops)/ops/admin/`, 1 Playwright spec, 4 reports. Changed: `src/components/shell/ops-shell.tsx`, `src/lib/ops/{guard,nav}.ts`, `src/lib/admin/access-api.ts` (+`.db-test.ts`), this report.

## Migrations / data
NO_SCHEMA_CHANGE. No data changed (one pre-existing `vocabulary_items` row left ARCHIVED by an early, now-fixed test run was restored to ACTIVE — see QA report item 22).

## Tests / build
format, lint, typecheck PASS · unit 37 / 367 · DB 47 / 746 (`pnpm test:db`, fresh reset) · build PASS · **full protected regression on final HEAD:** 87 specs / 1164 tests, 1138 pass, 0 fail, 0 flaky, 26 skip (pre-existing, environment-gated, unrelated).

## Visual QA
No pixel baseline exists for these six screens (ADMIN-DESIGN-01 was never produced); pixel QA is explicitly ADMIN-PROD-08's. Built to the existing design-token vocabulary (cards, chips, the inline confirm-form) instead. Responsive: 1440/1024/768 no-overflow proven on two representative screens; 390 is smoke-only (the fixed-width OpsShell sidebar is pre-existing shared shell debt, not solved here).

## Deviations / blockers
None blocking. Reconciled: Organization/Delegation lives at `/ops/admin/access` (a thin, capability-scoped entry list) + the real per-org `/ops/admin/access/{orgId}` screen, rather than reusing `GET /ops/organizations` (wrong capability scope) or adding a new API route (the task's "real APIs only"). Category reorder uses move-up/down, not drag-and-drop (no such library in the stack). `account:escalate` has no UI (WF03-S04 deliberately excludes account administration; reopening that is outside this task's six modules — flagged for PROD-07). ADMIN-DECISION-02 (co-leader revoke) reported as current behaviour, not resolved — carries into PROD-07.

## Git
- Branch: `feat/admin-portal`; base `f2845a0`; HEAD unchanged during the task
- Implementation commit: `feat(admin): Admin Portal frontend inside the existing OpsShell (ADMIN-PROD-06)` (`69b7d85`)
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of ADMIN-PROD-06. ADMIN-PROD-07 not started.
