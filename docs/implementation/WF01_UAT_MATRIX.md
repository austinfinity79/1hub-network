# WF01 UAT Matrix

Automated in `tests/visual/specs/wf01-uat-journey.spec.ts` (Playwright, 1440×900, UI-driven). Runs: dev DB and a fresh clone on a fresh PostgreSQL, 2026-09-26. The "mail" step reads the newest link the way the inbox receives it; no email delivery exists in P0.

| ID | Preconditions | Steps | Expected | Mode | Result |
|---|---|---|---|---|---|
| UAT-01 New member happy path | New email | S01 request → S02 (resend visible) → open link → S05 choose → S06 required fields → S07 acknowledge → S08 → "Vào 1hub.network" | Session via HttpOnly cookie; token stripped from URL; 1 profile; DRAFT until S08, then ACTIVE with timestamp; 2 consent records, 2 `CONSENT_ACCEPTED`, 1 `PROFILE_ACTIVATED`, 1 `onboarding_completed`; `/session` = completion service; no raw token stored; lands on `/me` | Auto | PASS |
| UAT-02 Skip intent | New email | S05 "Bỏ qua, làm sau" → S06 → S07 → S08 | Completes; `primary_intent` NULL; ACTIVE | Auto | PASS |
| UAT-03a Resume partial | S05 + S06 done, logged out | Sign in again, continue to S07/S08 | Guest blocked meanwhile; answers kept; completes with one profile | Auto | PASS |
| UAT-03b Resume at first incomplete step | Same | Sign in again | Lands on `/onboarding/privacy` (WF01 state rule) | Auto (expected-fail) | **FAIL — DEFECT-RESUME (P2)**: lands on `/onboarding/purpose`; fix blocked on the S05-skip data-model decision (WF01-REMEDIATION-03) |
| UAT-04 Expired / used / invalid link | Link minted | Open expired; open valid; reopen used; open garbage | Expired and used states without a session; valid signs in once; invalid → `/auth/error` | Auto | PASS |
| UAT-05 Required profile validation | At S06 | Continue with empty fields | Field errors; stays on S06; nothing saved | Auto | PASS |
| UAT-06 Legal version race | At S07; a new Privacy version published | Acknowledge, continue; re-acknowledge | 409 → documents reload and ask again; consent for the new version; completes | Auto | PASS |
| UAT-07 PRIVATE vs NETWORK_ONLY | Avatar uploaded, discovery OFF | Other member / guest fetch the avatar; owner turns discovery ON | PRIVATE → other 404; NETWORK_ONLY → other 200; guest always 404 | Auto | PASS |
| UAT-08 Complete below 80% | Minimum fields only | Finish the journey | Completes; percent < 80; no NETWORK_CONTEXT group | Auto | PASS |
| UAT-09 Retry / concurrent completion | Completed | 4 parallel `POST /me/onboarding/complete`, reload S08 | All 200; state, audit and analytics unchanged | Auto | PASS |
| UAT-10 Returning completed member | Completed, logged out | Sign in; open S05–S08 | Callback → `/me`; S05–S07 → `/me`; S08 viewable; nothing rewritten | Auto | PASS |
| UAT-11 Launch-roster member (Freeze D2) | Roster rows for a member and a leader | Sign in; onboard; sign in again | One profile; ACTIVE membership; leadership only for the leader; no capability; onboarding completes; nothing duplicated | Auto | **PASS** (GAP-ROSTER closed, marker removed) |
| UAT-12 Registration metric | New email | Sign in; retry the link; sign out and in | Exactly one `account_created` throughout | Auto | **PASS** (GAP-ANALYTICS-REG closed, marker removed) |
| UAT-13 Funnel consistency | New email | Full journey S01→S08 | `account_created` first, only real `profile_completion_changed` in between, `onboarding_completed` last, one account, no personal data | Auto | PASS |
| UAT-M1 Real legal documents | Production content supplied | Read Terms/Privacy from S07 links | Approved legal text and versions | **Manual** | BLOCKED — PRODUCTION_LEGAL_CONTENT_REQUIRED |
| UAT-M2 Copy sign-off | — | PO reviews the strings in the audit's copy review (§7) | Approved wording | **Manual** | OPEN |
| UAT-M3 Real mailbox | Email delivery configured | Receive and open the link | Link arrives and works | **Manual** | NOT AVAILABLE in P0 local (no email delivery) |

**Totals:**
- Automated: 14 (13 PASS; 1 expected-fail marker confirming DEFECT-RESUME).
- Manual: 3.
- Passed: 13.
- Failed (known, tracked): 1.

**Expected-fail tests:** `test.fail()` marks UAT-03b only (UAT-11 and UAT-12 markers were removed when GAP-ROSTER and GAP-ANALYTICS-REG closed). They start failing when the gap is fixed, so the marker must then be removed.

## Related

- [WF01_COMPLETION_AUDIT.md](WF01_COMPLETION_AUDIT.md) — audit and defect classification
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
