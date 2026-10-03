# WF06-PROD-03_tests-evidence

**Restart / determinism, performance smoke, test totals, protected regression and bugs** (evidence 18 – 22). Parent: [WF06-PROD-03_api-hardening.md](WF06-PROD-03_api-hardening.md).

## Restart / determinism (evidence 18)
| Check | Result |
|---|---|
| real server restart (new process, same build, same data) | 5 answers byte-identical before / after: startups page 1 (5,310 B), page 2 with the **pre-restart cursor** (5,372 B), founders as a member (4,308 B), problems by prize (25,097 B), startups by name (8,344 B) |
| fresh module instance (db-test) | same body and same next page |
| identity | keys derive from canonical ids (`projects.id`, `individual_profiles.id`); no session-local discovery state |

## Performance smoke (evidence 19)
| Call (built server, fixture + live feed) | Guest | Member |
|---|---|---|
| startups `q=WF06&limit=50` | 5 ms | 4 ms |
| startups domain filter, `NAME` | 3 ms | 4 ms |
| startups, no filter | 3 ms | 5 ms |
| founders `limit=50` | 2 ms | 8 ms |
| problems `limit=50` | 2 ms | 4 ms |
| problems area filter, `PRIZE` | 2 ms | 2 ms |
SQL statements per request are fixed (2 / 6 / 0), so no N+1; result sets bounded (page ≤ 50, canonical cap 1000). PROD-02's plans stand (Q1 22.7 – 34 ms at 50k synthetic projects).

## Targeted test totals (evidence 20)
| Suite | Result |
|---|---|
| `library-api.test.ts` (parsing) | 6 |
| `library-data.test.ts` (+ multi-value, facet counts, opaque external keys) | 21 |
| `library-routes.db-test.ts` (inventory, matrix, merge, failure, filters, sort, normalisation, pages, bounds, ids, exclusion, query count, determinism, org bound) | 26 |
| `canonical-source.db-test.ts` (updated) | 16 |
| `wf06-prod-api.spec.ts` (HTTP: inventory / methods, cookie / spoofing, timings) | 3 |
| gates | format, lint, typecheck PASS; unit 36 files / 340 tests; DB 37 → 38 files / 611 tests; production build PASS |

## Protected regression (evidence 21)
24 specs, one run on the rebuilt server, **275 / 275**: `wf06-prod-api`, `public-library`, `l6-discovery-privacy`, `alpha-interaction-gaps`, `p0-landing`, `pdf-alpha-decisions`, `wf03-s09` / `s08` / `s01`, `wf02-s01` / `s03` / `s05` / `s08` / `t00`, `wf02-uat-journey`, `wf05-s01` / `s02`, `wf01-s07`, `release-rc-responsive`, `auth-session`, `authz-session`, `wf01-s01` / `s03` / `s04`. WF04 not touched (no shared read path). The ACC-07 QA vocabulary fixture was re-applied after the DB suite's reset, before the run. No canonical data mutated; fixture rows removed (0 left).

## Bugs found / fixed (evidence 22)
| Class | Finding | Action |
|---|---|---|
| API_BUG | external item `key` exposed the feed's slug and an `x-` provenance prefix (implementation detail) | fixed: opaque hash |
| API_BUG | organization page children unbounded (P3-4) | fixed: ≤ 200 by name, `stats.children` total |
| FRONTEND_GAP | `/library` still renders the external directory; guest founder permission state; "Chưa xác định" stage facet has no API id | PROD-04 ([handoff](WF06-PROD-03_prod04-handoff.md)) |
| OUT_OF_SCOPE (test) | `l6-discovery-privacy` asserts a PUBLIC venture never shows on `/library`; true until PROD-04 wires the page; DEC-W6P-D02 (PO D4) then lists PUBLIC startups there, read against DEC-PDF-D1 / DEC-L6-D1 "PUBLIC grants no read" | PROD-04: PO confirms the reading, then the spec is aligned |
No CONTRACT_CONFLICT, PRIVACY_BUG, VISIBILITY_BUG, FILTER_BUG, PAGINATION_BUG, EXTERNAL_ADAPTER_BUG or PERFORMANCE_BUG.

## Related
- [WF06-PROD-03_query-behaviour.md](WF06-PROD-03_query-behaviour.md) · [WF06-PROD-02_query-index-audit.md](WF06-PROD-02_query-index-audit.md)
