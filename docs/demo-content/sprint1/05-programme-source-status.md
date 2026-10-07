# Programme source status

Domain: Chương trình (cuộc thi khởi nghiệp, thử thách đổi mới sáng tạo). Source: `1hub.network - Tổng hợp thông tin sprint 1.xlsx`, sheet `Tổng hợp`, rows 5 (A5:A6, B5, C5, D5, F5:F6, G5:G6, H5:H6, I5).

| Item | Workbook says |
|---|---|
| Level of detail | "Thông tin cơ bản theo tag danh sách" |
| Target | "3-5 profile tag" |
| Data file | `F5` "1hub.network - Sự kiện, chương trình đã tổ chức" → external Google Sheet (link kept in the internal trace only) |
| Source of information | "Page Hub Network tổng, các KV" |
| Owner / status | Thảo · "Hoàn thiện" |
| UI illustration | `E5` "Link" → broken internal hyperlink `null!A1` |

**Status: REFERENCE_TO_EXTERNAL_FILE_ONLY.** No programme row exists in this workbook, so nothing is imported or created from the filename or the link.

## What Thảo still needs to provide
1. An export (xlsx / csv) of the "Sự kiện, chương trình đã tổ chức" sheet, programme rows only.
2. Per programme:
   - name;
   - type (cuộc thi / thử thách);
   - organiser unit (HUB Tổng / Chapter / CLB);
   - period (from – to);
   - status (đang mở / đã kết thúc);
   - one-line description;
   - eligibility or audience;
   - banner image file and its usage rights.
3. Confirmation of which 3–5 programmes to show, and that the copy is approved for public display.
4. A replacement for the broken illustration link `E5`, or confirmation that it can be dropped.

Note: the public Chương trình screen (DM06) is REFERENCE only in the 07/10 demo SOT.

## Related
- [event source status](06-event-source-status.md) · [validation report](10-validation-report.md)
