# Claude Task Report

## Task
S1-UAT-07 — Team invitations: e-mail invitation to US-02.11, invite link in parallel (US-02.12, FB-18), invitation detail in the workspace shell (FB-14). Reports: [task](reports/S1-UAT-07-invite.md) · [evidence](reports/S1-UAT-07-evidence.md).

## Verdict
**PASS_WITH_EVIDENCE — READY FOR CHATGPT/PO S1-UAT-07 REVIEW.** US-02.11 PASS (AC1 PASS_WITH_DEVIATION, privacy, PO 05/10) · US-02.12 PASS · FB-14 PASS · FB-18 PASS. No other task started. STOP.

## Scope implemented
Migration 020 (D1): e-mail invitation expiry column and `venture_invite_links` (hash only, one open link per venture). E-mail (D4): 7-day expiry, re-send extends the same row, current member refused, ≤ 10 per send, ≤ 20 people. Link (D2 / D3): owner-only copy / regenerate on PRJ2 and the team page; receiver `/moi/:code` (WF02-S09) with auth return and explicit "Tham gia" as Thành viên · Xem; one invalid answer; TEAM_FULL. FB-14 (D5): detail in WorkspaceShell with ME7's card. Decisions [DEC-S1I](../decisions/DECISION_LOG.md#dec-s1i); contract amendment A15; DEC-PDF-D2 / D-T1 marked superseded.

## Files changed
New: migration 020, `src/lib/venture/invite-link.ts`, 4 API routes (`team/invite-link`, `…/regenerate`, `invite-links/[code]`, `…/join`), `/moi/[code]` page + card, `projects/invite-link.{tsx,module.css}`, `invite-link.db-test.ts`, `invite-link-migration.db-test.ts`, `s1-uat-07-invite.spec.ts`, 2 reports. Changed: `team.ts`, team route helper, invitations route, error codes, audit codes, routes registry + screen contracts, wizard team step / CSS, team view, invitation detail, team page, team copy, projects view, seed (schema-agnostic), `.env.example`, DECISION_LOG, API contract, P0_STATUS, living UAT docs; tests (8 DB suites, 13 specs, UAT UC07 / UC08).

## Migrations / data
020 (additive, documented rollback refused while a link exists): `project_members.invite_expires_at` (pending rows now + 7 days) + CHECK; `venture_invite_links`. Applied to `hubnetwork_s1invite` only; shared `hubnetwork_p0` untouched (ledger ends at 017). **Deploy prerequisite: `INVITE_LINK_SECRET` (≥ 32 chars) in the server env.**

## Tests / build
format, lint, typecheck, build PASS · unit 42 / 444 · DB 55 / 848 (migration 020 fresh / upgrade / recovery) · S1-UAT-07 spec 11 / 11 · UAT L1-L2 19 / 19 · **protected regression SPEC_COUNT 96 · TEST_COUNT 1260 · PASS 1231 · FAIL 0 · SKIP 29 (opt-in) · FLAKY 0** on `6a3a485` · server log 0 5xx, 0 hydration, 0 token.

## Visual QA
1440 / 768 / 390 clean for PRJ2 link row, team invite panel, receiver, invalid card, invitation detail. PRJ2 pixel PASS with the INTENTIONAL region updated (row text says what the link grants instead of an address).

## Deviations / blockers
None blocking. PO review: US-02.11 AC1 note not shown (privacy); "Cố vấn" not added; PRJ2 link row text; 20-pending bound replaced by 20 people per team.

## Git
- Branch: `feat/s1-uat-07-invite`; start HEAD `6ab6cbc`, unchanged by others
- Implementation commit: `d37c36c` (+ `6a3a485` stale WF03 audit-code test)
- Report/final commit: the docs commit after it
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: origin/main `edd3d24`; production `78f21f2` (last known, not touched)
- Working tree: clean after the report commit

## Recommended next task
ChatGPT / PO review of S1-UAT-07. No next task started.
