# WF01 — IDENTITY & ONBOARDING — FINAL v1.0

**Mode:** Production 29/09  
**Actor:** Guest → authenticated member / leader  
**Goal:** Create/access account, establish initial Individual Profile, capture privacy/visibility choices, finish onboarding.  
**Result:** authenticated account + initial profile + recorded consent/visibility + handoff to WF02.

> **Amended 2026-09-29 (TASK 22-L1-L2-SOT-REALIGN).** The BA workbook and the L1 flow board of 28/09 supersede the happy path and the screen contracts of WF01-S05 … S08 below. Current flow: AUTH → ACC-05 intro → ACC-06 basic information → ACC-07 capability and field → ACC-08 ecosystem role → ACC-09 review and finish → ACC-10 → `/me`. Sign-up is open to any valid e-mail through the verified magic link. Source of the current rules: [DEC-L1R](../decisions/DECISION_LOG.md#dec-l1r) and [l1-screen-contracts.md](../implementation/l1-l2-realign/l1-screen-contracts.md). The text below is kept as history.

## Final happy path

```text
WF01-S01 Auth entry
→ WF01-S02 Check email
→ WF01-S03 Auth callback
→ WF01-S05 Purpose / role intent
→ WF01-S06 Basic profile
→ WF01-S07 Privacy & visibility
→ WF01-S08 Complete / next actions
→ WF02-S01 Account Home
```

`WF01-S04` contains error/blocked auth variants and is entered only on exception paths.

## Screen contracts

| ID | Route | Source | Responsibility | Primary write |
|---|---|---|---|---|
| WF01-S01 | `/auth` | AUTH1 | Email magic-link entry; provider entry if configured | auth request |
| WF01-S02 | `/auth/check-email` | AUTH2 | Confirm link sent, resend/correct email | auth request state |
| WF01-S03 | `/auth/callback` | AUTH3 | success / expired / already-used callback states | session/account activation |
| WF01-S04 | `/auth/error` | AUTH4 | blocked/error recovery states | none |
| WF01-S05 | `/onboarding/purpose` | ONB1 | capture why user comes to HUB / initial intent | onboarding/profile intent |
| WF01-S06 | `/onboarding/profile` | ONB2 | avatar + basic identity/profile fields + canonical expertise selection | IndividualProfile |
| WF01-S07 | `/onboarding/privacy` | ONB3 | privacy-by-purpose + visibility settings + required legal acceptance | ConsentRecord + ProfileVisibilitySetting |
| WF01-S08 | `/onboarding/complete` | ONB4 | show valid next actions based on intent/profile state | onboarding completion state |

## State rules

- Existing valid session + completed onboarding skips to WF02-S01.
- Existing account + incomplete onboarding resumes at first incomplete onboarding step.
- Email callback must distinguish success, expired link and already-used/invalid link.
- Required legal consent is versioned and separate from optional visibility purposes.
- Profile completion percentage is informative; `>=80%` is a KPI, not a general access gate.
- Canonical skill/domain selection uses controlled vocabulary; do not create free-text duplicates where vocabulary is required.

## Future identity verification insertion point

Later flow may become:

```text
Auth success
→ optional/required 1Hub verified identity / CCCD verification
→ onboarding
```

P0 must not store sensitive CCCD data locally merely to prepare for this future flow. Use an external verification reference/status boundary.

## Explicit non-goals in WF01

- membership approval workflow;
- programme application;
- project/startup creation;
- investor verification;
- matching/recommendation engine.
