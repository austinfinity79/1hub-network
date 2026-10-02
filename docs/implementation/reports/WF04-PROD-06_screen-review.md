# WF04-PROD-06_screen-review

**WF04-PROD-06 — visual impact map and per-screen review.** 2026-10-02, `cdcf17e` against the approved baseline: the released WF04 UI, production `78f21f2` ([DEC-W4P-D08](../../decisions/DECISION_LOG.md#dec-w4p-d08); `design-reference/final` has no WF04 frame, contract Q9). Both builds ran side by side with their own databases; `scripts/qa/wf04-visual-compare.mjs` captured 12 WF04 states and 10 cross-workflow states × 6 viewports on each and diffed every CSS-module component (box, font, colour, radius, border). Main report: [WF04-PROD-06_pixel-responsive.md](WF04-PROD-06_pixel-responsive.md).

## Visual impact map (PROD-02 → 05)
| Surface | Hardening change | Visible effect | Source |
|---|---|---|---|
| every WF04 screen | fixture → real API | demo notice and "Đặt lại demo" removed; "(demo)" copy gone | contract §16, PROD-04 |
| S01 list | `GET /programmes` | loading, error + "Thử lại", empty rows (same table) | D08 allowed states |
| S02 create | `POST`; archived owner | field errors, save failure + retry, unavailable state | D08, D13 #1 |
| S03 journey | `PATCH` | save failure + retry; Challenge hint no longer says "cần ít nhất một bài toán" | D08, Q7 / D12 |
| S04 events | read only | add / edit / remove controls removed | D13 #2 |
| S05 registration | `PUT`; lock; Q3(b) | demo application counts card removed; locked note; "Thêm câu hỏi" disabled | Q5 deferred, D13 #3, D14 |
| S06 team | no programme role | empty state instead of demo operators | Q4 deferred, D13 #7 |
| S07 review | `POST …/publish` | 4 checks instead of 5; publish failure + retry | Q7 / D12, D08 |
| S08 detail / basic | real data; close | no close control; CLOSED and archived owner read only | D14, D13 #1 |
| unknown id / member | server 404 | the ordinary 404 inside the shell | API A5 |
| DemoPage frame (shared with WF05 demo) | `notice` optional | WF04 off; WF05 demo unchanged (notice kept) | PROD-04 |

## Per-screen classification
| Screen / state | 1440 | 1024 | 768 | 430 | 390 | 320 |
|---|---|---|---|---|---|---|
| S01 list | PASS | PASS | PASS | PASS | PASS | PASS |
| S02 create | PASS | PASS | PASS | PASS | PASS | PRE-EXISTING (16 px, = baseline) |
| S03 journey (Programme, Challenge) | PASS | PASS | PASS | PASS | PASS | PASS |
| S04 events | PASS (intentional: read only) | PASS | PASS | PASS | PASS | PASS |
| S05 registration | PASS (intentional: counts card) | PASS | PASS | PASS | PASS | PRE-EXISTING (17 px, = baseline) |
| S06 team | PASS (intentional: empty state) | PASS | PASS | PASS | PASS | PASS |
| S07 review draft / published | PASS (intentional: 4 checks) | PASS | PASS | PASS | PASS | PRE-EXISTING (20 / 39 px, = baseline) |
| S08 detail published / Challenge / basic | PASS | PASS | PASS | PASS | PASS | PRE-EXISTING (40 / 34 / 12 px; baseline 59 / 34 / 12) |

Matched components (header band, title / meta, stepper, card, card head, rows, inputs, primary / secondary buttons, status pills, chips, checklist): **0 font, colour, radius or border deltas** at any width, except S01's first pill, which is a different row (the API lists newest first): matched by status, "Bản nháp" and "Đang công khai" pills are identical in colour, border, 22 px height, 11 px / 500 and radius. Box deltas only where content differs (title length, row count) or from the approved intentional changes above. Classes used: no MINOR / MAJOR visual delta, no STRUCTURAL mismatch.

## 320 spot-check (pre-existing, not a regression)
The shared OpsShell keeps its 13.5rem sidebar at every width (no breakpoint; unchanged since `78f21f2`). At 320 the content column is about 72 px, and eight WF04 primitives that do not wrap push the page 10–40 px wide: `programme-form_typeOption`, `status-pill_pill`, `journey_editLink`, `journey_cardMeta`, `journey_textAction`, `journey_chip`, `journey_checkState`, `journey_publishText`. The baseline shows the same causes on the same screens, equal or larger; the PROD-06 spec pins them (`KNOWN_320`, ≤ 64 px), so they cannot spread. Not fixed here (contract §8 / §11: outside the hardening delta).

## Cross-workflow (same path on both builds)
| State | Result |
|---|---|
| WF05 demo list / detail / application (DemoPage frame) | 0 overflow at 6 widths; notice kept; deltas = data rows only |
| member apply → application (`/programmes/{id}/apply`) | same redirect, 0 component delta, 0 overflow at 6 widths |
| member home, settings, projects | member shell responsive: 0 overflow at 6 widths, 0 delta |
| WF02 project team | 0 delta; 320: 20 px overflow on both builds (pre-existing, WF02) |
| WF03 ops dashboard | 0 delta; 320: 40 px overflow on both builds (OpsShell) |

## Related
- [WF04-PROD-06_pixel-responsive.md](WF04-PROD-06_pixel-responsive.md) · [WF04-PROD-05_functional-security-qa.md](WF04-PROD-05_functional-security-qa.md) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md)
