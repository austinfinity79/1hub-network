# Claude Task Report

## Task
WF04-S05 — REGISTRATION CONFIGURATION (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Decisions: [DEC-WF04-S05-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s05-d1) (implementation only; H1–H5 not reopened).

## Precheck
| Item | Result |
|---|---|
| Audit | S05 = CONFIG DEMO, SUPPORTING: who may apply, programme-specific questions, profile reuse (SOT §12) |
| Contract | T00 `RegistrationConfigDTO`: `applicant_types` (INDIVIDUAL / TEAM / STARTUP) + `questions` (text); fixtures TEAM + STARTUP; C1 no questions |
| Counts | T00 `application_counts` by SOT §6 state: P1 SUBMITTED 5 / UNDER_REVIEW 3 / NEEDS_UPDATE 1; C1 none |
| Not frozen | Open / close switch, registration period, eligibility rules → not implemented (FUTURE) |
| Applications | No `applications` table in migrations 001–009 |
| H5 | Registration is not a publish prerequisite — unchanged |
| Navigation | S04 "Tiếp theo" disabled until S05 → activated |
| Conflicts | None |

## Scope
| Item | Result |
|---|---|
| View | "Ai được đăng ký" chips, "Câu hỏi riêng của chương trình" list, profile-reuse notice; empty state "Chưa cấu hình đăng ký." |
| Edit | Checkboxes for the three applicant types; question list (add / edit / remove); "Lưu cấu hình" |
| Validation | Unknown applicant type, blank question → refused, atomic |
| Counts | Read-only card, "Số liệu minh hoạ…"; unchanged by edits |
| States | Loading, configured, not configured, editing, validation, saved, save error + "Thử lại", reset |
| Navigation | S04 → S05; "← Sự kiện"; "Tiếp theo" disabled until S06 |

## Files changed
- New: `src/app/(demo)/demo/programmes/[id]/setup/registration/page.tsx`; `src/components/programme-demo/programme-registration.tsx`; `src/lib/programme-demo/{registration.ts, registration.test.ts}`; `tests/visual/specs/wf04-s05-programme-registration.spec.ts`
- Changed: `src/lib/programme-demo/copy.ts` (applicant / application labels); `src/components/programme-demo/{programme-events.tsx (next → S05), journey.module.css}`; specs `wf04-s04` (next link), `p0-shell-navigation` (crawl both registration steps)
- Docs: DECISION_LOG, WF04 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. No programme, application (no table), project, profile, membership, role assignment, event, audit or analytics write.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 217 passed (4 new: canonical save, refusal, empty config, H5 unchanged) |
| DB | 343 passed |
| WF04 Playwright | 63 / 63 (S05: 9) |
| Targeted regression | 203 passed: WF04, P0-SHELL, shell-routes, WF03-T00 / S07 / S08, auth / authz session, console health, API contract, M0 root, WF01-S01, WF02-S01 / S05 |
| Navigation matrix | 357 rows, 0 dead: S04 "Tiếp theo" → registration WORKING; S05 "← Sự kiện" WORKING; S05 "Tiếp theo" DISABLED with reason |
| Server log | 0 email / token / cookie lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf04-s05-configured-1440x900.png`, `-validation-`, `-empty-`, `-768.png`, `-390.png` |
| vs ADM5 | header band + rule, card top / left edges: 0 drift |
| vs WF02-S02 | question input left / top edges: 0 drift |
| Typography | 98 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Raster | none |
| Intentional-Demo | No WF04 bitmap; S03 card chrome, neutral ADM5 pill family for chips, WF02 inputs |
| Fixed during QA | 390 px: counts grid overflowed 6 px (min column now bounded); question "Xoá" aligned with its input |

## Blocking gaps
0. Known PO item unchanged: OpsShell desktop-first.

## Git
- Branch: `main`; start HEAD `f15cb19` (checked again before each commit)
- Implementation commit: `234e311`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF04-S06 — Operating Team. Do not start WF05.
