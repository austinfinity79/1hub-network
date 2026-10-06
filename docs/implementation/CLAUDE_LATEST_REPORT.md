# Claude Task Report

## Task
DEMO-SP1-FOUNDER-01 — Startup Detail (DM10 Tổng quan) → Founder → public Founder Profile (DM13) with the DEMO-only "Đã xác thực danh tính qua 1Hub" state. Report: [DEMO-SP1-FOUNDER-01](reports/DEMO-SP1-FOUNDER-01.md). Decisions: [DEC-DEMO-SP1](../decisions/DECISION_LOG.md#dec-demo-sp1).

## Verdict
**PASS_WITH_EVIDENCE.** Every DM10 block and the DM13 profile card, about, education and expertise + certificates blocks are within the DEC-H1-D5 thresholds. 768 and 390 structural checks pass. The Tier B slice and UAT L1–L2 are green. Chỉ số / Cập nhật are not built: MISSING_OPTIONAL_SP1_VISUAL_ASSET. DEMO-QA-01 is not started. Not pushed, not merged, not deployed. STOP.

## Scope implemented
- **`/products/[slug]`:** the DM10 Tổng quan.
  - Head, tabs.
  - Bài toán / Giải pháp / Thị trường / quotes / Đội ngũ / Tầm nhìn.
  - Rail: quarter, funding, milestones, needs.
  - Allow-listed founders are clickable.
- **`/talents/[handle]`:** the DM13 public Founder Profile.
  - Canonical identity, bio and ventures through the discovery projection.
  - Fixture experience, education, expertise, certificates and badges.
  - DEMO verified state.
  - Allow-list only; anything else is 404.

## Files changed
- **New:**
  - `src/lib/demo-0710/{startup-overview,founders}.ts`
  - `src/lib/public/founder-data.ts`
  - `src/app/(public)/talents/[handle]/{page.tsx,founder.module.css}`
  - `tests/visual/specs/demo-sp1-founder-01.spec.ts`
  - the report
- **Changed:**
  - `src/app/(public)/products/[slug]/{page.tsx,startup.module.css}`
  - `src/lib/public/directory-data.ts`: team discovery filter, founder links, overview
  - `db/seed/demo_0710.sql`: canonical bio
  - DECISION_LOG, P0_STATUS, SCREEN_ROUTE_MAP, DEMO_DATA_CONTRACT

## Migrations / data
- No migration.
- The demo seed adds Đặng Kim Chi's bio. It is re-applied to `hubnetwork_s1uat03` only. The shared `hubnetwork_p0` is untouched.

## Tests / build
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 45 / 458 |
| DB (library, public, profile) | 6 / 107 |
| New spec | 13 / 13 |
| Tier B visual | 27 specs · 436 tests · 434 PASS · 0 FAIL · 2 SKIP · 0 FLAKY |
| UAT L1–L2 | 19 / 19 |
| Server log | hydration / 5xx / secret: 0 |

## Deviations / blockers
- **Blockers:** none.
- **Optional, not implemented:** Chỉ số / Cập nhật. The UPDATED files 13 / 12 are missing.
- **Recorded deviations:**
  - Canonical team names.
  - Privacy omissions on DM13: the contact card and challenge applications.
  - No external website link.
  - Guest header.

## Git
- Branch: `feat/sprint1-completion` (worktree `../1hub-network-sprint1-completion`). Start HEAD `7dd5230`, unchanged by others.
- Implementation commit: the DEMO-SP1-FOUNDER-01 commit.
- Report/final commit: same commit.
- Remote: `origin`.
- Push status: NOT RUN (task: no push).
- Remote HEAD: origin/main `edd3d24` (unchanged).
- Working tree: clean after the commit.

## Recommended next task
DEMO-QA-01. Not started.
