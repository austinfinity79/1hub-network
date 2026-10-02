# WF04-PROD-06_pixel-responsive

**WF04-PROD-06 — pixel, responsive and protected regression.** 2026-10-02, branch `feat/wf04-prod-hardening` on `cdcf17e` (PROD-05). QA only: no runtime code, API, DB, design or business rule changed. Visual regressions 0, responsive regressions 0; pre-existing small-width limits of the shared OpsShell reported separately. Per-screen review and impact map: [WF04-PROD-06_screen-review.md](WF04-PROD-06_screen-review.md). Not pushed, not deployed.

## Preflight
| Check | Result |
|---|---|
| branch, HEAD | `feat/wf04-prod-hardening`, `cdcf17e057f9cdd00204f752a8e984ee7286282e` (PROD-05); the contract quotes `…52a8c984ce…`, an object that does not exist: same commit, two hex digits mistyped |
| tree, writer | clean except `AGENTS.md`; reflog and worktree list show no other writer |
| frozen baselines | `origin/main` `78f21f2`, production `78f21f2` |
| runtime fixture dependency | 0 (T00 static scan, PROD-05) |

## Evidence pack
| Gate | Result | Evidence |
|---|---|---|
| Preflight | PASS | above |
| Visual impact map | PASS | screen-review: 11 surfaces, each change traced to D08 / D12 / D13 / D14 / §16 |
| 1440 | PASS | 17 states; baseline diff: intentional deltas only; 8 ADM5 pixel tests |
| 1024 | PASS | 17 states, 0 overflow / escape / overlap / clip |
| 768 | PASS | idem; 7 existing 768 / 390 tests |
| 430 | PASS | idem |
| 390 | PASS | idem + 11 interaction states |
| 320 | PASS, no regression | pre-existing overflow 10–40 px on 7 states, same causes as the baseline (59 px there at most); pinned |
| Programme list/detail | PASS | S01, S08 identical structure to baseline |
| Create/edit | PASS | S02, S08 basic, S03: errors, save failure + retry inside the viewport |
| Publish states | PASS | S07 ready / incomplete (disabled publish) / published |
| Closed/read-only state | PASS | CLOSED: status visible, no manage / publish / close control |
| Challenge | PASS | S03 problems, S08 Challenge card |
| Application/Form | PASS | S05 configured / locked; Q3(b) "Thêm câu hỏi" disabled + `aria-disabled` |
| Loading/error/empty | PASS | list loading, API error + retry, empty, 404 inside the shell |
| Close UI absent | PASS | 0 close control (incl. hidden) on 17 states × 6 widths and both builds' captures |
| Shared shell | PASS (WF04 delta 0) | OpsShell / member shell files unchanged since `78f21f2`; OpsShell desktop-first limits reported below |
| Cross-WF integration | PASS | apply → application, WF05 demo frame, member shell, WF03 dashboard: 0 delta |
| Protected regression | PASS | 64 specs / 797 tests, UAT 19/19; 5xx, console, hydration 0 |

## Counts
| Kind | Tests |
|---|---:|
| Pixel | 8 ADM5 segment tests (S01–S08, 1440) + 132 baseline / current capture pairs (22 states × 6 widths) |
| Responsive | 102 viewport-matrix tests (17 states × 6 widths) + 7 existing 768 / 390 |
| Visual states | 22 (11 × 1440 / 390) |
| Regression | 64 specs / 797, UAT 19, unit 307, DB 509 |

## Findings
| # | Finding | Class | Action |
|---|---|---|---|
| 1 | product visual / responsive regression | — | none found |
| 2 | 320: eight WF04 primitives do not wrap (10–40 px) | pre-existing (baseline 12–59 px) | reported; pinned by `KNOWN_320` |
| 3 | OpsShell keeps a 13.5rem sidebar at all widths: WF04 content column ≈ 142 px at 390, ≈ 72 px at 320; WF03 dashboard 40 px overflow at 320 | pre-existing global shell (IA-L1, "ops shell desktop-first") | reported separately; not fixed (contract §8) |
| 4 | S01 loading / empty sentence is a table row: at ≤ 430 it starts visible and continues in the table's horizontal scroll | pre-existing (identical position in baseline) | reported |
| 5 | member-shell mobile overflow (earlier IA finding) | already fixed before `78f21f2` | member home, settings, projects: 0 overflow at 6 widths; WF02 project team 20 px at 320 on both builds (pre-existing, WF02, reported) |

## Decisions for the PO
- Q3(b): DEFERRED, add-question disabled; surface again at PROD-07.
- Whether the OpsShell gets a small-screen layout (findings 2–4) in a separate shell task; WF04 itself needs none.
- Q9: this task applied the method the contract gives (the accepted UI, D08) with the released build `78f21f2` as the pixel baseline; no WF04 bitmap exists. Recording it as the closed Q9 answer is the PO's call.

## Related
- [WF04-PROD-06_screen-review.md](WF04-PROD-06_screen-review.md) · [WF04-PROD-05_functional-security-qa.md](WF04-PROD-05_functional-security-qa.md) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
