# Claude Task Report

## Task
WF05-S01 — MY PROJECTS / STARTUPS + OPEN PROGRAMMES (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Inside [DEC-WF05-G1..G5](../../decisions/DECISION_LOG.md#dec-wf05-g1) and [DEC-WF05-T00-D1..D3](../../decisions/DECISION_LOG.md#dec-wf05-t00-d1); no new decision.

## Precheck
| Item | Result |
|---|---|
| List semantics | Plan S01 = "My ventures (owner / member)": owner and ACTIVE-member ventures (WF02 `getOwnNetwork`); pending invitations, unrelated ventures and admin / leader shortcuts excluded |
| Venture API | T00 `GET /api/v1/demo/projects` (summary: name, type, status, relation, role label); no new API |
| Programme source | WF04 fixtures, PUBLISHED only (T00 read model); ops session drafts never reach members |
| Design | Composed (G1): WF04 DemoPage frame + card chrome + status pill in MemberShell; WF02 venture wording ("Dự án" / "Startup", "Chủ sở hữu", status labels) |
| Auth | `requireProjectDemo` (guest → /auth, onboarding → resolver); session identity only |
| S02 contract | `/demo/projects/:id` not built → no link (plan S01 row); `/projects/new` (WF02) linked as in HC-WF05-02 |
| Conflicts | None |

## Scope implemented
| Item | Result |
|---|---|
| Route | `/demo/projects` in MemberShell (layout with guard + provider), `data-screen="WF05-S01"` |
| Entry | "Dự án & Startup · Demo" under "DEMO · INTERNAL ALPHA" in the MemberShell sidebar, below the account list; text only on WF02 pages; current (`aria-current`) on S01 |
| Ventures | Name, type, relation (owner / member role label), canonical status; archived shown read-only; no action; "+ Tạo dự án / startup" → WF02 |
| Programmes | Type · owning organization, name, summary, dates, "Dành cho", status pill; read only |
| Applications | Read-only line per venture only when this session holds one (plan S01 "my demo applications"); none created by viewing |
| States | Loading (aria-busy), populated, no ventures, no programmes, both empty, error + "Thử lại" (one read serves both sections, so they load and fail together — never a fake empty list) |
| Responsive | Opt-in `MemberShell responsive` (WF05 only): header and body adapt below 1024 / 768 px; WF02 pages keep their frame |

## Files changed
- New: `src/app/(demo)/demo/projects/{layout,page}.tsx`; `src/components/project-demo/project-list.{tsx,module.css}`; `tests/visual/specs/wf05-s01-my-projects.spec.ts`
- Changed: `src/components/shell/member-shell.{tsx,module.css}` (entry, opt-in responsive); `src/lib/member/nav.ts` (entry shown); `src/lib/project-demo/copy.ts`; specs `wf05-t00` (entry contract now shown), `p0-shell-navigation` (crawl `/demo/projects`), `wf04-t00` (member assertion narrowed to `/demo/programmes`, the WF04 contract — the WF05 entry is DEC-WF05-G2)
- Docs: WF05 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. Row-exact fingerprints unchanged by viewing, spoofing and reset (projects, members, domains, programmes, events, roles, profiles, audit, analytics); the WF02 rename in test 3 goes through WF02. The session store stays empty when S01 is only viewed.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit / DB | 234 / 349 passed |
| WF05 Playwright | 17 / 17 (S01: 13 — functional 1–20, security, IDOR / spoof, privacy, responsive, visual; T00: 4) |
| Targeted regression | 240 passed: WF05, P0-SHELL, shell-routes, WF02-T00 / S01 / S03 / S04 / S05 / S06 / S07 / UAT, WF01-S01 / UAT, auth / authz session, WF04-T00 / S01, WF03-T00, API contract, console health, M0 root |
| Navigation matrix | 522 rows, 0 dead (the new entry WORKING from every member page) |
| Server log | 0 email / token / cookie / session / error lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf05-s01-{populated,no-ventures,no-programmes,error}-1440x900.png` / `-full`, `wf05-s01-768.png`, `wf05-s01-390.png` |
| Shell vs WF02-S01 (ME0) | Header + sidebar: 0 drift outside text masks (the reference's current "Tổng quan" item masked: the demo entry is current here) |
| Primitives vs ADM5 | Demo header rule, venture card top: 0 drift |
| WF02 member pages | All WF02 pixel specs pass with the text-only entry |
| Typography | 119 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Intentional-Demo | Composed screen, no WF05 bitmap, no parity claim |

## Blocking gaps
0. Known PO item unchanged: MemberShell / OpsShell desktop-first on WF01–WF04 screens.

## Git
- Branch: `main`; start HEAD `859e2e2` (checked again before each commit)
- Implementation commit: `e5aaa28`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF05-S02 — PROJECT / STARTUP DETAIL + PARTICIPATION. Do not start it automatically.
