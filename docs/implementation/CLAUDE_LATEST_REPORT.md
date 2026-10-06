# Claude Task Report

## Task
DEMO-QA-01 — Final Demo QA, consolidated regression and freeze of the exact demo candidate. Report: [DEMO-QA-01](reports/DEMO-QA-01.md).

## Verdict
**PASS_WITH_EVIDENCE.**
- Full protected regression on `58da5d1`: 2646 tests, 2617 PASS, 0 FAIL, 29 SKIP, 0 FLAKY.
- Vertical demo QA: 115 / 115.
- P2 disposition:
  - QA-B-05 and QA-B-06 are fixed.
  - QA-B-04 is partly fixed: the remaining Thế giới-view domestic cluster is accepted as demo debt.
- Not pushed, merged or deployed. STOP.

## Final demo candidate
The commit that adds this report is the final demo candidate (FINAL_DEMO_CANDIDATE_SHA).
- It changes documentation only: its product tree equals `58da5d1`, the regressed SHA.
- It is the only SHA allowed into DEMO-DEPLOY-01.
- Do not modify it after the freeze.

## Scope implemented
- P2 fixes only (`58da5d1`): About map markers below 1024 px, founder row cue, 390 search placeholder, years wrap, bullet gap.
- No new feature.

## Files changed
- `58da5d1`:
  - `src/components/about/about.module.css`
  - `src/components/products/directory.{tsx,module.css}`
  - `src/app/(public)/products/[slug]/{page.tsx,startup.module.css}`
  - `src/app/(public)/talents/[handle]/founder.module.css`
- Freeze commit:
  - `docs/implementation/reports/DEMO-QA-01.md`
  - this file
  - P0_STATUS

## Migrations / data
- No migration. The last migration is still 020.
- The isolated `hubnetwork_s1uat03` was reset and seeded with the demo data step.
- The shared `hubnetwork_p0` is untouched: 17 migrations, 0 demo rows.

## Tests / build
| Suite | Total | Pass | Fail | Skip | Flaky |
|---|---|---|---|---|---|
| Visual (99 specs) | 1296 | 1267 | 0 | 29 | 0 |
| UAT L1–L2 | 19 | 19 | 0 | 0 | 0 |
| Unit | 458 | 458 | 0 | 0 | 0 |
| DB | 873 | 873 | 0 | 0 | 0 |

Format, lint, typecheck and build all PASS. Server log: hydration / 5xx / secret 0.

## Deviations / blockers
- **Blockers:** none for the candidate.
- **Deploy gate:** QA-B-02, the demo target and the demo-data policy, needs PO approval before DEMO-DEPLOY-01. QA-B-01 (`demo` data step class) stays open as a deploy-safety item.

## Git
- Branch: `feat/sprint1-completion` (worktree `../1hub-network-sprint1-completion`). Start HEAD `f309520`, unchanged by others.
- Implementation commit: `58da5d1`.
- Report/final commit: the freeze commit (FINAL_DEMO_CANDIDATE_SHA).
- Remote: `origin`.
- Push status: NOT RUN (task: no push).
- Remote HEAD: origin/main `edd3d24` (unchanged).
- Working tree: clean after the commit.

## Recommended next task
DEMO-DEPLOY-01, after the PO decision on QA-B-02. Not started.
