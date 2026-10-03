# WF05-PROD-05_evidence

**WF05-PROD-05 — evidence pack (items 1–30).** Production build on :3972 (server log captured), local PostgreSQL at 016, the deterministic WF05 fixture. Main report: [WF05-PROD-05_functional-security-qa.md](WF05-PROD-05_functional-security-qa.md); matrices: [WF05-PROD-05_matrices.md](WF05-PROD-05_matrices.md).

| # | Item | Result |
|---|---|---|
| 1 | Preflight | HEAD `71392fb` (PROD-04), clean except `AGENTS.md`, 001–016, no `db/` change since PROD-02, no Claude B / mobile-shell lane, no push / merge / deploy |
| 2–5 | Functional, negative, RBAC / IDOR, lifecycle | PASS — [matrices](WF05-PROD-05_matrices.md) |
| 6 | 400 vs 422 | `400_CASES` = 1 (router, undecodable path); `422_CASES` = 19; `CONSISTENCY_RESULT = PASS` (DEC-W5P-D11, API §24.1) |
| 7 | Draft-save audit | final names `APPLICATION_DRAFT_CREATED`, `APPLICATION_DRAFT_UPDATED` (new, changing saves only), `APPLICATION_SUBMITTED`; actor, application, action, time, `request_id`, result; no answer value (DEC-W5P-D12, API §24.2) |
| 8 | Idempotency | PASS — replay, conflict, no-key determinism, network retry, retry after refusal (no lockout), expiry |
| 9 | Concurrency | PASS — two creates, two submits, save vs submit, stale save after submit, pool of 10 / 12 creates |
| 10 | Form / application integrity | PASS — canonical form reference and version, snapshot immutable, no copied schema, no Q3(b) |
| 11 | WF02 ↔ WF05 | PASS — same venture id, owner and team unchanged, no copy |
| 12 | WF04 ↔ WF05 | PASS — same programme / form / application; CLOSED agreed by both; history read only |
| 13 | Auth / session | PASS — 6 guest deep links → `/auth?redirect`; revoked session; relogin resumes the private draft |
| 14 | Frontend states | PASS — loading, empty, error + retry, 403 / 404, read only, submitted, closed |
| 15 | Security / leakage | PASS — no stack, SQL, constraint, token, e-mail or account id in responses; no answer in audit rows or lists; server log of the final regression: 7 lines, 0 errors, no body, e-mail, answer or token |
| 16 | Restart / persistence | 14 / 14 (refresh, app restart, DB restart, relogin) |
| 17 | Fresh DB | `db:reset` runner 16 / 16 applied + seed; FRESH suites 4 + 11 |
| 18 | Upgrade DB | 015 + WF05 data → 016: 27; 014 → 015: 5; STOP / rollback: 2 + 5 |
| 19 | Test totals | table below |
| 20 | Protected regression | fresh `db:reset`, final build: 67 specs / 827 passed, 0 failed, 0 skipped, 0 flaky (16.2 min) — WF01–WF05, L5, auth / authz, shell, API contract, release, console health, WF04 / WF05 API, F, Q. Runs 1 (void, F5) and 2 (826 / 827, F6) superseded |
| 21 | 5xx / console / hydration | 0 / 0 / 0 (every spec's guards; server log 0 error lines) |
| 22 | Bugs found / fixed | F1 AUDIT_GAP fixed; F2 ERROR_CONTRACT (doc) recorded; F3 TEST_GAP closed; F4 OUT_OF_SCOPE (405 framework); F5 run 1 void (shared-schema reset by a parallel DB suite); F6 TEST_GAP: WF03 UAT audit-code registry copy lacked the new code (run 2: 826 / 827), fixed |
| 23 | Deferred | main report "Deferred" |
| 24 | PROD-06 handoff | [WF05-PROD-05_prod06-handoff.md](WF05-PROD-05_prod06-handoff.md) |
| 25 | Files changed | runtime 3, tests 9 (1 new spec), docs 8 — [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md) |
| 26 | Local commit | this commit, `fix(wf05): draft-save audit and functional / security QA (WF05-PROD-05)`; SHA in the final task report |
| 27 | Working tree | clean after the commit except the untracked `AGENTS.md` |
| 28 | `origin/main` | `78f21f2` |
| 29 | production | `78f21f2` |
| 30 | Confirmation | no push, no merge, no deploy; PROD-06 not started |

## Test inventory (tests; matrix cases in brackets)
| Category | Evidence | PASS | FAIL | SKIP |
|---|---|---|---|---|
| functional (incl. auth, states, navigation) | Q 2, F 9, A 3, H 1 | 15 | 0 | 0 |
| negative (incl. leakage) | Q 2 [32 cases], P 1, A 2 | 5 | 0 | 0 |
| RBAC | P 2, H 2, A 2, F 1 | 7 | 0 | 0 |
| IDOR | P 1, H 2 [+ 8 Q cases] | 3 | 0 | 0 |
| lifecycle | P 2, H 4, A 3, F 1 | 10 | 0 | 0 |
| validation | Q 1 [24 cases], P 1, H 6, A 1, F 1 | 10 | 0 | 0 |
| idempotency | Q 1, P 1, A 1, K 27 | 30 | 0 | 0 |
| concurrency | P 1, H 4, A 1 | 6 | 0 | 0 |
| audit | Q 1, H 2 | 3 | 0 | 0 |
| restart | R (14 steps) | 1 | 0 | 0 |
| cross-WF | F 2 | 2 | 0 | 0 |
| fresh DB | I 4, WF04 11, runner 1 | 16 | 0 | 0 |
| upgrade DB | I 27 + 2, WF04 5 + 5 | 39 | 0 | 0 |
Suites: Q `wf05-prod-qa` 7, F `wf05-prod-frontend` 14, P `wf05-prod-api` 9, H hardening 21, A application 13, K idempotency 27, I integrity 37, WF04 `programme-persistence` 21, R restart check. Unit 33 / 307, DB 36 / 569, format, lint, typecheck, build PASS.

## Related
- [WF05-PROD-05_functional-security-qa.md](WF05-PROD-05_functional-security-qa.md) · [WF05-PROD-05_matrices.md](WF05-PROD-05_matrices.md) · [WF05-PROD-04_evidence.md](WF05-PROD-04_evidence.md)
