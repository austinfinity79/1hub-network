# Demo smoke checklist

DEMO-QA-PREP-B. The exact smoke sequence for DEMO-QA-01, on the accepted A candidate (exact SHA), first locally on an isolated database, then on the demo target after deploy. Automated parts: `demo-qa-vertical-flow.spec.ts` (`DEMO_QA_SYNC=1`) and `scripts/qa/demo-0710-smoke.mjs <base-url> --sync`.

## 0. Preconditions
| # | Check | Pass when |
|---|---|---|
| 0.1 | Candidate | `git rev-parse HEAD` equals the SHA the PO accepted; tree clean |
| 0.2 | Database | isolated DB named on the command line (never `hubnetwork_p0`); `migrate` → `seed` → `catalog` → `demo` applied; `demo` run twice gives the same state (idempotent, DEMO_DATA_CONTRACT "Determinism") |
| 0.3 | Demo data | exactly 3 demo startups (Tracely, AgriTrace, Kho Lạnh Miền Tây) PUBLIC + ACTIVE; 6 demo profiles; Kim Chi and Lý Gia Bảo flagged verified, Võ Thanh Hà not |
| 0.4 | Build | `pnpm build` from the candidate; server = `next start` on a port nobody else uses |
| 0.5 | Server log | captured to a file from the first request |

## 1. Clean-load guest journey (fresh browser profile, no cookies)
| # | Action | Pass when |
|---|---|---|
| 1.1 | Open `/` | 200; DM01; guest header; no console error |
| 1.2 | Header "Sản phẩm" | `/products`; 3 cards; live count = 3 |
| 1.3 | Tracely "Xem hồ sơ" | `/products/tracely`; Tổng quan; team shows Đặng Kim Chi |
| 1.4 | Đặng Kim Chi | `/talents/<id>`; public view; "Đã xác thực danh tính qua 1Hub" (DEMO) |
| 1.5 | Header "Giới thiệu" | `/about`; DM02; map, popup (HUB Đà Nẵng), Humans tabs work |
| 1.6 | Logo | `/` |

## 2. Refresh, direct URL, Back
| # | Action | Pass when |
|---|---|---|
| 2.1 | Reload each of `/`, `/about`, `/products`, `/products/tracely`, `/talents/<id>` | same content, no flash of error, 200 |
| 2.2 | Paste each URL into a new tab | same as navigation (no client-only state) |
| 2.3 | Back from founder → startup → directory → home | each page restores; directory keeps its filter state if any |
| 2.4 | Non-demo ids: `/products/not-a-demo-startup`, `/talents/<random uuid>`, Võ Thanh Hà's id | 404, 404, 200 without the verified mark |

## 3. Health of every page
| # | Check | Pass when |
|---|---|---|
| 3.1 | Browser console | 0 errors, 0 hydration warnings ("Text content does not match", "Hydration failed") |
| 3.2 | Network | 0 responses ≥ 500; 0 failed image / font requests |
| 3.3 | Images | 0 broken (`naturalWidth === 0`); no stretched logo / avatar |
| 3.4 | Links | 0 `href="#"`, empty or `javascript:`; every internal link < 400 |
| 3.5 | Copy | none of "đã xác minh", "đã kết nối", "đã theo dõi", "đã gửi yêu cầu"; no demo UUID on listing pages |
| 3.6 | Server log | 0 unexpected 5xx, 0 hydration, 0 stack trace, 0 secret or 40-hex token |

## 4. Mobile viewport
| # | Check | Pass when |
|---|---|---|
| 4.1 | 390 × 900 and 768 × 900, journey 1.1–1.6 | menu opens, every step reachable, no horizontal overflow ([responsive matrix](DEMO_RESPONSIVE_MATRIX.md)) |
| 4.2 | HUB popup at 390 | inside the viewport, closes with Esc / close button |

## 5. Determinism
| # | Check | Pass when |
|---|---|---|
| 5.1 | Two runs of the spec on fresh databases | same results, same counts |
| 5.2 | `node scripts/db.mjs demo` twice | no row count change |
| 5.3 | Visible numbers | computed from live data (3 products), drawn samples not shown (INTENTIONAL-DATA) |

## Evidence to record
SHA · DB name · spec PASS / FAIL / SKIP counts · smoke JSON · console / network summary · screenshots per surface × width · server log summary.

## Related
- [DEMO_VERTICAL_FLOW_QA](DEMO_VERTICAL_FLOW_QA.md) · [DEMO_DEPLOY_ROLLBACK_CHECKLIST](DEMO_DEPLOY_ROLLBACK_CHECKLIST.md)
