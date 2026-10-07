# Talent source status

Domain: Nhân tài. Source: `1hub.network - Tổng hợp thông tin sprint 1.xlsx`, sheet `Tổng hợp`, rows 9–10 (A9:B10, C9, D9, F9:F10, G9, G10, H9, H10, I9, I10, J10).

| Item | Workbook says |
|---|---|
| Detailed profile | "Thông tin rất chi tiết" · "1 profile chi tiết" · source "Tuấn Anh 1Hub" · Thảo · **"Đang tổng hợp thông tin"** |
| List | "Thông tin cơ bản theo tag danh sách" · "100 profile tag" · source "Data member HUB Network" · Đức, Tâm · "Hoàn thiện" |
| Data files | `F9` "1hub.network - Nhân tài" (external Google Sheet); `J10` "HUB \| Human of HUB" (external Google Sheet). Links kept in the internal trace only |

**Status: REFERENCE_TO_EXTERNAL_FILE_ONLY.** No talent row exists in this workbook. The detailed profile is still being compiled.

## Blocking constraints before any import (not decided here)
- **Public profiles of real members.** Real members have no public profile (P0, US-02.01-AC04, DEC-WF02-H3). The 07/10 demo renders only the fictional allow-list on `/talents/[handle]` (DEC-DEMO-SP1-D1, OUT_OF_SCOPE_POST_DEMO). Publishing 100 real member profiles needs an explicit PO decision and each person's consent.
- **Identity.** No "verified identity" may be shown for a real person (DEMO-D10: demo state only).

## What Thảo still needs to provide
1. An export of "1hub.network - Nhân tài" and of the member list.
2. Per person:
   - full name;
   - title / role;
   - organisation;
   - HUB unit;
   - region;
   - expertise tags (1–5, free text);
   - short bio;
   - portrait, with a consent flag for public display.
3. The finished detailed profile from Tuấn Anh (1Hub), with consent.
4. The PO decision on whether real people appear publicly in Sprint 1 at all.

## Related
- [homepage / About source status](08-homepage-about-source-status.md) · [validation report](10-validation-report.md)
