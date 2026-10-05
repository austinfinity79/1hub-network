# Claude Task Report

## Task
S1-UAT-07-FIX-01 — add the authoritative US-02.11 team role "Cố vấn" to S1-UAT-07 (team invitations: e-mail to US-02.11, invite link US-02.12 / FB-18, invitation detail FB-14). Reports: [fix](reports/S1-UAT-07-FIX-01.md) · [task](reports/S1-UAT-07-invite.md) · [evidence](reports/S1-UAT-07-evidence.md).

## Verdict
**PASS_WITH_EVIDENCE — READY FOR CHATGPT/PO S1-UAT-07 REVIEW.** US-02.11 PASS (AC1 = PO_APPROVED_SECURITY_DEVIATION) · US-02.12 PASS · FB-14 PASS · FB-18 PASS. No other task started. STOP.

## Scope implemented
FIX-01: PRJ2 team roles are Founder · Co-founder · Thành viên · Cố vấn. The role is display text (`role_label`, free text ≤ 100 server-side): no schema change, no capability; authorisation stays on the level (EDIT / VIEW; OWNER never given by invitation). S1-UAT-07 (unchanged): migration 020, e-mail 7-day expiry / re-send / limits, owner-only invite link with receiver `/moi/:code`, FB-14 detail in WorkspaceShell. Decisions [DEC-S1I](../decisions/DECISION_LOG.md#dec-s1i).

## Files changed
FIX-01: `src/app/(member)/projects/team-copy.ts`, `src/lib/venture/invite-link.db-test.ts`, `tests/visual/specs/s1-uat-07-invite.spec.ts`, `tests/visual/specs/wf02-s05-project-startup.spec.ts` (stale role list); docs: DECISION_LOG (D5), S1-UAT-07 reports, this report, new `reports/S1-UAT-07-FIX-01.md`. S1-UAT-07 files: see its report.

## Migrations / data
FIX-01: none (SCHEMA_CHANGE_REQUIRED = NO). S1-UAT-07: 020 on `hubnetwork_s1invite` only; shared `hubnetwork_p0` untouched (ledger ends at 017). **Release prerequisite: `INVITE_LINK_SECRET` in the deployed env, ≥ 32 characters; missing → controlled `INVITE_LINK_UNAVAILABLE`.**

## Tests / build
format, lint, typecheck, build PASS · unit 42 / 444 · DB 55 / 849 · targeted e2e 9 specs 106 / 106 · UAT L1-L2 19 / 19 · **protected regression SPEC_COUNT 96 · TEST_COUNT 1261 · PASS 1232 · FAIL 0 · SKIP 29 (opt-in) · FLAKY 0** on `63eb2cb` · server log 0 5xx, 0 hydration, 0 token.

## Visual QA
FIX-01 adds one option to an existing select; PRJ2 pixel PASS unchanged. S1-UAT-07 1440 / 768 / 390 clean.

## Deviations / blockers
None blocking. Kept as approved: US-02.11 AC1 note not shown (PO_APPROVED_SECURITY_DEVIATION); PRJ2 link row text; link created lazily on copy. Not in scope: the owner's own role list in PRJ1 / venture editor (not US-02.11) is unchanged.

## Git
- Branch: `feat/s1-uat-07-invite`; FIX-01 start HEAD `309574a`, unchanged by others
- Implementation commits: `d37c36c`, `6a3a485`; FIX-01 `63eb2cb`
- Report/final commit: the docs commit after `63eb2cb`
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: origin/main `edd3d24`; production `78f21f2` (last known, not touched)
- Working tree: clean after the report commit

## Recommended next task
ChatGPT / PO review of S1-UAT-07 with FIX-01. No next task started.
