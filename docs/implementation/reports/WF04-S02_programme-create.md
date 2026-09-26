# Claude Task Report

## Task
WF04-S02 — CREATE + BASIC INFO (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Decisions: [DEC-WF04-S02-D1..D4](../../decisions/DECISION_LOG.md#dec-wf04-s02-d1). D1 and D2 were a precheck STOP resolved by the PO in-session (recommended options).

## Precheck
| Item | Result |
|---|---|
| Contract conflict | The requested form (Loại, Tên, Tóm tắt, Lĩnh vực, Tỉnh / thành phố, "Lưu", type immutable) is the WF02-S05 Project / Startup form (DEC-WF02-S05-G1/G4). `programmes` and the frozen T00 DTO have no domain or region; the accepted WF04 audit gives S02 = type, name, summary, owner, dates → **STOP → PO chose the Programme model (D1)** |
| Owner | `/demo/*` has no selected organization; multi-scope actors need a rule → **PO chose "select within scope" (D2)** |
| Demo store | T00 `save` / session semantics; `demoRoutes.create` |
| Vocabulary | `/api/v1/vocabularies/{type}` exists but is not used: no taxonomy field on a Programme |
| Authorization | Layout `requireProgrammeDemo`; owner options computed server-side from `programme:read` |

## Scope
| Item | Result |
|---|---|
| Route | `/demo/programmes/new` in the demo frame; header "Huỷ" / "Lưu" |
| Fields | Loại (radio, once), Tên, Tóm tắt, Đơn vị chủ trì, Thời gian (Ngày bắt đầu / kết thúc) |
| Owner | Leader: Chapter 01 read-only; admin: select of every HUB / CHAPTER / CLB (required); injected / query / header values refused or ignored |
| States | Default, invalid required, invalid value (type / owner / date order / impossible day), saving (button disabled, double submit ignored), success (list confirmation), error (refused browser write) |
| Create | One DRAFT per save in the session store; PROGRAMME without problem statements, CHALLENGE with an empty list; listed first on S01 |
| S01 | "Tạo mới" opens S02 (was disabled) |
| Post-save | Back to the list with "Đã tạo bản nháp “…”." until S03 (INTENTIONAL-DEMO) |

## Files changed
- New: `src/app/(demo)/demo/programmes/new/page.tsx`, `src/components/programme-demo/{programme-create.tsx, programme-form.module.css, demo-buttons.module.css}`, `src/lib/programme-demo/{basic-info.ts, basic-info.test.ts}`, `tests/visual/specs/wf04-s02-programme-create.spec.ts`
- Changed: `src/lib/programme-demo/read-model.ts` (+ `demoOwnerOptions`) and its DB test; `src/components/programme-demo/{demo-store.tsx (save result, one-off confirmation), programme-list.tsx / .module.css (working CTA, confirmation), demo-page.module.css (narrow wrap)}`; specs `wf04-t00` (S02 no longer unbuilt), `wf04-s01` (working CTA), `p0-shell-navigation` (crawl `/demo/programmes/new`)
- Docs: DECISION_LOG, WF04 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. No DB, audit or analytics write.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 196 passed (9 new: basic-info rules, draft shape, H5 readiness of new drafts) |
| DB | 343 passed (1 new: owner options for admin / leader / member / foreign / PROGRAMME_ORGANIZER) |
| WF04 Playwright | 34 / 34 (S02: 10); S01 + S02 repeated twice: 42 / 42 |
| Targeted regression | 174 passed: WF04, P0-SHELL, shell-routes, WF03-T00 / S07 / S08, auth / authz session, console health, API contract, M0 root, WF01-S01, WF02-S01, WF02-S05 |
| Navigation matrix | S01 "Tạo mới" → `/demo/programmes/new` WORKING; S02 "Huỷ" → list WORKING; 0 dead, no `#` |
| Server log | 0 email / token / cookie lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf04-s02-default-1440x900.png`, `-validation-`, `-filled-`, `-768.png`, `-390.png` |
| vs WF02-S02 input | left / top / bottom edges of "Tên": 0 drift |
| vs ADM5 header | band + rule: 0 drift |
| Typography | 29 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Raster | none |
| Intentional-Demo | No WF04 bitmap; WF02 field language inside the demo frame; ADM5 button family for "Huỷ" / "Lưu" |
| Fixed during QA | 390 px overflow from the type options row (now wraps); "Đặt lại demo" wraps inside the notice on narrow screens |

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `6824747` (checked again before each commit)
- Implementation commit: `e283c1a`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF04-S03 — Structure / Journey. Do not start WF05.
