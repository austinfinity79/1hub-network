# Claude Task Report

## Task
WF05-PROD-02 — close the remaining WF05 persistence gaps (handoff P2-1 … P2-4 only). Report: [reports/WF05-PROD-02_persistence.md](reports/WF05-PROD-02_persistence.md); evidence: [reports/WF05-PROD-02_evidence.md](reports/WF05-PROD-02_evidence.md).

## Verdict
**PASS_WITH_EVIDENCE, local only.** Submitted applications immutable and undeletable in the database; applicant identity fixed; idempotency records no longer outlive their window; deterministic WF05 fixtures; WF05 state survives refresh, relogin, app restart and PostgreSQL restart. Not pushed, not deployed; PROD-03 not started. STOP.

## Scope implemented
- Migration 016 `016_p0_application_integrity.sql`: identity-fixed trigger, SUBMITTED delete / truncate guards, snapshot-object check; data pre-check; documented lossless rollback; no table, column or index.
- Idempotency store: expired record of the same scope removed before the claim; bounded sweep (100) of other expired records.
- `src/lib/application/testing.ts`: deterministic fixture set and the maintenance cleanup used by suites that create SUBMITTED applications.
- Seed: a form with applications is never rewritten by a re-seed.
- WF04 migration-chain tests made independent of the newest migration; schema list includes 016.

## Files changed
- Migration: `db/migrations/016_p0_application_integrity.sql` (new).
- Runtime: `src/lib/idempotency/store.ts`.
- Test support / tests: `src/lib/application/testing.ts` (new), `src/lib/db/application-integrity.db-test.ts` (new), `src/lib/idempotency/idempotency.db-test.ts`, `src/lib/application/application.db-test.ts`, `src/lib/db/programme-persistence.db-test.ts`, `src/lib/db/schema.db-test.ts`, `tests/visual/specs/wf05-s02-project-detail.spec.ts`, `tests/visual/specs/wf05-uat-journey.spec.ts`.
- Seed: `db/seed/seed_p0_deterministic.sql`. QA tooling: `scripts/qa/wf05-restart-check.mjs` (new, local only).
- Docs: the two PROD-02 reports, `DB_SCHEMA_GAPS_P0.md` (D8), `IDEMPOTENCY_STORE_P0.md` (I7), this report.

## Migrations / data
Migration 016 (additive, one transaction, pre-check, lossless rollback). Fresh 001 → 016 and upgrade 015 → 016 with WF05 data verified; no data written by the migration.

## Tests / build
format, lint, typecheck PASS; unit 33 / 307; DB 35 / 549 (+40); build PASS; restart check 14 / 14; protected regression 64 specs / 797 on a fresh DB; UAT 19 / 19; 5xx, console, hydration 0.

## Visual QA
No UI change.

## Deviations / blockers
P2-4b deferred: the seeded venture stays ACTIVE + PRIVATE (valid in the DB; twelve protected specs read it). Fixture module placed in `src/lib/application/testing.ts` (next to `venture/testing.ts`) instead of `tests/visual/support/ventures.ts`, so DB suites and Playwright share it.

## Git
- Branch: `feat/wf05-prod-hardening`; start HEAD `b362527`; no concurrent change
- Implementation commit: `feat(wf05): application integrity and persistence hardening, migration 016 (WF05-PROD-02)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of PROD-02; then WF05-PROD-03 (API / lifecycle / RBAC, handoff P3-1 … P3-10, with the WF02 / WF04 authorizations it needs).
