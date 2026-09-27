# Claude Task Report

## Task
WF05-S02 — PROJECT / STARTUP DETAIL + PARTICIPATION (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Inside [DEC-WF05-G1..G5](../../decisions/DECISION_LOG.md#dec-wf05-g1) and [DEC-WF05-T00-D1..D3](../../decisions/DECISION_LOG.md#dec-wf05-t00-d1); no new decision.

## Precheck
| Item | Result |
|---|---|
| Detail contract | Plan S02 + HC-WF05-03: type, name, summary, status, region, domains, team summary (owner + ACTIVE members) |
| Participation | Plan S02 "eligible programmes, applications", HC-06 / 08 / 10 / 11, NEG-08: every PUBLISHED programme with this actor's eligibility (T00 rule); "Đăng ký" only when eligible; otherwise the rule's reason, no "Đăng ký" |
| Programme source | T00 detail read model: WF04 fixtures, PUBLISHED only |
| Application status | Plan (HC-08): the session application of this venture × programme, DRAFT "Nháp" / SUBMITTED "Đã nộp", read only |
| S01 → S02 | Plan task S01 → S02: each venture row links to `/demo/projects/:id` |
| S03 entry | "Đăng ký" → `…/applications/:programmeId` is not built: shown disabled with the standard reason (as WF04 did for unbuilt next steps) |
| Links | "Sửa hồ sơ" → WF02 `/projects/:id/edit` (WF02 `can_edit`: owner, not archived), "Xem đội" → WF02 `/projects/:id/team` (HC-04 / 05) |
| Authorization | Server guard `requireDemoVentureRoute` (WF02 relation rule; 404 otherwise); data via `GET /api/v1/demo/projects/{id}` |
| Conflicts | None |

## Scope implemented
| Item | Result |
|---|---|
| Route | `/demo/projects/:id` in MemberShell, `data-screen="WF05-S02"`; direct load and refresh |
| Header | Venture name (long names wrap), "Loại · Chủ sở hữu / Thành viên"; "← Dự án & Startup", "Sửa hồ sơ" (owner, not archived) |
| Overview | Loại, Trạng thái, Tóm tắt, Tỉnh / Thành phố, Lĩnh vực (labels only, "—" when empty) |
| Team | Count + owner and ACTIVE members (name · relation / role label); never invitations or emails; "Xem đội" → WF02 |
| Participation | Programme rows: type · organization, name, dates, "Dành cho"; the session application status, or disabled "Đăng ký" (eligible owner), or the reason (member, archived, type not taken) |
| Archived | Notice "Hồ sơ đã lưu trữ: chỉ xem, không đăng ký chương trình mới.", no edit, no "Đăng ký" |
| States | Loading, populated, not found (404 page; client 404 → "Không tìm thấy…"), no programme, error + "Thử lại" (never a fake empty list) |
| S01 | Rows link to S02 (name link, row hit area) |
| Read model | `can_edit` (WF02's own value) added to the T00 detail DTO |

## Files changed
- New: `src/app/(demo)/demo/projects/[id]/page.tsx`; `src/components/project-demo/project-detail.tsx`; `tests/visual/specs/wf05-s02-project-detail.spec.ts`
- Changed: `src/components/project-demo/project-list.{tsx,module.css}` (row link); `src/lib/project-demo/{types,read-model,copy}.ts`; `src/components/programme-demo/demo-page.module.css` (title wraps; 1440 unchanged, WF04 suite green); specs `wf05-s01` (rows link, S03 404), `wf05-t00` (owner's S02 is a screen, S03 404)
- Docs: WF05 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. Row-exact fingerprints unchanged by every view, spoof and reset; the WF02 edit in tests 6 / 18 goes through WF02. Viewing S02 stores nothing in the session.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit / DB | 234 / 349 passed |
| WF05 Playwright | 30 / 30 (S02: 13 — functional 1–22, security / IDOR / spoof, privacy, responsive, visual; S01: 13; T00: 4) |
| Targeted regression | 308 passed: WF05, WF04 (all), P0-SHELL, shell-routes, WF02-T00 / S01 / S05 / S06 / UAT, WF01-S01 / UAT, auth / authz session, WF03-T00, API contract, console health, M0 root |
| Navigation matrix | 524 rows, 0 dead |
| Server log | 0 email / token / cookie / session / error lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf05-s02-{project,startup,archived,no-programmes,error}-1440x900.png` / `-full`, `wf05-s02-768.png`, `wf05-s02-390.png` |
| Shell vs WF02-S01 | Header + sidebar: 0 drift outside text masks |
| Primitives vs ADM5 | Header rule, overview card top: 0 drift (19 segments) |
| Typography | 198 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Intentional-Demo | Composed screen; disabled "Đăng ký" until S03; no parity claim |

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `66becd7` (checked again before each commit). The task prompt quoted the S01 docs SHA as `6b6ecd7`; the actual commit is `66becd7`
- Implementation commit: `ad7f764`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF05-S03 — APPLICATION DRAFT. Do not start it automatically.
