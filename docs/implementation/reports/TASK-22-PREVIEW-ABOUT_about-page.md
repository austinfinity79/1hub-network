# TASK 22-PREVIEW-ABOUT — Public About Page

Public `/about` page from `About.zip` (Sprint 1 · DL29, 28/09). Branch `feat/about-page` is based on `aa8748a` and is an isolated worktree. The work ran in parallel with the email-auth task. Not deployed.

## Source pack (13 files)

| Asset | Use |
|---|---|
| `01 · Hero` … `08 · Mỗi kết nối, một khởi đầu`, `Footer (cố định phía sau)` | the nine section references (1440 px wide) |
| `Label.png` ("07 / CHÚNG TÔI LÀ AI?"), `5 hàng.png`, "Kết nối đúng người…" and "HUB Network kết nối cộng đồng…" text images | **not placed**: they have no slot in sections 01–08, and their "07" numbering conflicts with section 07. Placement needs a PO decision (FU-ABOUT-3) |

All photo slots in the pack are labelled gradient placeholders ("ẢNH · …") and are reproduced as such. People are shown as "Họ tên — chờ cập nhật", exactly as in the pack.

## Implementation

| Section | Result |
|---|---|
| 01 Hero | homepage bar (shared `landing.module.css` classes, read-only), "Về HUB Network" is the current page, three tilted photo cards, title, lede, CTAs, four stats |
| 02 Sứ mệnh | three rows. The row rises on scroll; the photo opens horizontally. Hover moves the highlight (row 01 is open by default, as drawn) |
| 03 H·U·B | three cards; letters slide in. The letters use IBM Plex Mono 500, the approved mono font, widened; no new font |
| 04 Quy mô | HUB Tổng card with a deterministic SVG ring (13 slots), two tier cards, CTAs |
| 05 Cơ cấu + Humans | interactive diagram (13 HUBs; hover, tap or keyboard updates the panel; spokes draw on scroll); tier list; Humans strip with a term filter |
| 06 Dấu ấn | six milestones. The left column (year, step, HUB count, place chips) is sticky and follows the milestone in view; the section is not pinned |
| 07 Hoạt động | horizontal strip (drag, swipe, arrows, progress) with a type filter. Three cards |
| 08 Kết trang | pointer-following glow and a magnetic primary button (fine pointers, no reduced motion) |
| Footer | fixed behind the page (sticky reveal); anchors to 02, 04, 05, 06 and Humans; legal links as on the homepage |

Calls to action: "Tham gia HUB Network" goes to the visitor's entry point (as on the homepage), and "Khám phá các HUB Chapter" / "HUB Chapters" go to the published HUB page. Everything else is inert with a reason (`Cta`, DEC-P0-SHELL-D2). No DB, API or auth change.

## QA (production build, local)

| Check | Result |
|---|---|
| Pixel vs pack, 1440 (threshold 40) | hero 5.85 · mission 3.98 · values 5.27 · scale 6.76 · org 3.81 · timeline 6.86 (2024 state) · activities 4.80 · closing 4.86 · footer 5.73 %. Section heights within ±7 px |
| Classification | P0 0 · P1 0 · P2 0. P3: text anti-aliasing, gradient approximation, Plex Mono letterforms for H·U·B |
| Intentional | the timeline opens on 2021 (the pack shows the 2024 scroll state); mobile layouts |
| Functional | `/about` 200 for guests, refresh, back/forward, 5 anchors, all footer links clickable (hit-test) at 4 widths |
| Hydration / console | #418 = 0; console errors 0; failed responses 0 |
| Responsive 1440 / 1024 / 768 / 390 | no page overflow, no clipped controls, no hidden reveals |
| Regression | P0-LANDING + P0-SHELL + shell-routes 57/57; unit 245/245; format, lint, typecheck, build PASS |

## Follow-ups (non-blocking)

| ID | Item |
|---|---|
| FU-ABOUT-1 | The homepage does not link to `/about` ("Về HUB Network" → `#cong-dong`). A one-line change after email-auth, as the task rules require |
| FU-ABOUT-2 | Activity card 4 ("SỰ KIỆN · HUB…") is cut off in the pack, so its title is unknown and it is not rendered. With three cards the strip does not overflow at 1440 |
| FU-ABOUT-3 | Placement of the "Chúng tôi là ai?" fragments |
| FU-ABOUT-4 | Values the pack leaves blank (panel counts, activity dates and roles) stay "—" / "Chờ cập nhật" until content arrives. "Tầm nhìn" opens the mission section |
| FU-ABOUT-5 | Legal links return 404 where `LEGAL_CONTENT_DIR` is unset (same as the homepage; PL-11) |

## Related

- [INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md) — preview scope
