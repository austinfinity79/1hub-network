# Claude Task Report

## Task
WF04-S08 — PROGRAMME DETAIL / MANAGE (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Decisions: [DEC-WF04-S08-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s08-d1) (implementation only; H1–H5 not reopened). Supersedes S01-D1 and the S07-D3 post-publish destination; builds the `setup/basic` edit promised by S02-D3.

## Precheck
| Item | Result |
|---|---|
| Detail contract | Plan row 3 + route table (`/demo/programmes/:id`, `setup/basic` with type locked); S03-D2 `:id` resolution; same guard as S03–S07 |
| Lifecycle | Demo DRAFT → PUBLISHED only, on S07; the detail shows the state, changes nothing |
| Data | Demo DTO + session copy (`effectiveDetail`); no second store or read model |
| S01 / S07 | S01 rows had no link (S01-D1); S07 stayed on S07 after publishing (S07-D3) |
| Design | ADM5 header / card chrome, S07 summary rows, ADM5 pills, WF03 text actions, S02 form primitives |
| Conflicts | None blocking. Plan row 3 / happy path J2 list "application counts" and a "current stage"; the S08 task forbids an application funnel and H3 defines no date rule for a current stage — both left off the detail (D1), flagged for the completion audit |

## Scope
| Item | Result |
|---|---|
| Detail | Status band, overview (type, owner, time, summary), cards: journey (stages + dates), CHALLENGE Bài toán, events (time, status), registration (applicant types, question count), team (name, label) |
| Actions | "← Danh sách"; "Rà soát & xuất bản" (DRAFT, primary) / "Rà soát" (PUBLISHED); "Sửa" → `setup/basic`; "Quản lý" → journey / events / registration / team; reset. No publish, unpublish, close, archive, public link |
| Basic edit | `setup/basic`: name, summary, dates editable (S02 validation, atomic); type and owner read-only; planted fields ignored; save error + "Thử lại" |
| Navigation | S01 row → S08; S07 "Tiếp theo" / publish → S08 + one-off "Đã xuất bản “…”."; S07 basic / dates "Sửa" → `setup/basic` |
| States | Loading (server render), DRAFT, PUBLISHED, not found (random id: "Không tìm thấy…"; malformed / unknown fixture id: 404), read error + "Thử lại", reset-safe (a created draft → not found; fixtures restored) |

## Files changed
- New: `src/app/(demo)/demo/programmes/[id]/page.tsx`, `…/[id]/setup/basic/page.tsx`; `src/components/programme-demo/{programme-detail,programme-basic-edit}.tsx`; `tests/visual/specs/wf04-s08-programme-detail.spec.ts`
- Changed: `src/lib/programme-demo/basic-info.{ts,test.ts}` (`basicInfoOf`, `updateBasicInfo`); `src/components/programme-demo/{setup-screen.tsx (optional step, header actions), programme-review.tsx (→ S08, basic edit links), programme-list.tsx + .module.css (row link), demo-page.tsx (flash state), journey.module.css}`; specs T00, S01, S02, S03, S07, P0-SHELL
- Docs: DECISION_LOG, WF04 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. Row-exact fingerprints unchanged across view, basic edit, publish and reset: programmes, events, role_assignments, community_memberships, leadership_records, individual_profiles, user_accounts, project_members; no `applications` table; audit / analytics counts unchanged.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 223 passed (3 new: basic info read, update, type / owner / status kept) |
| DB | 343 passed |
| WF04 Playwright | 100 / 100 (S08: 20) |
| Targeted regression | 154 passed: P0-SHELL, shell-routes, WF03-T00 / S04 / S07 / S08, WF02-S01 / S05 / S06, auth / authz session, console health, API contract, M0 root, WF01-S01 |
| Navigation matrix | 503 rows, 0 dead; 70 rows from the S08 / basic pages, all WORKING |
| Server log | 0 email / token / cookie lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `wf04-s08-{programme-published,programme-draft,challenge-draft,challenge-published}-1440x900.png` / `-full`, `wf04-s08-768.png`, `wf04-s08-390.png` |
| vs ADM5 | header band + rule, card top / left edges in all four states: 0 drift (16 segments) |
| Typography | 212 text elements, 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Raster | none |
| Intentional-Demo | No WF04 bitmap; two-column card grid (one column below 1024 px); "Sửa" instead of the plan's "Chỉnh sửa"; missing-draft copy is the S03–S07 frame's |

## Blocking gaps
0. Known PO item unchanged: OpsShell desktop-first (at 390 px the sidebar stays beside the content; no overflow).

## Git
- Branch: `main`; start HEAD `2417fb7` (checked again before each commit)
- Implementation commit: `8fd8c70`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF04 COMPLETION AUDIT + HAPPY PATH UAT. Do not start WF05 automatically.
