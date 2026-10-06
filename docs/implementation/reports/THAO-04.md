# THAO-04

About HUB v2 — production logic / data closure. No UI redesign; the DM02–DM05 composition of DEMO-HOME-ABOUT-01 is unchanged.

- Milestone: THAO-M1
- Branch / worktree: `feat/thao-m1-public-experience` / `../1hub-network-thao-m1`
- Base: `af51e42`
- Decisions: [DEC-THAO-ABOUT](../../decisions/DECISION_LOG.md#dec-thao-about)
- No migration, no canonical data changed; not merged, not deployed.

## Conflicts resolved (canonical data wins)
| # | Conflict | Before | Canonical value used | Source / code |
|---|---|---|---|---|
| 1 | Region board heading | "Ban điều hành HUB Network TP.HCM / Trung Quốc / Úc / Vương quốc Anh / Hoa Kỳ / UAE / Châu Âu" (chip label) | the catalogue name, e.g. "HUB Network Hồ Chí Minh", "HUB Network Úc (Australia)" | `organizations.name` · `about.tsx`, `about-humans.tsx` |
| 2 | Domestic HUBs | "HUB KHU VỰC TRONG NƯỚC · HÀ NỘI · ĐÀ NẴNG · HỒ CHÍ MINH" (DM04) | + QUẢNG NINH, from the catalogue's domestic regional HUBs in catalogue order | catalogue · `about-humans.tsx` |
| 3 | Partner wall names | "Chapter Cần Thơ" (no such unit), "Chapter Đà Nẵng" (a member HUB) | placeholders "Hiệp hội C", "Hiệp hội D"; repeats hidden from assistive technology | `about.tsx` (illustration, DEC-H1-R2-D2) |
| 4 | CLB / community count | frame 60+ · "Hơn 60" | 55 everywhere (hero, CLB tab, card list) — already canonical, verified | catalogue |
| 5 | HUB Đà Nẵng CLBs | frame 7 | 6 (popup, board, "Xem thêm") — verified | catalogue |
| 6 | Regional HUBs | 13 (S1-UAT-08A copy) | 11 HUB Khu vực (13 Chapters minus HighSchool, Business); markers, chips, popups, tabs all 11, no duplicate | catalogue · `REGIONAL_HUBS` |
| 7 | Ecosystem 5 / 6 / 7 | no count is displayed | the 7 rows of DEMO-D11 unchanged; the business list stays with the PO (SOT C1) | `about.tsx` |

## Logic and links
| Area | Result |
|---|---|
| Map / chips | 11 markers = 11 catalogue regional HUBs; positions presentation-only. Hà Nội was covered by Quảng Ninh (4.5 px) in the Thế giới view: an overlapping earlier HUB is now lifted, so all but Quảng Ninh are clickable there and every marker is clickable in the Việt Nam view |
| HUB popup | binds the clicked HUB: catalogue CLBs, workbook board, CTA `/organizations/[slug]`; close button, Escape, overlay, switching; body scroll restored |
| Humans tabs | HUB Tổng / HUB Khu vực (11 boards, catalogue CLB count) / Câu lạc bộ (55; "Xem tất cả") |
| Deep links (new) | every Chapter and CLB named on the page → `/organizations/[slug]` (13 + 55), all 200 |
| Partner links | facebook.com/1hubnetwork, 1hub.global/en, ihub.dream-lab.ai, ihub.ventures, deck.ihub.ventures (→ /login), vnv.ihub.ventures (→ /access): all 200, new tab, `noopener noreferrer` |
| READ_ONLY_APPROVED | Kết nối hợp tác ×2, Tìm thành viên, Xem thành viên HUB Tổng, Xem lịch sự kiện, APEC Innovation Challenge, iHUB Incubator, partner chips |

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build · unit | PASS · PASS · PASS · PASS · 459 / 459 |
| thao-04-about | 9 / 9 |
| Protected slice (thao-04, demo-home-about-01, thao-01, thao-02, thao-03, wf03-s09, p0-shell-navigation, alpha-interaction-gaps, public-library, demo-qa-vertical-flow, demo-dir2-01, demo-sp1-founder-01, s1-uat-02-feedback, m0-entry-01-root) | 14 specs, 176 / 176 |
| DM02 pixel (gated blocks) | unchanged, all below threshold |
| UAT L1–L2 | 19 / 19 |
| Runtime | console / hydration 0, 5xx 0 |

`demo-qa-vertical-flow`: the 390 px "Đà Nẵng marker" test was an expected failure (QA-B-04); it now passes, so the mark is removed as its comment asked.

## Related
- [THAO-03](THAO-03.md) · [DEMO-HOME-ABOUT-01](DEMO-HOME-ABOUT-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
