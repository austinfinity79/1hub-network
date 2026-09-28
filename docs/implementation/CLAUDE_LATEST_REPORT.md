# Claude Task Report

## Task
TASK 22-PREVIEW-LIBRARY-FIX — REAL STARTUP.JSON DATA + PIXEL UI REMAP. Full report: [reports/TASK-22-PREVIEW-LIBRARY-FIX_library-fix.md](reports/TASK-22-PREVIEW-LIBRARY-FIX_library-fix.md).

## Verdict
**DONE (local), ready for PO visual review.** Startup (72) and Nhà sáng lập (84) come from `startup.json`; Bài toán stays the labelled demo fixture. The page follows the full "L15 · DIR1 · Thư viện" frame: P0 / P1 / P2 = 0. Not deployed.

## Scope implemented
- Read-only adapter + cached server read of startup.json; per-tab directory model; startup and founder cards; error state.
- Light directory body and toolbar / facet / load-more remap; mobile facet toggle.

## Files changed
- New: `src/lib/library/startup-adapter.ts` (+ test), `src/lib/library/startup-source.ts`, `src/components/library/library-model.ts`, `design-reference/final/revision/L2/L15__library__SOURCE.png`.
- Updated: `src/app/(public)/library/page.tsx`, `src/components/library/*`, `tests/visual/specs/public-library.spec.ts`, `tests/visual/pixel-qa/revision.ts` (back to its original), `design-reference/final/revision/README.md`, `DECISION_LOG.md` (DEC-L15-D7/D8), `.env.example`.
- Removed: the four `L15__library-*` fragments.

## Migrations / data
None. No API, DB, auth, RBAC or e-mail change; nothing imported.

## Tests
format, lint, typecheck, build PASS; unit 255 / 255; regression 142 / 142.

## Visual QA
Max outside 0.0111, max beyond 0.0114; geometry asserted (810 / 873 / 358 / 324 × 431 / 23 / 2340 / 2470). Responsive 1440 / 1024 / 768 / 390 clean. #418 0, 5xx 0.

## Deviations / blockers
- Blocking gaps: 0.
- Deploy needs outbound HTTPS to startup.1hub.cloud (else the error state shows).

## Git
- Branch: `main`; start HEAD `c47fc92`, checked again before each commit
- Implementation commit: `e128d1cd903e867a014876a3493a758621e80b4e`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN**; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO visual review of `/library` (local server); deploy only on instruction. Not started automatically.
