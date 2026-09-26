# Claude Task Report

## 1. Task
- Task ID / name: WF02-S06 — Venture Team / Members PREFLIGHT
- Status: **HUMAN DECISION REQUIRED** (8 decisions); audit only
- Mode: LOCAL REVIEW. No runtime code, no P12 migration, no push.

## 2. Output
[WF02_S06_PREFLIGHT_AUDIT.md](../WF02_S06_PREFLIGHT_AUDIT.md) covers all 14 areas. [OPEN-WF02-S06 G1–G8](../../decisions/DECISION_LOG.md#open-wf02-s06-g1) records the gaps.

## 3. Summary
| Area | Result |
|---|---|
| Schema | `project_members(id, project_id, profile_id NOT NULL, role_label NULL, state record_state, joined_at, ended_at)`, unique ACTIVE (project, profile). No email target, no SOT team states |
| Owner | `projects.owner_profile_id` only. The seed still has an owner member row (`'Founder'`); readers dedupe |
| P12 | Migration `008_p0_venture_team.sql` proposed as DDL only: `team_membership_state` enum (SOT states), pending row with `invite_email_normalized`, CHECKs, pending-email unique index |
| Lifecycle | Frozen: `PENDING_CONFIRMATION → ACTIVE → LEFT \| REMOVED \| REJECTED`; history kept; no expiry |
| Invitation | Email only, `normalizeEmail`; no account lookup at invite time (no enumeration); duplicates stopped by DB unique indexes |
| Authorization | `venture:team_manage` = owner only; members get `venture:read` only; `role_label` grants nothing |
| API | List, invite, PATCH and DELETE defined (§5.4). Accept/decline and resend missing |
| Design | Permission tiers, "Ba mức quyền", data room → excluded. Owner row, "Quyền" column, "Đổi quyền", remove placement, "Gửi lại" need decisions |

## 4. Human decisions
- G1: P12 storage shape.
- G2: invitee accept/decline (route addendum + S01 block).
- G3: "Gửi lại" without email delivery.
- G4: "Quyền" column, "Đổi quyền", remove control.
- G5: owner row derivation.
- G6: terminal states (cancel, leave, re-invite).
- G7: team audit actions.
- G8: what a member sees.

Recommendations are in the log. Tiers, transfer, owner leave and expiry are resolved by precedence.

## 5. Tests / build
Not run: no code changed. Last green: `d32cef4` (unit 157, DB 258, Playwright 352 passed / 24 skipped).

## 6. Git
- Branch: `main`; start HEAD `d32cef4`
- Implementation commit: none
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `d54cc8d`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Related
- [WF02_S06_PREFLIGHT_AUDIT.md](../WF02_S06_PREFLIGHT_AUDIT.md) — audit
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](../WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [P0_STATUS.md](../P0_STATUS.md) — status
