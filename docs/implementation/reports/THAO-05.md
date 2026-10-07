# THAO-05

DIR0–DIR3 discovery — production closure of Thảo item #5 on the PO decisions of 07/10.

- Milestone: THAO-M2 · branch `feat/thao-m2-discovery` · worktree `../1hub-network-thao-m2` · base `547e174`
- Decisions: [DEC-THAO-DIR](../../decisions/DECISION_LOG.md#dec-thao-dir) D1–D6 (committed before any runtime change)
- No migration, no canonical data written; not merged, not deployed.

## Directories
| Surface | Route | Source | Visibility | Card destination |
|---|---|---|---|---|
| DIR0 Chương trình | `/programmes` | `programmes` (public projection, `programme-directory.ts`) | PUBLISHED + CLOSED; DRAFT never; host named only when PUBLISHED | `/programmes/[id]/apply` for an eligible signed-in member (PUBLISHED, form, not ended), else READ_ONLY |
| DIR1 Bài toán | `/problems` | `dir-bai-toan.json` via the Library adapter | public dataset; `challenge_id` dropped | READ_ONLY (no button) |
| DIR2 Sản phẩm | `/products`, `/products/[slug]` | `projects` STARTUP · ACTIVE · PUBLIC | unchanged predicate; hidden slugs 404 | `/products/[slug]` |
| DIR3 Nhân tài | `/talents` | `individual_profiles` through `projectDiscovery` | guest: gate, nothing read; member: NETWORK_ONLY cards | allow-listed demo founder → `/talents/[handle]`; real people READ_ONLY |

Phase (DIR0) is derived for display only: Sắp tới / Đang mở / Đã kết thúc.

## Shared discovery contract
| Part | Detail |
|---|---|
| Address | `q`, filters, `quoc-gia` / `tinh`, `sap-xep`; written with `history.replaceState` (no round trip), read by the same pure readers on the server (refresh, shared link) and on arrival (Back) — `discovery-views.ts` |
| Location (D6) | COUNTRY → REGION (`metadata.country`); invalid pair or unknown slug → controlled empty state; legacy `?tinh=<label>` rewritten to slugs |
| Sort | deterministic with a tie-break; DIR0 phase · DIR1 Sắp hết hạn / Giải thưởng / A–Z · DIR2 Hoạt động / Mới nhất / A–Z · DIR3 A–Z / Có sản phẩm |
| States | count, active-filter chips, Xoá tất cả, empty, loading (list routes only), error + Thử lại (no 5xx) |
| Layout | one stylesheet `components/discovery/discovery.module.css` (from DM08) |

## Fixes found by the new tests
| Issue | Fix |
|---|---|
| `loading.tsx` above `/products/[slug]` and `/talents/[handle]` made 404 answers 200 (streaming) | loading moved into a `(list)` route group |
| `router.replace` per filter refetched the page; Back lost the view | `replaceState` + restore from the address |
| Footer near 1024 px: column 2 was 57 px, "Chương trình" wrapped onto "Sản phẩm" (hidden while they were labels) | grid `minmax(0,447px) minmax(0,447px) minmax(180px,1fr)`; 1440 unchanged |
| "Chương trình ▾" had no current state | label marked current on `/programmes` |

## Navigation
Header: "Chương trình, cuộc thi" → `/programmes`, "Nhân tài" → `/talents` (desktop, mobile); footer likewise; Sự kiện and Tin tức stay labels. `/problems` is reached from `/programmes` (and back).

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build · unit | PASS · PASS · PASS · PASS · 466 / 466 |
| thao-05-discovery | 20 / 20 |
| Pixel 1440 hero (gated) | DM06 0.57 / 0.68 % · DM09 0.61 / 0.44 %; results areas reported (data) |
| DB tests | 873 / 873 |
| Full regression (106 specs, 1386 tests) | 1349 PASS · 29 SKIP (opt-in) · 8 FAIL: 7 timeouts under host load (run took 67 min vs 27), 1 test-design issue (113 QA profiles share the demo founder's name) fixed |
| Rerun of the 7 failing specs | 203 / 203, 0 flaky |
| UAT L1–L2 | 19 / 19 |

Updated stale assertions (nav labels became links per DEC-THAO-DIR): alpha-interaction-gaps, demo-dir2-01, demo-home-about-01, thao-01, thao-02, wf04-t00, UAT uc02.

## Related
- [THAO-04](THAO-04.md) · [SCREEN_ROUTE_MAP](../../demo-0710/SCREEN_ROUTE_MAP.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
