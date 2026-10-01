# WF04-PROD-02_db-persistence-hardening

**WF04-PROD-02 — DB / persistence hardening.** 2026-10-02, branch `feat/wf04-prod-hardening` from `b4463e2` (PROD-01). One migration, `015_p0_programme_production.sql`; no runtime code, API, UI, seed or production change; not pushed, not deployed. Inputs: [WF04 production contract](WF04_PRODUCTION_CONTRACT.md) §3, §4, §6, §11, §20 and the PO lifecycle clarification of 02/10 ([DEC-W4P-D11](../../decisions/DECISION_LOG.md#dec-w4p-d11)).

## Result
| Gate | Result | Evidence |
|---|---|---|
| Schema reconciliation | PASS | table below; canonical storage exists for every concept, no table added |
| Migration | PASS | `015_p0_programme_production.sql`, one transaction, number checked free on every branch and worktree |
| Programme ownership | PASS | `organization_id` NOT NULL + the 001 FK (unknown owner and owner deletion refused) |
| Programme lifecycle DB | PASS | `programme_status` DRAFT / PUBLISHED / CLOSED / ARCHIVED; CLOSED added, ARCHIVED carried over |
| Challenge/Problem relation | PASS | `programmes.metadata.challenge` (option A), CHALLENGE only, documented shape; no table |
| Application reuse | PASS | `programme_application_forms` and `applications` untouched; no new application table |
| Fresh DB | PASS | runner on an empty DB, 15/15 in the ledger; seed twice identical |
| Existing DB upgrade | PASS | 014 → 015 scratch fixture and the real local DB (18 applications): every row hash identical |
| WF04 DB tests | PASS | `programme-persistence.db-test.ts` 21/21; `programme-demo` read model 9/9 |
| WF05 Application regression | PASS | `application.db-test` 13/13; L5 journey 13 + WF05 specs 38 |
| Protected regression | PASS | DB suite 483/483; visual WF01–WF05 613/613; UAT 19/19 |
| Production fixture dependency | 0 | migrations alone leave every programme table empty; 015 writes no row |

## Schema reconciliation (step 1)
| Table | PK | FKs | Status / type | Owner | Changed by 015 |
|---|---|---|---|---|---|
| `organizations` | id | parent_id → organizations | `publication_status` | — | no |
| `programmes` | id | organization_id → organizations | `publication_status` → `programme_status` | `organization_id` nullable → NOT NULL | yes |
| `programme_application_forms` | programme_id | programme_id → programmes | — (version > 0) | via programme | no |
| `applications` | id | programme, venture, created / submitted by | `application_status` | WF05 | no |
| `events` | id | organization_id, programme_id (nullable) | `event_status` (002) | organization_id | no |
| `audit_events` | id | actor_account_id | `resource_type` text | — | no |

Unique: `programmes.slug`, `events.slug`, `uq_applications_active_pair` (unchanged). Index `idx_programmes_org_status` is rebuilt on the new type by PostgreSQL. No challenge, problem, stage or WF04 table exists or is created. Rows needing migration: none outside the identity mapping (seed `c0…0001` DRAFT, `d4…0001` PUBLISHED; production `d4…0001` PUBLISHED).

## Migration 015
| Change | Detail |
|---|---|
| A. data check | STOP, as one transaction, on: an ownerless programme, a status outside the mapping, end < start, metadata outside the shape; the message names each id |
| B. lifecycle | `CREATE TYPE programme_status ('DRAFT','PUBLISHED','CLOSED','ARCHIVED')`; status converted with an explicit identity CASE (no ELSE, no fallback); default `DRAFT` |
| C. ownership | `organization_id SET NOT NULL` |
| D. content | `ck_programmes_dates` (end ≥ start when both set); `ck_programmes_metadata` (object; `journey.stages` array; `challenge.problem_statements` array, CHALLENGE only; NULL-safe); column comment documents both schemas |

Not added, because no frozen rule or the plan for this phase supports it: owner type HUB / CHAPTER / CLB and owner / type immutability (service rules, PROD-03); CHALLENGE ≥ 1 problem, required dates, stages or form (Q7); `schema_version` values (service validation).

## Lifecycle and ARCHIVED
| Label | Before (`publication_status`) | After (`programme_status`) |
|---|---|---|
| DRAFT, PUBLISHED | yes | yes (identity) |
| CLOSED | no | **added** (approved, D11) |
| ARCHIVED | yes, since M001, independent of WF04 | carried over for compatibility only; DEFERRED; nothing writes or reads it |

`publication_status` keeps DRAFT / PUBLISHED / ARCHIVED for organizations only.

## Fixtures (step 7)
`src/lib/programme-demo/fixtures.ts` (`d4…0001`, `d4…0002`) and the session store still drive the demo screens until PROD-04; seed rows `c0…0001`, `d4…0001` + form stay local / CI. 015 depends on no fixture id and inserts nothing; new tests create and drop their own databases.

## Rollback / recovery
Documented in the migration header and executed by the test: lossless while no row is CLOSED (it refuses otherwise), restores the 014 schema with every row, and the runner re-applies 015. The release runtime (`78f21f2`) runs unchanged on 015 (it compares `status` with `'PUBLISHED'` only), so an application rollback needs no DB rollback; production recovery stays the pre-deploy backup.

## Tests
| Gate | Result |
|---|---|
| format, lint, typecheck | PASS |
| unit | 34 files / 263 tests PASS |
| build | PASS (`next build`) |
| DB suite (`pnpm test:db`) | 33 files / 483 tests PASS; new `programme-persistence.db-test.ts` 21 (fresh 12, upgrade 5, STOP + rollback 4), `schema.db-test` ledger + 015 |
| visual regression (55 specs) | 613/613: WF01 188, WF02 170, WF03 69, WF04 115, WF05 38, L5 13, L6 4, API contract 9, release 7 |
| UAT | 19/19 |
| real local DB upgrade | 013 → 014 → 015 on the dev DB: programmes 2, forms 1, applications 18, events 2, organizations 4, audit 561 — row digests identical; second `migrate` skips 015 |
| PostgreSQL restart | scratch DB, CLOSED row and challenge content written, `docker restart`, both read back, ledger 15 |
| mutation check | reverting the NULL-safe `stages` check to `=` fails test (9); file restored byte-identical |

Requirement map: (1) fresh 3 tests · (2) upgrade · (3)(5) rows and statuses · (4) owner · (6) CLOSED · (7) ARCHIVED not introduced · (8) owner FK · (9) challenge content ×2 · (10) WF05 data · (11) no duplicate domain · (12) reconnect + real restart · (13) seed twice.

## Related
- [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md) · [WF04_PRODUCTION_GAP_MATRIX.md](WF04_PRODUCTION_GAP_MATRIX.md) · [../DB_SCHEMA_GAPS_P0.md](../DB_SCHEMA_GAPS_P0.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
