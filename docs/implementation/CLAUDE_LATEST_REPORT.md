# Claude Task Report

## Task
S1-UAT-01 — Sprint1 AUTH replacement: username/email + password + Google + reset / session rules on the one canonical `/auth`. Reports: [architecture](reports/S1-UAT-01-auth-replacement.md) · [evidence](reports/S1-UAT-01-evidence.md) · [security / regression / git](reports/S1-UAT-01-security.md) · [DB incident](reports/S1-UAT-01-db-incident.md).

## Verdict
**PASS_WITH_EVIDENCE — READY FOR CHATGPT/PO S1-UAT-01 REVIEW.** Live Google E2E ENV_BLOCKED (no OAuth client here; release / UAT prerequisite). TECHNICAL_UAT_PASS; BUSINESS_UAT_NOT_YET_RUN. S1-UAT-02 not started. STOP.

## Scope implemented
Sign-in by username or e-mail + password, create account (Legal v1.0 through the existing consent writer), forgot / reset (WF01-S11 `/auth/reset-password`), Google OAuth (PKCE, state, same-account linking), lockout 5 / 15 min, neutral sign-up refusal (no e-mail existence disclosure), Sprint1-sourced limits only, JSON-only bodies. Magic link compatibility-only. Decisions [DEC-S1A](../decisions/DECISION_LOG.md#dec-s1a); contract amendment A12.

## Files changed
New: migration 018, `src/lib/auth/{credentials,google,lockout,password,password-rules,username,sign-in,after-sign-in,client-ip,require-json,password-reset-email}.ts`, 8 auth API routes, `/auth/reset-password`, password field, auth tests and specs, 4 reports. Changed: `/auth` form and CSS, check-email, callback, stage 1 prefill, magic-link consume (shared sign-in), routes manifest + screen contract (WF01-S11), error codes, audit actions, `.env.example`, 16 stale specs, DECISION_LOG, API contract, P0_STATUS.

## Migrations / data
018 additive (username, scrypt hash, lockout, sign-up name; `auth_identities`; `password_reset_requests`); documented rollback; fresh / upgrade / recovery proven. Shared dev DB incident closed: back at 017, checksums intact, no residue.

## Tests / build
format, lint, typecheck, build PASS · unit 38 / 398 · DB 49 / 789 · **protected regression SPEC_COUNT 92 · TEST_COUNT 1213 · PASS 1184 · FAIL 0 · SKIP 29 (opt-in, classified) · FLAKY 0** · L1–L2 UAT 19 / 19 · server log: 0 unexpected 5xx, 0 secrets.

## Visual QA
AUTH1 shell (panel, title, Google control, divider) pixel PASS; forms below reuse the auth shell and components (PO decision 1). Responsive 1440 / 768 / 390 (+ 1024 / 430 / 320 detector) clean.

## Deviations / blockers
Live Google E2E ENV_BLOCKED. Residual: a sign-up that does not complete still implies a conflict (closing it needs verify-before-account). Google photo not imported into stage 1. Username change and session list in Cài đặt belong to a settings task.

## Git
- Branch: `feat/s1-uat-01-auth`; start HEAD `edd3d24`, unchanged during the task
- Implementation commit: `1ac26b0` (feat), `d502f9a` (fix)
- Report/final commit: the docs commit following `d502f9a`
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: origin/main `edd3d24`; production `78f21f2` (not touched)
- Working tree: clean after the report commit, except untracked `AGENTS.md` and `design-reference/candidate/admin-po-review/` in the main checkout (not this worktree)

## Recommended next task
ChatGPT / PO review of S1-UAT-01. S1-UAT-02 not started.
