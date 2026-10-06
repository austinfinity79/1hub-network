# DEMO-SOT-00

Freeze the 07/10 demo SOT, visual baseline and route / data contract. Documentation only: no runtime code, migration, push, merge or deploy.

## Inputs
| Input | Use |
|---|---|
| PO pack `~/Desktop/hub New Design 7:10/` (14 PNG, 06/10) | presentation SOT; 13 copied to `design-reference/final/demo-0710/` (one byte-identical duplicate skipped) |
| Thảo `1hubnetwork_thay-doi-tu-sprint1.docx` (06/10) | change list, spec IDs (HOME, ABT1, DIR0–DIR3, EV2, SP1, FP1) |
| Repository inventory (`afa5bea`) | routes, models, APIs, fixtures, decisions, specs |

## Results
| Item | Result |
|---|---|
| Authoritative screens / states | 13 (DM01–DM13) |
| MUST demo | DM01 Homepage v2, DM02 About v2, DM03 HUB popup, DM04 Humans · HUB Khu vực, DM05 Humans · Câu lạc bộ, DM08 Sản phẩm directory, DM10 startup Tổng quan, DM13 founder profile |
| SHOULD (read-only) | DM11 Chỉ số (provisional frame), DM12 Cập nhật |
| Reference only | DM06 Chương trình, DM07 Sự kiện, DM09 Nhân tài (P1) |
| Routes | frozen: 7 new public routes + 3 reserved; no existing route changed |
| Data | reuse of projects / project_members / individual_profiles / catalogue / library source; presentation fixtures in code; 3 startups, 6 fictional profiles; no migration |
| SOT conflicts | 11 (C1–C11), each with a demo handling rule |
| Missing inputs | 8 groups; the updated Chỉ số frame is the only missing screen |
| Blocker | DEMO-D9 typography (extend DEC-HD-12) needs PO approval |

## Files
- New: `docs/demo-0710/` (6 files), `design-reference/final/demo-0710/` (13 PNG + README), this report.
- Changed: `DECISION_LOG.md` (DEC-DEMO), `P0_STATUS.md`, `CLAUDE_LATEST_REPORT.md`.

## Related
- [DEMO_SOT_v1](../../demo-0710/DEMO_SOT_v1.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
