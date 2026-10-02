# WF04-PROD-07_closure-matrix

**WF04-PROD-07 — closure matrix and final test totals.** 2026-10-02. Every row is closed by evidence already committed in PROD-02 → PROD-06 and the PROD-07 smoke on the candidate tree (identical to `5005ec1`). Readiness verdict and dispositions: [WF04-PROD-07_production-readiness.md](WF04-PROD-07_production-readiness.md).

## Closure matrix
| Area | Evidence | Status | Remaining decision |
|---|---|---|---|
| Production Contract | [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md), DEC-W4P-D01…D14 | CLOSED | Q2 rest, Q4–Q6, Q8–Q10 (non-blocking) |
| DB/Persistence | migration 015; `programme-persistence.db-test` 21 | CLOSED | — |
| Canonical domain reuse | 3 tables only; no V2 / WF04 duplicate in code or schema | CLOSED | — |
| API | API §22 (A5); `wf04-prod-api` 8; `programme.db-test` 26 | CLOSED | — |
| RBAC | `programme:read` / `manage` server side; 16 RBAC + 7 IDOR + 4 spoofing tests; IDOR success 0 | CLOSED | — |
| validation | 71 validation tests; 422 with field reasons; never 5xx | CLOSED | — |
| lifecycle | DRAFT → PUBLISHED → CLOSED; 20 lifecycle tests; ARCHIVED legacy only | CLOSED | close control on screen (design) |
| idempotency | 13 tests; per-action behaviour in PROD-05 journey matrix | CLOSED | — |
| audit | one row per write, request-id correlated (QA-AUDIT + 7 asserting tests) | CLOSED | — |
| frontend real API | S01–S08 on `/api/v1/programmes*`; T00 scan: 0 fixture / session / demo API | CLOSED | Q6 routes |
| Challenge metadata | `metadata.challenge`; malformed 422; foreign 404 | CLOSED | — |
| Programme Application/Form reuse | canonical form + WF05 `applications`; locked once applied; 0-question form submits | CLOSED | Q3(b) = A, out of P0 |
| Event boundary | 0 Event writes (snapshot + static scan) | CLOSED | — |
| loading/error/empty states | S0x state tests + PROD-06 visual states 22 | CLOSED | — |
| functional QA | 166 focused functional tests (PROD-05 inventory) | CLOSED | — |
| security QA | 46 security tests; error surface clean | CLOSED | — |
| visual QA | 8 ADM5 pixel tests; 132 baseline / current pairs vs `78f21f2` | CLOSED | Q9 record |
| responsive QA | 102 viewport-matrix + 7 tests; 320 pre-existing, pinned | CLOSED | OpsShell (C) |
| protected regression | 64 specs / 797 (PROD-06); PROD-07 smoke 14 specs / 157; UAT 19 | GREEN | — |
| fresh DB | `db:reset` 001–015 + seed before every regression; DB test (1) | CLOSED | — |
| existing DB upgrade | DB test (2)(3): 015 on 014 data, checksums, rows kept; STOP cases | CLOSED | run against production only at promotion |
| restart/refresh | refresh, relogin, expired session, app restart, DB restart (restart check 10/10) | CLOSED | — |
| console/hydration/5xx | 0 / 0 / 0 in every run, server log clean | CLOSED | — |
| production promotion status | NOT DEPLOYED; production `78f21f2` | PENDING PO | Q8, then exact-SHA deploy |

## Final test totals (WF04 suites, 0 failures, 0 skips)
| Kind | Count |
|---|---:|
| DB (WF04) | 56: persistence 21, service 26, read 9 (DB suite 509) |
| API / RBAC (service + HTTP) | 60: `programme.db-test` 26, `read.db-test` 9, `wf04-prod-api` 8, `wf04-prod-qa` 17 |
| Security (RBAC, IDOR, spoofing, surface, archived owner) | 46 |
| Focused functional (incl. validation, lifecycle, idempotency, audit, application, persistence, Challenge, Event) | 166 |
| Unit (WF04) | 109 (unit suite 307) |
| Pixel | 8 ADM5 tests + 132 capture pairs |
| Responsive / visual states | 109 / 22 |
| Protected regression | 797 (64 specs) + smoke 157 (14 specs) |
| UAT-WF04 | journey 1 / 1; UAT suite 19 / 19 |
| Local checks | restart 10 / 10; 0-question apply → submit 1 / 1 |
| WF04 test files total | 385 tests (261 PROD-05 inventory + 124 PROD-06) |

Known deferred items: Q3(b) (A, out of P0), close control on screen, Q2 rest, Q4, Q5, Q6, Q8, Q9 record, Q10, OpsShell small-screen layout, demo-lib cleanup.

## Related
- [WF04-PROD-07_production-readiness.md](WF04-PROD-07_production-readiness.md) · [WF04-PROD-05_test-inventory.csv](WF04-PROD-05_test-inventory.csv) · [WF04-PROD-06_screen-review.md](WF04-PROD-06_screen-review.md)
