# WF05-PROD-05_functional-security-qa

**WF05-PROD-05 — functional and security QA.** 2026-10-03, branch `feat/wf05-prod-hardening` on `71392fb` (PROD-04). Real runtime: canonical Venture → Programme → form → DRAFT → SUBMITTED → read-only history, over the PROD-02 – PROD-04 APIs and persistence. Matrices: [WF05-PROD-05_matrices.md](WF05-PROD-05_matrices.md); evidence: [WF05-PROD-05_evidence.md](WF05-PROD-05_evidence.md); PROD-06: [WF05-PROD-05_prod06-handoff.md](WF05-PROD-05_prod06-handoff.md).

## Preflight
Branch `feat/wf05-prod-hardening`, HEAD `71392fb` (PROD-04 in HEAD, WF04 candidate `f40f70c` in history), tree clean except `AGENTS.md`; migrations 001–016, no file in `db/` changed since PROD-02 (`9842b70`); `origin/main` and production `78f21f2`; Claude B `fb2130f` and `fix/member-shell-mobile` `a957876` not in HEAD; no fixture-backed runtime (PROD-04 grep, unchanged). SOT read: WF05 contract (PROD-01), PROD-02 / 03 / 04 evidence, API §2.5, §21, §23, DEC-L5-D3, DEC-W5P, WF04-PROD-05.

## Carry-forward A — 400 vs 422 (RESOLVED)
| Source | Rule |
|---|---|
| API §2.5 (generic table) | `400` "malformed request / validation"; `422` "semantically valid JSON but business validation failed" |
| WF05 contract (PROD-01, RBAC / API, "Common") | "malformed JSON or body `422`, never `500`" |
| DEC-L5-D3, API §21.1 | `APPLICATION_VALIDATION_FAILED` and `APPLICATION_INCOMPLETE` are `422` |
| repo practice | all 31 JSON routes of WF02–WF05 send an unreadable body through the domain validator → `422 … {body: invalid}`; `400` only in WF01 auth (`AUTH_EMAIL_INVALID`, `AUTH_LINK_INVALID`); WF04-PROD-05 "bad JSON 422" |
**Frozen reading (DEC-W5P-D11, API §24.1):** a WF05 handler never answers `400`; body, field and business validation are `422`; malformed or unknown ids `404`; state and duplicates `409`. The workflow contract is the more specific source and has no generic `400` code to use; no global standard is changed.
- **400_CASES** = 1: an undecodable `%` in the path, answered by the Next.js router before any handler (HTML "400: Bad Request", outside the envelope, global G14). WF01 auth `400` codes are outside WF05.
- **422_CASES** = 19: malformed JSON (create, save, `POST /ventures`), array body, missing field, wrong type, malformed body id, unknown field, forbidden `owner_profile_id`, non-writable enum field, `status` in a save, `answers` not an array, answer without value, non-string value, unknown question, > 2000 characters, repeated question, venture `type` enum, incomplete submit (`APPLICATION_INCOMPLETE`).
- **CONSISTENCY_RESULT = PASS**: every case answers the rule, in the frozen envelope, with no stack, SQL or constraint name, and no row changes. No route needed a fix.
- Observation (not a defect, no contract defines it): a missing `venture_id` / `programme_id` reports reason `invalid`, not `required`.

## Carry-forward B — draft-save audit (RESOLVED, AUDIT_GAP fixed)
Before: create and submit audited; a draft save wrote nothing, so the audit trail could not show who changed a draft and when. Fixed per the WF02–WF04 `X_UPDATED` convention (PO task contract §3; DEC-W5P-D12, API §24.2):
| Action | Written when | Proves (never an answer value) |
|---|---|---|
| `APPLICATION_DRAFT_CREATED` | create | actor, application, programme, venture, status, `request_id`, time |
| `APPLICATION_DRAFT_UPDATED` | a `PATCH` that changes at least one answer | the same + `changed_questions` (ids) |
| `APPLICATION_SUBMITTED` | submit | the same, `before` DRAFT → `after` SUBMITTED |
A save that changes nothing (autosave, page hide with nothing typed) and every refused call write nothing; the row commits in the mutation's transaction, so its existence is the result. Files: `application.ts` (audit + `requestId`), `audit.ts`, `applications/[applicationId]/route.ts`; tests updated where they asserted the superseded "no draft-save audit" (hardening DB test rewritten + 1 new; L5 DB submit test; L5 and UAT HTTP sequences).

## Findings
| # | Finding | Class | Action |
|---|---|---|---|
| F1 | draft saves unaudited | AUDIT_GAP | fixed (above) |
| F2 | 400 vs 422 undefined for WF05 | ERROR_CONTRACT_BUG (documentation) | rule recorded (DEC-W5P-D11, API §24.1); runtime already conformed |
| F3 | no single HTTP proof of the full negative / validation matrix, retry-after-refusal, unsupported methods, ARCHIVED over HTTP, PROJECT + STARTUP journeys | TEST_GAP | `wf05-prod-qa.spec.ts` (7 tests) |
| F4 | `DELETE` / `PUT` on applications answer `405` with an empty body (framework) | OUT_OF_SCOPE (G14, global) | documented; controlled 4xx, nothing changes |
| F5 | regression run 1 void: a DB suite run alongside it reset the shared schema (`idempotency.db-test` runs `db.mjs reset`), one `500` "relation does not exist" | test-environment (operator) | run discarded; clean rerun on a fresh DB, nothing in parallel |
| F6 | regression run 2: `wf03-uat-journey` NEG-WF03 checks every stored audit action against its copy of the `audit.ts` registry, which lacked the new `APPLICATION_DRAFT_UPDATED` | TEST_GAP (registry copy) | code added to the copy with its decision id; run 3 on a fresh DB. Its copy also lacks WF04 `PROGRAMME_*` (pre-existing; passes only because WF03 runs before WF04): reported, not changed |
No FUNCTIONAL_BUG, SECURITY_BUG, VISUAL_ONLY or CONTRACT_CONFLICT.

## Deferred (unchanged owners)
WF02: team invitation `Idempotency-Key` (G08), invitation e-mail in a locked transaction (G13). Global: rate limit, CSRF beyond SameSite, framework `400` / `405` envelope (G14). Promotion runbook (Claude B): 014 → 015 → 016 on a production-shaped copy, close `d4…0001`. PROD-04 PO flag: draft created on first input. G29 back links (design).

## Related
- [WF05-PROD-05_matrices.md](WF05-PROD-05_matrices.md) · [WF05-PROD-05_evidence.md](WF05-PROD-05_evidence.md) · [WF05-PROD-05_prod06-handoff.md](WF05-PROD-05_prod06-handoff.md) · [WF05-PROD-04_frontend-integration.md](WF05-PROD-04_frontend-integration.md)
