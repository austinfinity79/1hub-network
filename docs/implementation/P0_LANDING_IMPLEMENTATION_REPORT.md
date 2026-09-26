# P0 Landing Implementation Report

## Task
P0-LANDING — PUBLIC HOMEPAGE (INTERNAL ALPHA). Process: PROCESS-P0-ACCELERATED-SAFE-V2.

## Status
**DONE — LOCAL REVIEW.** Decisions: [DEC-P0-LANDING-D1..D3](../decisions/DECISION_LOG.md#dec-p0-landing-d1).

## Precheck
| Item | Result |
|---|---|
| SOT | Master Spec §1 (shared ecosystem identity / data and operating layer; activity → records → enriched profiles → future Discovery / Matching); Data SOT principles 1, 4, 7; WF04 = Demo, WF06 = Future, CCCD verification = Future. The Overview DOCX is not in the repository: the four pain points come from the task |
| Design | No approved landing bitmap; approved public primitives exist (WF03-S09 public page, WF01-S01 display headline) |
| Primitives | S09 top bar / hero gradient / red-dash eyebrow / card / join band / footer; `.type-display` (Archivo 700) |
| CTA routes | `/auth`, the resolver's route (`/me` or a WF01 step), `/organizations/:slug` of a PUBLISHED HUB, `/legal/:kind/:version` |
| Conflicts | None between Business SOT and design. M0-ENTRY-01 (`/` redirects) is superseded for `/` by this task (D1) |

## Scope
`/` renders six sections plus a footer. The header shows only real links.

| Section | Content |
|---|---|
| Top bar | Brand, three in-page anchors, "Mạng lưới" (S09 of the HUB), primary CTA |
| 01 Hero | Positioning, primary CTA, "Khám phá mạng lưới" |
| 02 Problem | 4 pain points |
| 03 Product | Programs × Verified Identity × Ecosystem Profiles × Discovery & Matching, each with a status chip |
| 04 Flywheel | 5 steps, labelled as product vision |
| 05 Surfaces | 5 surfaces with status; only "Tổ chức & mạng lưới" links, to the S09 page |
| 06 Join | Final CTA |
| Footer | Current legal documents |

## Files changed
- `src/app/page.tsx`
- `src/components/landing/{landing.tsx, landing.module.css}`
- `src/lib/landing/{entry.ts, entry.test.ts}`
- `src/app/page.test.tsx` (removed; replaced by `entry.test.ts`)
- `tests/visual/specs/p0-landing.spec.ts` (new), `tests/visual/specs/m0-entry-01-root.spec.ts` (amended)
- Docs: DECISION_LOG, P0_STATUS, CLAUDE_LATEST_REPORT, this report

## Migrations / data
None.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 158 passed |
| DB | 334 passed |
| Landing + root specs | 12 / 12 |
| Targeted regression (WF01 ×8, M0, shell-routes, console-health, api-contract, WF02-T00, WF03-T00, WF03-S09, landing) | 255 passed, 0 failed |
| Server log | 0 email / token / cookie lines |

The landing spec covers:
- guest page and CTAs;
- member / incomplete / leader CTAs;
- no `#` or dead links (every internal href requested);
- no personal / internal data and no unsupported claims;
- explicit Demo / Future status;
- protected-route guards and resolver unchanged;
- 768 / 390 without overflow;
- keyboard focus;
- no console or hydration errors.

## Visual QA
| Check | Result |
|---|---|
| Captures | `tests/visual/actual/p0-landing-1440x900.png`, `-full.png` (2750px), `-768.png`, `-390.png` |
| Primitives vs S09 | Bar, card top / left edges, hero primary cap, join button cap: 0 drift. Eyebrow dash core: 0 drift; its anti-aliased edge rows are P3 raster |
| Structural / Major / Component | 0 / 0 / 0 |
| Intentional | No approved landing bitmap: the layout awaits PO review (D2) |

## Blocking gaps
0. Release notes:
- PO review of layout and copy;
- the Overview DOCX should be added to the repository for traceability;
- the "Mạng lưới" link appears only when a PUBLISHED HUB exists in production data.

## Related
- [P0_STATUS.md](P0_STATUS.md) — status
- [WF03_COMPLETION_AUDIT.md](WF03_COMPLETION_AUDIT.md) — last workflow closure
