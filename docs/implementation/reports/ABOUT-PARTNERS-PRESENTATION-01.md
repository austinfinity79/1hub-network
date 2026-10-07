# ABOUT-PARTNERS-PRESENTATION-01

About: the placeholder partner wall is removed and the ecosystem rows without a URL no longer look clickable. UI only; no DB change.

| Item | Value |
|---|---|
| Source audit | workbooks "Tổng hợp thông tin sprint 1" (both variants, every sheet), `content/`, `src/lib/public/routes.ts`, DECISION_LOG, DEMO_SOT: **no approved partner list** (DEC-THAO-ABOUT-D4 "Real partners await PO data"; university names in the sheets are talents' education, not partners) and **no iHUB Incubator URL** (DEMO_SOT C2 "iHUB Incubator none, APEC none") |
| Partner wall | the DM02 placeholder wall ("Doanh nghiệp A", "Tập đoàn C", "Đại học A", "Hiệp hội B", "Chương trình A" …) and its "Dữ liệu minh hoạ" label are no longer rendered; data and CSS removed |
| Ecosystem | rows with a supplied URL (1Hub, AI - Cofounder, Builder Camp, iHUB Ventures, Vietnam's National Ventures) unchanged; iHUB Incubator and APEC Innovation Challenge (same pattern, acceptance CP-3) render as plain rows: label, name and text kept, no arrow, no INERT control, no hover |
| Kept | hero stat "200+ đối tác trong hệ sinh thái" (S1-UAT-08A copy), "Kết nối hợp tác" CTAs, all other sections |
| Tests | `thao-04-about` (plain rows; no wall, no placeholder text), `demo-home-about-01` (wall gone; report-only "11-partners" pixel segment retired): 25 / 26 — the one failure is the pre-existing homepage hero counter typography (IBM Plex Mono 400), unrelated |

## Related
- [THAO-04](THAO-04.md) · [PUBLIC-CONTENT-PUBLISH-01](PUBLIC-CONTENT-PUBLISH-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
