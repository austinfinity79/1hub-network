# Claude Task Report

## Task
WF05-PROD-04 — WF05 frontend + cross-WF integration hardening (G21–G29). Report: [reports/WF05-PROD-04_frontend-integration.md](reports/WF05-PROD-04_frontend-integration.md); evidence: [reports/WF05-PROD-04_evidence.md](reports/WF05-PROD-04_evidence.md).

## Verdict
**PASS_WITH_EVIDENCE, local only.** S01 / S02 / L5 run on the canonical backend only; demo artifacts removed as frozen (routes kept); every own application readable in every programme state; closed drafts read only; draft save / retry / page-hide flush; submit once, read only after; `401` and guest deep links return through `/auth?redirect`; WF02 ↔ WF05 and WF04 ↔ WF05 identity proven. Not pushed, not deployed; PROD-05 not started. STOP.

## Scope implemented
- G21 / G22 demo notice, reset, demo copy, actor key, shell group label and "· Demo" suffix removed; `/demo/projects*` and `/api/v1/demo/projects*` kept.
- G23 `requireMember(returnTo?)` + client `401` → sign in and back; G24 journey origin (`?tu=`) for back links, SUB3 → S01; G25 closed-programme applications listed and read only (SUB1 read mode); G26 save retry, first-input save, keepalive flush on page hide; G27 step ordinal, QuickTeam server reasons, status wording, error title, ineligible-draft link, submit error mapping.
- Not changed, with reasons: client readiness pill, S01 "Đăng ký" after submit, G29 dead-ends (new navigation), the WF04 `DemoPage` notice branch.

## Files changed
- Runtime: `src/lib/member/guard.ts`, `nav.ts`; `src/lib/api/client.ts` (`keepalive`); `src/lib/application/application.ts` (SUB1 read mode), `copy.ts`, `routes.ts`; `src/lib/project-demo/copy.ts`, `guard.ts`, `read-model.ts`; `src/app/(demo)/demo/projects/layout.tsx`, `page.tsx`; L5 pages (apply, SUB1, SUB2, SUB3); `src/components/application/*` (form, review, submitted, QuickTeam, CSS, `session.ts` new); `src/components/project-demo/demo-store.tsx`, `project-list.tsx`, `project-detail.tsx`; `src/components/shell/member-shell.tsx`, `workspace-shell.tsx` / `.module.css`; `src/components/programme-demo/demo-frame.ts` (comment).
- Tests: `tests/visual/specs/wf05-prod-frontend.spec.ts` (new); DB test for the SUB1 read mode; actor-key test removed; old assertions updated in `wf05-s01`, `wf05-s02`, `wf05-t00`, `wf05-uat-journey`, `l5-startup-journey`.
- Docs: the two PROD-04 reports; this report.

## Migrations / data
None.

## Tests / build
format, lint, typecheck PASS; unit 33 / 307; DB 36 / 568; build PASS; new frontend spec 14 / 14; WF05 + L5 set 74 / 74; restart check 14 / 14; protected regression on a fresh DB 66 specs / 820 passed (16.2 min); 5xx, console, hydration 0 (server log: 0 error lines).

## Visual QA
No redesign. Visible changes: demo notice / reset block gone (S01 / S02), sidebar demo group label gone (MemberShell, WorkspaceShell), inline "Thử lại" after a failed save only, closed-programme rows in the existing S02 row style, S02 error title, read-only SUB1 (reason alert, pill "Chỉ xem", no autosave card). Evidence captures at 1440×900 in `tests/visual/actual/wf05-prod-04/` (local, untracked); L5 pixel checks pass. Full pixel audit is PROD-06.

## Deviations / blockers
None blocking. PO flag: the draft is now created (and `APPLICATION_DRAFT_CREATED` audited) on the first typed characters instead of the first blur. PROD-05 carry-forward A (400 vs 422) and B (draft-save audit) recorded open.

## Git
- Branch: `feat/wf05-prod-hardening`; start HEAD `5c7d907`; no concurrent change
- Implementation commit: `feat(wf05): frontend and cross-workflow integration hardening (WF05-PROD-04)`
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: local commit only)
- Remote HEAD: `78f21f2` (production also `78f21f2`)
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
ChatGPT / PO review of PROD-04; then WF05-PROD-05 (QA: 400 vs 422, draft-save audit decision).
