# Supersession matrix — 07/10 demo

Part of [DEMO_SOT_v1](DEMO_SOT_v1.md). The PO pack (06/10/2026) supersedes the earlier **presentation** of the Homepage and About.

- Data, guards, APIs and schema stay unless a row below says otherwise.
- A superseded item is replaced only by the task that implements its new screen.
- Until then, the current code remains the live behaviour.
- DEMO-HOME-ABOUT-01 (06/10) has replaced the Homepage, About and their headers / footers ([report](../implementation/reports/DEMO-HOME-ABOUT-01.md)).

## Screens and components (F)
| Old | Where | Status | Replaced by | Task |
|---|---|---|---|---|
| Homepage H1 r2 presentation (hero video 800 px, Pain / Solution / Opportunities, Events / Programmes / Pipeline, AllInOne, Network, Community + partner matrix, Closing) | `src/components/landing/*` | SUPERSEDED | DM01 | DEMO-HOME-ABOUT-01 |
| Homepage hero search → `/library?q=` | `landing.tsx` HeroSearch | SUPERSEDED IN PART | scoped search ([E](SCREEN_ROUTE_MAP.md#calls-to-action-e)); "Tất cả" keeps `/library?q=` | DEMO-HOME-ABOUT-01 |
| About S1-UAT-08A layout: numbered sections 01–08, Sứ mệnh, Quy mô ring, OrgDiagram, Humans strip with tabs Tất cả / Nhiệm kỳ hiện tại / Các thế hệ trước, milestone and activity layouts | `src/components/about/about*.tsx` | SUPERSEDED (layout) | DM02–DM05 | DEMO-HOME-ABOUT-01 |
| About data: HUMAN_ROWS, MILESTONES, ACTIVITY_ROWS, photos, hero copy, H·U·B values | `about-source.ts`, `about-data.ts`, `public/about/` | KEPT, reused | — | — |
| Per-page public headers / footers (landing, about, library) | `landing.tsx`, `about.tsx`, `library.tsx` | SUPERSEDED | one shared header (logo icon, Giới thiệu ▾ · Chương trình ▾ · Sản phẩm · Nhân tài · Tin tức) and a two-column footer | DEMO-HOME-ABOUT-01 |
| "Mạng lưới đổi mới sáng tạo" nav entry → `/library` | header | SUPERSEDED | "Sản phẩm" → `/products` | DEMO-HOME-ABOUT-01 (label); target live with DEMO-DIR2-01 |
| `/library` (Bài toán / Startup / Nhà sáng lập tabs) | `src/app/(public)/library` | KEPT, not in nav | DIR0–DIR3 split (Thảo); `/library` stays reachable until all directories exist | post-demo |
| Library founder "Xem hồ sơ" inert (DEC-L15-D12), no ✓ mark (DEC-L15-D11) | `library.tsx` | KEPT for `/library` | DM08 / DM13 for the demo set | DEMO-PRODUCT-01 / DEMO-FOUNDER-01 |
| WF05 `/demo/projects/[id]` member-only detail | `src/app/(demo)` | KEPT | public `/products/[slug]` is a separate read-only view | — |

## Decisions (traceable conflict records)
| Decision | Effect of the PO pack |
|---|---|
| DEC-H1-D2 / D3, DEC-H1-R2-D1, DEC-2809-D1 (homepage copy, CTA map, section order) | superseded for presentation; the guest / signed-in entry rule of DEC-H1-D1 stays |
| DEC-AIG-D1 (Chương trình / Sự kiện plain labels) | kept as the rule for any target not yet built; the labels now sit under "Chương trình ▾" |
| DEC-S1H-D1…D4 (About, S1-UAT-08A) | layout superseded; verbatim data kept |
| DEC-W6P-D01 ("no new public venture discovery, no new nav entry") | superseded for the demo: `/products`, `/products/[slug]` and a "Sản phẩm" entry are authorised by the pack |
| DEC-HD-12 (Space Grotesk on Homepage and L1–L6 only) | extended to the demo / public surfaces DM01–DM13 by [DEMO-D9](DEMO_SOT_v1.md#decisions) (approved); admin / member / ops unchanged |
| DEC-P0-LANDING-D2 (1Hub / CCCD verification is Tương lai) | kept; the demo mark is a labelled DEMO state only ([out of scope](OUT_OF_SCOPE_POST_DEMO.md)) |

## Tests that the replacement makes stale
| Spec | Pin that changes | Class when replaced |
|---|---|---|
| `p0-landing.spec.ts` (10) | H1 pixel blocks, `network-bar` → `/library`, plain-label list, homepage copy | STALE_TEST → rewritten against DM01; H1 baseline kept, not overwritten |
| `alpha-interaction-gaps.spec.ts` L109-115 | plain labels on `/` and `/about`, search → `/library?q=` | STALE_TEST |
| `s1-uat-08a-about.spec.ts` | section order and tabs (people, activities and the 1440 / 768 / 390 checks stay) | STALE_TEST in part |
| `internal-alpha-release.spec.ts` | nav crawl targets | STALE_TEST |
| `s1-uat-02-feedback.spec.ts` | "Góp ý" on `/` and `/about` | unchanged; must stay green |

## Related
- [DEMO_SOT_v1](DEMO_SOT_v1.md) · [SCREEN_ROUTE_MAP](SCREEN_ROUTE_MAP.md) · [OUT_OF_SCOPE_POST_DEMO](OUT_OF_SCOPE_POST_DEMO.md)
