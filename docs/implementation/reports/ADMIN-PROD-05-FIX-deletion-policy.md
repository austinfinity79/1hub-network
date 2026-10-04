# ADMIN-PROD-05-FIX-deletion-policy

**ADMIN-PROD-05-FIX — close the account-deletion policy + final regression recheck (AUDIT + FIX + RECHECK).** Evidence 1 – 15. Decision: [DEC-ADM-PD7.1](../../decisions/DECISION_LOG.md#dec-adm-pd7-1) (PO, stated in the task contract). Contract: [05 §28](../../architecture/05_API_CONTRACT_P0_v1.0.md). Base `5ea7835`; HEAD unchanged by anyone else during the task.

## 1. Rule correction
| | ADMIN-PROD-05 (unsupported, removed) | Now (PO) |
|---|---|---|
| reject a user's own deletion request | refused, 409 "can only be processed" | allowed |
| states | PENDING → PROCESSED | PENDING → PROCESSED · PENDING → REJECTED |
| rejection reason | optional | **required** for every deletion request (the user's own, a leader's SOFT_DELETE escalation); LOCK / DEACTIVATE escalation declines unchanged (optional) |
| acceptance | deactivate + privacy flag (PD-7) | unchanged |
| hard delete | never | never |
REJECTED is stored as the frozen 017 `account_request_status` value `DECLINED` (route `…/decline`, filter `status=DECLINED`): the PO's state, no migration. Audit trail kept whole: `ACCOUNT_DELETION_REQUESTED` (WF02) → `ACCOUNT_REQUEST_PROCESSED` or `ACCOUNT_REQUEST_DECLINED` (before PENDING, after DECLINED + reason).

## 2. API behaviour — `POST /ops/account-requests/{id}/process | decline`
| Case | Answer |
|---|---|
| PLATFORM_ADMIN processes a PENDING deletion | 200 PROCESSED; account + profile DEACTIVATED, sessions revoked, flagged for the retention procedure; nothing deleted |
| PLATFORM_ADMIN declines with a reason | 200 DECLINED; account, profile, sessions and the request row untouched |
| decline without / with a blank reason | 422 `fields.reason = required` (> 500 → `too_long`; any other key → `not_accepted`) |
| request already PROCESSED or DECLINED (duplicate or opposite decision) | 409 |
| leader, member, the requester; unknown or malformed id | 404 (identical) |
| a request about the admin's own account | 403, audited `ACCOUNT_SELF_ACTION_REFUSED` |
| retry with the same `Idempotency-Key` | the first answer replayed |
Order: authority → body → own account → reason rule → row locks (actor, target, request) → PENDING check. Code: one rule in `decideAccountRequest` (`src/lib/admin/account-ops.ts`); the canonical `account_deletion_requests` / `account_action_requests` rows are reused.

## 3. Reject-reason validation
Trimmed; required non-blank; ≤ 500; kept verbatim in the decision audit (`after.reason`) and never elsewhere. The server cannot judge whether the text names a legal / retention / security / operational obligation: the PROD-06 dialog prompts for it (handoff updated).

## 4. Targeted tests (all PASS)
| Required | Test |
|---|---|
| process request | `processing follows the deactivate / privacy flow and deletes nothing` |
| reject request · missing reason · audit | `rejects only with a reason; nothing about the account changes; the reason is audited` (5 missing / blank bodies, too long, extra key; trail and payload checked) |
| invalid state · duplicate processing | `a decided request is final: duplicate or opposite decisions answer 409` (one decision audit each) |
| non-admin | `only PLATFORM_ADMIN decides: leaders, members and the requester see 404` |
| concurrent process / reject | `a concurrent process and reject resolve to exactly one decision` (two rounds) |
| no hard delete | account, profile and request rows counted after every decision |
| escalations | `a leader's SOFT_DELETE escalation also needs a reason; LOCK / DEACTIVATE keep it optional` |
| over HTTP | `admin-prod-05-api.spec.ts`: leader 404, missing / blank 422, reject 200, idempotent replay, then process 409 |
`account-ops.db-test.ts` 19 / 19 (was 13: one test replaced, seven added).

## 5. Full protected regression — final build of `6f865e4`
SPEC_COUNT = 86 files, 1152 tests (full `tests/visual/specs`, fresh DB + QA vocabulary fixture, rebuilt production server)

PASS = 1126

FAIL = 0

SKIP = 26 — `pixel-qa-screens.spec.ts` (24: gated by `PIXEL_QA_SCREENS`, opt-in per-screen pixel diff, not part of this task); `wf06-prod-library.spec.ts` (1: needs `WF06_FEED_DOWN`, a down-feed server); `wf06-prod-qa.spec.ts` (1: needs `WF06_QA_FEED=crafted`, a crafted-feed server) — all pre-existing, environment-gated, unrelated to this task

FLAKY = 0 (retries: 0; a pass is a true pass)

Duration 19.0m.

## 6 – 9. Regression by area
| Area | Result |
|---|---|
| feedback (NEW → IN_REVIEW → DONE, 90-day screenshots, optional private guest e-mail, weekly summary) | `feedback-ops.db-test.ts` 10 / 10 + HTTP spec — GREEN |
| categories (label / archive / activate / order only) | `category-ops.db-test.ts` 6 / 6 + HTTP spec — GREEN |
| account ops (LOCK, DEACTIVATE, SOFT_DELETE request; no hard delete; session invalidation) | `account-ops.db-test.ts` 19 / 19 + HTTP spec — GREEN |
| audit · IDOR · concurrency | GREEN: text-free audit payloads, 404 for foreign ids, admin races and process / reject race serialized |
Gates: format · lint · typecheck PASS · unit 37 / 367 · DB 47 / 744 (`pnpm test:db`, fresh reset) · build PASS.

## 10 – 15. Files, git, confirmations
Implementation commit `6f865e4`: `account-ops.ts`, decline route comment, `account-ops.db-test.ts`, `admin-prod-05-api.spec.ts`, API contract §28, `DECISION_LOG.md` (PD7.1 + R16). Report commit: this file, the PROD-05 accounts / QA / handoff reports, `CLAUDE_LATEST_REPORT.md` — docs only. No migration, no data change. origin/main and production `78f21f2`. No frontend, no push, no merge, no deploy; ADMIN-PROD-06 not started.

## Gaps for the PO (not built: no scope expansion)
| Item | Note |
|---|---|
| the user is not told | WF02-S07 shows only "requested"; a rejection and its reason reach the user nowhere (WF02 protected; frontend NO) |
| re-request after rejection | WF02 keeps one request per account (`uq_account_deletion_request_account`), so a rejected user cannot file again |
| reason in the admin API | kept in the audit, not on the request DTO; PROD-06 cannot show it without an additive field |

## Related
- [ADMIN-PROD-05-accounts.md](ADMIN-PROD-05-accounts.md) · [ADMIN-PROD-05-qa.md](ADMIN-PROD-05-qa.md) · [ADMIN-PROD-05-prod06-handoff.md](ADMIN-PROD-05-prod06-handoff.md)
