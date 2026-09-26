# Claude Task Report

## 1. Task
- Task ID / name: WF01-REMEDIATION-02 — GAP-ANALYTICS-REG (registration + WF01 funnel analytics)
- Status: **DONE — GAP-ANALYTICS-REG CLOSED**
- Mode: LOCAL REVIEW. Committed locally, not pushed. DEFECT-RESUME and WF02 not started.

## 2. Source audit
| Item | Finding |
|---|---|
| Frozen event name | API 05 §10 "P0 minimum events" lists **`account_created`**. Used exactly; no alias |
| Common properties | `event_name, occurred_at, account_id, profile_id, workflow, screen_id` (§10); no personal content |
| Writer | `src/lib/analytics/analytics.ts` (S08), one writer on `analytics_events` |
| Delivery policy | **Transactional**: the event is inserted in the same transaction as the change it records. A writer failure rolls the change back, so account state is never inconsistent. No new semantics were introduced |
| Account creation | `consumeMagicLink`, previously SELECT-then-INSERT. That raced on concurrent first sign-ins, where the second one failed on the UNIQUE email (a latent defect, fixed here) |

## 3. Implementation
- `consumeMagicLink`: `INSERT … ON CONFLICT (email_normalized) DO NOTHING RETURNING id` and `account_created` in **one transaction**. The event is written only when this call created the account.
  - `profile_id` is null at sign-up; `workflow` WF01; `screen_id` WF01-S03.
  - The existing account is resolved otherwise, and the blocked check is unchanged.
- The roster reconcile still runs after the account is resolved (unchanged). The event carries no roster data.
- `trackEvent` accepts a null `profile_id`; the event type union gains `account_created`.

## 4. QA
**DB** (`registration.db-test.ts`, 5):
- the first sign-in writes one event with exactly the frozen properties and no `@`;
- returning sign-in and a retried link add nothing;
- two valid links consumed concurrently → 1 account, 1 event (previously one request errored);
- a failing event insert (test trigger) rolls the account back; the next link creates the account and one event;
- a roster sign-up → one event, no roster fields, membership attached.

**UAT** (`wf01-uat-journey.spec.ts`):
- **UAT-12 PASS**, expected-fail marker removed: one event after the first sign-in, a link retry, and sign-out/sign-in.
- **UAT-13 (new) PASS**: the full journey reads `account_created` first, only real `profile_completion_changed` in between (from ≠ to), `onboarding_completed` last; one account id; no email, token, name, headline or legal types.
- The UAT-03b marker (DEFECT-RESUME) is untouched.

**Re-proved:**
- `onboarding_completed` once (S08 suites, concurrency);
- `profile_completion_changed` change-only (a PATCH with no percent change writes none);
- audit and analytics stay separate (no `audit_events` written or read for registration).

**Fresh DB proof** (clean clone of `37d66b4`, new PostgreSQL 17.6):
- migrate 001→004 and seed;
- new account → onboarding via the real APIs gives `account_created → profile_completion_changed(0→20) → (20→30) → onboarding_completed`; a no-change PATCH and a repeated complete wrote nothing;
- **app and DB restarted, signed in again → funnel identical**;
- DB 195/195 and the UAT suite 14/14 on the fresh DB;
- app logs contain no email or token.

## 5. Validation (dev)
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit / DB | 120 / 195 |
| Build | PASS |
| Full Playwright | 264 passed (+UAT-13), 24 skipped by design. Includes auth/session, magic-link concurrency, roster, completion, S08, the WF01 journey and UAT |
| Pixel | unchanged: S01 0/0/0/0/1; S02 0/0/0/14/3; S03 71/247/97; S04 1, 1/3; S05 193/245; S06 6/503; S07 26/75; S08 all 0 |

## 6. Remaining
- **ANALYTICS-EXT (P2):** API §10 also lists `account_authenticated`, `onboarding_started`, `consent_accepted`, `visibility_changed`, `membership_bootstrapped`, `membership_requested`, `profile_saved` and `feedback_submitted`, which are not emitted. The Data SOT minimum (registration, profile completion; feedback later) is met. Go-live decision: implement with the same writer, or confirm the deferral.
- **DEFECT-RESUME (P2):** unchanged.
- **Known edge (pre-existing):** a link is claimed before the account transaction. If that transaction fails, the link is spent and the user requests a new one.

## 7. Git
- Branch: `main`; start HEAD `71d4cd7`
- Implementation commit: `37d66b4` feat(wf01): record account_created once per new account (GAP-ANALYTICS-REG)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `fed0b25`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [WF01_COMPLETION_AUDIT.md](../WF01_COMPLETION_AUDIT.md) — audit (updated)
- [WF01_UAT_MATRIX.md](../WF01_UAT_MATRIX.md) — UAT matrix (updated)
- [P0_STATUS.md](../P0_STATUS.md) — overall P0 state
