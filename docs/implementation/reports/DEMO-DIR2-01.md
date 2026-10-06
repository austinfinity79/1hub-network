# DEMO-DIR2-01

Product / Startup directory MVP (DM08) for the 07/10 demo, on `feat/sprint1-completion` from `4c9e7b7`. Contract: [DEMO_SOT_v1](../../demo-0710/DEMO_SOT_v1.md), [DEMO_DATA_CONTRACT](../../demo-0710/DEMO_DATA_CONTRACT.md); decisions [DEC-DEMO-DIR](../../decisions/DECISION_LOG.md#dec-demo-dir). No migration. Not pushed, merged or deployed.

## Scope
| Surface | Result |
|---|---|
| `/products` (DM08) | hero (live count, scoped search, quick chips Đang gọi vốn · Tìm pilot · Logistics · AgriTech · AI, three counters), filter rail (Lĩnh vực · Giai đoạn · Khu vực Việt Nam / Quốc tế with province / country), active filters + "Xoá tất cả", sort (Hoạt động · Mới nhất · Tên A–Z), 3-column cards (logo, name, province, stage, summary, domains, "Xem hồ sơ", "Theo dõi"), empty state, "Xem thêm N sản phẩm" (9 per step). Filters mirror the address (`q`, `linh-vuc`, `giai-doan`, `tinh`) |
| `/products/[slug]` | interim Tổng quan in the DM10 language: back link, identity, status, "Từ · round · place", follow / connect (guest → /auth), tagline, summary, demo headline numbers, team (demo ventures only), facts panel. The DM10–DM12 rebuild is DEMO-SP1-FOUNDER-01 |
| Handoff | header and footer "Sản phẩm", homepage "Xem tất cả" / "Xem tất cả sản phẩm", homepage product rows and the hero search ("Sản phẩm" scope) now route to `/products` (`PUBLIC_ROUTES.products`) |

## Data and visibility
| Rule | Detail |
|---|---|
| Source | canonical published startups only (type STARTUP · status ACTIVE · visibility PUBLIC, DEC-W6P-D02) via `listPublicStartups`; canonical slug = route key; no new model, no read-model store |
| Demo | `db/seed/demo_0710.sql` (3 startups, 6 fictional profiles); the fixture adds DEMO STATE ONLY fields (fundraising, paying customers, portfolio, round, since, headline numbers) |
| Private data | no owner, member, account, e-mail, id or application on the directory; team names only on the demo ventures' pages; DRAFT / PRIVATE / PROJECT / unknown slug → 404 |
| Counters | Đang gọi vốn / có khách hàng trả phí / danh mục iHUB Ventures count the fixture flags; the title count is live |

## Visual QA (1440 × DPR1)
| Block | outside-text % / beyond ±2 px % |
|---|---|
| header + hero (gated; live count and counters excluded) | 0.47 / 0.52 — PASS (< 1.5 / < 2) |
| results (reported: canonical cards, unfiltered default state vs the frame's filtered state) | 4.18 / 5.97 — reported, not gated |
| 768 / 390 | no overflow, filters usable, "Xem hồ sơ" visible and hittable (structural only) |

## Tests
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS (`/products`, `/products/[slug]` dynamic) |
| unit | 458 / 458 (45 files) |
| db (`src/lib/library`, `src/lib/public`) | 42 / 42 |
| `demo-dir2-01` | 10 / 10: guest browse, visibility (hidden slugs 404, no ids / e-mail / owners), search, chips, filters, URL sync, deep link, empty, sort, home → directory → detail, every card 200, 768 / 390, typography, DM08 pixel |
| Tier B visual slice (13 specs, 386 tests) | 381 passed, 2 skipped, 3 stale expectations fixed and re-run 36 / 36 (see below) |
| UAT | 19 / 19 |
| server log | hydration 0 · 5xx 0 · secret 0 · hex40 0 |

Stale expectations: `demo-dir2-01` results segment exceeded a 3-card page (cut to 560 px); `demo-home-about-01` "Sản phẩm" search now lands on `/products`; `wf06-prod-visual` used the pre-DM01 "Tìm trong Thư viện" form (stale since DEMO-HOME-ABOUT-01, now `[data-search="hero"]`, scope Tất cả → `/library`).

## Known deviations
- 3 demo startups (no other founder is drawn in the pack); the frame's 142 / 48 / 23 / 9 are samples.
- The red verified mark beside product names is not drawn (no product verification source).
- "Quốc tế": canonical ventures keep a Vietnamese province only, so it counts 0.
- "Tìm pilot" searches the Pilot stage; quick chips are keyword shortcuts, not a ranking.
- No footer on `/products`, as DM08 draws none.

## Related
- [DEMO-HOME-ABOUT-01](DEMO-HOME-ABOUT-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
