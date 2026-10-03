# WF06-PROD-05_prod06-handoff

**Final pixel / responsive / closure handoff to WF06-PROD-06** (evidence 26). Parent: [WF06-PROD-05_qa-summary.md](WF06-PROD-05_qa-summary.md). PROD-06 not started.

## Routes and states
| Route | States to capture |
|---|---|
| `/library` › Bài toán | first page, filtered (Logistics as L15), "Xem thêm" / page end, empty, loading (delayed answer), error + retry |
| `/library` › Startup | first page (canonical + external), canonical card without website / member line, external card, stage / domain filter, page 2, empty, error |
| `/library` › Nhà sáng lập | member: founder cards (L15c); guest: sign-in state |
| `/library?q=…` | keyword applied from the homepage |
| `/organizations/:slug` | published HUB / CHAPTER / CLB; children heading total; no-children state |

## Viewport matrix
1440 × 900 DPR1 (reference), 1728, 1920 (gutter rule), 1280, 1024, 768, 390 (filters folded behind "Bộ lọc"). PROD-04 / 05 smoke: no horizontal overflow at 1440 / 768 / 390 in any state.

## Cases
| Area | Cases |
|---|---|
| guest / member | guest and member on each tab; logout reload |
| founder visible / hidden | visible owners drawn; hidden owners absent; guest sign-in state |
| filters | DOMAIN / VENTURE_STAGE facets with counts, zero values kept; quick chips (Bài toán labels; Startup / founders DOMAIN map) |
| pagination | 9 → "Xem thêm N" → end; refused next page retry |
| external fallback | server on an unreachable feed (`LIBRARY_STARTUP_SOURCE_URL`); crafted feed for unsafe data |
| loading / empty / error | dimmed grid + "Đang tải…", empty block, error block + "Thử lại" |
Fixture: `seedLibraryFixture()` + `addVisibleFounder()`; member session via `createSession()`; QA vocabulary fixture re-applied after any DB reset.

## Known baseline debt / risks
| # | Item |
|---|---|
| V1 | facet values are the DOMAIN / VENTURE_STAGE vocabulary (production DOMAIN list unknown here; dev DB has QA items) |
| V2 | Startup / founder quick chips follow the reviewed DOMAIN slug map; row hidden (space kept) when none matches |
| V3 | canonical startup cards: no member line and no website button, so card heights vary |
| V4 | mark tones derive from opaque keys |
| V5 | guest founder sign-in state: new on L15c (existing block style; copy for PO / design) |
| V6 | "Chưa xác định" stage value no longer a facet (PO / design H1) |
| V7 | the external feed is live data: Startup pixel captures depend on it unless the server runs on a fixed feed |
| V8 | `pixel-qa-screens` WF01–WF03 runs report PENDING_REVIEW pixel differences by design (they fail only on V0 / typography) |

## Closure inputs
PROD-02 … 05 reports; H3 (DEC-L6-D1 / DEC-PDF-D1 reading under DEC-W6P-D02) and the DOMAIN slug map review still open for the PO.

## Related
- [WF06-PROD-04_prod05-handoff.md](WF06-PROD-04_prod05-handoff.md) · [WF06-PROD-05_functional-quality.md](WF06-PROD-05_functional-quality.md)
