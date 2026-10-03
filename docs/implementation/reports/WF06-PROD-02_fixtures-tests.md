# WF06-PROD-02_fixtures-tests

**Fixture matrix, data-quality cases, fresh / upgrade DB, cross-WF regression and bugs** (evidence 13, 14, 17 – 20). Parent: [WF06-PROD-02_data-foundation.md](WF06-PROD-02_data-foundation.md).

## Fixture matrix (evidence 13)
`src/lib/library/testing.ts`: rows marked `wf06-fx-` (slugs, e-mails) and "WF06 " (names), cleared before seeding and after the suite; test-only (imported by no runtime module). External records are stubbed per test (`fetch`), never fetched.

| Required case | Fixture | Test |
|---|---|---|
| public organization | CLB `wf06-fx-org-published` | db-test `organization page data` |
| canonical item | 14 PUBLIC ACTIVE STARTUP ventures | `listPublicStartups`, `listLibraryStartups` |
| temporary external item | feed "WF06 Ngoài Một / Hai" | `merges, suppresses…` |
| founder visible / hidden | owners Lan, Hải / PRIVATE, deactivated, blocked, nameless | `listVisibleFounders` cases |
| location filter | problem `area` facet; canonical region present / missing | `library-model.test.ts`, db-test |
| content-type filter | one function per tab; `kind` per tab | `keeps each tab to its own content type` |
| empty result | unknown DOMAIN id | `… an unknown id gives an empty result` |
| pagination | 16 items → 9 + 7, cursor | `pages 9 at a time…` |
| private item excluded | PRIVATE, DRAFT, ARCHIVED ventures; PUBLIC PROJECT | `returns PUBLIC ACTIVE STARTUP ventures only` |

## Data-quality cases (evidence 14)
| Case | Deterministic result |
|---|---|
| missing founder (hidden, deactivated, blocked or nameless owner) | venture listed, founder omitted |
| missing location / stage / domain | `region` / `stage` null, `domains` `[]`; sorted last for stage |
| inactive / closed organization | DRAFT, ARCHIVED, COMPANY → the same 404 |
| private profile | founder omitted; private fields never selected |
| private venture | not listed; its owner gets no founder entry |
| ARCHIVED venture | not listed |
| invalid external reference | unusable record skipped; `javascript:` website → null; unknown stage → null |
| duplicate external item | first kept; canonical twin suppresses the external one |
| external feed down | canonical items served, `external: 'unavailable'` |
Observation (not a WF06 bug): a PUBLIC venture of a deactivated or blocked owner stays listed under the frozen predicate; no WF02 rule unpublishes it on deactivation.

## Gates and DB paths (evidence 17, 18)
| Gate | Result |
|---|---|
| format / lint / typecheck | PASS |
| unit `pnpm test` | 35 files / 331 tests (baseline 33 / 307) |
| DB `pnpm test:db` (fresh DB) | 37 files / 585 tests (baseline 36 / 569) |
| upgrade: existing DB, no migration | `db:migrate` skips 001 – 016; Library db-test 16 / 16 |
| fresh: `db:reset` | 16 / 16 migrations + seed; Library db-test 16 / 16 |
| production build | PASS |

## Cross-WF regression (evidence 19)
16 specs on the rebuilt server: `public-library`, `l6-discovery-privacy`, `alpha-interaction-gaps`, `p0-landing`, `pdf-alpha-decisions`, `wf03-s09-public-organization`, `wf02-s01 / s03 / s05 / s08 / t00`, `wf02-uat-journey`, `wf05-s01 / s02`, `wf01-s07`, `release-rc-responsive`. First run 186 / 190: the 4 `l6` tests failed at setup (422 "Unknown vocabulary item") because `db:reset` had removed the ACC-07 QA vocabulary fixture that other specs apply first. After re-applying `tests/visual/fixtures/wf01-acc07-qa-vocabulary.sql`: `l6` 4 / 4, then the full set **190 / 190** in one run. WF04 not touched.

## Bugs found / fixed (evidence 20)
| Class | Finding | Action |
|---|---|---|
| QUERY_BUG | Q1 aggregated all public ventures before the cap (134.6 ms at 50k) | fixed (22.7 ms) |
| VISIBILITY_BUG | external founder names searchable on `/library` (DEC-W6P-D03) | fixed (P2-3) |
| OUT_OF_SCOPE (test env) | `l6` spec relies on the QA vocabulary applied by earlier specs | reported only |
| API_GAP | session → viewer, 422 for unknown id / sort, problem paging, org children cap | PROD-03 |
| FRONTEND_GAP | `/library` still renders the external directory | PROD-04 |
No CONTRACT_CONFLICT.

## Related
- [WF06-PROD-02_visibility-security.md](WF06-PROD-02_visibility-security.md) · [WF06-PROD-02_prod03-handoff.md](WF06-PROD-02_prod03-handoff.md)
