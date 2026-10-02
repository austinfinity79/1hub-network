# Claude Task Report

## Task
WF05-PROD-01 — freeze the WF05 production contract and canonical data model. Contract: [production contract](reports/WF05-PROD-01_production-contract.md) · [domain and lifecycle](reports/WF05-PROD-01_domain-lifecycle.md) · [RBAC, API, frontend](reports/WF05-PROD-01_rbac-api-frontend.md) · [DB contract](reports/WF05-PROD-01_db-contract.md) · [implementation handoff](reports/WF05-PROD-01_implementation-handoff.md); decisions: [DEC-W5P](../decisions/DECISION_LOG.md#dec-w5p).

## Verdict
**PASS_WITH_EVIDENCE — WF05 PRODUCTION CONTRACT FROZEN.** TRUE_PO_DECISIONS_REMAINING = 0. PROD-02 not started. STOP.

## Scope implemented
- Scope L5 + S01 + S02 with routes, screens, actions and the out-of-P0 list; demo artifact disposition (remove notice, reset, demo copy, actor key, MemberShell "Demo" labels; keep `/demo` routes and API names).
- One canonical model (`projects`, `project_members`, `programmes`, `programme_application_forms`, `applications`); applicant = the venture; DRAFT → SUBMITTED final; programme-state matrix; submitted immutability; form consistency; visibility; authority matrix; API behaviour per endpoint; idempotency and duplicate rules; audit; frontend rules; cross-WF invariants.
- DB contract from the live catalog: every table EXISTING / NO_CHANGE except migration 016 (DELETE guard, DRAFT identity guard, snapshot shape check).
- `d4…0001`: KEEP + CLOSE / HIDE via the canonical WF04 close at promotion; no schema mechanism needed.
- SOT conflicts C1 / C2 resolved by precedence (historical SOT unchanged); PROD-02 / PROD-03 allowed scope.

## Files changed
- Docs: the five `reports/WF05-PROD-01_*` contract files above (new); `docs/decisions/DECISION_LOG.md` (DEC-W5P); this report.

## Migrations / data
None. No runtime, API, route, DB or data change.

## Tests / build
Not applicable (contract task). Catalog facts read with SELECT only.

## Visual QA
Not applicable.

## Deviations / blockers
None. Owner document updates (CLAUDE.md §2 wording, Data SOT annotation, superseded notes) and closing `d4…0001` are promotion-runbook items, not PROD-02 / 03 scope.

## Git
- Branch: `feat/wf05-prod-hardening`; start HEAD `d1ac04a`; no concurrent change
- Implementation commit: `docs(wf05): freeze the WF05 production contract (WF05-PROD-01)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of the WF05 production contract; then WF05-PROD-02 (persistence / schema: migration 016, idempotency retention, test fixtures, seed hygiene).
