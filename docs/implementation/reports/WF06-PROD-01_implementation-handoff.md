# WF06-PROD-01_implementation-handoff

**Allowed implementation scope for WF06-PROD-02 → 04**, derived from the frozen [runtime contract](WF06-PROD-01_runtime-contract.md) and [API / data contract](WF06-PROD-01_api-data-contract.md) (DEC-W6P). Anything not listed needs a new authorization. Gap ids refer to [WF06-PROD-00](WF06-PROD-00_gap-matrix.md).

## WF06-PROD-02 — data / read-model foundation (no API, no frontend)
| # | Current | Target | Files / modules | DB impact | Risk |
|---|---|---|---|---|---|
| P2-1 | no canonical Library query | server-only query functions: PUBLIC ACTIVE STARTUP ventures with stage / domain / region labels; their owners through `projectDiscovery(…, 'NETWORK')`; deterministic order and opaque cursor; folded-name key for suppression | new `src/lib/library/canonical-source.ts` (+ db-test) | QUERY only | visibility drift → tests per D03 / D04 |
| P2-2 | external categories are raw strings | reviewed static map external category → DOMAIN slug; unmapped → no facet | new `src/lib/library/external-domain-map.ts` (+ unit test); `startup-adapter.ts` reads it | none | wrong mapping → reviewed list, no inference |
| P2-3 | external founder names searchable | drop founder names from the external search fields | `startup-adapter.ts`, `library-model.ts` | none | none |
| P2-4 | no index evidence | `EXPLAIN ANALYZE` of P2-1 on a production-sized copy; add a partial index only if the plan needs it (additive migration `017`, PO / contract note) | report; `db/migrations/017_*` only if proven | INDEX_REQUIRED only on evidence | schema creep → default NO_CHANGE |
| P2-5 | no WF06 fixture | deterministic helper: PUBLIC / PRIVATE / DRAFT / ARCHIVED ventures, STARTUP / PROJECT, owners NETWORK_ONLY / PRIVATE / deactivated, a same-name external record, > 9 rows | new `src/lib/library/testing.ts` | test data only | shared rows → own slugs, cleanup |

## WF06-PROD-03 — API / visibility / read hardening (renamed: no matching scope)
| # | Target | Files / modules | API impact |
|---|---|---|---|
| P3-1 | `GET /api/v1/library/startups` merging canonical rows and the TEMPORARY_EXTERNAL remainder (suppression, filters, sorts, cursor, limit 9 / 50, `q` ≤ 120) | new `src/app/api/v1/library/startups/route.ts`, `lib/library/*` | API contract amendment (§25) |
| P3-2 | `GET /api/v1/library/founders`: D03; guests `items: []`, `restricted: true` | `…/library/founders/route.ts` | same |
| P3-3 | `GET /api/v1/library/problems`: the temporary file, server-paged | `…/library/problems/route.ts` | same |
| P3-4 | organization page children capped at 200 + total count; db-test for `lib/public/organization.ts` | `lib/public/organization.ts` (+ db-test) | none (DTO unchanged) |
| P3-5 | error envelope (422 for malformed / unknown id or sort), 5xx logged without body, no ids in DTOs | handlers | — |
| P3-6 | API + security tests: visibility per actor, no enumeration, no bulk, external outage | new `tests/visual/specs/wf06-prod-api.spec.ts`, db-tests | — |
Not in PROD-03: matching, recommendation, ranking, search-all, write endpoints, `/profiles/{id}`, venture / programme public reads.

## WF06-PROD-04 — frontend integration (existing surfaces only)
| # | Target | Files |
|---|---|---|
| P4-1 | `/library` reads the three APIs (facets, sorts, keyword, "Xem thêm" via cursor) instead of the full dataset in the page; layout unchanged | `src/app/(public)/library/page.tsx`, `src/components/library/*` |
| P4-2 | canonical startup cards without a website CTA; founder tab permission state for guests; loading / empty / error / filtered / paged states; L15 / L15b / L15c responsive baselines | same |
| P4-3 | `/organizations/:slug` and the home search: no change beyond PROD-03 data | — |
Not in PROD-04: member directory, venture / programme / challenge discovery pages, new nav entry, the WF02 privacy switch copy (separate copy review, DEC-WF02-S03-D2).

## WF06-PROD-05 / 06 (for reference)
05: functional, visibility, privacy, enumeration, pagination, outage and leakage QA. 06: pixel / responsive against L15 / L15b / L15c and L19, protected regression, closure. SHELL-MOBILE-01 stays separate.

## Boundaries
Admin Portal starts after WF06-PROD-06. Sprint1 UAT (auth replacement, feedback modal, AI profile helper, AI venture import, RoleVerificationRequest, About / Home / Library feedback) stays its own lane; if it changes canonical profile or venture fields, WF06 reads them unchanged. Cross-WF follow-ups outside WF06: open-programme list vs owner organization status (WF05), global rate limit (G14).

## Related
- [WF06-PROD-01_runtime-contract.md](WF06-PROD-01_runtime-contract.md) · [WF06-PROD-01_api-data-contract.md](WF06-PROD-01_api-data-contract.md) · [WF06-PROD-00_gap-matrix.md](WF06-PROD-00_gap-matrix.md)
