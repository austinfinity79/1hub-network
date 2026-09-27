# Claude Task Report

## Task
WF05-S03 — APPLICATION DRAFT (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Inside [DEC-WF05-G1..G5](../../decisions/DECISION_LOG.md#dec-wf05-g1) and [DEC-WF05-T00-D1..D3](../../decisions/DECISION_LOG.md#dec-wf05-t00-d1); no new decision.

## Precheck
| # | Item | Result (source) |
|---|---|---|
| 1 | Route | `/demo/projects/:id/applications/:programmeId` (plan S03 row; `projectDemoRoutes.application`) |
| 2 | Questions | WF04 `registration.questions` of the PUBLISHED fixture, via the T00 read model |
| 3 | Question types | Plain text only (DEC-WF04-S05-D1: no types, rules, branching, uploads) |
| 4 | Answers | T00-D1 `programme_specific_answers`: one string per question, in order |
| 5 | Creation | HC-06: opening is a read; HC-07: "Lưu nháp" creates the DRAFT |
| 6 | Duplicates | One per venture × programme: reopening resumes it (S02 "Tiếp tục"); saves update it |
| 7 | Eligibility | T00 rule (G3–G5): PUBLISHED, owner, not archived, type taken (PROJECT → TEAM, STARTUP → STARTUP) |
| 8 | Save | Incomplete allowed (completeness is S04, G5-5); refusals atomic |
| 9 | S04 boundary | "Rà soát & nộp" disabled with its reason; `…/review` 404 |
| 10 | Design | WF04 frame, card chrome, S05 question form; WF02 field language (G1) |
| — | Answer length | No frozen bound: the repo's existing technical free-text bound, 2000 (DEC-WF02-S05-D1), as a technical limit, not a business rule |
| — | Config drift | WF04 fixtures are deep-frozen; a draft whose answers do not match the questions is shown read only, never "repaired" |

## Scope implemented
| Item | Result |
|---|---|
| Route | Server guard: venture by the WF02 rule, programme must be PUBLISHED (else 404); data read live from `GET /api/v1/demo/projects/{id}` |
| Applicant | Live venture name, type, "Đăng ký với tư cách: Đội / Startup", the SOT §12 reuse notice |
| Programme | Live kind · organization, name, dates; read only |
| Form | One textarea per question; "Lưu nháp" (`saveDraft`: first save creates, later saves update; double click safe); "Đã lưu bản nháp."; field error "Tối đa 2000 ký tự."; "Chưa lưu được bản nháp…" on a refused browser write; reset remounts the form |
| Locked | SUBMITTED ("Đơn đã nộp: không sửa được." + answers), not eligible ("Không đăng ký được: …" — member, archived, type), mismatch |
| States | Loading, new, existing draft, saving, saved, validation error, locked, not found, error + "Thử lại", unreadable store + "Thử lại" |
| S02 | "Đăng ký" links to S03 for the eligible owner; a DRAFT shows "Nháp" + "Tiếp tục"; SUBMITTED shows "Đã nộp" only |
| Store | `saveDraft` + `answersTooLong` added to the T00 store (pure, unit-tested) |

## Files changed
- New: `src/app/(demo)/demo/projects/[id]/applications/[programmeId]/page.tsx`; `src/components/project-demo/project-application.tsx`; `tests/visual/specs/wf05-s03-application-draft.spec.ts`
- Changed: `src/lib/project-demo/application-store.{ts,test.ts}`; `src/lib/project-demo/copy.ts`; `src/components/project-demo/{project-detail.tsx, project-list.module.css}`; specs `wf05-s02` (apply is a link), `wf05-s01` / `wf05-t00` (S03 is a screen, S04 404)
- Docs: WF05 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. Row-exact fingerprints (projects, members, domains, programmes, events, roles, memberships, leadership, profiles, audit, analytics) unchanged through every view, save, refusal, spoof and reset; the WF02 rename goes through WF02. Only the WF05 browser-session key changes.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit / DB | 236 (2 new: saveDraft) / 349 passed |
| WF05 Playwright | 41 / 41 (S03: 11 — functional 1–24, atomicity, locked states, IDOR / spoof / cross-venture, privacy, responsive, visual) |
| Targeted regression | 237 passed: WF05, P0-SHELL, shell-routes, WF02-T00 / S01 / S05 / S06 / UAT, WF04-T00 / S01 / S05, WF01-S01 / UAT, auth / authz session, WF03-T00, API contract, console health, M0 root |
| Navigation matrix | 524 rows, 0 dead |
| Server log | 0 email / token / cookie / session / error lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf05-s03-{new,partial,saved,validation,archived,submitted}-1440x900.png` / `-full`, `wf05-s03-768.png`, `wf05-s03-390.png` |
| Shell vs WF02-S01; primitives vs ADM5 | 24 segments, 0 drift (typed answers masked as content) |
| Typography | 220 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Intentional-Demo | Composed screen; "Rà soát & nộp" disabled (primary, faded) until S04 |

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `68aca8e` (checked again before each commit)
- Implementation commit: `1d1d7da`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF05-S04 — REVIEW + SUBMIT. Do not start it automatically.
