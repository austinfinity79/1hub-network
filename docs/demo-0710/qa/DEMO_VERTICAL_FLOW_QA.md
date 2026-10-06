# Demo vertical flow QA

DEMO-QA-PREP-B (06/10, Claude B, `qa/demo-support-0710` on `4c9e7b7`). The automated plan for the 07/10 review journey ([DEMO_SOT_v1](../DEMO_SOT_v1.md#review-journey)). Spec: `tests/visual/specs/demo-qa-vertical-flow.spec.ts`. Smoke: `scripts/qa/demo-0710-smoke.mjs`.

## Status legend
| Status | Meaning |
|---|---|
| BASE | exists on `4c9e7b7` (DEMO-HOME-ABOUT-01, PASS_WITH_EVIDENCE); the test runs always |
| AWAITING_A_IMPLEMENTATION | owned by DEMO-DIR2-01 or DEMO-SP1-FOUNDER-01; the test is `fixme` until `DEMO_QA_SYNC=1` at DEMO-QA-B-SYNC, then a missing screen fails |

## Steps
| # | Step | Route | Assertion (selectors on BASE; roles, routes and SOT text on AWAITING) | Status | Test |
|---|---|---|---|---|---|
| 1 | Homepage loads | `/` | 200; `[data-screen="P0-LANDING"][data-revision="DM01"]`; no console / hydration error, no 5xx, no broken image | BASE | `1–2` |
| 2 | Public nav renders | `/` | `header[data-shell="public"][data-viewer="GUEST"]`; logo `href="/"`; Giới thiệu `href="/about"` | BASE | `1–2` |
| 3 | "Sản phẩm" CTA works | `/` → `/products` | header link named "Sản phẩm" (a plain label on BASE, `PUBLIC_ROUTES.products = null`) | AWAITING (DIR2) | `3–5` |
| 4 | Directory loads | `/products` | URL `/products`; clean page | AWAITING (DIR2) | `3–5` |
| 5 | Demo cards render | `/products` | "Tracely", "AgriTrace", "Kho Lạnh Miền Tây" visible; no `de710000-…c*` id in HTML | AWAITING (DIR2) | `3–5` |
| 6 | Startup → Detail | `/products/tracely` | Tracely card "Xem hồ sơ" → URL `/products/tracely`; h1 contains "Tracely" | AWAITING (DIR2 interim → SP1) | `6–11` |
| 7 | Detail has a Founder | `/products/tracely` | link named "Đặng Kim Chi" (DM13 team, SOT C7); a non-founder member (Phạm Quốc Việt) is not a link | AWAITING (SP1-FOUNDER) | `6–11` |
| 8 | Founder → Profile | `/talents/dang-kim-chi` | URL is the fixed handle (DEC-DEMO-SP1-D1); h1 contains "Đặng Kim Chi"; a profile UUID is 404 | AWAITING (SP1-FOUNDER) | `6–11` |
| 9 | DEMO verified state | `/talents/dang-kim-chi` | `[data-verified="demo"][data-demo="DEMO-0710"]` "Đã xác thực danh tính qua 1Hub" (DEMO-D10); `ly-gia-bao` shows it, `vo-thanh-ha` / `nguyen-minh-anh` do not; unknown handle → 404 | AWAITING (SP1-FOUNDER) | `6–11`, `direct URLs` |
| 10 | About opens | `/about` | header Giới thiệu → `/about`; `[data-screen="PUBLIC-ABOUT"][data-revision="DM02"]`; refresh holds | BASE | `10–11` |
| 11 | Home returns | `/` | logo → `/`; Back → `/about` | BASE | `10–11` |

Every page also checks: no `href="#"`, empty or `javascript:` link (DEMO-D6); none of "đã xác minh / đã kết nối / đã theo dõi / đã gửi yêu cầu" ([wording guard](../OUT_OF_SCOPE_POST_DEMO.md#wording-guard)); no broken image; containment at 1440 / 768 / 390 (step list in [DEMO_RESPONSIVE_MATRIX](DEMO_RESPONSIVE_MATRIX.md)).

## Run
| When | Command (isolated DB and port only, never `hubnetwork_p0`) |
|---|---|
| now (BASE) | `DATABASE_URL=…/hubnetwork_demo_qa_b VISUAL_PORT=<free> pnpm visual tests/visual/specs/demo-qa-vertical-flow.spec.ts` |
| DEMO-QA-B-SYNC | same with `DEMO_QA_SYNC=1` on the accepted A candidate |
| any server, HTTP only | `node scripts/qa/demo-0710-smoke.mjs <base-url> [--sync]` |

The spec applies `db/seed/demo_0710.sql` in `beforeAll` and removes the demo rows in `afterAll`, as `demo-home-about-01` does.

## SYNC result (DEMO-QA-B-SYNC, candidate `f309520`)
All AWAITING steps PASS with `DEMO_QA_SYNC=1`; the founder route follows DEC-DEMO-SP1-D1 (`/talents/[handle]`). Final run 27 / 27 as expected (25 PASS, 2 expected-fail for QA-B-04). Report: [DEMO-QA-B-SYNC](../../implementation/reports/DEMO-QA-B-SYNC.md).

## Confirmed at SYNC (first observed in A `7dd5230`)
| Item | Note |
|---|---|
| `PUBLIC_ROUTES.products` | `/products` in `7dd5230` |
| Hero search "Sản phẩm" scope | BASE goes to `/library?q=`; SOT wants `/products?q=`; `7dd5230` changes it |
| `/products/[slug]` | interim Tổng quan page in `7dd5230`; SP1 finishes it |
| Spec `demo-dir2-01` | A's own suite; this spec is the cross-screen journey, not a duplicate |

## Related
- [DEMO_ROUTE_CTA_MATRIX](DEMO_ROUTE_CTA_MATRIX.md) · [DEMO_RESPONSIVE_MATRIX](DEMO_RESPONSIVE_MATRIX.md)
- [DEMO_SMOKE_CHECKLIST](DEMO_SMOKE_CHECKLIST.md) · [DEMO_DEPLOY_ROLLBACK_CHECKLIST](DEMO_DEPLOY_ROLLBACK_CHECKLIST.md)
- [SCREEN_ROUTE_MAP](../SCREEN_ROUTE_MAP.md) · [DEMO_DATA_CONTRACT](../DEMO_DATA_CONTRACT.md)
