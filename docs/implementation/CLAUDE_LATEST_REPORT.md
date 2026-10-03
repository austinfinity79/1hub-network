# Claude Task Report

## Task
WF05-PROD-03 — WF05 lifecycle / API / RBAC hardening (handoff P3-1 … P3-10). Report: [reports/WF05-PROD-03_api-rbac.md](reports/WF05-PROD-03_api-rbac.md); evidence: [reports/WF05-PROD-03_evidence.md](reports/WF05-PROD-03_evidence.md).

## Verdict
**PASS_WITH_EVIDENCE, local only.** Every WF05 action enforced server side; IDOR / spoofing 0; DRAFT → SUBMITTED terminal; CLOSED / ARCHIVED writes blocked with the owner's history readable; duplicates, idempotency and concurrency controlled; no 5xx. Not pushed, not deployed; PROD-04 not started. STOP.

## Scope implemented
- P3-1 strict venture id (500 → 404); P3-2 `/me/applications` `{items}` + programme status; P3-3 PATCH ARCHIVED / duplicate / too-many refusals; P3-4 programme + form FOR SHARE on create / save / submit; P3-5 read-only drafts with `editable` / `reason`; P3-6 5xx server log; P3-7 one connection per transaction; P3-8 one applicant-type definition; P3-9 tests; P3-10 API §23 amendment A6, capability matrix, OpenAPI paths.
- Frozen contract applied where the task template differs (draft-save audit; 422 for validation), flagged for the PO.

## Files changed
- Runtime: `src/lib/application/application.ts`, `types.ts`, `applicant.ts` (new); `src/lib/venture/venture.ts`, `team.ts` (WF02: strict id, optional executor); `src/lib/project-demo/eligibility.ts`, `types.ts`; `src/lib/api/handler.ts`; `src/app/api/v1/me/applications/route.ts`; `src/components/project-demo/project-list.tsx`, `project-detail.tsx` (envelope reader only).
- Tests: `src/lib/application/application-hardening.db-test.ts` (new, 19), `tests/visual/specs/wf05-prod-api.spec.ts` (new, 9); envelope assertions in `l5-startup-journey`, `wf05-s01-my-projects`, `wf05-uat-journey`.
- Docs: the two PROD-03 reports; `05_API_CONTRACT_P0_v1.0.md` §23 (A6) and `.yaml`; `AUTHORIZATION_CAPABILITY_MATRIX_P0.md`; this report.

## Migrations / data
None (016 unchanged and sufficient).

## Tests / build
format, lint, typecheck PASS; unit 33 / 307; DB 36 / 568; build PASS; WF05 API spec 9 / 9; restart check 14 / 14; protected regression 65 specs / 806 on a fresh DB (one earlier run void: host sleep); UAT 19 / 19; 5xx, console, hydration 0.

## Visual QA
No UI change beyond the envelope reader of S01 / S02 (same data, same render).

## Deviations / blockers
None blocking. PO choice (non-blocking): add an audited `APPLICATION_DRAFT_SAVED` (ids only) — today's frozen contract says draft saves are not audited.

## Git
- Branch: `feat/wf05-prod-hardening`; start HEAD `9842b70`; no concurrent change
- Implementation commit: `feat(wf05): lifecycle, API and RBAC hardening of the application (WF05-PROD-03)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of PROD-03; then WF05-PROD-04 (frontend + cross-WF: `editable` / `reason`, closed-programme history on S01 / S02, demo artifacts, session expiry).
