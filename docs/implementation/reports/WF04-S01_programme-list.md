# Claude Task Report

## Task
WF04-S01 — PROGRAMME / CHALLENGE LIST (INTERNAL ALPHA, DEMO). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Decisions: [DEC-WF04-S01-D1..D3](../../decisions/DECISION_LOG.md#dec-wf04-s01-d1) (implementation only; H1–H5 not reopened).

## Precheck
| Item | Result |
|---|---|
| Contract | T00 `GET /api/v1/demo/programmes` list envelope; DTO = programme columns + `type`, owner OrganizationRefDTO, counts, `demo: true` |
| Data | 2 fixtures (Chapter 01): PROGRAMME PUBLISHED, CHALLENGE DRAFT |
| Guard | Layout `requireProgrammeDemo`; API re-authorizes (`programme:read`, exact org) |
| Design | ADM5 (WF03-S05 bitmap): header band, table card, head row, row rules, pill families, header button; WF03-S01 list pattern for states |
| Routes | `/demo/programmes` only; detail / create not built (S08 / S02) |
| Reset | T00 store + inline-confirmed reset |
| Conflicts | None new |

## Scope
| Item | Result |
|---|---|
| List | ADM5 table: Tên · Đơn vị chủ trì · Loại · Thời gian · Bài toán · Trạng thái; DTO fields only |
| Order | Session drafts newest first, then server order (Programme, Challenge); session copy replaces its row; no duplicates |
| Status | PUBLISHED "Đang công khai" (open-state pill), DRAFT "Bản nháp" (neutral pill); no CLOSED / ARCHIVED |
| States | Loading (aria-busy), populated, scoped empty, error with "Thử lại" only (no raw payload), reset |
| Navigation | Rows non-navigable until S08; "Tạo mới" disabled with its reason until S02; OpsShell entry current; WF03 nav unchanged |
| Responsive | 768 / 390: no page overflow, table scrolls inside its card, notice and reset reachable |

## Files changed
- New: `src/components/programme-demo/{programme-list.tsx, programme-list.module.css, status-pill.tsx, status-pill.module.css}`, `src/lib/programme-demo/{format.ts, format.test.ts}`, `tests/visual/specs/wf04-s01-programme-list.spec.ts`
- Changed: `src/app/(demo)/demo/programmes/page.tsx` (renders the list; reads via the API only), `src/components/programme-demo/demo-page.module.css` (wrap below 1024px), `src/lib/programme-demo/session-store.{ts,test.ts}` (copy always replaces its row; ids unique)
- Removed: `src/components/programme-demo/demo-home.tsx` (T00 frame content, superseded)
- Docs: DECISION_LOG, WF04 plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. No DB, audit or analytics write.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 187 passed (4 new: date format ×3, merge dedupe) |
| DB | 342 passed |
| WF04 Playwright (T00 + S01) | 24 / 24; S01 11: content ×2, loading, error + retry, empty, session + reset, security ×3, responsive, visual |
| Targeted regression | 156 passed: WF04, P0-SHELL, shell-routes, WF03-T00, WF03-S07, WF03-S08, auth / authz session, console health, API contract, M0 root, WF01-S01, WF02-S01 |
| Navigation matrix | `/demo/programmes`: 4 working links + "Tạo mới" DISABLED with reason, operator and admin; 0 dead |
| Server log | 0 email / token / cookie lines |

## Visual QA
| Check | Result |
|---|---|
| Captures | `tests/visual/actual/wf04-s01-1440x900.png`, `-full.png`, `-768.png`, `-390.png` |
| vs ADM5 | table top / left / bottom edges, head fill, head rule, row fill, row rule, open and neutral pill caps: 0 drift outside text |
| Typography | 0 violations |
| Structural / Major / Component | 0 / 0 / 0 |
| Raster | ADM5 pill corners on half pixels: curve pixels masked (straight edge + fill compared) |
| Intentional-Demo | No WF04 bitmap; dates in the "Chapter hưởng ứng" track; narrower problem-count track so the status pill is not clipped; notice between header and table; disabled "Tạo mới" |

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `dfbcb35` (checked again before each commit)
- Implementation commit: `fff79a4`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF04-S02 — Create + Basic Info. Do not start WF05.
