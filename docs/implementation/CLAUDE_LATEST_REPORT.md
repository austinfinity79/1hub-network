# Claude Task Report

## Task
DEMO-SOT-00 (+ DEMO-SOT-00-FIX) — freeze the 07/10 demo SOT, visual baseline and route / data contract. Report: [DEMO-SOT-00](reports/DEMO-SOT-00.md). SOT: [DEMO_SOT_v1](../demo-0710/DEMO_SOT_v1.md).

## Verdict
**BLOCKED** on one input only: the PO's UPDATED SP1 files (file 13 Chỉ số, file 12 Cập nhật) are not on the workstation, so DM11 / DM12 baselines could not be replaced.

| Area | State |
|---|---|
| SP1 mapping by meaning | locked |
| Founder Profile | PUBLIC VIEW, identity verification DEMO STATE ONLY |
| DEMO-D9 | approved and recorded |
| Stale SP1 copies | withdrawn |
| DEMO-HOME-ABOUT-01 | ready, not started |

Not pushed, not merged, not deployed. STOP.

## Scope implemented
- **FIX: SP1 lock.** Tổng quan = file 10, Chỉ số = UPDATED file 13, Cập nhật = UPDATED file 12, Founder = file 14 (DEMO-D14, DEC-DEMO-D5).
- **FIX: stale exports.** The duplicate-image conclusion is removed. The obsolete `DM11` / `DM12` PNGs are withdrawn from `design-reference/final/demo-0710/`.
- **FIX: Founder.** PUBLIC VIEW; owner-only controls are excluded from acceptance (DEMO-D13). Identity verification is DEMO STATE ONLY (DEMO-D10).
- **FIX: typography.** DEMO-D9 approved: Space Grotesk on the demo / public surfaces only, with no change to admin / member / ops (DEC-DEMO-D4).
- **FIX: About counts.** Ecosystem 5 / 6 / 7, 60+ vs 55 CLB and Đà Nẵng 7 vs 6 stay documented and are not blockers with canonical data.

## Files changed
- `docs/demo-0710/*` (6)
- `design-reference/final/demo-0710/README.md`, plus 2 PNG removed
- `DECISION_LOG.md`, `P0_STATUS.md`, `reports/DEMO-SOT-00.md`, this report

## Migrations / data
None. No database touched.

## Tests / build
Not applicable (no runtime change). `prettier --check` on the changed docs and a relative-link check: PASS.

## Visual QA
Not applicable. 11 baselines present (DM01–DM10, DM13); DM11 / DM12 pending the PO's files.

## Deviations / blockers
- **Blocker:** the UPDATED SP1 files 12 / 13. They block only DEMO-SP-TABS-01 and are needed to close this item.
- **For PO:** conflicts C1–C10 (advisory); C11 resolved.

## Git
- Branch: `feat/sprint1-completion` (worktree `../1hub-network-sprint1-completion`); start HEAD `4791f30`, unchanged by others
- Implementation commit: none (documentation task)
- Report/final commit: the DEMO-SOT-00-FIX docs commit
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: origin/main `edd3d24` (unchanged)
- Working tree: clean after the commit

## Recommended next task
DEMO-HOME-ABOUT-01. Supplying the UPDATED SP1 files 12 / 13 closes the remaining SP1 item. Not started.
