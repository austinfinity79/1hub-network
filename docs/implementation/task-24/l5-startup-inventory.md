# L5 Startup Inventory

TASK 24.4 screen map for `Luồng 5 - Startup Journey.png` (PO, 29/09 19:26; 16440×2071, sha256 `9a269e7d…59b4d8`). Business SOT: [DEC-2809-D5 / D6](../../design-revision/scope-refreeze/overview.md#d5), the [application matrix](../../design-revision/scope-refreeze/matrix-application.md), [DEC-2909](../../decisions/DECISION_LOG.md#dec-2909) and the PO answers of 29/09 ([DEC-L5-D1](../../decisions/DECISION_LOG.md#dec-l5-d1)). Contract: [l5-startup-contract.md](l5-startup-contract.md).

## Frames
| Frame (board x) | Screen | Baseline | Status |
|---|---|---|---|
| 120 | L37 SUB0 quick team | `L5/L37__sub0-quick-team__SOURCE.png` 1440×934 | ALPHA |
| 1920 · 3720 · 5520 · 7320 | L38–L41 SUB1 B1 Hiểu đề · B2 Cách giải · B3 Đội & kế hoạch · B4 Cần hỗ trợ gì | `L5/L38…L41__*` 1440×899 / 1131 / 1013 / 1096 | ALPHA |
| 9120 | L42 SUB2 review | `L5/L42__sub2-review__SOURCE.png` 1440×983 | ALPHA |
| 10920 | L43 SUB3 submitted | `L5/L43__sub3-submitted__SOURCE.png` 1440×984 | ALPHA |
| 12720 · 14520 | L44 / L45 SP1 public startup profile | — | FUTURE |

## Map
| Frame | User goal | Route | Entity | API | Mutation | Next state |
|---|---|---|---|---|---|---|
| L37 | apply without an eligible venture | `/programmes/:programmeId/apply` | Venture (canonical) | `POST /ventures`, `POST /applications` | a DRAFT venture (owner = me); the form's first save creates the DRAFT application | L38 |
| (entry) | apply with an eligible venture | same | Application | server read of the member's ventures | none: one venture opens its form or its L43, several a choice | L38, or L43 when SUBMITTED |
| L38–L41 | answer the programme's questions | `/projects/:id/applications/:programmeId?buoc=1..4` | Application | `GET` / `PATCH /applications/{id}` | answers saved (DRAFT only) | next step; L42 |
| L42 | check and submit | `…/review` | Application | `POST /applications/{id}/submit` | SUBMITTED + snapshot, once | L43 |
| L43 | confirmation, read-only | `…/submitted` | Application (snapshot) | `GET /applications/{id}` | none | — |

## Drawn but not rendered (no approved data or rule)
| Element | Reason |
|---|---|
| "Nộp giải pháp" to a Problem, problem brief boxes, "Mở lại đề bài" | Problem is FUTURE ([DEC-2909-L4H1](../../decisions/DECISION_LOG.md#dec-2909-l4h1)); the form applies to the Programme |
| S1–S6 fixed schema with word limits, milestone table, support checklist | the programme's configured questions are the form (HD-A8) |
| diagram upload, attachments | no uploads (HD-A8) |
| countdown "Còn 12 ngày 4 giờ", timeline dates | no application deadline on the server programme |
| commitment checkboxes on L42 | no approved consent text or record |
| profile completion "62%" | no field count ([DEC-PDF-D3](../../decisions/DECISION_LOG.md#dec-pdf-d3)) |
| application code "SP-2026-0142", confirmation e-mail | no code, no e-mail (HD-A8) |
| "Nộp xong vẫn sửa được đến hạn" | SUBMITTED is final (HD-A8) |

## Related
- [l5-startup-contract.md](l5-startup-contract.md) · [l4-challenge-inventory.md](l4-challenge-inventory.md)
