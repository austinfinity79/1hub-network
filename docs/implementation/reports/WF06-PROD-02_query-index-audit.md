# WF06-PROD-02_query-index-audit

**Query foundation, sort / filter rules, index audit and migration decision** (evidence 6, 7, 8, 9). Parent: [WF06-PROD-02_data-foundation.md](WF06-PROD-02_data-foundation.md).

## Query foundation (evidence 6)
| Concern | Implemented | Note |
|---|---|---|
| keyword | `q`, every word must appear, case- and accent-folded (`fold`), ≤ 120 (`LIBRARY_QUERY_MAX`) | startups: name, summary, domain labels (canonical); name, tagline, product, domains (external). Founders: display name, listed venture names |
| content type | one function per tab (`listLibraryStartups`, `listLibraryFounders`; problems keep `LIBRARY_PROBLEMS`) + `provenance` | — |
| taxonomy filter | `domainId` (DOMAIN), `stageId` (VENTURE_STAGE), exact id | frozen PROD-01 filters |
| location filter | problems: existing `area` facet; canonical `region` displayed | the frozen contract has no startup / founder location filter: none added |
| organization filter | not added | no venture → organization relation in the frozen Library contract |
| pagination | `paginate`: limit 9 default, 1 – 50, opaque base64url cursor validated by re-encoding | `nextCursor` null at the end |
| visibility | SQL predicate + founder projection | [visibility](WF06-PROD-02_visibility-security.md) |

## Sort rules (evidence 7)
| List | Exact order |
|---|---|
| startups `STAGE` (default) | GROWTH, SELLING, PILOT, MVP, IDEA, no stage → name `localeCompare(…, 'vi')` → CANONICAL before TEMPORARY_EXTERNAL → key |
| startups `NAME` | name (vi) → provenance → key |
| founders | display name (vi) → key |
| problems | unchanged (deadline, then name) |
Total orders (ties broken by key), independent of input order (unit test). No relevance, recommendation, personalisation, semantic or embedding score.

## Index audit (evidence 8)
Plans by `EXPLAIN (ANALYZE, BUFFERS)` in a scratch database `wf06_index_audit` (migrations 001 – 016 + seed + synthetic rows), dropped afterwards; the dev DB measured read-only. Production row counts were not read.

| Dataset | Q1 startups | Q2 owners | Q3 discovery | Q4 vocab |
|---|---|---|---|---|
| dev DB: 18 projects, 1 public startup | 0.44 ms | 0.05 ms | 0.02 ms | 0.02 ms |
| 2k projects, 464 public startups | 5.3 ms (probe index 3.5 ms) | 0.6 ms | 0.2 ms | 0.02 ms |
| 50k projects, ~12.3k public, 60k domain links, 25k profiles | first query 134.6 ms → rewritten 22.7 ms (reruns 29 – 34 ms; probe index 17 – 21 ms) | 8.4 ms | 1.7 ms | 0.02 ms |

| Query | Plan / issue | Index? |
|---|---|---|
| Q1 `publicStartupRows` | first version aggregated domains of every public startup before `LIMIT` (QUERY_BUG, fixed: cap the page first, then `LATERAL` domain lookups through `project_domains_pkey`); `projects` seq scan 9.5 ms at 50k, the predicate keeps ~25 % of rows | none: a partial index on `projects (name, id) WHERE <predicate>` gains ≤ 2 ms at 2k |
| Q2 owners | `individual_profiles_pkey`, `user_accounts_pkey` | existing |
| Q3 `discoveryLevelsOf` | `profile_visibility_settings_pkey` | existing |
| Q4 vocabulary | seq scan of 21 rows | none |
Revisit trigger: > ~10k PUBLIC startups or a PROD-03 latency budget miss → additive migration with the partial index above (table `projects`; risk: write overhead on venture saves only).

## Migration decision (evidence 9)
NO_SCHEMA_CHANGE: no migration, table, view or enum; fresh 001 → 016 and the existing DB stay valid ([tests](WF06-PROD-02_fixtures-tests.md)).

## Related
- [WF06-PROD-02_source-matrix.md](WF06-PROD-02_source-matrix.md) · [WF06-PROD-02_prod03-handoff.md](WF06-PROD-02_prod03-handoff.md)
