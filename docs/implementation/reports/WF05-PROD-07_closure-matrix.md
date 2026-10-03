# WF05-PROD-07_closure-matrix

**WF05-PROD-07 — closure matrix and aggregate QA evidence** for the WF05 candidate `8c1fbd6` (runtime; the closure commit adds docs only). Verdict and debt: [WF05-PROD-07_production-readiness.md](WF05-PROD-07_production-readiness.md).

## Closure matrix
| Area | Evidence | Status | Remaining issue |
|---|---|---|---|
| production scope | L5 + S01 + S02 (DEC-W5P-D01, D09); PROD-01 contract | CLOSED | owner doc wording (CLAUDE.md §2) — P1 |
| canonical Venture model | `projects` + `owner_profile_id` + `project_members` (D03); no V2 table or type (grep, table list) | CLOSED | — |
| owner / team | owner-only application actions; members read the venture (PROD-03 P, H; PROD-05 Q) | CLOSED | — |
| Programme linkage | `programmes` + `programme_application_forms` FK; version held (PROD-04 F, PROD-05 Q) | CLOSED | — |
| Application lifecycle | DRAFT → SUBMITTED, terminal; CLOSED / ARCHIVED write-blocked, history readable (D05) | CLOSED | — |
| persistence | all business state in DB; restart check 14 / 14 (PROD-02, -04, -05) | CLOSED | — |
| migration 016 | guards + snapshot check; FRESH 4, UPGRADE 27, RECOVERY 2; rollback documented | CLOSED | production apply = release step |
| API | §21, §23 (A6), §24 (A7); `wf05-prod-api` 9 / 9 | CLOSED | — |
| RBAC | owner / EDIT / VIEW / stranger / operator matrix (P, H, Q) | CLOSED | — |
| IDOR | foreign ids, injected fields, spoofed headers: 404 / 422, data unchanged (P, Q) | CLOSED | — |
| validation | 422_CASES 19, 400_CASES 1 (router), CONSISTENCY PASS (D11) | CLOSED | API §2.5 global wording — P2 |
| idempotency | replay, conflict, no-key, retry after refusal, expiry (P, Q, K) | CLOSED | — |
| concurrency | creates, submits, save vs submit, pool (H, P) | CLOSED | — |
| audit | `APPLICATION_DRAFT_CREATED` / `_UPDATED` / `SUBMITTED`, no answers (D12) | CLOSED | — |
| frontend real API | no fixture, no browser state, no actor key (PROD-04) | CLOSED | — |
| cross-WF integrity | WF02 ↔ WF05, WF04 ↔ WF05 same ids (F, Q) | CLOSED | — |
| error states | 401 / 403 / 404 / 409 / 422 / 5xx mapped, retry (F, PROD-06 V) | CLOSED | — |
| auth redirect | guest and expired session → `/auth?redirect` → page (F, Q, V) | CLOSED | — |
| functional QA | PROJECT / STARTUP journeys, UAT 19 / 19 | CLOSED | — |
| security QA | negative 32 cases, leakage, logs (PROD-05) | CLOSED | — |
| pixel QA | 144 pairs vs `f40f70c`: REAL_REGRESSION 0 (PROD-06) | CLOSED | — |
| responsive QA | 6 widths, 150 + 144 checks, overflow 0 on WF05 (PROD-06) | CLOSED | SHELL-MOBILE-01 separate |
| accessibility smoke | keyboard, labels, decorative, disabled (PROD-06) | CLOSED | S01 venture-name focus ring — P2 |
| restart / relogin | 14 / 14 (PROD-05) | CLOSED | — |
| fresh DB | runner 16 / 16 + seed (PROD-07 rerun); FRESH suites | CLOSED | — |
| upgrade DB | 015 + data → 016 (27); 014 → 015 (5) | CLOSED | 014 → 016 on a production copy — P1 |
| protected regression | 68 specs / 981 (PROD-06); unit 307, DB 569 (PROD-07 rerun) | CLOSED | — |
| console / hydration / 5xx | 0 / 0 / 0; server log 0 errors | CLOSED | — |
| demo artifact policy | notice, reset, actor key, demo labels removed; routes kept (D02) | CLOSED | — |
| d4…0001 policy | KEEP + CLOSE / HIDE (D08); no runtime dependency | CLOSED | close via WF04 at promotion — RELEASE_STEP |
| production promotion | not in scope | NOT STARTED | PO-controlled ([combined handoff](WF04-WF05-combined-hardening-handoff.md)) |
Sources: P `wf05-prod-api`, F `wf05-prod-frontend`, Q `wf05-prod-qa`, V `wf05-prod-visual`, H / A application DB suites, K idempotency, I integrity.

## Aggregate QA evidence
| Gate | Result |
|---|---|
| PROD-02 | migration 016 FRESH / UPGRADE / RECOVERY; DB guards (SUBMITTED never changes or is deleted); restart 14 / 14 |
| PROD-03 | API spec 9 / 9; hardening DB 19; regression 65 specs / 806; UAT 19 / 19 |
| PROD-04 | frontend spec 14 / 14; regression 66 / 820; restart 14 / 14 |
| PROD-05 | QA spec 7 / 7; regression 67 / 827; 400-vs-422 CLOSED; draft-save audit CLOSED |
| PROD-06 | REAL_REGRESSION 0 over 144 pairs; 1440 / 1024 / 768 / 430 / 390 / 320; visual spec 154 / 154; regression 68 / 981 (the contract quotes 901: the run reported 981); unit 307, DB 569; console / hydration / 5xx 0 / 0 / 0 |
| PROD-07 (rerun on `8c1fbd6`) | fresh DB 16 / 16; unit 307 / 307; DB 569 / 569; UAT 19 / 19 |

## Related
- [WF05-PROD-07_production-readiness.md](WF05-PROD-07_production-readiness.md) · [WF04-WF05-combined-hardening-handoff.md](WF04-WF05-combined-hardening-handoff.md)
