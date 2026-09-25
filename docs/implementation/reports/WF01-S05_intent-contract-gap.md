# Claude Task Report

## 1. Task
- Task ID / name: WF01-S05 — Onboarding Purpose (plus the S04 carry-over fix)
- Status: **BLOCKED — ONBOARDING INTENT CONTRACT GAP**. Stopped before implementation, as the task instructs.
- Mode: LOCAL REVIEW. Committed locally, not pushed.

## 2. Carry-over fix (S04) — DONE
- **Change:** the BLOCKED body promised the reason and unblock steps were "in the HUB email sent to you", but no email delivery exists in P0. That sentence alone became "Tài khoản này đang bị tạm khoá, nên hiện chưa thể đăng nhập."
- **Unchanged:** layout, the generic support line and every other state.
- **Test:** the BLOCKED test now asserts no "mail" wording.
- **Regression:** full Playwright 175/175, unit 110; BLOCKED disc diff still 1 px. Commit `386b67f`.

## 3. Pre-flight (S05)
- Single writer: PASS. Start HEAD `9f296ef`; S01–S04 green.
- Reference `WF01-S05__onboarding-purpose__1440x900.png` is `strict` 1440×900 and was inspected.

## 4. Why S05 stopped
See [WF01_S05_INTENT_CONTRACT_GAP.md](WF01_S05_INTENT_CONTRACT_GAP.md).
- **The contract defines no intent values.** API §4.2 makes `primary_intent` config-backed, approved "in launch configuration", and no such configuration exists. The DB column is free `text`, and the only frozen example is `EXPLORE_NETWORK`.
- **None of the bitmap's 5 options has a canonical code**, so implementing them would invent an enum.
- **Option 4 "Tôi là nhà đầu tư" (dataroom) is Future scope.**

Decisions needed (proposed IDs DEC-WF01-S05-D1..D6):
- D1: intent codes;
- D2: the investor option in P0;
- D3: `skip_later` semantics;
- D4: default selection;
- D5: unauthenticated page guard;
- D6: revisit behaviour.

Each has a suggested option in the gap document; none is implemented.

## 5. Changes
- Implementation for S05: NONE
- DB/API: none
- Shared primitives: none

## 6. Git
- Branch `main`; start HEAD `9f296ef`
- Commits: `386b67f` (S04 copy fix) and the docs commit containing this report
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `e1a458b`
- Working tree: clean after commit except the untracked `AGENTS.md`

## Related
- [WF01_S05_INTENT_CONTRACT_GAP.md](WF01_S05_INTENT_CONTRACT_GAP.md) — gap and decisions
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
