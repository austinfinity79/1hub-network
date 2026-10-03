# WF06-PROD-03_api-hardening

**WF06-PROD-03 — API / visibility / deterministic read hardening (IMPLEMENT)** on the PROD-02 foundation (`c405c3c`), under the frozen [runtime contract](WF06-PROD-01_runtime-contract.md) and [handoff](WF06-PROD-01_implementation-handoff.md) P3-1 … P3-6 (DEC-W6P). Verdict: **PASS_WITH_EVIDENCE**. Three read-only routes for the existing `/library` tabs, recorded as [API amendment A8 (§25)](../../architecture/05_API_CONTRACT_P0_v1.0.md); the organization page bound (P3-4). No write, no new surface, no frontend.

## Preflight (evidence 1)
| Check | Result |
|---|---|
| branch / HEAD | `feat/wf06-prod-hardening` at `c405c3c` (PROD-02); unchanged until the commit |
| migrations | 001 → 016; no migration added |
| origin/main · production | `78f21f2` · `78f21f2` (read only) |
| Claude B / other lanes | `fb2130f`, `a957876`, `c1b60c3` not in HEAD |
| runtime fixture dependency | none: `src/lib/library/testing.ts` is imported by tests only |
| tree | clean except the untracked `AGENTS.md` |

## API inventory (evidence 2)
| Method / route | Auth | Visibility | Filters | Sort | Pagination | Source | Errors | Limits | Class |
|---|---|---|---|---|---|---|---|---|---|
| GET `/library/startups` | none | PUBLIC ACTIVE STARTUP; same for all | `q`, `domain_id`, `stage_id` | STAGE, NAME | cursor, 9 / 50 | `projects` + feed remainder | 422, 500 | page ≤ 50, `q` ≤ 120, ≤ 10 values, canonical cap 1000 | GREEN (new) |
| GET `/library/founders` | session optional | D03; guests restricted | `q`, `domain_id` | NAME | same | owners via discovery projection | same | same | GREEN (new) |
| GET `/library/problems` | none | public file | `q`, `domain`, `stage`, `area` | DEADLINE, PRIZE | same | `dir-bai-toan.json` | same | same | GREEN (new) |
| GET `/organizations/by-slug/{slug}` | none | PUBLISHED HUB / CHAPTER / CLB | — | children by name | children ≤ 200 + total; events 6 | WF03 | uniform 404 | bounded | GREEN (was PARTIAL: unbounded children) |
| GET `/vocabularies/{type}` | none | ACTIVE items | `q`, `status` | sort order | cursor 50 / 200 | `vocabulary_items` | 404 type | bounded | GREEN (unchanged; facet labels) |
| `/library` page | none | external directory until PROD-04 | client-side | client-side | "Xem thêm" | feed + file | page states | — | PARTIAL → PROD-04 |
| public organization list / search | — | — | — | — | — | — | — | — | OUT_OF_P0 (no frozen surface; ops list is WF03) |
| `/ventures/{id}`, `/events/{id}`, `/me/network` | session | owner / team / scoped | — | — | — | WF02 / WF03 | 401 / 404 | — | OUT_OF_P0 for discovery (unchanged; L6 IDOR) |
| `/profiles/{id}`, `/search`, `/discovery/*`, `/public/ventures`, matching | — | — | — | — | — | — | 404 | — | OUT_OF_P0 (absent) |
POST / PUT / PATCH / DELETE on the Library routes → 405; `/api/v1/library`, `/library/startups/{id}`, `/library/ventures|members|programmes|challenges|recommendations|search` → 404 (HTTP spec).

## Clarifications made within the frozen contract (for PO review)
| # | Point | Choice | Why |
|---|---|---|---|
| C1 | malformed query status | 422 `PROFILE_VALIDATION_FAILED` | frozen PROD-01 contract; the repo has no generic 400 code (400 is WF01 auth only) |
| C2 | several values of one filter | any of them, ≤ 10 | the page's facets are multi-select today |
| C3 | `total`, `facets` with counts, `degraded` beside the envelope | added | the page shows counts and "Xem thêm N"; without them PROD-04 would change the layout |
| C4 | `limit` > 50, unknown parameter | refused (422), not clamped or ignored | abuse-safe and visible to the caller |
| C5 | member (NETWORK) viewer | live session of an ACTIVE account | the existing media rule for discovery data; onboarding state not required |
| C6 | problem facet values | the file's text; an absent value matches nothing | keeps the quick chips' current behaviour |
| C7 | provenance | not serialised; external keys opaque | `website` / `member_count` already distinguish the cards |

## Files changed (evidence 24)
- New: `src/app/api/v1/library/{startups,founders,problems}/route.ts`; `src/lib/library/library-api.ts` (+ `library-api.test.ts`); `src/lib/library/library-routes.db-test.ts`; `tests/visual/specs/wf06-prod-api.spec.ts`.
- Modified: `src/lib/library/library-data.ts` (+ test), `library-service.ts`, `canonical-source.ts` (vocabulary order), `testing.ts` (member viewer, account ids, relationship cleanup), `canonical-source.db-test.ts`; `src/lib/public/organization.ts` (children ≤ 200).
- Docs: `05_API_CONTRACT_P0_v1.0.md` §25 and `.yaml` (3 paths), the five `WF06-PROD-03_*` reports, `CLAUDE_LATEST_REPORT.md`.

## Git and confirmation (evidence 25 – 29)
Local commit only (SHA in `CLAUDE_LATEST_REPORT.md` and the final chat report); working tree clean except `AGENTS.md`; origin/main `78f21f2`; production `78f21f2`. Confirmed: no new discovery surface, no matching / recommendation, no write API, no frontend implementation, no push, no merge, no deploy, PROD-04 not started.

## Self-audit (section 27)
All 18 items confirmed: foundation reused; visibility server side; founder privacy; canonical wins duplicates; deterministic filters / sort; stable pages; bounded queries; external failure isolated; application / private data excluded; no id bypass; no new surface; no matching; no writes; regression GREEN; no push / merge / deploy; PROD-04 not started.

## Related
- [WF06-PROD-03_visibility-privacy.md](WF06-PROD-03_visibility-privacy.md) · [WF06-PROD-03_query-behaviour.md](WF06-PROD-03_query-behaviour.md) · [WF06-PROD-03_tests-evidence.md](WF06-PROD-03_tests-evidence.md) · [WF06-PROD-03_prod04-handoff.md](WF06-PROD-03_prod04-handoff.md)
- [WF06-PROD-02_data-foundation.md](WF06-PROD-02_data-foundation.md)
