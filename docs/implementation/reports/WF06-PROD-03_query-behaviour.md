# WF06-PROD-03_query-behaviour

**Merge, filters, sort, pagination, limits, normalisation, error contract and external failure** (evidence 5 – 12). Parent: [WF06-PROD-03_api-hardening.md](WF06-PROD-03_api-hardening.md). Contract text: [API §25](../../architecture/05_API_CONTRACT_P0_v1.0.md).

## Canonical / external merge (evidence 5)
| Rule | Behaviour (tested) |
|---|---|
| duplicate | an external record with a canonical twin (folded name) is dropped: the canonical card wins (`website` null, region kept) |
| repeated external name | first record kept; case-only variants included |
| unusable external row | no name / not an object → skipped; missing fields → null / `[]`; `javascript:` URL → null; unknown stage → null |
| uniqueness | every `key` unique in a list; one card per startup |
| provenance | internal only; external keys are opaque hashes (no source slug, no `x-` prefix) |
| privilege | the merge never widens visibility: canonical rows come from the SQL predicate, external rows carry no person |
| persistence | external content is never written to a table |

## Filters (evidence 6)
| Filter | Values | Behaviour |
|---|---|---|
| `q` | keyword | every word must appear; see normalisation |
| `domain_id` | ACTIVE DOMAIN UUIDs, ≤ 10 | any of them; unknown → 422 `unknown` |
| `stage_id` | ACTIVE VENTURE_STAGE UUIDs, ≤ 10 | any of them; unknown → 422 `unknown` |
| `domain` / `stage` / `area` (problems) | file text, ≤ 10, ≤ 120 chars | any of them; absent value → empty result |
| organization | — | not offered: no frozen venture → organization filter |
| location | problems `area` | canonical `region` is display only (frozen) |
| content type | one route per tab | — |
Facet counts apply the keyword and the other groups, as the page's `facetCount` does; zero counts listed.

## Sort (evidence 7)
Startups `STAGE` (default): GROWTH, SELLING, PILOT, MVP, IDEA, none → name (vi) → canonical first → key. `NAME`: name → canonical first → key. Founders: name → key. Problems: existing `DEADLINE` (stage rank, then deadline, dataset order on ties — the file is fixed) and `PRIZE`. Repeated requests return identical bodies (tested); no score of any kind.

## Pagination (evidence 8)
Default 9, maximum 50; opaque base64url offset cursor validated by re-encoding; walking `limit=4` pages returns exactly the full list in order (no gap, no repeat); past the end → empty page, `next_cursor` null; malformed cursor → 422 `invalid`; `limit` 0 / text → `invalid`, 51 → `too_many`. The cursor is stateless: valid across a server restart.

## Abuse-safe limits (evidence 9)
| Risk | Bound |
|---|---|
| unbounded page | ≤ 50 items; canonical read capped at 1000 rows (warning if reached) |
| giant keyword | > 120 characters → 422 before any read |
| repeated values | > 10 per filter → 422; duplicates removed |
| repeated single parameter | `q`, `sort`, `cursor`, `limit` twice → 422 `duplicate` |
| malformed cursor / wildcard | 422 / literal characters (no `LIKE`, no regex) |
| expensive broad query | no SQL filter by user input; fixed 2 statements (startups), 6 (founders, member), 0 (problems, guest founders, refused requests) |
| enumeration | no id lookup exists; offsets only page the visible list |
No rate-limit layer exists for public reads (G14), so none is claimed and no 429 is returned.

## Search normalisation (evidence 10)
NFC → whitespace collapsed → trimmed; NFD input, extra spaces, upper case and missing accents return the same result as the plain keyword; blank / whitespace-only = no keyword (identical body); control characters → 422 `invalid`.

## Error contract (evidence 11)
| Case | Answer |
|---|---|
| malformed / oversized / repeated / unknown parameter | 422 `PROFILE_VALIDATION_FAILED`, `fields` with every failing field |
| unknown vocabulary id | 422, reason `unknown` |
| no session on founders | 200 restricted (no 401: the data is simply not shown) |
| absent route / record path | 404; other methods 405 |
| unexpected fault | 500 generic envelope with `request_id`; no stack, SQL or adapter text (asserted on every 422 body) |

## External source failure (evidence 12)
Timeout (`TimeoutError`), non-JSON body, bad, duplicate and incomplete rows, invalid URL: canonical rows still served with 200; `degraded: true` while the feed is unavailable (no last good copy); the warning carries the error class only; nothing fabricated. The existing 10 min cache / 24 h stale fallback is unchanged.

## Related
- [WF06-PROD-03_visibility-privacy.md](WF06-PROD-03_visibility-privacy.md) · [WF06-PROD-03_tests-evidence.md](WF06-PROD-03_tests-evidence.md)
