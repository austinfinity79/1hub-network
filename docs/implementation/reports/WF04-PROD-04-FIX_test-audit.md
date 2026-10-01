# WF04-PROD-04-FIX_test-audit

**WF04-PROD-04-FIX — test rewrite audit and scope fix.** 2026-10-02, branch `feat/wf04-prod-hardening` on `6e99d15`. Decision: [DEC-W4P-D14](../../decisions/DECISION_LOG.md#dec-w4p-d14). Every one of the 115 WF04 demo-behaviour tests that PROD-04 replaced is classified in [WF04-PROD-04-FIX_test-audit.csv](WF04-PROD-04-FIX_test-audit.csv) with the test that covers it now. No API, DB, UI addition or redesign; not pushed, not deployed.

This rewrite is the contract §17 / §20 "rewritten nothing-written specs" item **pulled forward from PROD-05**; PROD-05 does not redo or re-count it.

## Classification of the 115 removed tests
| Class | Count | Meaning |
|---|---:|---|
| OBSOLETE_DEMO | 12 | session store, reset, per-actor key, "demo writes nothing", demo event writes (PO decision 2), the read-only demo API |
| REPLACED_BY_PRODUCTION_TEST | 80 | the still-valid behaviour is covered by a production spec, DB test or unit test |
| STILL_VALID_AND_MISSING | 23 | a still-valid behaviour lost its coverage in PROD-04 → **all 23 restored** below |
| Remaining coverage gap | **0** | |

## Per spec
| Old spec | Old tests | Obsolete | Replaced | Missing → restored | Production tests now |
|---|---:|---:|---:|---:|---:|
| T00 foundation | 13 | 3 | 8 | 2 | 8 |
| S01 list | 11 | 1 | 10 | 0 | 8 |
| S02 create | 10 | 0 | 10 | 0 | 8 |
| S03 journey | 10 | 0 | 7 | 3 | 11 |
| S04 events | 10 | 2 | 7 | 1 | 4 |
| S05 registration | 9 | 0 | 7 | 2 | 7 |
| S06 team | 8 | 1 | 6 | 1 | 3 |
| S07 review | 9 | 0 | 6 | 3 | 10 |
| S08 detail | 20 | 3 | 10 | 7 | 11 |
| UAT journey | 15 | 2 | 9 | 4 | 1 |
| API spec (new in PROD-03) | — | — | — | — | 8 |
| **Total** | **115** | **12** | **80** | **23** | **79** |

The UAT's restored items live where they belong (T00 matrix and 404, S03 frame, S08 links, per-screen visual QA); its one end-to-end journey stays. Coverage that moved to DB / unit tests: `programme.db-test` (26), `read.db-test` (9), `rules.test` (63).

## Restored as production tests (19 tests for the 23 behaviours)
| Spec | Restored test | Covers |
|---|---|---|
| T00 | unbuilt WF04 routes and any public programme page are the ordinary 404 | T00-10, S08-7, UAT-12 |
| T00 | the entry shows in every OpsShell context, is current on WF04 pages, and never for members | T00-11 |
| T00 | 6 actors × every WF04 route, plain and with spoofed headers | UAT-4 |
| S03 | move boundaries | S03-2 |
| S03 | the setup frame: stepper and the back / next chain of every step | S03-1, UAT-13 |
| S03 | typography and ADM5 primitives (Challenge, empty) | S03-10, UAT-15 |
| S04 | typography, ADM5 primitives and the event pill | S04-10, UAT-15 |
| S05 | a failed save shows "Thử lại"; the retry stores the form once | S05-4 |
| S05 | typography and ADM5 primitives (empty, configured, editing) | S05-9, UAT-15 |
| S06 | typography and ADM5 primitives (empty) | S06-8, UAT-15 |
| S07 | the summary reflects the programme | S07-1 |
| S07 | a failed publish keeps DRAFT; "Thử lại" publishes once with the same key | S07-4 |
| S07 | ADM5 primitives (ready, incomplete, published) | S07-9, UAT-15 |
| S08 | a PUBLISHED Challenge summarises its stage, problem and registration | S08-1 |
| S08 | every manage link opens its built step | S08-5, UAT-13 |
| S08 | basic information: read-only type / owner, validation, save shown on the detail | S08-9 |
| S08 | a failed basic save; the retry stores the edit once | S08-11 |
| S08 | the review "Sửa" on a failing name opens the basic step | S08-10 |
| S08 | typography and ADM5 primitives (DRAFT, PUBLISHED, basic) | S08-20, UAT-15 |

Nothing that needs the deleted fixture or session-store runtime was restored.

## Scope fix
| Item | Result |
|---|---|
| S08 close control ("Đóng chương trình" + confirmation) | removed; `Confirm` back to its PROD-03 form; S08 asserts no close control and a read-only CLOSED page |
| close API | unchanged: `wf04-prod-api` lifecycle, `programme.db-test`, S08 and UAT close through `POST …/close` |
| Q3(b) | DEFERRED / NEED PO DECISION BEFORE PROD-07; "Thêm câu hỏi" stays disabled (S05) |

## Related
- [WF04-PROD-04_frontend-api.md](WF04-PROD-04_frontend-api.md) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
