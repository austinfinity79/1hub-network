# S2-TALENT-DIRECTORY-CLEANUP-01

Member talent directory (`/talents`) cleanup (Sprint 2, priority 04). NETWORK_ONLY privacy unchanged.

| Change | Where | Result |
|---|---|---|
| Hero | `components/discovery/talent-directory.tsx` | "các nhân tài trong mạng lưới"; the 3-number summary (có sản phẩm công khai / lĩnh vực / tỉnh/thành) removed, no replacement |
| Non-real people | `NON_REAL_TALENT_PROFILE_IDS` in `lib/public/talent-directory.ts` (directory only; rows kept) | Demo Member, Demo Leader, Demo Pending (seed accounts); Đặng Kim Chi, Nguyễn Minh Anh, Phạm Quốc Việt, Trần Hạnh, Lý Gia Bảo, Võ Thanh Hà (DEMO-0710) — none in any workbook sheet; never listed (their demo founder pages / Tracely team unchanged) |
| Lead talent | `PINNED_TALENT_PROFILE_ID` | Vũ Tuấn Anh first under every sort (existing profile, avatar, account, Smart Campus link reused) |
| Source-backed people | runtime data (`hubnetwork_demo_0710`) | 39 people from "Thư viện nhân tài" rows 3–42 (all rows with a portrait link, minus 1): non-login account (`talent-NNN@1hub.internal`, no password), ACTIVE profile (name, headline "Chức vụ · Đơn vị" as written, region / country only on an exact catalogue match + `TP.HCM` → TP. Hồ Chí Minh), NETWORK_ONLY visibility, "Lĩnh vực" as DOMAIN tags (7 new UNNORMALIZED labels), portrait as a 512 px WebP avatar asset (authorised media route); audit +39 |

## Backlog / gaps
- Row 29 Lê Mai Anh ("Học sinh", a high-school student): not published — needs PO confirmation and consent before a minor's name and photo are shown.
- 78 library rows without a portrait link (rows 43–120): left for a later pass (name / title / unit / region / field available, no image).
- Region not in the catalogue for 7 people (UAE, Bắc Kinh / Thượng Hải, Italia, Pháp, Séc): left empty.
- "Chuyên môn" (column I) is not a card field (D4): not imported.
- "Thành viên HUB_Orgchart" leadership data is not a directory field: not used here.

## Tests
`thao-05-discovery` DIR3 updated (personas absent, hero wording, filters on the remaining data) 20 / 20; `demo-sp1-founder-01`, `demo-qa-vertical-flow` pass.

## Related
- [TALENT-TUAN-ANH-MEMBER-ACCOUNT-01](TALENT-TUAN-ANH-MEMBER-ACCOUNT-01.md) · [THAO-05](THAO-05.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
