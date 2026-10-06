# THAO-03

Homepage v2 — production closure and visual parity with the PO's 07/10 16:9 frames.

- Milestone: THAO-M1
- Branch / worktree: `feat/thao-m1-public-experience` / `../1hub-network-thao-m1`
- Base: `b8e9d82`
- Decisions: [DEC-THAO-HOME](../../decisions/DECISION_LOG.md#dec-thao-home)
- References (new, nothing overwritten): `DM01H` hero, `DM01P` startup showcase ([map](../../demo-0710/FIGMA_REFERENCE_MAP.md))
- No migration; not merged, not deployed.

## Before → after
| Area | Before (`b8e9d82`) | After |
|---|---|---|
| Hero height | fixed 812 px; at 1440 × 900 the programme strip showed in the first screen | `max(812px, 100svh)`; the strip starts after the hero at every desktop height |
| Search + CTA cluster | 609 px from the top | 73 px above the hero bottom (same place at 812 px) |
| Pitch card | 442 px, pink edge, shadow clipped by the section | 420 px, grey edge, deeper shadow visible below; frame type sizes |
| Metric row | equal thirds, "1,2 triệu" ran into "-33%" | columns follow their values |
| Next-card glimpse | none with one fundraising startup (empty right side) | the next pitch at 90 %; with one startup, a link to `/products` |
| Product directory | `ceil(n / 2)` columns (2 for 3 startups), heading 19 px off | at least 4 columns, heading row on the frame line, filters clear of the count |

## Logic and data
| Check | Result |
|---|---|
| Search | "Tất cả" → `/library?q=`, "Sản phẩm" → `/products?q=`; Chương trình / Nhân tài scopes inert (no screen) |
| CTAs | "Tham gia cộng đồng" → viewer entry (`/auth`); "Tổ chức chương trình", "Gọi vốn" inert, `aria-disabled` |
| Startup showcase | canonical investor-ready startups only (Tracely); "Xem sản phẩm" → `/products/tracely` |
| Directory | live count = published startups; filters = their canonical domains; view-all → `/products` |
| Programmes / news | unchanged demo blocks (DEMO-D6), no new route |
| Links | every internal link < 400; no `#` / empty / `javascript:` link |

No new business logic, domain model, route or status. The frame's sample startups, count (128) and sectors are data (INTENTIONAL-DATA).

## Pixel QA 1440 × 812, DPR 1 (outside-text / beyond ±2 px, %)
| Segment | Gated | Result |
|---|---|---|
| DM01H hero top · cluster · base | yes | 0.08 / 0.10 · 0.87 / 0.67 · 0 / 0 |
| DM01P heading + arrows | yes | 0.24 / 1.06 |
| DM01P pitch card | yes | 0.20 / 0.94 |
| DM01P next glimpse | no | 2.14 / 3.40 — directory link where the frame draws a second sample pitch |
| DM01P directory head · rows | no | 2.57 / 6.02 · 5.74 / 7.01 — 3 canonical startups vs 128 samples |
| DM01 (demo-home-about-01) | 8 of 9 gated | all below threshold; 07-ventures 2.16 / 3.36 (ungated, data) |

The nav row is excluded (DEC-THAO-NAV-D1: the frames draw "Giới thiệu ▾").

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build · unit | PASS · PASS · PASS · PASS · 458 / 458 |
| thao-03-home | 13 / 13 (hero ×3 viewports, search/CTAs, showcase, directory, dead CTA, responsive ×5, pixel) |
| Targeted slice (thao-03, demo-home-about-01, thao-01, thao-02, demo-dir2-01, demo-sp1-founder-01, demo-qa-vertical-flow, p0-shell-navigation, alpha-interaction-gaps, public-library, s1-uat-02-feedback, m0-entry-01-root) | 12 specs, 160 / 160, 0 flaky |
| UAT L1–L2 | 19 / 19 |
| Responsive 1440 / 1280 / 1024 / 768 / 390 | no overflow, CTAs inside, pitch and filters usable, no distorted image |
| Runtime | console / hydration 0, 5xx 0 |

## Related
- [THAO-01](THAO-01.md) · [THAO-01-FIX](THAO-01-FIX.md) · [THAO-02](THAO-02.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
