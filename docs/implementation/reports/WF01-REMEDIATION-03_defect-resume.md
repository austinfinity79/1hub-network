# Claude Task Report

## 1. Task
- Task ID / name: WF01-REMEDIATION-03A (purpose step persistence) + WF01-REMEDIATION-03 — DEFECT-RESUME
- Status: **DONE — DEFECT-RESUME CLOSED**
- History: the first pass (commit `756ea8b`) stopped on the S05-skip data-model gap and recorded DEC-WF01-ANALYTICS-EXT-DEFER. Option A was then approved.
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF02 not started.

## 2. Decision
[DEC-WF01-RESUME-D1](../../decisions/DECISION_LOG.md#dec-wf01-resume-d1) amends DEC-WF01-S05-D3; the D3 row is kept and linked.

| Item | Result |
|---|---|
| Persistence model | `individual_profiles.purpose_step_completed_at timestamptz NULL`; no progress table |
| Migration | `005_p0_purpose_step_completion.sql`, additive; existing rows NULL, **no backfill**; the seed resets the column for fixture personas |
| API amendment (05 §4.2) | `PUT /me/onboarding/intent`: `{action:"SKIP"}` records the step only; `{action:"SAVE", primary_intent}` (action optional for the frozen shape) saves the intent. The timestamp is set once by the server; any other field → 422 `PROFILE_VALIDATION_FAILED` |

## 3. Resolver
One resolver, `getOnboardingState` / `routeFor` in `src/lib/onboarding/state.ts`, derived only from persisted data.

| State | Condition | Route |
|---|---|---|
| DONE | status ACTIVE and `onboarding_completed_at` set | `/me` |
| PURPOSE | `purpose_step_completed_at` NULL (never inferred from later data) | `/onboarding/purpose` |
| PROFILE | S06 progression incomplete (name, headline, region, ≥1 DOMAIN/SKILL) | `/onboarding/profile` |
| PRIVACY | current Terms and/or Privacy not accepted, matched by document id; stale versions do not count | `/onboarding/privacy` |
| COMPLETE | all above done, S08 not yet run | `/onboarding/complete` |

**Where it is used:**
- `consumeMagicLink` → `next_step` (the callback now maps COMPLETE);
- `GET /me/onboarding`; `PUT /me/onboarding/intent`;
- `/session` (`onboarding_completed`);
- the S05–S08 page guards.

The guards keep the existing convention: revisits allowed before completion; DONE → `/me` from S05–S07; S08 stays viewable. The old parallel derivations (consume's hard-coded PURPOSE, session's raw timestamp) are removed.

**S05 UI:** "Bỏ qua, làm sau" is now a button that sends SKIP and moves on only after the server confirms, with a retry message on failure. Pixel S05 is unchanged.

## 4. QA
**DB** (`resume.db-test.ts`, 10, plus updated suites) covers the full matrix:
1. new → PURPOSE;
2. save → PROFILE with a timestamp;
3–5. skip → PROFILE, intent stays NULL, no fake intent;
6. S06 incomplete → PROFILE;
7. no legal → PRIVACY;
- Terms only / Privacy only → PRIVACY;
8. a stale Terms version → PRIVACY;
9. current legal → COMPLETE;
10. ACTIVE + completed → DONE `/me`; a DEACTIVATED profile is not DONE;
11. repeated skip and later edits keep the first timestamp, and skip keeps an existing intent;
13. client timestamp, `current_step`, `completed`, unknown action or intent + skip → 422, nothing written;
14. one profile.

Also: no inference from later data; sign-in `next_step` follows the resolver; resolving mutates nothing.

**UAT-03b PASS, marker removed.** Skip → sign in → S06; S06 → sign in → S07; S07 with S08 failing once → sign in → S08; completed → sign in → `/me`. No expected-fail markers remain in the UAT suite.

**Fresh DB + restart** (clean clone of `87875ed`, new PostgreSQL 17.6):
- migrate 001→005, then a repeat run skips; seed;
- five users prepared through the real APIs; sign-in `next_step`, `GET /me/onboarding` and `/session` agree: PURPOSE / PROFILE / PRIVACY / COMPLETE / DONE;
- **identical after app and PostgreSQL restart**;
- 4 profiles for 5 users (the new user has none);
- DB 205/205 and UAT + S05 + S03 specs 46/46 on the fresh DB.

## 5. Validation (dev)
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit / DB | 120 / 205 |
| Build | PASS |
| Full Playwright | 264 passed, 24 skipped by design (auth/session, roster, analytics, S05–S08, WF01 journey, UAT) |
| Pixel | unchanged: S01 0/0/0/0/1; S02 0/0/0/14/3; S03 71/247/97; S04 1, 1/3; S05 193/245; S06 6/503; S07 26/75; S08 all 0 |

## 6. State
- P0 0 · P1 0 · P2 0. ANALYTICS-EXT deferred by decision.
- Release blockers: PRODUCTION_LEGAL_CONTENT_REQUIRED, real production roster data, production taxonomy data.

## 7. Git
- Branch: `main`; start HEAD `756ea8b`
- Implementation commit: `87875ed` fix(wf01): resume at the first incomplete onboarding step (DEFECT-RESUME)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `fed0b25`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [DECISION_LOG.md](../../decisions/DECISION_LOG.md) — decision records
- [WF01_COMPLETION_AUDIT.md](../WF01_COMPLETION_AUDIT.md) — audit (updated)
- [WF01_UAT_MATRIX.md](../WF01_UAT_MATRIX.md) — UAT matrix (updated)
- [P0_STATUS.md](../P0_STATUS.md) — overall P0 state
