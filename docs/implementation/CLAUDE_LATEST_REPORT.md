# Claude Task Report

## Task
WF04-PROD-05 — WF04 functional + security QA (audit + QA). Report: [reports/WF04-PROD-05_functional-security-qa.md](reports/WF04-PROD-05_functional-security-qa.md); impact map and journeys: [reports/WF04-PROD-05_journey-matrix.md](reports/WF04-PROD-05_journey-matrix.md); inventory: [reports/WF04-PROD-05_test-inventory.csv](reports/WF04-PROD-05_test-inventory.csv) (261 tests).

## Verdict
**PASS_WITH_EVIDENCE, local only.** Product bugs 0; IDOR successes 0; Event writes 0; 5xx / console / hydration 0. Not pushed, not deployed; PROD-06 not started. STOP.

## Scope implemented
- Preflight, impact map A–G, journey matrix A–L on the real DB / API.
- Happy and negative paths, RBAC, IDOR, role spoofing, lifecycle, publish, close (API only, no close control), archived owner over HTTP, Challenge, Application / Form, Event boundary, idempotency per action, audit correlation, persistence, error surface.
- Fix loop: 14 TEST_GAP findings closed by 17 production tests and one local restart check; BUG 0; SOT_CONFLICT / NEW_BUSINESS_REQUIREMENT 0.
- Coverage audit: STILL_VALID_AND_MISSING stays 0; no obsolete fixture behaviour restored.

## Files changed
- Tests: `tests/visual/specs/wf04-prod-qa.spec.ts` (new, 17 tests).
- QA tooling: `scripts/qa/wf04-restart-check.mjs` (new; local only: app restart, DB restart, relogin, production-mode surface).
- Docs: the three PROD-05 reports above, this report.

## Migrations / data
None. No runtime code, API contract, DB schema or business rule changed.

## Tests / build
format, lint, typecheck PASS; unit 33 files / 307; DB 34 files / 509; build PASS; WF04 targeted 261 (unit 109, DB 56, HTTP / E2E 96); restart check 10/10; protected regression 63 specs / 673 on a fresh DB (`db:reset`, 001–015 + seed); UAT 19/19; 5xx 0, console / hydration errors 0.

## Visual QA
No UI change; no baseline touched. Pixel work stays PROD-06 (Q9).

## Deviations / blockers
None. Open for the PO: Q3(b) before PROD-07; a close control on screen (design decision); Q2 remainder (discard a DRAFT), Q4–Q6, Q8, Q9, Q10. Cleanup candidate for PROD-07: unused demo write helpers in `lib/programme-demo`.

## Git
- Branch: `feat/wf04-prod-hardening`; start HEAD `7ea892d`; no concurrent change
- Implementation commit: `test(wf04): functional and security QA evidence (WF04-PROD-05)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO review of PROD-05; then WF04-PROD-06 (pixel / responsive) after Q9.
