# Claude Task Report

## Task
WF04-PROD-03 — API / RBAC / validation / idempotency hardening. API: [05 §22 amendment A5](../architecture/05_API_CONTRACT_P0_v1.0.md); decisions: [DEC-W4P-D12](../decisions/DECISION_LOG.md#dec-w4p-d12); task report: [reports/WF04-PROD-03_api-rbac-hardening.md](reports/WF04-PROD-03_api-rbac-hardening.md).

## Verdict
**PASS_WITH_EVIDENCE, local only.** Canonical `/api/v1/programmes*` on the PROD-02 persistence; no migration, table, role, UI or frontend change. Not pushed, not deployed; PROD-04 not started. STOP.

## Scope implemented
- Capability `programme:manage` (leader of exactly the owning org, platform admin) in matrix code, document and test.
- `GET /programmes`, `POST /programmes`, `GET|PATCH /programmes/{id}`, `PUT /programmes/{id}/registration`, `POST /programmes/{id}/publish`, `POST /programmes/{id}/close`.
- Lifecycle DRAFT → PUBLISHED → CLOSED only; ARCHIVED never written; publish rules of contract §8 only.
- Challenge problems in `metadata.challenge` (CHALLENGE only); stages in `metadata.journey`; no generic metadata write.
- Registration writes the canonical WF05 form (TEAM / STARTUP, per-question `required` / `step`), version bump, refused once applications exist.
- Idempotency-Key for `programme.create` / `publish` / `close`; audit `PROGRAMME_CREATED|UPDATED|REGISTRATION_UPDATED|PUBLISHED|CLOSED`.

## Files changed
- New: `src/lib/programme/{types,rules,programme,request}.ts`, `src/app/api/v1/programmes/**` (5 route files), tests `src/lib/programme/rules.test.ts`, `src/lib/programme/programme.db-test.ts`, `tests/visual/specs/wf04-prod-api.spec.ts`.
- Changed: `src/lib/authz/matrix.ts`, `src/lib/api/idempotency.ts`, `src/lib/audit/audit.ts`; tests `authz.db-test.ts`, `idempotency.db-test.ts`, `contract.test.ts` (counts).
- Docs: API contract §22 (A5), DECISION_LOG (DEC-W4P-D12), capability matrix, WF04 contract §5 / §6 / §12 / §14 / §19, task report, this report.

## Migrations / data
None. DB changes beyond migration 015: none.

## Tests / build
format, lint, typecheck PASS; unit 35 files / 326; build PASS; DB 34 files / 505; HTTP API spec 8/8; protected visual / API 61 specs 696/696 on the final build; UAT 19/19; 5xx 0, console errors 0.

## Visual QA
No UI change; no baseline touched.

## Deviations / blockers
- Field refusals use the ops convention (422 `PROFILE_VALIDATION_FAILED`, `not_accepted` / `immutable`), replacing contract §12's "400" wording (D12).
- Undecodable `%` escapes are refused with 400 by the Next.js router before the handler; every other malformed id is the canonical 404.
- Open for the PO: create under an ARCHIVED organization; Q1, Q3 (edits after applications, INDIVIDUAL), Q4–Q6, Q8–Q10. WF05 follow-up: lock the form read on application create (reviewer L1).

## Git
- Branch: `feat/wf04-prod-hardening`; start HEAD `2a77a1e`; no concurrent change
- Implementation commit: `feat(wf04): programme API, RBAC and lifecycle (WF04-PROD-03)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO review of PROD-03; then WF04-PROD-04 (frontend fixture → API) once Q4–Q6 are answered.
