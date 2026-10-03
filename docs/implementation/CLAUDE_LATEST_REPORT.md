# Claude Task Report

## Task
WF06-PROD-04 — frontend integration of the existing discovery / read-only surfaces (IMPLEMENT) on the PROD-03 API `4fe1e36`. Summary, preflight, inventory: [reports/WF06-PROD-04_frontend-integration.md](reports/WF06-PROD-04_frontend-integration.md); behaviour: [reports/WF06-PROD-04_library-behaviour.md](reports/WF06-PROD-04_library-behaviour.md); spec realignment: [reports/WF06-PROD-04_spec-realignment.md](reports/WF06-PROD-04_spec-realignment.md); QA evidence: [reports/WF06-PROD-04_qa-evidence.md](reports/WF06-PROD-04_qa-evidence.md); PROD-05 handoff: [reports/WF06-PROD-04_prod05-handoff.md](reports/WF06-PROD-04_prod05-handoff.md).

## Verdict
**PASS_WITH_EVIDENCE.** `/library` renders only the Library APIs' answers: the first page of each tab is built on the server with the API's own builders for the session's viewer; keyword, filters and sort ask the API; "Xem thêm" follows the cursor. Startup: canonical PUBLIC startups plus the external remainder (canonical wins); founders: visible canonical owners for members, a sign-in state for guests; loading / empty / error / retry states; the external feed's failure leaves canonical rows. Zero runtime fixture. Organization page heading shows the children total. PROD-05 not started. STOP.

## Scope implemented
- Page, client, model and CSS of `/library`; shared body builders for routes and page; external-founder extraction removed from the adapter (no reader; DEC-W6P-D03); organization children heading.
- New spec `wf06-prod-library`; realigned `public-library`, `l6-discovery-privacy`, `alpha-interaction-gaps` and two unit suites, each with OLD → NEW, source and reason.

## Files changed
- Runtime: `src/app/(public)/library/page.tsx`, `src/components/library/*` (client, model, view, CSS), `src/lib/library/library-bodies.ts` (new), `library-api.ts`, `startup-adapter.ts`, `src/app/api/v1/library/*/route.ts`, `src/app/(public)/organizations/[slug]/page.tsx`.
- Tests: `library-model.test.ts`, `startup-adapter.test.ts`, `src/lib/library/testing.ts`, four visual specs.
- Docs: five `WF06-PROD-04_*` reports, this report.

## Migrations / data
None. Test fixture rows only, removed after each suite.

## Tests / build
Format, lint, typecheck PASS; unit 36 files / 344 tests; DB 38 files / 611 tests; production build PASS; all 81 visual specs: 1091 passed, 1 contract-driven failure realigned and re-run green (15 / 15), 25 gated skips; feed-down case PASS; console / hydration / unexpected 5xx: 0.

## Visual QA
Targeted responsive smoke at 1440 / 768 / 390: no overflow in any state; L15 / L15b / L15c pixel tests green (founder frame as a member). Full pixel matrix belongs to PROD-06 (risks V1 – V6).

## Deviations / blockers
None blocking. For PO / design review: the guest founder sign-in copy, "Chưa xác định" no longer a facet, quick chips on Startup / founders follow the DOMAIN slug map (hidden when none matches), H3 (`/library` reading of DEC-L6-D1 / DEC-PDF-D1 under DEC-W6P-D02). The task's backend SHA `c4fe1e36` does not exist; `4fe1e36` is the PROD-03 commit.

## Git
- Branch: `feat/wf06-prod-hardening`; base `4fe1e36`; HEAD unchanged during the task
- Implementation commit: `feat(wf06): Library frontend on the read API (WF06-PROD-04)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of WF06-PROD-04 (copy, H1 / H2 / H3); then WF06-PROD-05 (QA) per the handoff.
