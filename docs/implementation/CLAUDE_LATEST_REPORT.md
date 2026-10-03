# Claude Task Report

## Task
WF06-PROD-03 — WF06 API / visibility / deterministic read hardening (IMPLEMENT) on the PROD-02 foundation `c405c3c`. Summary, inventory and clarifications: [reports/WF06-PROD-03_api-hardening.md](reports/WF06-PROD-03_api-hardening.md); visibility / privacy: [reports/WF06-PROD-03_visibility-privacy.md](reports/WF06-PROD-03_visibility-privacy.md); query behaviour: [reports/WF06-PROD-03_query-behaviour.md](reports/WF06-PROD-03_query-behaviour.md); tests / evidence: [reports/WF06-PROD-03_tests-evidence.md](reports/WF06-PROD-03_tests-evidence.md); PROD-04 handoff: [reports/WF06-PROD-03_prod04-handoff.md](reports/WF06-PROD-03_prod04-handoff.md); contract: [API §25 (A8)](../architecture/05_API_CONTRACT_P0_v1.0.md).

## Verdict
**PASS_WITH_EVIDENCE.** `GET /api/v1/library/{startups,founders,problems}`: read-only, server-side visibility (SQL predicate; founders only for a live session of an ACTIVE account and only where PROFILE_DISCOVERY allows; guests `restricted: true`), canonical-wins merge, deterministic filters / sort, stateless cursor pages (9 / 50), bounded and normalised input, 422 envelope, external failure isolated (`degraded`), no ids or private fields, `Cache-Control: private, no-store`. Organization page children ≤ 200 with the total kept. PROD-04 not started. STOP.

## Scope implemented
- Routes and `library-api.ts` (parsing, viewer, DTOs, headers); service: multi-value filters, facet counts, problems paging, vocabulary-id validation; opaque external keys; P3-4 bound.
- API amendment A8 (§25) in the Markdown contract, three YAML skeleton paths.
- Seven clarifications within the frozen contract, listed for PO review (C1 – C7).

## Files changed
- New: `src/app/api/v1/library/{startups,founders,problems}/route.ts`, `src/lib/library/library-api.ts` (+ test), `src/lib/library/library-routes.db-test.ts`, `tests/visual/specs/wf06-prod-api.spec.ts`.
- Modified: `src/lib/library/{library-data,library-service,canonical-source,testing}.ts`, `library-data.test.ts`, `canonical-source.db-test.ts`, `src/lib/public/organization.ts`.
- Docs: `05_API_CONTRACT_P0_v1.0.md` / `.yaml`, five `WF06-PROD-03_*` reports, this report.

## Migrations / data
None (no schema change). Test fixture rows only, removed after each suite.

## Tests / build
Format, lint, typecheck PASS; unit 36 files / 340 tests; DB 38 files / 611 tests; production build PASS; HTTP spec 3 / 3; protected regression 24 specs **275 / 275** in one run; real restart: 5 answers byte-identical, pre-restart cursor valid; API calls 2 – 8 ms at fixture scale; fixed SQL statement count per request (2 / 6 / 0).

## Visual QA
No UI change (the page still reads its datasets until PROD-04).

## Deviations / blockers
None blocking. For PO review: C1 – C7 (422 status, multi-value filters, `total` / `facets` / `degraded`, refused oversize / unknown parameters, member = live session of an ACTIVE account, problem facet text, provenance not serialised). PROD-04 open points H1 – H4, including the `l6-discovery-privacy` assertion versus DEC-W6P-D02 once `/library` reads the API.

## Git
- Branch: `feat/wf06-prod-hardening`; base `c405c3c`; HEAD unchanged during the task
- Implementation commit: `feat(wf06): Library read API and visibility hardening (WF06-PROD-03)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of WF06-PROD-03 (C1 – C7, H1 – H4); then WF06-PROD-04 (frontend integration) per the handoff.
