# PRODUCT-DETAIL-SMART-CAMPUS-01

`/products/1hub-smart-campus-solution` gets a production detail from its approved source blocks; Vũ Tuấn Anh's founder page can show an avatar (TALENT-TUAN-ANH-PHOTO-01, photo pending).

| Item | Value |
|---|---|
| Source | `1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx` (sha256 `4b023eaf…`), "Sản phẩm chi tiết" r3; block decisions from the readiness audit (`docs/data/product-detail-readiness-audit.md`, branch `qa/product-detail-readiness`) |
| Rendered | slogan H (eyebrow), one-line description I (tagline), problem N and solution O (Retention / Use case), vision R, needs M, website B `https://1hub.global/en` (new rail card, new tab), stage "Thử nghiệm" (PO), region TP. Hà Nội (G), sector Giáo dục (PO lock), logo (bound), team under DEC-THAO-SP-D1 (members only) |
| Hidden | founding date E, funding F/K, highlights J, milestones L, market P, metrics W–Y (quarantined); customer voice Q and updates Z (held); no market, quarter, funding, milestones, quotes or recruitment block is drawn |
| Code | `startup-overview.ts`: optional blocks (`market`, `quarter`, `funding`, `stageLabel`, `website`, problem `items`) + the Smart Campus entry; `/products/[slug]`: a missing block is not drawn; `startup-frame.tsx`: `stageLabel`; Tracely unchanged |
| DB (`hubnetwork_demo_0710`) | `projects` 1 row (Smart Campus): stage GROWTH → PILOT, region null → hanoi; `audit_events` +1 (before / after) |
| Talent photo | `founder-data.ts` + `/talents/[handle]`: the profile's `avatar_asset_id` through `/media/assets/:id` (authorised: guests 404); no photo file reached the session, so no asset is ingested yet |
| Tests | `product-detail-smart-campus` (new, 1440 / 390), `thao-06-startup-profile`, `demo-sp1-founder-01`: 37 / 37 |

Note: product cards keep the global short label "Pilot" for the PILOT stage; the detail shows the PO's "Thử nghiệm".

## Related
- [TALENT-TUAN-ANH-MEMBER-ACCOUNT-01](TALENT-TUAN-ANH-MEMBER-ACCOUNT-01.md) · [THAO-06](THAO-06.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
