# WF05-PROD-06_pixel-responsive

**WF05-PROD-06 — pixel, responsive and cross-WF regression.** 2026-10-03, branch `feat/wf05-prod-hardening` on `0e07dca` (PROD-05). QA only: no runtime code, API, DB, design or business rule changed. REAL_REGRESSION 0, NEW_WF05_REGRESSION 0. Screens, impact map and per-surface results: [WF05-PROD-06_screen-review.md](WF05-PROD-06_screen-review.md); closure handoff: [WF05-PROD-06_prod07-handoff.md](WF05-PROD-06_prod07-handoff.md).

## Preflight
| Check | Result |
|---|---|
| branch, HEAD | `feat/wf05-prod-hardening`, `0e07dca` (PROD-05) |
| tree, writer | clean except `AGENTS.md`; no other writer; Claude B `fb2130f` and `fix/member-shell-mobile` `a957876` not in HEAD |
| migrations | 001–016 |
| `origin/main`, production | `78f21f2`, `78f21f2` |
| runtime fixture dependency | 0 (PROD-04 grep, PROD-05 matrices) |
| SOT read | WF05 contract (PROD-01: "approved L5 frames and current S01 / S02 are the baseline"), PROD-04 / PROD-05 evidence, PROD-06 handoff, `design-reference/final/revision/L5` (L37–L43), SHELL-MOBILE-01 |

## Method
| Layer | Tool | Baseline |
|---|---|---|
| baseline vs candidate | `scripts/qa/wf05-visual-compare.mjs`: 24 states × 6 widths × 2 builds = 288 captures, side-by-side at 1440 / 768 / 390, layout facts, CSS-module component deltas, pixelmatch | `f40f70c` (start of the WF05 branch; its WF05 UI = production `78f21f2` + the WF04 frame changes approved in WF04-PROD-06), own DB 001–015 + seed on :3974; same data through each build's API, same vocabulary |
| approved L5 frames | `l5-startup-journey.spec` (anchor / pixel checks vs L37–L43) | `design-reference/final/revision/L5` |
| responsive + states | `tests/visual/specs/wf05-prod-visual.spec.ts`: 25 states × 6 widths (150) + 4 interaction / a11y tests | invariants: overflow 0, no escaping / overlapping control, no clipped text |
DPR 1, viewport height 900, fonts settled, `networkidle`.

## Pixel diff matrix (144 baseline / candidate pairs)
| Class | Pairs | Classification |
|---|---:|---|
| IDENTICAL (0 %) | 70 | — (SUB0 / CHOOSE / SUB1 1–3 / SUB2 / SUB3 / 404 / guest auth / WF02 edit + team / WF04 detail) |
| STRUCTURAL | 66 | INTENTIONAL_APPROVED_CHANGE: demo notice + reset removed, sidebar demo group removed (DEC-W5P-D02); closed-programme rows and SUB1 read mode (G25); "Bản nháp" wording (G27); read-only pill "Chỉ xem", no autosave card (PROD-04) |
| MAJOR | 0 | — |
| COMPONENT | 0 | no font, colour, background, radius or border change on any component |
| MINOR | 8 | 6 INTENTIONAL (SUB1 step 4 "Quay lại bước 02", was 03: G27 fix); 2 BASELINE_VARIANCE (select anti-aliasing, 0.04 % at 430 / 390) |
| **REAL_REGRESSION** | **0** | |
Mismatch range: S01 / S02 1.4–4.2 % (content moves up when the notice goes; heights −3 … −443 px); SUB1 archived 0.15–0.37 %; SUB1 closed is a new read-only state (baseline 404). Content variance (vocabulary order) was removed by using the same slugs on both builds.

## Responsive matrix (candidate)
| Width | States | Overflow | Escaping / overlap / clipped | Result |
|---|---:|---:|---:|---|
| 1440 / 1024 / 768 / 430 / 390 / 320 | 25 spec + 24 compare each | 0 on every WF05 state | 0 | PASS |
Only non-WF05 rows show anything: WF02 project team at 320 overflows 9 px ("Mời thành viên", editor header actions), identical on the baseline (pre-existing WF02, also in WF04-PROD-06).

## SHELL-MOBILE-01 separation
| Finding | Class |
|---|---|
| S01 / S02 in MemberShell (`responsive`): 0 overflow at 320–430 on both builds | no finding |
| L5 screens (no shell): 0 overflow | no finding |
| WF02 team 9 px at 320 | KNOWN_SHARED_BASELINE (pre-existing WF02 page, identical baseline) |
| WF04 OpsShell "DEMO · INTERNAL ALPHA" entry on the programme detail | KNOWN_SHARED_BASELINE (WF04 scope, unchanged by contract) |
| sidebar stacked above content at ≤ 430 (MemberShell / WorkspaceShell) | ACCEPTABLE_LAYOUT_VARIANCE (shell design, unchanged; only the demo label removed) |
NEW_WF05_REGRESSION = 0.

## Findings
| # | Finding | Class | Action |
|---|---|---|---|
| 1 | visual / responsive / cross-WF regression | — | none |
| 2 | S01 venture-name link (`venture-detail`) has no visible focus ring; identical on `f40f70c` (since WF05-S02) | pre-existing a11y gap (P2) | reported; pinned in the spec, not changed (QA task) |
| 3 | WF02 team 9 px at 320; WF04 OpsShell demo entry | KNOWN_SHARED_BASELINE | reported |
| 4 | first spec run: 151 false failures from Next's off-screen route announcer (`role="alert"`) matched by the test | test defect | selector scoped to page content |

## Related
- [WF05-PROD-06_screen-review.md](WF05-PROD-06_screen-review.md) · [WF05-PROD-06_prod07-handoff.md](WF05-PROD-06_prod07-handoff.md) · [WF05-PROD-05_prod06-handoff.md](WF05-PROD-05_prod06-handoff.md) · [WF04-PROD-06_pixel-responsive.md](WF04-PROD-06_pixel-responsive.md)
