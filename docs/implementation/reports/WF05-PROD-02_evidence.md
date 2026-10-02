# WF05-PROD-02_evidence

**WF05-PROD-02 — persistence evidence.** Local PostgreSQL 17 (`hubnetwork-p0-db`), production build on :3972. Main report: [WF05-PROD-02_persistence.md](WF05-PROD-02_persistence.md).

## Migration chain
| Case | Result | Test |
|---|---|---|
| fresh DB 001 → 016 + seed | 16 / 16 applied in order with checksums, 016 last; seed succeeds; seeded venture, member and PUBLISHED form valid; no application seeded | `application-integrity.db-test` FRESH (4) |
| shared DB `db:reset` | 001 → 016 applied, seed applied | runner output |
| existing DB (WF04 candidate, 001–015) with WF05 data → runner | 016 only, 15 skipped; second run applies nothing; ventures, member, programmes, forms and applications byte-identical (count + row digest); ids, links and the CLOSED programme's submitted snapshot unchanged | UPGRADE (3) |
| STOP and recovery | a non-object snapshot STOPS 016 (ledger and rows unchanged); clean data applies; the documented rollback removes it losslessly (only 013's trigger left); re-apply succeeds | RECOVERY (2) |
| WF04 chain still valid | 015 FRESH / UPGRADE / RECOVERY suites pass with 016 present | `programme-persistence.db-test` (21) |

## Submitted immutability (database level)
| Attempt on a SUBMITTED row | Result |
|---|---|
| UPDATE answers, programme, venture, applicant type, creator, submission time, status | refused `23514` (7 cases) |
| DELETE | refused `23514` "never deleted" |
| TRUNCATE | refused `23514` |
| service: save answers, submit again | `409 APPLICATION_SUBMITTED` |
The snapshot stays readable (`schema_version` 1) after the programme closes.

## Draft persistence
| Check | Result |
|---|---|
| applicant identity on a DRAFT (venture, programme, type, creator) | change refused `23514` (4 cases) |
| answers update and DELETE of a DRAFT | accepted |
| create / save / reload through a new connection pool | identical DTO (`getApplication`) |
| refresh, app restart, PostgreSQL restart, relogin (HTTP) | identical reads of draft, submitted, `/me/applications`, venture, S02 and S01 data; canonical rows unchanged (status, venture, programme, form version, ACTIVE member) — `scripts/qa/wf05-restart-check.mjs` 14 / 14 |
| browser storage | none used as business state (WF05-PROD-00, unchanged) |

## Duplicates, links, orphans (negative)
| Attempt | Result |
|---|---|
| second active application, same venture + programme (SQL) | `23505 uq_applications_active_pair` |
| same, through the service | `409 APPLICATION_EXISTS`, one row |
| unknown venture / programme / creator | `23503` on the matching foreign key |
| SUBMITTED without snapshot; non-object snapshot | `23514` `ck_applications_submitted` / `ck_applications_snapshot_object` |
| status `WITHDRAWN` | `22P02` (not in `application_status`) |
| delete a venture / programme with applications, a programme with a form | `23503` (no orphan) |
| venture owned by an unknown profile; member with an unknown profile | `23503` |

## Idempotency retention
| Case | Result |
|---|---|
| key reused after its 24 h window | runs as a new request (`replayed: false`), new live record |
| expired records with stored answers | swept by the next guarded request |
| sweep bound | 100 per request (`IDEMPOTENCY_SWEEP_LIMIT`), oldest first |
| existing store guarantees (A–E, isolation, no payload, schema) | unchanged, 24 / 24 |

## Test totals
| Suite | Result |
|---|---|
| unit | 33 files / 307 |
| DB | 35 files / 549 (new `application-integrity` 37, idempotency +3) |
| restart check | 14 / 14 |
| protected regression (fresh `db:reset`, 001 → 016) | 64 specs / 797 passed: WF01, WF02 (venture, team, projects), WF03, WF04 (incl. QA and visual), WF05 (S01, S02, T00, UAT), L5, auth / authz, shell, API contract, release; 5xx, console, hydration 0 |
| UAT | 19 / 19 |

## Related
- [WF05-PROD-02_persistence.md](WF05-PROD-02_persistence.md) · [WF05-PROD-01_db-contract.md](WF05-PROD-01_db-contract.md)
