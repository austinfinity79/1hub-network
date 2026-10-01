# Claude Task Report

## Task
WF04-PROD-04 — WF04 frontend fixture → real API. Decisions: [DEC-W4P-D13](../decisions/DECISION_LOG.md#dec-w4p-d13); task report: [reports/WF04-PROD-04_frontend-api.md](reports/WF04-PROD-04_frontend-api.md).

## Verdict
**PASS_WITH_EVIDENCE, local only.** The approved WF04 screens read and write `/api/v1/programmes*`; WF04 runtime fixture dependency 0. Not pushed, not deployed; PROD-05 not started. STOP.

## Scope implemented
- Pages read the canonical programme on the server (`requireProgrammeRoute`); every change goes through the API and the screen shows the server's answer (no optimistic state).
- List, create (Idempotency-Key), basic edit, journey stages, Challenge problems, registration (TEAM / STARTUP), publish, close (S08, inline confirmation).
- States: loading, empty, API error with retry, validation (422), conflict (409, re-read), same 404, read only / disabled from server `actions`.
- PO decisions: archived owner → no write (server 409, UI read only); events read only; form locked after an application; INDIVIDUAL not offered; no new publish rule; ARCHIVED compatibility only.
- Demo notice, reset, session store, demo API, demo guard and demo read model removed from the runtime; `fixtures.ts` kept for tests.

## Files changed
- Backend (existing endpoints): `lib/programme/programme.ts`, `types.ts` (`actions`, `owner_archived`, archived-owner 409, `programmeOwnerOptions`).
- New: `lib/programme/{view,guard}.ts`, `components/programme-demo/programme-provider.tsx`, `[id]/error.tsx`, `tests/visual/support/programmes.ts`.
- Changed: 10 WF04 pages + layout, 12 WF04 components (shared `DemoPage` notice made optional; WF05 unchanged), `lib/programme-demo/{types,copy}.ts`.
- Removed: 2 demo API routes, `lib/programme-demo/{guard,read-model,session-store,readiness}.ts` (+ their tests), `demo-store.tsx`.
- Tests: 11 WF04 specs rewritten (60), `read.db-test.ts` (rewritten), `programme.db-test.ts` (+4), 3 unit tests; REL-SEC, P0-SHELL, WF05-S01 updated.
- Docs: API §22 (A5 additions), DECISION_LOG (D13), WF04 contract (PROD-04 status), task report, this report.

## Migrations / data
None.

## Tests / build
format, lint, typecheck PASS; unit 33 files / 307; build PASS; DB 34 files / 509; WF04 specs 60/60; protected regression 62 specs / 637 on the final build; UAT 19/19; 5xx 0, console / hydration errors 0.

## Visual QA
No baseline changed; ADM5 primitives still compared on S01 / S02 (pass); the demo notice is gone by contract §16; WF04 pixel reference method stays Q9 (PROD-06).

## Deviations / blockers
- Adding a registration question is unavailable: it needs `required` and `step`, and Q3(b) has no approved default.
- A close button + inline confirmation was added on S08 (approved transition, no prior visual).
- Routes and the OpsShell label "Demo · Internal Alpha" stay (Q6).

## Git
- Branch: `feat/wf04-prod-hardening`; start HEAD `e0dc779`; no concurrent change
- Implementation commit: `feat(wf04): screens on the programme API (WF04-PROD-04)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO review of PROD-04; Q3(b) decision for operator questions; then WF04-PROD-05 (functional / security QA).
