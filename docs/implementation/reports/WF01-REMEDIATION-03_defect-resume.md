# Claude Task Report

## 1. Task
- Task ID / name: WF01-REMEDIATION-03 — DEFECT-RESUME
- Status: **BLOCKED — S05 SKIP DATA-MODEL GAP**. Stopped before implementation, as the task instructs for this case.
- Mode: LOCAL REVIEW. No runtime, API or DB change. Not pushed. WF02 not started.
- Done in this task: **DEC-WF01-ANALYTICS-EXT-DEFER** recorded in [DECISION_LOG.md](../../decisions/DECISION_LOG.md#dec-wf01-analytics-ext-defer) (APPROVED P0 DEFERRED).

## 2. Why it stopped
The task requires S05 "Bỏ qua, làm sau" to resume at PROFILE ("S05 intentionally skipped → PROFILE"), and says to STOP if a skip cannot be told apart from "never visited" without a heuristic.

| Evidence | Finding |
|---|---|
| DEC-WF01-S05-D3 | Skip is "no write, `primary_intent` stays NULL"; its test asserts **0 requests and no profile row** |
| `purpose/page.tsx:36` | Skip is a plain `<Link href="/onboarding/profile">`; nothing reaches the server |
| `individual_profiles` (001) | Only `primary_intent` and `onboarding_completed_at`; **no step-progress column**; 002–004 add none |
| Other stores | Skip writes no audit, no analytics, no consent |

A user who skipped S05 and saved nothing else is therefore **indistinguishable** from a brand-new user. Any rule that separates them would be inferred, not recorded.

## 3. What is determinable today (no decision needed)
With `primary_intent` set, or once later data exists:

| Step | Canonical source |
|---|---|
| PROFILE done | S06 progression: display_name, headline, region, ≥1 DOMAIN/SKILL (`profileStepComplete`) |
| PRIVACY done | Live acceptance of the CURRENT Terms and Privacy documents, by document id (`getLegalState`) |
| COMPLETE pending | Both above, `onboarding_completed_at` NULL |
| DONE | `onboarding_completed_at` set (status ACTIVE) → `/me` |

`GET /me/onboarding` already derives PURPOSE/PROFILE/PRIVACY. The defect is that `consumeMagicLink` hard-codes `next_step: PURPOSE`, and the resolver treats NULL intent as PURPOSE even after later progress.

## 4. Options (human decision required)
| Option | What | Schema | Decisions affected |
|---|---|---|---|
| **A. Persist the skip** (recommended) | Additive column, e.g. `individual_profiles.purpose_step_passed_at timestamptz`, set both when an intent is saved and when S05 is skipped. The skip becomes a server write (creating the DRAFT profile), still with `primary_intent` NULL. Carrier: `PUT /me/onboarding/intent` with an explicit skip payload, or a new endpoint | migration 005 (additive) | Amends DEC-WF01-S05-D3 ("no write") and the D1 validation (null is rejected today). A frozen API shape for "skip" is needed |
| B. Evidence rule | PURPOSE counts as passed if an intent is set OR any later-step evidence exists (S06 fields saved, current consents). A pure skip with nothing else saved resumes at PURPOSE (skip offered again; no data loss) | none | Needs explicit approval, because the task forbids an unapproved heuristic; test 2 would be narrowed to "skipped and progressed" |
| C. Progress table | Separate onboarding-progress records per step | new table | Heavier than P0 needs |

**Recommendation:** A. It records the user's actual choice, keeps the resolver fully derived from persisted state, and has the smallest behavioural surface.

## 5. Planned implementation once decided (not started)
- One resolver in `src/lib/onboarding/state.ts` returning PURPOSE, PROFILE, PRIVACY, COMPLETE or DONE, plus its route.
- Used by `consumeMagicLink` (`next_step`), the S05–S08 page guards (redirect to the current step; no data changed) and `GET /me/onboarding`.
- The callback route map gains COMPLETE (`/onboarding/complete`).
- Tests: the 12-case matrix, UAT-03b flip, fresh DB + restart.

## 6. State
- DEFECT-RESUME: **OPEN (P2)**, blocked on the decision above. UAT-03b stays expected-fail.
- P0: 0. P1: 0. P2: DEFECT-RESUME.
- Release blockers unchanged: PRODUCTION_LEGAL_CONTENT_REQUIRED, real production roster data, production taxonomy data.
- Validation: docs only. `pnpm test` (contract guard reading the decision log) and format check PASS. No code changed, so the previous full run stands (unit 120, DB 195, Playwright 264).

## 7. Git
- Branch: `main`; start HEAD `862519a`
- Commits: the docs commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `fed0b25`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [DECISION_LOG.md](../../decisions/DECISION_LOG.md) — decision records
- [WF01_COMPLETION_AUDIT.md](../WF01_COMPLETION_AUDIT.md) — audit
- [WF01_UAT_MATRIX.md](../WF01_UAT_MATRIX.md) — UAT matrix
- [P0_STATUS.md](../P0_STATUS.md) — overall P0 state
