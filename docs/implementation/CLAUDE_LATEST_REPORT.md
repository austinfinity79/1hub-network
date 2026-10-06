# Claude Task Report

## Task
DEMO-DIR2-01 — Product / Startup directory MVP (DM08) for the 07/10 demo. Report: [DEMO-DIR2-01](reports/DEMO-DIR2-01.md). Decisions: [DEC-DEMO-DIR](../decisions/DECISION_LOG.md#dec-demo-dir).

## Verdict
**PASS_WITH_EVIDENCE.** The DM08 header + hero block is within the DEC-H1-D5 thresholds. 768 and 390 structural checks pass. The Tier B slice and UAT L1–L2 are green. DEMO-SP1-FOUNDER-01 is not started. Not pushed, not merged, not deployed. STOP.

## Scope implemented
- **`/products`:** hero with live count, search, quick chips and counters; filters for sector, stage and location; active filters; sort; cards; empty state; "Xem thêm"; URL sync.
- **`/products/[slug]`:** interim Tổng quan page. Unpublished slugs return 404.
- **Homepage handoff:** "Sản phẩm" in the header and footer, "Xem tất cả", product rows and the "Sản phẩm" search scope all lead to `/products`.

## Files changed
- **New:**
  - `src/app/(public)/products/page.tsx`
  - `src/app/(public)/products/[slug]/{page.tsx,startup.module.css}`
  - `src/components/products/{directory.tsx,directory.module.css}`
  - `src/lib/public/directory-data.ts`
  - `tests/visual/specs/demo-dir2-01.spec.ts`
  - the report
- **Changed:**
  - `src/lib/public/routes.ts`
  - `src/lib/demo-0710/ventures.ts`
  - 3 visual specs: `demo-home-about-01`, `alpha-interaction-gaps`, `wf06-prod-visual`
  - DECISION_LOG, P0_STATUS, SCREEN_ROUTE_MAP, SUPERSESSION_MATRIX

## Migrations / data
- No migration.
- `node scripts/db.mjs demo` re-applied to `hubnetwork_s1uat03` only (3 startups). The shared `hubnetwork_p0` is untouched.

## Tests / build
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 45 / 458 |
| DB (library, public) | 2 / 42 |
| Tier B visual | 13 specs · 386 tests · 381 PASS · 3 FAIL (stale expectations, fixed; re-run 36 / 36) · 2 SKIP |
| UAT L1–L2 | 19 / 19 |
| Server log | hydration / 5xx / secret: 0 |

## Visual QA
| DM08 block | Result |
|---|---|
| Header + hero (gated) | 0.47 / 0.52 % |
| Results (reported) | 4.18 / 5.97 % |

The results block differs because it shows canonical cards in the default unfiltered state, while the frame shows a filtered state with an open dropdown (INTENTIONAL-DATA).

## Deviations / blockers
- **Blockers:** none.
- **Recorded deviations:**
  - 3 demo startups.
  - No verified mark.
  - "Quốc tế" shows 0.
  - Counters come from the demo fixture.
  - No footer, because DM08 draws none.
  - The startup page is interim.
- **Pre-existing:** the `wf06-prod-visual` homepage search selector had been stale since DEMO-HOME-ABOUT-01. It is now fixed.

## Git
- Branch: `feat/sprint1-completion` (worktree `../1hub-network-sprint1-completion`). Start HEAD `4c9e7b7`, unchanged by others.
- Implementation commit: the DEMO-DIR2-01 commit.
- Report/final commit: same commit.
- Remote: `origin`.
- Push status: NOT RUN (task: no push).
- Remote HEAD: origin/main `edd3d24` (unchanged).
- Working tree: clean after the commit.

## Recommended next task
DEMO-SP1-FOUNDER-01. Not started.
