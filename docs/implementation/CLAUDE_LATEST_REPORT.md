# Claude Task Report

## Task
WF04-PROD-04-FIX — close the PROD-04 scope deviations. Decision: [DEC-W4P-D14](../decisions/DECISION_LOG.md#dec-w4p-d14); audit: [reports/WF04-PROD-04-FIX_test-audit.md](reports/WF04-PROD-04-FIX_test-audit.md) (+ `.csv`, 115 rows); PROD-04 report: [reports/WF04-PROD-04_frontend-api.md](reports/WF04-PROD-04_frontend-api.md).

## Verdict
**PASS_WITH_EVIDENCE, local only.** Unapproved close UI 0; close API unchanged; coverage gap 0; runtime fixture dependency 0; Q3(b) unavailable on screen. Not pushed, not deployed; PROD-05 not started. STOP.

## Scope implemented
- FIX 1: the S08 "Đóng chương trình" button, its confirmation and message are removed; `Confirm` returns to its PROD-03 form. `POST /programmes/{id}/close` and the lifecycle are untouched; a closed programme renders read only.
- FIX 2: the 115 replaced demo tests are classified: 12 OBSOLETE_DEMO, 80 REPLACED_BY_PRODUCTION_TEST, 23 STILL_VALID_AND_MISSING — all 23 restored as 19 production tests (route 404s, OpsShell entry, route × actor matrix, move boundaries, setup frame chain, registration and publish retries, review summary, published detail, manage links, basic information, ADM5 primitives on S03–S08). The rewrite is recorded as pulled forward from PROD-05.
- Q3(b): DEFERRED / NEED PO DECISION BEFORE PROD-07; "Thêm câu hỏi" stays disabled; no default invented.

## Files changed
- App: `components/programme-demo/programme-detail.tsx` (close UI removed), `setup-screen.tsx` (`Confirm` busy prop removed).
- Tests: `tests/visual/support/programmes.ts` (ADM5 primitive helper), WF04 specs T00, S03, S04, S05, S06, S07, S08, UAT.
- Docs: DECISION_LOG (D14), WF04 contract (§16 close note, §19 Q3, §20 PROD-05), PROD-04 report, audit `.md` + `.csv`, this report.

## Migrations / data
None. API contract unchanged.

## Tests / build
format, lint, typecheck PASS; unit 33 files / 307; build PASS; DB 34 files / 509; WF04 specs 79 (T00 8, S01 8, S02 8, S03 11, S04 4, S05 7, S06 3, S07 10, S08 11, UAT 1, API 8); protected regression 62 specs / 656 on the final build; UAT 19/19; 5xx 0, console / hydration errors 0.

## Visual QA
No baseline changed; ADM5 primitives (header band / rule, card edges, pills) compared again on S01–S08, all within threshold; pixel reference method stays Q9.

## Deviations / blockers
None. Open for the PO: a close control on screen (design decision); Q3(b) before PROD-07.

## Git
- Branch: `feat/wf04-prod-hardening`; start HEAD `6e99d15`; no concurrent change
- Implementation commit: `fix(wf04): no close control on screen; restore WF04 test coverage (WF04-PROD-04-FIX)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO final review of PROD-04; then WF04-PROD-05 (functional / security QA).
