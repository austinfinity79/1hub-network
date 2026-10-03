# WF06-PROD-02_prod03-handoff

**Handoff to WF06-PROD-03 (API / visibility / read hardening — matching is out of P0)** (evidence 21). Parent: [WF06-PROD-02_data-foundation.md](WF06-PROD-02_data-foundation.md). Scope per [WF06-PROD-01 handoff](WF06-PROD-01_implementation-handoff.md) P3-1 … P3-6; PROD-03 not started.

## Functions ready for API use
| Function (module) | Returns | For |
|---|---|---|
| `listLibraryStartups({ q, domainId, stageId, sort, cursor, limit })` (`library-service`) | `{ items, nextCursor, total, external: 'ok' \| 'unavailable' }` | `GET /api/v1/library/startups` |
| `listLibraryFounders(viewer, { q, domainId, cursor, limit })` (`library-service`) | `{ items, nextCursor, total, restricted }` | `GET /api/v1/library/founders` |
| `paginate(items, cursor, limit)`, `LibraryQueryError` (`library-data`) | page + cursor; throws on a forged cursor | problems paging; error mapping |
| `PAGE_DEFAULT` 9, `PAGE_MAX` 50, `LIBRARY_QUERY_MAX` 120 | limits | input validation |
| `vocabularyForLibrary()` (`canonical-source`) | ACTIVE DOMAIN / VENTURE_STAGE maps | validating `domain_id` / `stage_id` |
| `LIBRARY_PROBLEMS`, `problemTab`, `matches`, `sortItems` (existing) | problem items, facets, sorts | `GET /api/v1/library/problems` |
| `getPublicOrganization(slug)` (existing) | organization DTO | P3-4 children cap |
Items carry no UUID, slug, owner id or e-mail; serialise them as they are.

## What PROD-03 must add
| Area | Requirement |
|---|---|
| read API | three GET routes under `/api/v1/library`; no write, export or search-all |
| visibility | viewer from the session (signed-in ACTIVE account → `NETWORK`, else `GUEST`), never from the client; guests keep `restricted: true` |
| filters | reject malformed or unknown `domain_id` / `stage_id` and unknown `sort` with 422 `PROFILE_VALIDATION_FAILED` (the data layer only returns an empty page) |
| pagination | map `LibraryQueryError` to 422; `limit` outside 1 – 50 → 422 or clamp, as the API amendment states |
| deterministic sorting | `STAGE` default, `NAME`; founders by name; problems unchanged |
| privacy | no field beyond the item types; 5xx logged without body; reads not audited |
| abuse-safe limits | page ≤ 50, `q` ≤ 120, canonical read capped at 1000 (warning at the cap; move paging into SQL if it ever triggers); global rate limit stays G14 |
| tests | API + security spec per P3-6 reusing `seedLibraryFixture` / `clearLibraryFixture` |

## Open items (not blocking PROD-02)
- HUB / PO review of the external category → DOMAIN slug list against the production DOMAIN vocabulary (inert until slugs match).
- PO awareness: PUBLIC ventures of deactivated or blocked owners stay listed (frozen predicate; WF02 lifecycle question, not WF06).

## Related
- [WF06-PROD-02_query-index-audit.md](WF06-PROD-02_query-index-audit.md) · [WF06-PROD-02_visibility-security.md](WF06-PROD-02_visibility-security.md) · [WF06-PROD-01_api-data-contract.md](WF06-PROD-01_api-data-contract.md)
