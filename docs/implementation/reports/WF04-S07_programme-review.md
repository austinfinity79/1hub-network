# Claude Task Report

## Task
WF04-S07 — REVIEW + PUBLISH (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Decisions: [DEC-WF04-S07-D1..D3](../../decisions/DECISION_LOG.md#dec-wf04-s07-d1) (implementation only; H5 not reopened or strengthened).

## Precheck
| Item | Result |
|---|---|
| Lifecycle | SOT §6 DRAFT → PUBLISHED → CLOSED → ARCHIVED; demo: DRAFT → PUBLISHED only (H5); no unpublish |
| H5 | `publishReadiness`: name, type, owner in the actor's allowance, date order, CHALLENGE ≥ 1 problem statement; stages / events / registration / team never required |
| Store | Session copy via `SetupScreen.apply`; allowance now passed to setup steps |
| Sections | S02 basic info, S03 stages + problem statements, S04 events, S05 registration, S06 team — all in the demo DTO |
| Edit routes | journey, events, registration, team built; `setup/basic` not built (S08) |
| Design | S03 card chrome, ADM5 pills and header buttons, WF01-S03 success ink |
| Conflicts | None |

## Scope
| Item | Result |
|---|---|
| Summary | Read-only rows with "Sửa" to built steps |
| Checklist | 4 items (PROGRAMME) / 5 (CHALLENGE), "✓ Đạt" / "✗ Còn thiếu", header "Sẵn sàng xuất bản" / "Còn thiếu N mục"; the problems item links to the journey |
| Publish | Ready → "Xuất bản" (disabled otherwise, with the reason); atomic; idempotent; double click publishes once; setup data kept |
| States | Loading, draft ready, draft incomplete, publishing (button busy), published (stays on S07 + "Về danh sách"), error (save error + "Thử lại"; read error) |
| Navigation | S06 → S07; "← Đội vận hành"; "Tiếp theo" disabled until S08; no S08 route exposed |

## Files changed
- New: `src/app/(demo)/demo/programmes/[id]/setup/review/page.tsx`; `src/components/programme-demo/programme-review.tsx`; `tests/visual/specs/wf04-s07-programme-review.spec.ts`
- Changed: `src/lib/programme-demo/readiness.{ts,test.ts}` (+ `publishProgramme`); `src/components/programme-demo/{setup-screen.tsx (allowance), programme-team.tsx (next → S07), journey.module.css}`; specs `wf04-s06` (next link), `p0-shell-navigation` (crawl both review steps)
- Docs: DECISION_LOG, WF04 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. Row-exact fingerprints unchanged: programmes, events, role_assignments, community_memberships, leadership_records, individual_profiles, project_members; no `applications` table; audit / analytics counts unchanged.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 220 passed (3 new: publish, refusal with missing items, idempotence) |
| DB | 343 passed |
| WF04 Playwright | 80 / 80 (S07: 9) |
| Targeted regression | 234 passed: WF04, P0-SHELL, shell-routes, WF03-T00 / S04 / S07 / S08, WF02-S06, auth / authz session, console health, API contract, M0 root, WF01-S01, WF02-S01 / S05 |
| Navigation matrix | 425 rows, 0 dead: S06 "Tiếp theo" → review WORKING; S07 "Sửa" links WORKING; S07 "Tiếp theo" DISABLED with reason |
| Server log | 0 email / token / cookie lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf04-s07-incomplete-1440x900.png` / `-full`, `-ready-`, `-published-`, `-768.png`, `-390.png` |
| vs ADM5 | header band + rule, card top / left edges in all three states: 0 drift |
| Typography | 197 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Raster | none |
| Intentional-Demo | No WF04 bitmap; stays on S07 after publishing until S08 |
| Fixed during QA | 390 px: checklist labels squeezed beside the state column overflowed 31 px — labels now take their own line |

## Blocking gaps
0. Known PO item unchanged: OpsShell desktop-first.

## Git
- Branch: `main`; start HEAD `464a542` (checked again before each commit)
- Implementation commit: `1df5b9f`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF04-S08 — Programme Detail / Manage. Do not start WF05.
