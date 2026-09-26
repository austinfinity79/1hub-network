# Claude Task Report

## Task
WF03-S09 — PUBLIC ORGANIZATION PAGE. Process: PROCESS-P0-ACCELERATED-SAFE-V2, fast path.

## Status
**DONE — LOCAL REVIEW.** The contract freeze precheck (SCR S09, API §8.5, G4 / G9 / G10 / G13, DEC-WF01-S07-D2, schema, ADM reference) found no new conflict. Implementation decisions: DEC-WF03-S09-D1..D4.

## Scope completed
- **API:** `GET /api/v1/organizations/by-slug/{slug}` returns `OrganizationPublicDTO`: public, one projection for every caller.
- **Page:** `/organizations/:slug`, its own public layout (no OpsShell / MemberShell). It replaces the placeholder.
  - Top bar, hero with three canonical counts, children cards, upcoming events, join band, footer.
  - A not-found slug renders the shell 404.
- **Public route group:** no longer wraps a width container (S09 is its only screen).
- **Shell evidence:** moved from the former S09 placeholder to the last placeholder, WF03-S05, with a new baseline `shell-ops-placeholder.png`. The orphaned `shell-public-placeholder.png` was removed. The route sample slug is now the seeded `chapter-01`.

## Files changed
- `src/lib/public/organization.ts`
- `src/app/api/v1/organizations/by-slug/[slug]/route.ts`
- `src/app/(public)/layout.tsx`, `src/app/(public)/organizations/[slug]/{page.tsx, public-organization.module.css}`
- `src/lib/routes.ts` (sample slug)
- Tests:
  - `tests/visual/specs/wf03-s09-public-organization.spec.ts`
  - `tests/visual/specs/shell-routes.spec.ts`
  - `tests/visual/pixel-qa/qa-screens.ts`
  - `tests/visual/specs/api-contract.spec.ts` (comment)
  - `tests/visual/baseline/shell-ops-placeholder.png` (new); `shell-public-placeholder.png` (removed)
- Docs: DECISION_LOG (DEC-WF03-S09-D1..D4), WF03 plan, P0_STATUS, CLAUDE_LATEST_REPORT

## Migration / data
None. Schema, seed and `design-reference/final` are unchanged.

## Security / privacy (14 cases PASS)
| # | Case | Result |
|---|---|---|
| 1 | Guest sees the PUBLISHED Chapter 01 page | PASS |
| 2 | Unknown slug → public 404 (page + API) | PASS |
| 3 | DRAFT / ARCHIVED / COMPANY / malformed slugs → identical 404 | PASS |
| 4–8 | No email, phone, pending / rejected / provenance data, roles or capabilities, audit data | PASS |
| 9 | A PUBLIC-override profile stays hidden (discovery is never public for a guest) | PASS |
| 10 | Leadership does not surface a person | PASS |
| 11 | A programme-linked PUBLISHED event does not appear | PASS |
| 12 | DRAFT / CANCELLED / LIVE / past events do not appear | PASS |
| 13 | No metadata and no UUIDs in the DTO | PASS |
| 14 | Member, leader and admin receive exactly the guest DTO and page text | PASS |

- Hierarchy: a DRAFT child and a `parent_id`-only child are not listed.
- Server log: 0 email / token / cookie lines.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 157 passed |
| DB (full) | 334 passed |
| S09 Playwright | 7/7 |
| Targeted regression | 108 passed: T00, S01–S04, S06–S09, api-contract, shell-routes (33), console-health |

## Pixel (1440×900 DPR1; full reference 2511px, compared per section)
| Segment | Outside-text drift |
|---|---|
| Frame / top bar / hero | 0 / 44 / 400 px (≤ 0.07%) |
| Children section / card top | 0 / 4 |
| Events section / card top | 0 / 0 |
| Join band | 713 px (0.17%, gradient raster) |
| Footer | 0 |

- Structural / major / component: 0 / 0 / 0.
- Intentional:
  - the omitted sections move the later sections up (page height 1933px);
  - no-source content is not rendered (DEC-WF03-S09-D4);
  - typography migration.

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `6a63cce` (checked again before each commit)
- Implementation commit: `8e56450`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF03 COMPLETION AUDIT + HAPPY PATH UAT + FRESH DB / MIGRATION / RESTART + FULL WORKFLOW PIXEL REGRESSION.
