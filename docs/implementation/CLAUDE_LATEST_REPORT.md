# Claude Task Report

## Task
DEMO-HOME-ABOUT-01 — full UI rebuild of the global public shell, Homepage v2 (DM01) and About HUB v2 (DM02–DM05). Report: [DEMO-HOME-ABOUT-01](reports/DEMO-HOME-ABOUT-01.md). Decisions: [DEC-DEMO-HA](../decisions/DECISION_LOG.md#dec-demo-ha).

## Verdict
**PASS_WITH_EVIDENCE.** Every gated pixel block of DM01 and DM02 is within the DEC-H1-D5 thresholds. 768 and 390 structural checks pass. Tier B slice and UAT L1–L2 are green. DEMO-DIR2-01 is not started. Not pushed, not merged, not deployed. STOP.

## Scope implemented
- **Shared public header / footer:** HUB symbol, dropdowns, guest and member states, mobile menu. Unbuilt screens render as plain text.
- **Homepage:** hero search, ticker, highlights, programmes, investor carousel, all products, news.
- **About:** hero counters, H·U·B values, interactive map with Hoàng Sa / Trường Sa and the HUB popup, Humans of HUB (3 tabs), ecosystem, timeline, activities, partners, coral band.
- **Data:** canonical catalogue, S1-UAT-08A content and live published startups.
- **Demo data step:** `db.mjs demo`.

## Files changed
- **New:** `src/components/public-shell/*`, `src/components/home/*`, About v2 components (`about.tsx`, `about-map*.tsx/ts`, `about-humans.tsx`, `about-milestones.tsx`, `about-hubs.ts`, CSS), `src/lib/public/{routes,viewer,shell-data,home-data,about-network}.ts`, `src/lib/demo-0710/ventures.ts`, `db/seed/demo_0710.sql`, `public/about/map-{world,vietnam}.svg`, `tests/visual/specs/demo-home-about-01.spec.ts`, `about-hubs.test.ts`, report.
- **Changed:** `src/app/page.tsx`, `src/app/(public)/about/page.tsx`, `about-data.ts` (+ test), `lib/landing/entry.ts` (+ test), `scripts/db.mjs`, `scripts/db-target.mjs` (+ test), 5 visual specs, UAT `uc02`, DECISION_LOG, P0_STATUS, demo SOT docs.
- **Removed:** the old landing and About presentation files. `landing-parts.tsx` and `landing.module.css` stay, used by `/library`.

## Migrations / data
- No migration.
- New data step `node scripts/db.mjs demo`: MUTATING, idempotent, not part of `seed`.
- Applied to `hubnetwork_s1uat03` only. The shared `hubnetwork_p0` is untouched.

## Tests / build
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 45 / 458 |
| Tier B visual | 11 specs · 122 tests · 121 PASS · 0 FAIL · 1 SKIP · 0 FLAKY |
| UAT L1–L2 | 19 / 19 |
| Server log | hydration / 5xx / secret: 0 |

## Visual QA
Per-block metrics are in the report. DM03–DM05 were captured and reviewed. The ungated blocks differ by canonical data or the map raster (INTENTIONAL-DATA).

## Deviations / blockers
- **Blockers:** none.
- **Recorded deviations:** no hero video asset; generated map raster; partner wall labelled "Dữ liệu minh hoạ"; ecosystem shows the frame's 7 rows (business list open); canonical counts replace the frame samples.

## Git
- Branch: `feat/sprint1-completion` (worktree `../1hub-network-sprint1-completion`); start HEAD `03168ce`, unchanged by others
- Implementation commit: the DEMO-HOME-ABOUT-01 commit
- Report/final commit: same commit
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: origin/main `edd3d24` (unchanged)
- Working tree: clean after the commit

## Recommended next task
DEMO-DIR2-01. Not started.
