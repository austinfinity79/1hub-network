# Claude Task Report

## Task
WF04 — HUMAN DECISION FREEZE H1–H5 + WF04-T00 — DEMO FOUNDATION (INTERNAL ALPHA). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** OPEN-WF04 H1–H5 closed by [DEC-WF04-H1..H5](../decisions/DECISION_LOG.md#dec-wf04-h1); T00 decisions [DEC-WF04-T00-D1..D5](../decisions/DECISION_LOG.md#dec-wf04-t00-d1). Human decisions remaining: 0. S01–S08 not started.

## Scope
| Item | Result |
|---|---|
| Fixture | `src/lib/programme-demo/fixtures.ts`, deep-frozen: PROGRAMME "Chương trình ươm tạo (demo)" PUBLISHED (3 stages, 2 events, 2 team rows, counts SUBMITTED 5 / UNDER_REVIEW 3 / NEEDS_UPDATE 1); CHALLENGE "Thử thách đổi mới (demo)" DRAFT (2 stages, 2 problem statements, 1 event, 1 team row, no applications). Owner: dev fixture Chapter 01. Ids `d40…` |
| Types / helpers | `types.ts` (canonical shapes), `readiness.ts` (H5 checklist), `session-store.ts`, `routes.ts`, `copy.ts` |
| API | `GET /api/v1/demo/programmes`, `GET /api/v1/demo/programmes/{id}` — read-only, `programme:read` scope, 405 for every mutation method |
| Guard | `/demo/programmes/*`: ops entry, then `programme:read` somewhere, else 404 |
| Session store | `sessionStorage` key per actor; refresh keeps, reset clears; server never reads it |
| Frame | `DemoPage`: ADM header band + ADM5-style "Dữ liệu demo · Internal Alpha" notice + "Đặt lại demo" (inline confirmation) |
| OpsShell | Foot entry "Demo · Internal Alpha / Chương trình & Challenge" → `/demo/programmes`, current on demo pages |
| Routes | `/demo/programmes` renders the frame + in-scope totals; the other 8 audit routes are the ordinary 404 until S01–S08 |

## Files changed
- New: `src/lib/programme-demo/{types, fixtures, readiness, session-store, routes, copy, read-model, guard}.ts` + tests (`*.test.ts`, `read-model.db-test.ts`); `src/components/programme-demo/{demo-store, demo-page, demo-home}.tsx`, `demo-page.module.css`; `src/app/(demo)/layout.tsx`, `src/app/(demo)/demo/programmes/{layout, page}.tsx`; `src/app/api/v1/demo/programmes/{route.ts, [id]/route.ts}`; `tests/visual/specs/wf04-t00-demo-foundation.spec.ts`
- Changed: `src/components/shell/{ops-shell.tsx, ops-nav.tsx, ops-shell.module.css}`, `src/lib/ops/nav.ts`; `tests/visual/specs/p0-shell-navigation.spec.ts` (crawl `/demo/programmes`; the S05 "no programmes link" check now excludes the approved demo entry)
- Docs: DECISION_LOG, WF04 audit / scope / plan / happy path, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None. No seed change, no DB write, no audit or analytics event.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 183 passed (25 new: fixture, readiness, store, routes) |
| DB | 342 passed (8 new: scope, foreign org, PROGRAMME_ORGANIZER / membership / leadership grant nothing, 404s, no writes, Event boundary, no PII) |
| WF04-T00 Playwright | 13 / 13: admin + leader API, guest 401 / → /auth, member 403 / 404, incomplete → resolver, foreign org + query / header spoof, label spoof, 405 mutations, determinism, programme-linked events, WF03 events unchanged, refresh + reset + login kept + 0 DB / audit writes, per-actor key, frame only on demo pages, entry visibility, WF03 nav + S05 route unchanged, typography + primitives |
| Full visual regression | 465 passed, 24 skipped, 1 failed → fixed (P0-SHELL S05 selector matched the approved demo link); rerun P0-SHELL + T00 27 / 27 |
| Navigation matrix | 285 rows, 0 dead; `/demo/programmes` crawled for operator and admin |
| Server log | 0 email / token / cookie lines |

## Visual QA
| Check | Result |
|---|---|
| Changed surfaces | OpsShell foot entry; demo frame (header band, notice) |
| vs ADM5 | header band, header rule, canvas gap, notice left / top / bottom edges: 0 drift |
| Typography | 12 text elements, 0 violations |
| WF03 OpsShell screens (pixel) | PASS, baselines unchanged |
| Structural / Major / Component | 0 / 0 / 0 |
| Intentional | INTENTIONAL-DEMO: no WF04 bitmap; entry has no drawn reference; no WF04 pixel parity claimed |

## Blocking gaps
0. Release note: the demo lists a fixture only when its owning organization exists, so a database without the Chapter 01 dev fixture shows an empty demo.

## Git
- Branch: `main`; start HEAD `5c73438` (checked again before each commit)
- Implementation commit: `5b3971a`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF04-S01 — Programme / Challenge List. Do not start WF05.
