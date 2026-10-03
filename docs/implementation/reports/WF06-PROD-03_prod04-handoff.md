# WF06-PROD-03_prod04-handoff

**Frontend handoff to WF06-PROD-04 (existing surfaces only)** (evidence 23). Parent: [WF06-PROD-03_api-hardening.md](WF06-PROD-03_api-hardening.md). Scope per [WF06-PROD-01 handoff](WF06-PROD-01_implementation-handoff.md) P4-1 … P4-3; PROD-04 not started.

## Routes
| Page | Change in PROD-04 |
|---|---|
| `/library` (tabs Bài toán, Startup, Nhà sáng lập) | read the three APIs instead of the full datasets; layout, tabs, facets, sorts, "Xem thêm" unchanged |
| `/organizations/:slug` | none (children now ≤ 200; `stats.children` is the total) |
| home search → `/library?q=` | none; `q` passed to the APIs as typed (the API normalises) |
No new route, nav entry or CTA.

## API use per tab
| Tab | Call | Query | Response used |
|---|---|---|---|
| Startup | `GET /api/v1/library/startups` | `q`, `domain_id`*, `stage_id`*, `sort` STAGE / NAME, `cursor`, `limit` 9 | `items`, `page.next_cursor`, `total`, `facets.domain` / `facets.stage` (id, label, count), `degraded` |
| Nhà sáng lập | `GET /api/v1/library/founders` | `q`, `domain_id`*, `cursor`, `limit` | `items`, `total`, `facets.domain`, `restricted` |
| Bài toán | `GET /api/v1/library/problems` | `q`, `domain`*, `stage`*, `area`*, `sort` DEADLINE / PRIZE | `items`, `total`, `facets.domain` / `stage` / `area` (value, label, count) |
\* repeatable, ≤ 10 values. Items: see [API §25.1](../../architecture/05_API_CONTRACT_P0_v1.0.md).

## States
| State | Source | Render |
|---|---|---|
| loading | request in flight | the existing skeleton / loading state |
| empty | `total: 0` with a keyword or filter | existing "Không có … nào khớp bộ lọc" |
| error | non-200 or network failure | the existing error state of the tab |
| permission | founders `restricted: true` | the founder-tab permission state for guests (needs the approved frame / copy; no names, no placeholders) |
| pagination | `page.next_cursor` | "Xem thêm {total − shown}"; append the next page; reset on any filter / sort / keyword change |
| filter state | `facets` | facet values and counts from the answer (DOMAIN / VENTURE_STAGE ids for Startup and founders); quick chips map to DOMAIN ids |
| founder hidden | owner absent from `items` | nothing rendered for them; never an initial or placeholder |
| external fallback | `degraded: true` | render the canonical items; the tab's error state only when `degraded` and `total` is 0 without a filter |
| canonical card | `website` null, `member_count` null | inert "Xem hồ sơ" (as a card without a website today); no member-count line |

## Open points for PROD-04 / PO
| # | Point |
|---|---|
| H1 | "Chưa xác định" (no stage) is a facet value on the page but the frozen API filters by VENTURE_STAGE id only: drop the value or keep it count-only — needs a PO / design call |
| H2 | quick chips are categories today; with canonical data they become DOMAIN items (the reviewed slug map, PROD-02 open item) |
| H3 | `l6-discovery-privacy` asserts "PUBLIC venture never on `/library`" (DEC-PDF-D1 / DEC-L6-D1: PUBLIC grants no read). Once the page reads the API, DEC-W6P-D02 (PO D4) lists PUBLIC STARTUP names there: PO to confirm that D02 is the decision DEC-L6-D1 asked for, then align the spec (ids, owners and private ventures still never) |
| H4 | L15 / L15b / L15c pixel baselines and responsive checks after wiring |

## Related
- [WF06-PROD-03_query-behaviour.md](WF06-PROD-03_query-behaviour.md) · [WF06-PROD-01_runtime-contract.md](WF06-PROD-01_runtime-contract.md)
