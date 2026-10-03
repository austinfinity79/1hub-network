# WF05-PROD-05_prod06-handoff

**Visual surfaces WF05-PROD-06 must cover** (prepared by WF05-PROD-05; pixel QA not started). Baseline rule: `design-reference/final` only, 1440×900 DPR1, CLAUDE.md §5–§6; deterministic data from the WF05 fixture (`src/lib/application/testing.ts`), never `d4…0001`.

## Routes and states
| Route | Screen | States to capture | Reference |
|---|---|---|---|
| `/demo/projects` | S01 | loading; no venture; ventures with applications incl. "(đã đóng)"; no open programme; error + "Thử lại"; EDIT / VIEW member rows | no approved frame (DEC-WF05-G1 composition): structural QA vs PROD-04 captures |
| `/demo/projects/{id}` | S02 | owner; member (NOT_OWNER hint); ARCHIVED venture banner; ineligible draft hint + "Xem đơn"; closed-programme rows; missing; error + "Thử lại" (title "Dự án & Startup") | same |
| `/programmes/{id}/apply` | SUB0 QuickTeam | one type (no radio), two types, client "Bắt buộc.", server reasons, failed alert | `revision/L5/L37__sub0-quick-team__SOURCE.png` |
| `/programmes/{id}/apply` | CHOOSE | several ventures, each state | no frame (TASK 24.4) |
| `/projects/{id}/applications/{pid}` | SUB1 | steps 01 / 02 / 03 as drawn (questions on steps 1, 3, 4); saving, saved, failed + "Thử lại"; read only (`NOT_PUBLISHED`, `ARCHIVED`, `TYPE_NOT_ACCEPTED`: alert, pill "Chỉ xem", no autosave card) | L38–L41 |
| `…/review` | SUB2 | ready, remaining, submitting, incomplete ("Chưa nộp được. Kiểm tra…"), error ("Chưa nộp được. Vui lòng thử lại.") | L42 |
| `…/submitted` | SUB3 | snapshot; link "Về Dự án & startup của tôi" → S01 | L43 |
| member pages with the sidebar | MemberShell / WorkspaceShell | entry "Dự án & Startup" without the demo group label (PROD-04) | WF02 approved frames |

## Viewports
1440×900 DPR1 for every row (pixel); 1024, 768, 390 for S01 / S02 (opt-in responsive) and the L5 screens (overflow, reachable actions — existing checks in `l5-startup-journey`, `wf05-s01`, `wf05-s02`).

## Cross-WF journeys
1. WF02 → WF05: `/me/settings` → "Dự án & Startup" → S01 → S02 → "Sửa hồ sơ" (WF02 editor) → back.
2. WF04 → WF05: apply → draft → submit → operator closes the programme (WF04 `POST …/close`) → S01 "(đã đóng)" → S02 closed row → SUB1 read only / SUB3.

## Known baseline, not WF05 regressions
- SHELL-MOBILE-01 (shared OpsShell / MemberShell mobile debt) and the unmerged `fix/member-shell-mobile` lane (`a957876`): separate P2; do not fix in WF05.
- WF04 OpsShell "DEMO · INTERNAL ALPHA" entry: WF04 scope, unchanged.
- The seed programme `d4…0001` and its "(demo)" name / "Internal Alpha" summary are local seed data, not UI copy.
- PROD-04 evidence captures (local, untracked): `tests/visual/actual/wf05-prod-04/`.

## Related
- [WF05-PROD-05_functional-security-qa.md](WF05-PROD-05_functional-security-qa.md) · [WF05-PROD-04_frontend-integration.md](WF05-PROD-04_frontend-integration.md)
