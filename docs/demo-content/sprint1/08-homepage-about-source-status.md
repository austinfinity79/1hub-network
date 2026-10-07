# Homepage and About source status

Source: `1hub.network - Tổng hợp thông tin sprint 1.xlsx`, sheet `Tổng hợp`, rows 3 and 11–15. Every link below is kept in `internal/source-trace.json` (cell, host, fingerprint), not here.

## Homepage
| Item | Workbook says |
|---|---|
| Content | "Logo sản phẩm, banner chương trình, recap tin tức" · "Ảnh tương ứng" · target "30 ảnh" |
| Data file | `F11` "1hub.network - homepage" (external Google Sheet) |
| Owner / status | Thảo · **"Đang tổng hợp thông tin"** |

**Status: REFERENCE_TO_EXTERNAL_FILE_ONLY.** Thảo still needs to provide:
- the 30 image files, each mapped to its entity (product / programme / news item);
- the usage rights for each image;
- the news recap text, with date and source;
- which product logos match which of the 93 selected products, by exact product name.

## About
| Row | Item | Target | Data | Status |
|---|---|---|---|---|
| 12 | Nhân sự theo org chart (ảnh Leaders) | "30 ảnh, tên, title tương ứng" | `F12` Drive folder "Human of Hub / Nhân sự theo org chart" | Hoàn thiện |
| 13 | Ảnh milestones | "7 ảnh" | `F13` Drive folder "Dấu ấn - 5 năm kết nối" | Hoàn thiện |
| 14 | Logo chỗ Hub Biz | "10 logo" | `F14` Drive folder "logo HanoiBA" | Hoàn thiện (Tâm) |
| 15 | Quy mô cộng đồng · logo các HUB Khu vực | "11 khu vực" | `F15` Drive folder "Logo \| Hub khu vực" | Hoàn thiện |

**Status: REFERENCE_TO_EXTERNAL_FILE_ONLY** (asset folders only; no names or titles are in this workbook). About already uses S1-UAT-08A data from "Thông tin About Hub.xlsx" (DEC-S1H). To import these assets, Thảo still needs to provide:
1. the files themselves, exported from Drive;
2. a mapping from each filename to a person, milestone, partner or HUB, using the catalogue names (11 regional HUBs);
3. confirmation that people photos and partner logos may be published.

Note: `A3` "FILE ẢNH: LINK" points to a general image folder with no mapping. It is treated as a source reference, not as assets.

## Related
- [talent source status](07-talent-source-status.md) · [asset manifest](09-asset-manifest.csv) · [validation report](10-validation-report.md)
