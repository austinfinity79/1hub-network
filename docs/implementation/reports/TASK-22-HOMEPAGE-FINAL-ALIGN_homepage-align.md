# TASK-22-HOMEPAGE-FINAL-ALIGN Homepage Align

**TASK 22-HOMEPAGE-FINAL-ALIGN — final homepage content + pixel alignment: DONE (local).** Implementation `3fd00e4`. Decisions [DEC-H1-R2](../../decisions/DECISION_LOG.md#dec-h1-r2). Not deployed, not pushed.

## Source
| Item | Value |
|---|---|
| Reference | `1hub redesign — (15).zip` → `Homepage.png`, 1440 × 12853, sha256 `fd8987a0…2c0c`; stored as `design-reference/final/revision/H1/H1__homepage-r2__SOURCE.png` |
| Supersedes | `H1__homepage__SOURCE.png` (1440 × 17999, TASK 22.1) |
| Unchanged blocks | journey strip, One profile, doors, closing and footer are pixel-identical in both exports |
| PO answers (28/09) | cards verbatim with a "Dữ liệu minh hoạ" label; keep the "13 chapter · 9 quốc gia …" line; "Truy cập ihub.ventures" inert |

## Removed (PO overrides)
| Item | Where it was |
|---|---|
| "1hub.network — được phát triển bởi HUB Network" | hero eyebrow, community footer line |
| "Biến hoạt động thành dữ liệu, dữ liệu thành cơ hội." | end of Giải pháp |
| Organiser blocks | "/ Dành cho đơn vị tổ chức" section; "Dành cho các tổ chức, doanh nghiệp" + "Tạo chương trình" (present in the reference, removed by PO); event organiser box |
| "/ Từ dữ liệu đến những kết nối có ý nghĩa" | loop section and diagram |
| "HUB Network đóng góp …" paragraph | community |
| "Cùng kết nối nguồn lực với những tiềm năng mới" | old partner section |
| Not in the new reference | hero "Đăng bài toán" line, 01–03 bars, network notes |

## Sections
| Section | Result |
|---|---|
| 01 Hero | no eyebrow; title and side column rebalanced; wordmark unchanged |
| 03 Điểm nghẽn | five-line heading, new paragraph (red from "nơi dữ liệu …"), four short items |
| 04 Giải pháp | heading, line and four cards; slogan removed |
| 05 Giá trị đa tầng | three rows; row 01 tag "SỰ KIỆN" |
| 06–08 Rails | events 3 cards, programmes 3 cards, pipeline 3 cards; drag, swipe, keyboard, buttons |
| 09–10 | One profile unchanged; network without notes |
| 11 HUB Network | red sub-heading ending in dark "HUB Network"; five numbers; card with the line and "Tìm hiểu về HUB Network" → `/about` |
| 12 Partner matrix | five rows of placeholder names, labelled "Dữ liệu minh hoạ", no logo, no link; fake verified partners introduced: **NO** |
| 13–14 | closing and footer unchanged |

## QA (production build, local)
| Gate | Result |
|---|---|
| Pixel, 16 segments | P0 0 · P1 0 · P2 0; max outside 0.0099 (limit 0.015), max beyond ±2 px 0.0144 (limit 0.02); page 12636 px = reference 12853 − 217 (removed block) |
| P3 / intentional | text rasterisation; the four labels; third event tag outside the frame; chip borders at half-pixel positions |
| Responsive 1440 / 1024 / 768 / 390 | overflow 0; hero search and CTAs reachable; rails and matrix rows scroll; card overflow 0 |
| Tests | P0-LANDING 10 / 10; regression 191 / 191 (shell 14 + 33, Library 13, WF01-S01 13, S02 14, S03 15, S07 21, e-mail flow 5, auth-session 13, authz 8, console-health 4, root 4, WF02-S01 14, referrer, release pack); unit 257 / 257 |
| Gates | format, lint, typecheck, build PASS |
| Navigation | → `/about` (nav, footer, card), → `/library`, "Đăng nhập" and "Tạo tài khoản" → `/auth`, legal links 200 |
| Runtime | #418 0; 4xx / 5xx 0; console errors 0; no image on the page. Locally `next start` reports aborted RSC prefetches (200 responses) on every page, changed or not; not seen on the domain |

## Files
New: `landing-activities.tsx`, `landing-community.tsx`, `landing-rail.tsx`, `activities.module.css`, `activity-cards.module.css`, `community.module.css`, the reference. Changed: `landing.tsx`, `landing-story.tsx`, `landing-network.tsx`, three stylesheets, `p0-landing.spec.ts`, revision README, `DECISION_LOG.md`. Removed: the old reference. No API, DB, auth or `/about` / `/library` change.

## Git
Branch `main`; start HEAD `2033264`, checked again before the commit. Push **NOT RUN**; deploy **NOT RUN**.

## Related
- [TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md](TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md)
- [TASK-22.1_public-homepage.md](TASK-22.1_public-homepage.md)
