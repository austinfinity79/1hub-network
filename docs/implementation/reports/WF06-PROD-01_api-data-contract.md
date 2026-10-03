# WF06-PROD-01_api-data-contract

**WF06-PROD-01 — canonical sources, read model, search / sort, API, DB, frontend, security and test contract** for the frozen scope in [WF06-PROD-01_runtime-contract.md](WF06-PROD-01_runtime-contract.md) (DEC-W6P).

## Canonical sources (reuse only)
| Need | Source |
|---|---|
| venture (Startup tab) | `projects` (`type`, `name`, `summary`, `status`, `visibility`, `stage_id`, `region_id`), `project_domains` |
| founder | `projects.owner_profile_id`, `owner_role_label`; `individual_profiles` (display name, avatar, status) + `profile_visibility_settings` through `projectDiscovery(…, 'NETWORK')` |
| organization page | `organizations`, `organization_relationships`, `community_memberships` (counts), `events` (unchanged) |
| taxonomy / location | `vocabulary_items` DOMAIN, VENTURE_STAGE, REGION |
| programmes, challenges, applications | not read by WF06 |
No copied discovery entity, no LibraryContentV2, no ProfileSearchV2 / ProjectDiscoveryV2.

## Read model
DIRECT_CANONICAL_READ + existing indexes. No persisted read model: the data is small, visibility must stay in the canonical query, and no ranking or cross-entity aggregate needs precomputing. The external feed keeps its in-memory cache (5 s timeout, 10 min cache, 24 h stale fallback, 2 MB / 1000 cap); it is never persisted.

## Search / filter / sort
| Tab | Keyword fields | Filters | Default sort (existing) | Other sorts |
|---|---|---|---|---|
| Startup | name, summary, domain labels (canonical); name, tagline, product, domains (external) — never founder names | `domain_id` (DOMAIN), `stage_id` (VENTURE_STAGE) | stage (VENTURE_STAGE `sort_order`, unmapped last), then name (vi fold), then source (canonical first), then key | name |
| Nhà sáng lập | display name, venture names (members only) | `domain_id` of the listed ventures | name, then key | — |
| Bài toán | title, short title, summary, org, domains (file) | existing facets (domain, stage, area: raw values of the temporary file) | deadline (nulls last), then name | existing |
Keyword: case- and accent-folded substring, every word must match (existing rule), ≤ 120 characters. No fuzzy, semantic, ML, personalised or scored ordering.

## API (read-only)
| Route | Auth | Visibility | Filters | Pagination | Errors | Boundaries |
|---|---|---|---|---|---|---|
| `GET /api/v1/library/startups` | none | D02 / D04 | `q`, `domain_id`, `stage_id`, `sort` | `cursor`, `limit` 9 default, 50 max (§2.4 envelope) | `422 PROFILE_VALIDATION_FAILED` for a malformed or unknown id / sort; 5xx logged without body | no ids / slugs / owner ids; no export |
| `GET /api/v1/library/founders` | session optional | D03: guests get `items: []` with `restricted: true` | `q`, `domain_id` | same | same | names only for members |
| `GET /api/v1/library/problems` | none | public (temporary file) | `q`, existing facets, `sort` | same | same | file content only |
| `GET /api/v1/organizations/by-slug/{slug}` | none | unchanged | — | children capped at 200 with total count; events 6 | unchanged uniform 404 | unchanged DTO |
Reads are not audited (no read events, existing convention). No write, search-all, matching or recommendation API; the L6 guard's 404 paths stay 404.

## DB / index
| Item | Class |
|---|---|
| Library canonical queries | QUERY_CHANGE_ONLY |
| `projects` filter on `type`, `status`, `visibility` | NO_CHANGE by default; INDEX_REQUIRED only if PROD-02 shows a sequential scan that matters on a production-sized copy (`EXPLAIN ANALYZE` evidence) |
| organization children bound | QUERY_CHANGE_ONLY |
| views, tables | none (VIEW_REQUIRED / TABLE_REQUIRED rejected) |

## Frontend
`/library` keeps its layout, tabs, facets, sorts and "Xem thêm"; data comes from the three APIs instead of the full dataset in the page; canonical cards render without a website CTA; the founder tab shows a permission state to guests; loading, empty, error, filtered and paged states as today; responsive as L15 / L15b / L15c. `/organizations/:slug` and the home search unchanged. No new IA, nav entry or dead CTA.

## Security
Server-side visibility in SQL; no UUID, slug, owner id, metadata or internal field in any DTO; opaque cursors; page ≤ 50 and no endpoint returning the whole dataset; no private profile field, no DRAFT / PRIVATE / ARCHIVED venture, no programme or application; contact data never shown (canonical rows carry none; external rows keep the existing contact stripping).

## Test contract (deterministic fixture, no production content)
| Case | Fixture |
|---|---|
| public visible | PUBLIC ACTIVE STARTUP with domains and stage |
| private / hidden | PRIVATE ACTIVE, DRAFT, ARCHIVED, PUBLIC PROJECT — never listed |
| founder visible | owner NETWORK_ONLY; member viewer |
| founder hidden | owner PRIVATE; guest viewer; deactivated owner |
| canonical vs temporary | external record suppressed by a same-name canonical venture; one kept |
| empty, filtered, paged | no match; `domain_id` / `stage_id`; > 9 rows with cursor |
| forbidden / invalid | malformed id, unknown sort → 422; no id in any response |

## Related
- [WF06-PROD-01_runtime-contract.md](WF06-PROD-01_runtime-contract.md) · [WF06-PROD-01_implementation-handoff.md](WF06-PROD-01_implementation-handoff.md)
