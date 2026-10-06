# DEMO-SOT-00

Freeze the 07/10 demo SOT, visual baseline and route / data contract. Documentation only: no runtime code, migration, push, merge or deploy.

## Inputs
| Input | Use |
|---|---|
| PO pack `~/Desktop/hub New Design 7:10/` (14 PNG, 06/10) | presentation SOT; 11 kept in `design-reference/final/demo-0710/` (DM01–DM10, DM13) |
| PO audit (DEMO-SOT-00-FIX, 06/10) | SP1 mapping by meaning, Founder PUBLIC VIEW, DEMO-D9 approved; earlier local SP1 exports obsolete |
| Thảo `1hubnetwork_thay-doi-tu-sprint1.docx` (06/10) | change list, spec IDs (HOME, ABT1, DIR0–DIR3, EV2, SP1, FP1) |
| Repository inventory (`afa5bea`) | routes, models, APIs, fixtures, decisions, specs |

## Results
| Item | Result |
|---|---|
| Authoritative screens / states | 13 (DM01–DM13) |
| MUST demo | DM01 Homepage v2, DM02 About v2, DM03 HUB popup, DM04 Humans · HUB Khu vực, DM05 Humans · Câu lạc bộ, DM08 Sản phẩm directory, DM10 startup Tổng quan, DM13 founder profile |
| SHOULD (read-only) | DM11 Chỉ số (UPDATED file 13), DM12 Cập nhật (UPDATED file 12); files pending |
| Reference only | DM06 Chương trình, DM07 Sự kiện, DM09 Nhân tài (P1) |
| Routes | frozen: 7 new public routes + 3 reserved; no existing route changed |
| Data | reuse of projects / project_members / individual_profiles / catalogue / library source; presentation fixtures in code; 3 startups, 6 fictional profiles; no migration |
| SOT conflicts | 11 (C1–C11), each with a demo handling rule |
| Missing inputs | 8 groups, led by the UPDATED SP1 files 12 / 13 (not on the workstation) |
| Blocker | none for DEMO-HOME-ABOUT-01; DEMO-SP-TABS-01 waits for the UPDATED SP1 files |

## Files
- New: `docs/demo-0710/` (6 files), `design-reference/final/demo-0710/` (11 PNG + README), this report.
- FIX: stale `DM11` / `DM12` PNG withdrawn; SP1 lock, PUBLIC VIEW, DEMO STATE ONLY, D9 approved (DEMO-D9, D13, D14; DEC-DEMO-D4, D5).
- Changed: `DECISION_LOG.md` (DEC-DEMO), `P0_STATUS.md`, `CLAUDE_LATEST_REPORT.md`.

## Related
- [DEMO_SOT_v1](../../demo-0710/DEMO_SOT_v1.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
