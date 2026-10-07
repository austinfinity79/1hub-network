# Event source status

Domain: Sự kiện. Source: `1hub.network - Tổng hợp thông tin sprint 1.xlsx`, sheet `Tổng hợp`, row 6 (B6, C6, D6, I6; F5:F6 and G5:G6 merged with the programme row).

| Item | Workbook says |
|---|---|
| Level of detail | "Thông tin cơ bản theo tag danh sách" |
| Target | "30 event tag" |
| Data file | same external Google Sheet as programmes: "1hub.network - Sự kiện, chương trình đã tổ chức" (`F5:F6`, link kept in the internal trace only) |
| Source of information | "Page Hub Network tổng, các KV" (merged `G5:G6`) |
| Status | "Hoàn thiện" |

**Status: REFERENCE_TO_EXTERNAL_FILE_ONLY.** The workbook holds no event row. No event record is created from the filename.

## What Thảo still needs to provide
1. An export of the external sheet's event rows (30 targeted).
2. Per event:
   - name;
   - date;
   - place, or online;
   - organiser unit (HUB Tổng / Chapter / CLB);
   - linked programme, if any;
   - one-line description;
   - cover image and its rights.
3. Whether past events may be shown publicly with photos (consent for people in the photos).
4. Reconciliation with the 43 S1-UAT-08A "Hoạt động tiêu biểu" already on About, to avoid two lists of the same events.

Note: the public Sự kiện screen (DM07) is REFERENCE only in the 07/10 demo SOT.

## Related
- [programme source status](05-programme-source-status.md) · [validation report](10-validation-report.md)
