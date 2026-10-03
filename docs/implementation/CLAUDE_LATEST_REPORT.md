# Claude Task Report

## Task
WF06-PROD-02 — WF06 data / read-model foundation (IMPLEMENT) under the frozen WF06-PROD-01 contract (DEC-W6P). Summary and evidence index: [reports/WF06-PROD-02_data-foundation.md](reports/WF06-PROD-02_data-foundation.md); source matrix: [reports/WF06-PROD-02_source-matrix.md](reports/WF06-PROD-02_source-matrix.md); visibility / security: [reports/WF06-PROD-02_visibility-security.md](reports/WF06-PROD-02_visibility-security.md); query / index audit: [reports/WF06-PROD-02_query-index-audit.md](reports/WF06-PROD-02_query-index-audit.md); fixtures / tests: [reports/WF06-PROD-02_fixtures-tests.md](reports/WF06-PROD-02_fixtures-tests.md); PROD-03 handoff: [reports/WF06-PROD-02_prod03-handoff.md](reports/WF06-PROD-02_prod03-handoff.md).

## Verdict
**PASS_WITH_EVIDENCE.** Canonical Library read path implemented as server-side functions (no API, no frontend): PUBLIC ACTIVE STARTUP ventures with the predicate in SQL; founders only for a NETWORK viewer and only where PROFILE_DISCOVERY, profile and account status allow; the external feed merged as TEMPORARY_EXTERNAL with provenance; deterministic filters, sorts and opaque cursors; no ids in items. DIRECT_QUERY everywhere; NO_SCHEMA_CHANGE. PROD-03 not started. STOP.

## Scope implemented
- P2-1 `canonical-source.ts`, `library-data.ts`, `library-service.ts` (+ db-test); P2-2 `external-domain-map.ts` (+ unit test); P2-3 founder names out of Library search; P2-4 `EXPLAIN ANALYZE` audit (no index); P2-5 `testing.ts` fixture.
- One query fix found by the audit: the startup read caps the page before reading domains (134.6 ms → 22.7 ms at 50k synthetic projects).

## Files changed
- New: `src/lib/library/{canonical-source,library-data,library-service,external-domain-map,testing}.ts`, tests `canonical-source.db-test.ts`, `library-data.test.ts`, `external-domain-map.test.ts`.
- Modified: `src/lib/library/startup-adapter.ts` (+ test), `src/components/library/library-model.ts` (+ test).
- Docs: six `WF06-PROD-02_*` reports, this report.

## Migrations / data
None (NO_SCHEMA_CHANGE). The index audit used a scratch database, dropped afterwards.

## Tests / build
Format, lint, typecheck PASS; unit 35 files / 331 tests; DB 37 files / 585 tests on a fresh DB (`db:reset` 16 / 16); Library db-test 16 / 16 on the existing and the fresh DB; production build PASS; focused cross-WF regression 16 specs **190 / 190** (first run: 4 `l6` setup failures from the QA vocabulary fixture removed by `db:reset`; fixture re-applied, then all green in one run).

## Visual QA
No UI change beyond founder names leaving the `/library` search; Library and neighbouring visual specs green (above).

## Deviations / blockers
None blocking. Intentional: the DOMAIN map is applied in the merge layer, not the adapter; opaque derived keys instead of ids; `/library` keeps the external directory until PROD-04. Open items: HUB / PO review of the DOMAIN slug map; PUBLIC ventures of deactivated owners stay listed (WF02 lifecycle question).

## Git
- Branch: `feat/wf06-prod-hardening`; base `83a84f4`; HEAD unchanged during the task
- Implementation commit: `feat(wf06): canonical Library data / read foundation (WF06-PROD-02)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of WF06-PROD-02; then WF06-PROD-03 (API / visibility / read hardening) per the handoff.
