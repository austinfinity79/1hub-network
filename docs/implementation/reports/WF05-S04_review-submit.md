# Claude Task Report

## Task
WF05-S04 — REVIEW + SUBMIT (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Inside [DEC-WF05-G1..G5](../../decisions/DECISION_LOG.md#dec-wf05-g1) and [DEC-WF05-T00-D1..D3](../../decisions/DECISION_LOG.md#dec-wf05-t00-d1); no new decision.

## Precheck
| # | Item | Result (source) |
|---|---|---|
| 1 | Route | `/demo/projects/:id/applications/:programmeId/review` (plan S04 row; `projectDemoRoutes.review`) |
| 2 | Review contract | HC-WF05-08 / 09: the live venture (WF02), the PUBLISHED programme (WF04 fixture), the applicant type (G4), every configured question with its answer (T00-D1 store) |
| 3 | Validation | G5-5: every question answered; the S03 technical bound (2000, DEC-WF02-S05-D1) also holds at submit — a stored value is not trusted |
| 4 | Transition | T00 `submitApplication`: DRAFT → SUBMITTED only, same record, `created_at` and answers kept; SUBMITTED final (G5) |
| 5 | Post-submit | HC-WF05-08: read-only SUBMITTED on the same page; S01 / S02 "Đã nộp"; no second "Đăng ký" |
| 6 | Design | G1 composed: WF04 frame, card chrome, review rows and the WF04-S07 checklist + primary action |
| 7 | Authorization | Server guard `requireDemoVentureRoute` (WF02 relation rule; 404 otherwise); the store rule allows only the owner of an active venture whose type the PUBLISHED programme takes |
| 8 | S03 → S04 | S03 "Rà soát & nộp" becomes the form's second submit: it saves the draft, then opens S04 (only while editable: owner, eligible, DRAFT) |
| 9 | Stale state | The prompt's "do not silently submit stale state": "Nộp đơn" re-reads the venture and programme and applies the rules to them, not to the page as loaded |
| — | No application | A client state ("Chưa có đơn…" + "Mở đơn đăng ký" for the eligible owner); the session store is invisible to the server, and S04 never creates one |
| — | Config drift | S03's accepted rule: a draft whose answers do not match the questions is never repaired; on S04 the checklist blocks it |

## Scope implemented
| Item | Result |
|---|---|
| Route | Server guard as S03; programme must be PUBLISHED (else 404); data read live from `GET /api/v1/demo/projects/{id}` |
| Review | Three blocks: Dự án / Startup (live name, type, "Đăng ký với tư cách: Đội / Startup"), Chương trình (kind · organization · dates), Câu trả lời (each question, its answer or "Chưa trả lời"); no ids |
| Checklist | Owner, not archived, type taken, every answer valid; "Sẵn sàng nộp" / "Còn thiếu n mục"; "Nộp đơn" disabled with "Hoàn thành các mục còn thiếu để nộp." |
| Submit | Re-read, then one atomic store step; guarded against double / repeated clicks; "Đang nộp…" while the re-read runs; a refusal shows "Chưa nộp được đơn: kiểm tra lại các mục bên dưới." and the stored state; a refused browser write "Chưa nộp được đơn. Vui lòng thử lại." |
| SUBMITTED | "Đã nộp đơn. Đơn chỉ xem được, không sửa được.", pill "Đã nộp", "Nộp ngày dd/mm/yyyy"; no form, checklist or edit link; "← Hồ sơ dự án" only |
| Navigation | DRAFT: "← Sửa đơn" to S03 (eligible owner only); S02 SUBMITTED row "Xem đơn"; S03 SUBMITTED "Xem đơn đã nộp" |
| States | Loading, draft ready, draft incomplete, submitting, validation / refused, submitted, no application, not found, error + "Thử lại", unreadable store + "Thử lại" |
| Store | `submitApplication` also refuses an answer over the technical bound (unit-tested) |

## Files changed
- New: `src/app/(demo)/demo/projects/[id]/applications/[programmeId]/review/page.tsx`; `src/components/project-demo/project-review.tsx`; `tests/visual/specs/wf05-s04-review-submit.spec.ts`
- Changed: `src/lib/project-demo/{application-store.ts, application-store.test.ts, copy.ts}`; `src/components/project-demo/{project-application.tsx, project-detail.tsx}`; specs `wf05-s03` (review saves and opens S04; locked link), `wf05-s02` / `wf05-s01` / `wf05-t00` (review is a screen; unknown sub-route 404)
- Docs: WF05 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. Row-exact fingerprints (projects, members, domains, programmes, events, roles, memberships, leadership, profiles, audit, analytics; no `applications` table) unchanged through every review, submit, refusal, spoof and reset; the WF02 rename goes through WF02, and the archive-after-load case is a test fixture change. Only the WF05 browser-session key changes.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit / DB | 237 (1 new: submit bound) / 349 passed |
| WF05 Playwright | 56 / 56 (S04: 15 — functional 1–30, atomicity, submitting, archived / programme drift, reset, dead links, error; IDOR / spoof / privacy; responsive; visual) |
| Targeted + broader regression | 334 tests: all WF05 (T00, S01–S04) and all WF04 (incl. UAT), P0-SHELL, shell-routes, WF02-T00 / S01 / S05 / S06 / UAT, WF01-S01 / UAT, auth / authz session, WF03-T00, API contract, console health, M0 root. Run 1: 333 passed, 1 failed; run 2 (fresh server): **334 / 334 passed** |
| Run-1 failure | The S04 authorization test caught one React hydration error (#418) on the team member's first review load, right after the onboarding redirect. Not reproduced: the same test passed 10 / 10 alone, and the full rerun passed. No S04 render input is time-, storage- or viewport-dependent (session store and readiness use server snapshots). Recorded as an observed, non-reproducible flake for the completion audit to watch; not hidden, not retried away |
| Navigation matrix | 531 rows (the new S02 / S03 / S04 links), 0 dead |
| Server log | Both runs: 0 email / token / cookie / session / error lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf05-s04-{ready,incomplete,validation,submitting,submitted,no-application,error}-1440x900.png` / `-full`, `wf05-s04-{768,390}.png`, `wf05-s04-submitted-{768,390}.png` |
| Shell vs WF02-S01; primitives vs ADM5 | 26 segments, 0 drift (answers and dates masked as content) |
| Typography | 256 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Raster | 0 |
| Intentional-Demo | Composed screen (G1); SUBMITTING captured deterministically (the re-read held open) |
| Responsive | 768 / 390: no overflow, long answers wrap, checklist and "Nộp đơn" reachable, header actions do not overlap |

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `5194247` (checked again before each commit). The task prompt quoted the S03 docs SHA as `519c247`; the actual commit is `5194247`
- Implementation commit: `26d67c5`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF05 COMPLETION AUDIT + HAPPY PATH UAT. Do not start it automatically.
