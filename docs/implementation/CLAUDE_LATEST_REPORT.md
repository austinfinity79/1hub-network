# Claude Task Report

## Task
WF04-PROD-02 — DB / persistence hardening. Contract: [WF04_PRODUCTION_CONTRACT.md](reports/WF04_PRODUCTION_CONTRACT.md); PO lifecycle decision: [DEC-W4P-D11](../decisions/DECISION_LOG.md#dec-w4p-d11); task report: [reports/WF04-PROD-02_db-persistence-hardening.md](reports/WF04-PROD-02_db-persistence-hardening.md).

## Verdict
**GREEN, local only.** Migration 015 gives the canonical Programme aggregate its production persistence foundation; no runtime, API, UI, seed or production change. Not pushed, not deployed; PROD-03 not started. STOP.

## Scope implemented
- `programme_status` (DRAFT, PUBLISHED, CLOSED, ARCHIVED): CLOSED added (approved); ARCHIVED carried over from `publication_status` (present since M001) for compatibility only, DEFERRED.
- `programmes.organization_id` NOT NULL (the one owning organization; FK of 001 reused).
- `ck_programmes_dates` (end ≥ start when both set); `ck_programmes_metadata` (documented `journey` / `challenge` shape, `challenge` on CHALLENGE only, no cardinality rule).
- Data check that STOPS the whole migration on any row it cannot carry; identity status mapping, no coercion.

## Files changed
- Migration: `db/migrations/015_p0_programme_production.sql` (new).
- Tests: `src/lib/db/programme-persistence.db-test.ts` (new, 21), `src/lib/db/schema.db-test.ts` (ledger + 015).
- Docs: contract §5, §6, §11, §12, §19, §20 (ARCHIVED = DEFERRED); DECISION_LOG (DEC-W4P-D11, C1); `DB_SCHEMA_GAPS_P0.md` (D1 resolved, enum table); task report; this report.

## Migrations / data
`015_p0_programme_production.sql`, one transaction, writes no row. Local dev DB upgraded 013 → 014 → 015 with every row digest identical (18 applications kept). Production DB not touched.

## Tests / build
format, lint, typecheck PASS; unit 34 files / 263; build PASS; DB suite 33 files / 483 (new 21); visual WF01–WF05 55 specs / 613; UAT 19/19; PostgreSQL restart check PASS. No failure, no flaky test.

## Visual QA
No UI change; no baseline touched; the 613 visual tests pass unchanged.

## Deviations / blockers
- None blocking. ARCHIVED stays in the column domain because it pre-dates WF04 (PO rule: preserve, report, do not create).
- Not encoded in the DB (no frozen basis for this phase): owner type HUB / CHAPTER / CLB and owner / type immutability (PROD-03 service); CHALLENGE ≥ 1 problem, required dates / stages / form (Q7).
- Compatibility-only runtime changes: none.

## Git
- Branch: `feat/wf04-prod-hardening` (from `b4463e2`); start HEAD `b4463e2`; no concurrent change
- Implementation commit: `feat(wf04): programme persistence foundation, migration 015 (WF04-PROD-02)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO review of PROD-02; then WF04-PROD-03 (API / RBAC / validation) once Q1–Q3, Q7, Q10 are answered.
