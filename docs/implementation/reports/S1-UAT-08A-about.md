# S1-UAT-08A about

Sprint1 P0 HIGH: `/about` "Humans of HUB" and "Hoạt động tiêu biểu" refreshed from the PO workbook "Thông tin About Hub.xlsx" (sheets "Human of HUB", "HUB_events_2026"; sha256 `2fadf798…51dc`). Nothing invented, anomalies reported not corrected. Tests, PO pack and git: [S1-UAT-08A-evidence](S1-UAT-08A-evidence.md). Tables: [humans](S1-UAT-08A-humans.md) · [activities](S1-UAT-08A-activities.md).

## Preflight
| Check | Result |
|---|---|
| Base | `ad5dc06` (S1-UAT-02 final); worktree `../1hub-network-s1-about`, branch `feat/s1-uat-08a-about`; tree clean |
| DB | isolated `hubnetwork_s1about` (001 → 018); shared `hubnetwork_p0` untouched (017) |
| Writers | no other session on this worktree / DB; origin/main `edd3d24`, production `78f21f2` not touched |

## Current About audit
| Item | Found |
|---|---|
| CURRENT_ABOUT_STRUCTURE | hero · missions · org diagram (SVG, HUB nodes + lead panel) · Humans carousel (term tabs) · activities strip (filters) · CTA |
| DATA_SOURCE | static config `src/components/about/about-data.ts` + local photos under `public/about/` |
| STATIC_CONTENT | Humans and activities were hand-written placeholders (4 sample activities, 34 portraits by file name) |
| API_DEPENDENCY | none for content; the page reads only the landing entry, HUB slugs and legal links |

## Approach
| Piece | Role |
|---|---|
| `about-source.ts` | generated once from the workbook: every cell verbatim; "Link liên quan (bỏ)" not transcribed |
| `about-data.ts` | presentation only: trim, line break → space, a single D/M/YYYY date zero-padded; filters / mapping |
| `about-client.tsx` / `.module.css` | same layout and design system; new ĐỊA ĐIỂM fact, multi-organiser lines, 16:9 banner on narrow screens |
| `public/about/activities/activity-01…43.webp` | the workbook's 43 Drive images, downloaded once, 1280 px WebP (no hotlinking) |
No CMS, no table, no Event / Programme / Project record, no migration.

## Humans of HUB
- 36 rows → **34 shown** ("Nhiệm kỳ hiện tại"), order 1 … 34 as "Thứ tự hiển thị"; names / titles / flags as written ([table](S1-UAT-08A-humans.md)).
- Excluded: Ngô Trí Nguyên, Phùng Thị Ngọc Linh ("Các thế hệ trước", "Bỏ"). The "Các thế hệ trước" tab therefore lists nobody.
- Flags kept as source data: "Bổ sung" × 4, "Đảo vị trí" × 30 (the order column already reflects it).
- Portraits: exact name match with the existing photo pack only → 31 photos; **no photo** for Phạm Thành Long, Lê Mai Anh, Trần T. Bích Ngọc (placeholder).

## Org diagram
| Link (workbook) | Node | Lead shown |
|---|---|---|
| Trưởng HUB Biz · HCMC · ĐN · HN | BIZ · HCM · DN · HN | Bùi Hà Phương · Huỳnh Đức · Phạm Khánh Vân · **Vũ Minh Tâm** (A4, PO) |
| Trưởng HUB USA · UAE · UK · Australia · EU | US · UAE · UK · AU · EU | Đào Việt Tùng · Lê Diệu Anh · Nguyễn Mạnh Hùng · Nguyễn Vũ Hà Vy · Vũ Bích Diệp |
| Trưởng HUB HighSchool | THPT | Lê Mai Anh |
| Trưởng HUB China | CN | **not mapped** (placeholder) |
| Trưởng HUB Tổng | — | not mapped: the root node has no lead slot |
| (no link) | SG · QN | placeholder |

## RESOLVED_BY_PO
| # | Item | Resolution |
|---|---|---|
| A4 | HN lead: the ABOUT-HUB-LEAD hotfix showed Le Phuong Thao; the workbook links Vũ Minh Tâm | **PO frozen (05/10), About content only:** Vũ Minh Tâm = Trưởng HUB HN; Lê Phương Thảo = Phó Chủ tịch kiêm Tổng Thư ký HUB Tổng. Rendered from the workbook; the old hard-coded HN lead is gone |

A4 scope: About presentation only. Memberships, leadership, RoleVerificationRequest, RBAC, Admin and WF03 data unchanged. CROSS_DOMAIN_DATA_DIFFERENCE: none locally (no profile of either person in `hubnetwork_p0` or `hubnetwork_s1about`); production runtime data not inspected (out of scope, no access).

## UNRESOLVED_SOURCE_ANOMALY (reported, not corrected)
| # | Anomaly | Handling |
|---|---|---|
| A1 | Two "Chủ tịch HUB Network UAE" (Lê Diệu Anh, Lâm Mỹ Kỳ) | both shown as written; UAE lead = the linked Lê Diệu Anh |
| A2 | "Trưởng HUB China" links Phan Phương (Phó Chủ tịch) while Lê Đức Anh is "Chủ tịch HUB Network China" | CN lead left empty |
| A3 | Nguyễn Hoàng Khánh "Chủ tịch HUB Network Singapore" has no link | SG lead left empty |
| A5 | Naming: "HUB Network AU" / "HUB Network Úc" / "Australia"; "HCMC" vs "HCM"; "HighSchool" vs node "THPT" | shown as written |
| A6 | Row 36 date "21/22/2024" (no month 22) | shown as written, flagged in data |
| A7 | Missing ĐỊA ĐIỂM rows 10, 15; missing VAI TRÒ HUB rows 34, 39 | "Chờ cập nhật" |
| A8 | Tag "Chuỗi sự kiện" (3 rows) not in the old filters; "Chương trình" has 0 rows | new filter; empty state kept |
| A9 | Title spacing / "Cuôc" spelling, trailing spaces in titles / organisers | trimmed only; spelling kept |
| A10 | Phạm Thành Long has no exact portrait (a `thanh-long.webp` exists) | no guess — PO confirm |

## Activities
43 rows shown in workbook order (29 Sự kiện · 11 Cuộc thi · 3 Chuỗi sự kiện), each with its own image, THỜI GIAN · ĐƠN VỊ TỔ CHỨC (one line per organiser) · ĐỊA ĐIỂM · VAI TRÒ HUB. "Link liên quan (bỏ)": never transcribed, never shown.

## Related
- [S1-UAT-08A-evidence](S1-UAT-08A-evidence.md)
- [S1-UAT-08A-humans](S1-UAT-08A-humans.md)
- [S1-UAT-08A-activities](S1-UAT-08A-activities.md)
- [DECISION_LOG DEC-S1H](../../decisions/DECISION_LOG.md#dec-s1h)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
