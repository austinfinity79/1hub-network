# L4 Challenge Inventory

TASK 24.3 inventory for `Luồng 4 - Challenge Operations.png` (PO, 29/09 19:26; 16440×9956, sha256 `22542ac8…680f0`). Business SOT: [DEC-2809-D4](../../design-revision/scope-refreeze/overview.md#d4) and the [programme matrix](../../design-revision/scope-refreeze/matrix-programme.md), DEC-WF04-H1…H5.

## Board frames
| Column (x) | Frame | Actor | Kind | Status |
|---|---|---|---|---|
| 120 | L28 CH1 challenge detail (with problem search, chapters, timeline, FAQ) | guest | public page | FUTURE (was B / HD-10) |
| 1920 | L29 P1 Đề bài (problem detail, "Nộp giải pháp", "Theo dõi bài toán") | guest / participant | public page, participant CTA | FUTURE (Problem entity) |
| 3720 · 5520 · 7320 · 9120 · 10920 | L30–L34 P1 tabs: Quyền lợi, Đơn vị, Hỏi – đáp, Cập nhật, Đội đã nộp | guest / participant | public page | FUTURE (Problem, Q&A, Updates, Submitted Teams) |
| 12720 | L35 CS1 chapter summit landing ("Đăng ký dự summit") | guest | public page | FUTURE (Summit) |
| 14520 | L36 CS2 summit registration form | participant | participant form | FUTURE (EventRegistration) |

The board holds **no operator-side frame** (no dashboard, configuration, applicant list, review or lifecycle view). The same nine screens were classified on 28/09: ALPHA 0 · FUTURE 9; the only L4 capability approved for Alpha is a public directory, and no L4 frame draws one.

## Ownership
| Frame part | Owner under TASK 24 |
|---|---|
| public challenge / problem / summit pages | public discovery (L6) once promoted |
| "Nộp giải pháp", "Đăng ký dự summit", CS2 form | participant side (L5) once promoted |
| operator lifecycle | L4: the existing WF04 operator demo `/demo/programmes/*` (S01–S08), not on this board |

## Current L4 implementation (unchanged)
WF04 operator demo: one canonical Programme / Challenge aggregate (subtype), read-only `GET /api/v1/demo/programmes[/{id}]` scoped by `programme:read`, operator edits in the browser session only (no database or audit writes), `/demo/programmes` guarded server-side. No scoring, winner, judging, matching or recommendation logic exists or is added.

## Human decisions (closed by the PO, 29/09)
| # | Decision |
|---|---|
| L4-H1 | L28–L36 stay FUTURE, participant-side reference only — [DEC-2909-L4H1](../../decisions/DECISION_LOG.md#dec-2909-l4h1) |
| L4-H2 | no real operator-side Challenge product in Alpha — [DEC-2909-L4H2](../../decisions/DECISION_LOG.md#dec-2909-l4h2) |

## Related
- [l3-clb-inventory.md](l3-clb-inventory.md) · [../reports/TASK-24.3_l4-challenge-closure.md](../reports/TASK-24.3_l4-challenge-closure.md)
