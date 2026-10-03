# WF06-PROD-02_data-foundation

**WF06-PROD-02 — data / read-model foundation (IMPLEMENT)** under the frozen [runtime contract](WF06-PROD-01_runtime-contract.md) and [handoff](WF06-PROD-01_implementation-handoff.md) P2-1 … P2-5 (DEC-W6P). Verdict: **PASS_WITH_EVIDENCE**. Server-side read functions only: no API, no frontend, no schema change, no business write.

## Preflight (evidence 1)
| Check | Result |
|---|---|
| branch / HEAD | `feat/wf06-prod-hardening` at `83a84f4` (PROD-01 final re-freeze); unchanged before commit |
| migrations | 001 → 016 applied (existing DB and fresh DB) |
| origin/main · production | `78f21f2` · `78f21f2` (read only) |
| WF04 / WF05 candidates | `f40f70c`, `8c1fbd6`, `5199e07` are ancestors of HEAD |
| Claude B / other lanes | `fb2130f`, `a957876`, `c1b60c3` not in HEAD |
| concurrent writer | none; untracked `AGENTS.md` left alone |

## What was built
| Module | Role |
|---|---|
| `src/lib/library/canonical-source.ts` | SQL reads: `listPublicStartups`, `listVisibleFounders(viewer)`, `vocabularyForLibrary` |
| `src/lib/library/library-data.ts` | pure rules: `mergeStartups`, `founderEntries`, `filterEntries`, `sortStartups`, `sortFounders`, `paginate`, `opaqueKey`, `LibraryQueryError` |
| `src/lib/library/library-service.ts` | `listLibraryStartups(query)`, `listLibraryFounders(viewer, query)` for PROD-03 |
| `src/lib/library/external-domain-map.ts` | reviewed external category → DOMAIN slug map (P2-2) |
| `src/lib/library/testing.ts` | deterministic WF06 fixture (P2-5) |
| `startup-adapter.ts`, `library-model.ts` | founder names removed from search (P2-3, DEC-W6P-D03) |

## Direct read vs read model (evidence 5)
| Query path | Decision | Why |
|---|---|---|
| Startup list (`projects` + `project_domains` + `vocabulary_items`) | DIRECT_QUERY | predicate in SQL; 22–34 ms at 50k synthetic projects ([index audit](WF06-PROD-02_query-index-audit.md)) |
| Founder list (`individual_profiles` + `user_accounts` + `profile_visibility_settings`) | DIRECT_QUERY | primary-key lookups only |
| Vocabulary for mapping | DIRECT_QUERY | 21 rows |
| Organization page (WF03, unchanged) | DIRECT_QUERY | existing indexes `idx_org_type_status`, `idx_org_parent` |
| External startup feed / problem file | in-memory (existing cache) | never persisted |
No VIEW_REQUIRED or MATERIALIZED_READ_MODEL_REQUIRED path; no table, view or cache table created.

## Migration decision (evidence 9)
**NO_SCHEMA_CHANGE.** No migration 017. A probe partial index saved ≤ 2 ms at 2k and ~10 ms at 50k synthetic projects: below any evidence threshold for P0 ([details](WF06-PROD-02_query-index-audit.md)).

## Intentional deviations
| Item | Deviation | Reason |
|---|---|---|
| P2-2 | the DOMAIN map is applied in `library-data.ts` (merge), not inside `startup-adapter.ts` | the adapter stays a pure feed parser; the map needs the database's ACTIVE DOMAIN items |
| P2-1 | opaque key = first 16 hex of sha256(`wf06:<kind>:<canonical id>`) | the contract forbids ids in DTOs; the key is derived per read, stored nowhere and resolvable by no function |
| Live `/library` | still renders the external directory | wiring the page to the services is PROD-04 (FRONTEND_GAP) |

## Files changed (evidence 22)
- New: `canonical-source.ts`, `library-data.ts`, `library-service.ts`, `external-domain-map.ts`, `testing.ts` (all `src/lib/library/`).
- New tests: `canonical-source.db-test.ts` (16), `library-data.test.ts` (18), `external-domain-map.test.ts` (4).
- Modified: `startup-adapter.ts` (+ test), `src/components/library/library-model.ts` (+ test: founder-name, area and content-type cases).
- Docs: the six `WF06-PROD-02_*` reports, `CLAUDE_LATEST_REPORT.md`.

## Git and confirmation (evidence 23 – 27)
Local commit only (SHA in `CLAUDE_LATEST_REPORT.md` and the final chat report); working tree clean except `AGENTS.md`; origin/main `78f21f2`; production `78f21f2`. Confirmed: no new discovery surface, no matching / recommendation, no frontend implementation, no push, no merge, no deploy, PROD-03 not started.

## Self-audit (section 23)
All 18 items confirmed: canonical data reused; transition only where supported; external data isolated with provenance; founder privacy enforced in the data layer; no duplicate store; no read-model table; no matching; zero application data; deterministic filters / sort; no unproven index; fresh DB GREEN; canonical ids intact; no upstream write; no frontend scope; no push / merge / deploy; PROD-03 not started.

## Related
- [WF06-PROD-02_source-matrix.md](WF06-PROD-02_source-matrix.md) · [WF06-PROD-02_visibility-security.md](WF06-PROD-02_visibility-security.md) · [WF06-PROD-02_query-index-audit.md](WF06-PROD-02_query-index-audit.md)
- [WF06-PROD-02_fixtures-tests.md](WF06-PROD-02_fixtures-tests.md) · [WF06-PROD-02_prod03-handoff.md](WF06-PROD-02_prod03-handoff.md) · [WF06-PROD-01_api-data-contract.md](WF06-PROD-01_api-data-contract.md)
