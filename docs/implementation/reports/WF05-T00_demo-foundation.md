# Claude Task Report

## Task
WF05 — DECISION FREEZE + WF05-T00 DEMO FOUNDATION (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Decisions: [DEC-WF05-G1..G5](../../decisions/DECISION_LOG.md#dec-wf05-g1) (human approved; OPEN-WF05 closed; remaining 0) and [DEC-WF05-T00-D1..D3](../../decisions/DECISION_LOG.md#dec-wf05-t00-d1) (implementation). No S01–S04 screen.

## Scope implemented
| Item | Result |
|---|---|
| Guard | `requireProjectDemo` (member entry: guest → /auth, onboarding → resolver), `requireDemoVentureRoute` (WF02 relation rule, same 404) |
| Read model / API | `GET /api/v1/demo/projects` (own ventures + PUBLISHED programmes), `GET /api/v1/demo/projects/{id}` (venture, team without invitations, eligibility); 401 / 403 / 404; 405 for other methods |
| Programme source | WF04 fixtures read in place, PUBLISHED only, no counts / team / drafts; WF04 unchanged |
| Application store | Browser session per actor (opaque key), SOT §12 shape, one per (venture, programme), DRAFT → SUBMITTED only, owner only, archived refused, answers complete to submit, strict parse (no snapshot) |
| Frame | Shared `DemoPage` via `DemoFrameContext`; WF05 notice + reset clearing its key only |
| MemberShell entry | `PROJECT_DEMO_ENTRY` "Dự án & Startup · Demo" registered, `visible: false`, not rendered; `/demo/projects*` 404 until S01 |
| Harness | `/dev/project-demo` (dev-only, never linked) for the browser proofs |

## Files changed
- New: `src/lib/project-demo/{types,eligibility,application-store,read-model,guard,copy,routes}.ts` (+ `application-store.test.ts`, `read-model.db-test.ts`); `src/components/project-demo/demo-store.tsx`; `src/components/programme-demo/demo-frame.ts`; `src/app/api/v1/demo/projects/route.ts`, `…/[id]/route.ts`; `src/app/dev/project-demo/{page,harness}.tsx`; `tests/visual/specs/wf05-t00-demo-foundation.spec.ts`
- Changed: `src/components/programme-demo/{demo-page,demo-store}.tsx` (frame context, no behaviour change); `src/lib/member/nav.ts` (hidden entry contract)
- Docs: DECISION_LOG, WF05 audit / plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. Ledger unchanged (9 files, last `009`). Row-exact fingerprints unchanged across every WF05 read and store action: projects (except the WF02 rename made by the test through WF02), project members / domains, programmes, events, roles, memberships, leadership, profiles, audit, analytics; no `applications` table.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 234 passed (11 new: mapping, eligibility, store 1–10) |
| DB | 349 passed (6 new: owner, team member, unrelated / invitee / admin / leader 404, malformed, onboarding 403, PUBLISHED only, safe DTO, 0 writes) |
| Playwright WF05-T00 | 4 / 4 (security matrix 1–15 + 405 + 0 writes; entry / route contract; store 1–10 in the browser; team member) |
| Targeted regression | 272 passed: WF04 (all), P0-SHELL, shell-routes, WF01-S01, auth / authz session, WF02-S01 / S04 / S05 / S06 / UAT, WF03-T00 / UAT, API contract, console health, M0 root |
| Server log | 0 email / token / cookie / session / error lines |

## Visual QA
Changed visible shared surfaces: none (the MemberShell entry is not rendered; the WF04 frame renders identically — WF04 and WF02 pixel specs pass). Structural 0 · Major 0 · Component 0. No WF05 screen, no parity claim.

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `9536617` (checked again before each commit)
- Implementation commit: `9484614`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF05-S01 — MY PROJECTS / STARTUPS + OPEN PROGRAMMES. Do not start it automatically.
