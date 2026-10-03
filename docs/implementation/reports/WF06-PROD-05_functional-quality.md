# WF06-PROD-05_functional-quality

**Happy path, filters, sort, pagination, merge, query abuse, bounds, restart, data quality, keyboard smoke and runtime errors** (evidence 4, 8 – 11, 16 – 21). Parent: [WF06-PROD-05_qa-summary.md](WF06-PROD-05_qa-summary.md).

## Happy path (evidence 4)
| Surface | Result |
|---|---|
| `/organizations/chapter-01` | 200, stats and children drawn |
| problems API / tab | 47 records, first page 9, "Xem thêm" to the end |
| startups API / tab | canonical + external (live feed: 91 total, 33 external with a website, `degraded: false`); fixture: 18 canonical WF06 startups, page 2 by cursor, stage filter (Pilot → 4) |
| founders | member: visible owners; guest: sign-in state |
| ids | API keys derive from canonical ids; no fixture at runtime |

## Filters (evidence 8)
| Case | Result |
|---|---|
| valid keyword | one record for "WF06 Ổ Khóa" |
| case, accents, extra spaces, NFD | same keys as the plain keyword |
| empty / whitespace | identical to no keyword |
| control character | 422 `q: invalid` |
| unknown / malformed vocabulary id | 422 `unknown` / `invalid` |
| repeated `q` | 422 `duplicate`; repeated or upper-case id → deduplicated, same result |
| unknown parameter (`category`) | 422 `not_accepted` |
| location (problem `area`) | value filters; absent value → empty; empty value → 422 |
| content type | one route per tab |
| organization | NOT_APPLICABLE (not in the frozen contract) |

## Sort (evidence 9)
STAGE and NAME: three runs and guest vs member give the same keys; two canonical records with the same name and stage come back in the same order every time (the key breaks the tie). No score.

## Pagination (evidence 10)
`limit=4` walk returns the full list in order (no gap, no repeat); past the end → empty page, `next_cursor` null; `limit=50` 200; `51` → 422 `too_many`; `0`, `-1`, `1e3` → 422 `invalid`; repeated `limit` / `cursor` → 422 `duplicate`; non-canonical cursor `o:09` → 422.

## Canonical / external merge (evidence 11)
| Case | Result |
|---|---|
| canonical only (feed unreachable) | canonical rows, `degraded: true`, no external card, no error |
| external only (crafted) | external records without a twin listed once |
| canonical + external twin | canonical wins (no website button) |
| bad / missing-field / duplicate rows | dropped / nulls / kept once |
| timeout | canonical served (PROD-03 db-test; live unreachable feed here) |
Nothing is fabricated for a missing value.

## Query abuse and bounds (evidence 16, 17)
| Input | Answer |
|---|---|
| `q` of 10,000 characters | 422 in 5 ms |
| 200 repeated `domain_id` | 422 `too_many` |
| 1,000 repeated `domain_id` (≈ 47 KB URL), `q` of 30,000 | 431 from the HTTP server before the app |
| `limit=1000000`, `cursor=%%%`, `sort=name;DROP`, 121-char problem value, `__proto__` | 422 |
| `%`, `_`, `.*`, `\`, `' OR 1=1--` | 200, literal text (no `LIKE`, no regex, no SQL from input) |
Bounds: page ≤ 50, `q` ≤ 120, ≤ 10 values per filter, canonical read ≤ 1000 rows. No rate-limit layer exists for public reads (G14); none is claimed. No 500.

## Restart (evidence 18)
Real server restart with the fixture: 8 answers byte-identical (startups pages 1 and 2 with the pre-restart cursor, by name, founders as member and as guest, problems by prize, the published organization, the DRAFT organization's 404).

## Data quality (evidence 19)
Missing founder (hidden / deactivated owner: venture listed, no owner); missing location / stage / category (no pill, no region, no chips); a long Unicode title with an emoji (same card width, no overflow); two records with the same name (both, once each); duplicate external row (once); invalid external URL (no link); closed / inactive canonical (ARCHIVED venture absent, DRAFT / ARCHIVED organization 404).

## Keyboard and quality smoke (evidence 20)
Space toggles a facet; Enter submits the search; the empty state's "Xoá tất cả bộ lọc" works from the keyboard; load-more, retry and the guest sign-in link are named, focusable controls (PROD-04 smoke: arrows on tabs, Enter on "Xem thêm", focus outline solid).

## Console / hydration / 5xx (evidence 21)
Every QA journey asserts 0 console errors and 0 responses ≥ 500; the L6 runtime probe and `console-health` assert no hydration #418. Full run (82 specs): console errors 0, hydration errors 0, unexpected 5xx 0; controlled 4xx (422, 404, 401, 431) are expected answers.

## Related
- [WF06-PROD-05_privacy-security.md](WF06-PROD-05_privacy-security.md) · [WF06-PROD-03_query-behaviour.md](WF06-PROD-03_query-behaviour.md)
