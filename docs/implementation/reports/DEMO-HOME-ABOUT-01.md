# DEMO-HOME-ABOUT-01

Full UI rebuild of the public shell, Homepage v2 (DM01) and About HUB v2 (DM02–DM05) for the 07/10 demo, on `feat/sprint1-completion` from `03168ce`. Contract: [DEMO_SOT_v1](../../demo-0710/DEMO_SOT_v1.md); decisions [DEC-DEMO-HA](../../decisions/DECISION_LOG.md#dec-demo-ha). No migration. Not pushed, merged or deployed.

## Scope
| Surface | Result |
|---|---|
| Public shell | HUB symbol (SVG redrawn from DM01), Giới thiệu ▾ (About + iHUB Ventures / VNV / 1Hub), Chương trình ▾ (Chương trình, cuộc thi · Sự kiện), Sản phẩm · Nhân tài · Tin tức, VI \| EN, guest Đăng nhập / Tạo tài khoản or member Việc của tôi · bell (no count) · initials; mobile disclosure < 1024 px; footer `home` / `about` variants. Unbuilt destinations are plain text (`src/lib/public/routes.ts`) |
| Homepage `/` | hero (video treatment, scoped search, 3 intents), ticker, Nổi bật tuần này (programme updates · products by sector), Chương trình đổi mới sáng tạo, Startup sẵn sàng gặp nhà đầu tư (carousel), Tất cả sản phẩm, Tin tức, footer |
| About `/about` | hero + 5 counters, H·U·B values, map (Thế giới / Việt Nam, 11 markers, Hoàng Sa · Trường Sa, hover card, DM03 popup, "Xem thêm" full catalogue), Humans of HUB (HUB Tổng tree, HUB Khu vực structure + 11 boards, Câu lạc bộ 55), ecosystem (7 rows), 5-year timeline, activities (43), partner wall (labelled illustration), coral CTA band, footer |
| Data | live: catalogue (11 regional HUBs, 13 Chapters, 55 CLBs, Đà Nẵng 6), S1-UAT-08A people / milestones / activities / photos, canonical published startups; demo data step `node scripts/db.mjs demo` (`db/seed/demo_0710.sql`: 3 startups, 6 fictional profiles); presentation fixture `src/lib/demo-0710/ventures.ts` (DEMO STATE ONLY) |
| Removed | `src/components/landing/*` except `landing-parts.tsx` + `landing.module.css` (still used by `/library`), the old About layout files, orphaned About data exports and `legalLinks` / `publicHubSlug` |

## Canonical data overrides (frame sample → rendered)
| Frame | Rendered |
|---|---|
| 60+ cộng đồng và CLB / "Hơn 60 câu lạc bộ" | 55 câu lạc bộ trực thuộc |
| HUB Đà Nẵng: 420 thành viên · 7 CLB · 5 sự kiện · 5 dự án | 6 CLB · 4 board members · since 2024 (no source for members / events / projects) |
| Frame people and CLB names (boards, CLB cards, popup) | S1-UAT-08A workbook people and titles; catalogue CLB names; no CLB chairs (no source) |
| 10 map markers (no China) | 11 (Beijing added for HUB Trung Quốc) |
| 142 / 128 products, investor carousel of several | live count (3 demo startups), one investor-ready startup |
| Ecosystem "5 nhánh" / 6 (Thảo) | the frame's 7 rows (DEMO-D11); business list open (C1) |

## Visual QA (1440 × DPR1, per block, outside-text % / beyond ±2 px %; * reported, not gated)
| Page | Blocks |
|---|---|
| DM01 | hero 0.21/0.20 · ticker 0.04/1.36 · highlights 0.61/0.67 · updates 1.13/1.38 · sectors 1.76/2.23* · programmes 1.48/1.89 · ventures 6.48/7.93* · news 1.35/1.65 · footer 0.54/1.51 |
| DM02 | hero 0.50/1.99 · values 0.25/0.52 · scale 0.19/1.78 · map 2.01/1.86* · chips 3.78/2.60* · humans head 0.11/0.82 · humans tree 2.55/4.51* · ecosystem 0.31/1.81 · milestones 1.79/3.34* · activities 0.84/2.86* · partners 3.55/1.71* · closing 0.09/0.84 · footer 0.18/0.80 |
| DM03–DM05 | captured and reviewed side by side (`tests/visual/actual/demo-about-dm0{3,4,5}-*.png`): composition matches; content is canonical (INTENTIONAL-DATA) |
| 768 / 390 | no horizontal overflow, entry CTA visible and hittable, menu opens; no pixel claim (no frame) |

Thresholds unchanged (DEC-H1-D5: < 1.5 % / < 2 %). Ungated blocks differ by data (counts, people, photos, product list) or by the generated map raster.

## Tests
| Gate | Result |
|---|---|
| format · lint · typecheck · production build | PASS |
| Unit | 45 files · 458 / 458 |
| Tier B visual slice (11 specs, fresh guarded reset of `hubnetwork_s1uat03`) | 122 tests · 121 PASS · 0 FAIL · 1 SKIP · 0 FLAKY |
| UAT L1–L2 | 10 specs · 19 / 19 |
| Server log | hydration 0 · 5xx 0 · secret 0 · 40-hex 0 |

Stale tests replaced or updated: `p0-landing` and `s1-uat-08a-about` → `demo-home-about-01` (17 tests); `alpha-interaction-gaps`, `p0-shell-navigation`, `public-library`, `l6-discovery-privacy`, UAT `uc02` (old homepage CTAs and nav). The H1 baseline image is kept, not overwritten.

## Known deviations
- No hero video asset: the gradient poster with an inert pause control is shown.
- Map: generated from Natural Earth (public domain, world-atlas 2.0.2) in the Miller projection fitted to DM02; the coastline raster differs slightly from the frame.
- The partner wall shows the frame's placeholder names under a visible "Dữ liệu minh hoạ".
- Footer contact e-mail is plain text (contacts are text); newsletter form inert.
- Visual-only CTAs keep the frame's look (not dimmed) with "Sắp có…" on hover; DEMO-D6 supersedes the 01/10 dimming rule on these surfaces.
- `/library` keeps its own header (protected L15 baseline); its homepage nav entry is gone, the hero search ("Tất cả") still opens it.

## Related
- [DEMO_SOT_v1](../../demo-0710/DEMO_SOT_v1.md) · [DEMO_DATA_CONTRACT](../../demo-0710/DEMO_DATA_CONTRACT.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
