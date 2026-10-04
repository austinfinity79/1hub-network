# ADMIN-DESIGN-01-known-debt

**Visual debt deliberately left in the candidate baseline (not regressions).** Parent: [ADMIN-DESIGN-01-visual-baseline.md](ADMIN-DESIGN-01-visual-baseline.md).

| # | Item | Class | Why not fixed here | Owner |
|---|---|---|---|---|
| 1 | 390 px: fixed 216 px OpsShell sidebar leaves a 174 px column; content scrolls inside it | PRE_EXISTING_OPSSHELL_DEBT | global shell decision (collapsible nav), shared with WF03 | shell / PO |
| 2 | 768 px: wide tables scroll inside their card | ACCEPTABLE_DESKTOP_FIRST | same as WF03 members; Admin is desktop-first | — |
| 3 | Access table shows capability codes verbatim (`membership:confirm`) and the grantor as a profile id | ACCEPTABLE (content) | labels / names need copy approval or an API field; not a visual-only change | PO copy / PROD-08 |
| 4 | Denied / not-found states show the notice without the page title | ACCEPTABLE | shared admin notice, same on every module | — |
| 5 | Error state hides the subtitle (count unknown), so the filter row moves up one line | ACCEPTABLE | state-driven, consistent across queues | — |
| 6 | Approve is a single click (no confirm) | ACCEPTABLE | not destructive; PROD-07 decision | — |
| 7 | No modal dialog / drawer pattern | BY DESIGN | inline confirm idiom (PD-8, WF03) | — |
| 8 | Priority "Cao" chip uses two admin-only tints (`#fdecea` / `#f0c9c6`) | ACCEPTABLE | inside the 1hub red family; subjective to change | — |
| 9 | Fixture names (`ADM02 memberA`, `ADM02 chapter-a`) appear in frames | ACCEPTABLE (fixture) | deterministic QA fixture, never production roster names (CLAUDE.md §8) | — |
| 10 | Frames are date-pinned (28/09/2026, week 2026-W40); a feedback screenshot frame is not captured because retention is real-time | NOTE | PROD-08 must use the capture spec (pins dates) or mask dates | PROD-08 |

## Related
- [ADMIN-DESIGN-01-visual-baseline.md](ADMIN-DESIGN-01-visual-baseline.md) · [ADMIN-DESIGN-01-route-state-matrix.md](ADMIN-DESIGN-01-route-state-matrix.md)
