# Demo responsive matrix

DEMO-QA-PREP-B. Acceptance checklist for 1440 / 768 / 390 (DEMO-D7: pixel QA at 1440 × DPR1 full page; containment and pointer QA at 768 and 390, no frames exist). Automated containment: `demo-qa-vertical-flow.spec.ts` › "containment" (overflow, header width, dead links, broken images).

| Mark | Meaning |
|---|---|
| ✓ BASE | PASS evidence in DEMO-HOME-ABOUT-01 (re-check only at SYNC, no rework) |
| ☐ | to verify at DEMO-QA-B-SYNC |
| A | AWAITING_A_IMPLEMENTATION (DIR2 / SP1-FOUNDER) |
| n/a | not drawn on that surface |

## Surfaces × checks
| Check | Home 1440 | Home 768 | Home 390 | About 1440 | About 768 | About 390 | Directory 1440/768/390 | Startup 1440/768/390 | Founder 1440/768/390 |
|---|---|---|---|---|---|---|---|---|---|
| no horizontal overflow | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | A ☐☐☐ | A ☐☐☐ | A ☐☐☐ |
| no clipped text / control | ✓ BASE | ☐ | ☐ | ✓ BASE | ☐ | ☐ | A ☐☐☐ | A ☐☐☐ | A ☐☐☐ |
| primary CTA visible, not covered (incl. "Góp ý" pill) | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | A ☐☐☐ | A ☐☐☐ | A ☐☐☐ |
| nav: desktop bar ≥ 1024, disclosure menu < 1024 opens and closes | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | ✓ BASE | A ☐☐☐ | A ☐☐☐ | A ☐☐☐ |
| card grid columns reflow, equal heights | ☐ products blocks | ☐ | ☐ | n/a | n/a | n/a | A ☐☐☐ | n/a | A ☐☐☐ (product rows) |
| filters: reachable, chips wrap, active filters clearable | n/a | n/a | n/a | n/a | n/a | n/a | A ☐☐☐ | n/a | n/a |
| modal / popup inside viewport, Esc closes, focus returns | n/a | n/a | n/a | ✓ BASE (HUB popup) | ☐ | ☐ | n/a | n/a | n/a |
| typography: Space Grotesk on public surfaces, IBM Plex Mono 500 labels, self-hosted fonts (DEMO-D9) | ✓ BASE | ☐ | ☐ | ✓ BASE | ☐ | ☐ | A ☐☐☐ | A ☐☐☐ | A ☐☐☐ |
| images: no distortion (object-fit), no broken src | ☐ | ☐ | ☐ | ☐ (people, map) | ☐ | ☐ | A ☐☐☐ (logos) | A ☐☐☐ | A ☐☐☐ (avatar) |
| tab layout: tablist scrolls or wraps, selected state visible | ☐ (sector tabs) | ☐ | ☐ | ✓ BASE (map, humans, timeline) | ☐ | ☐ | n/a | A ☐☐☐ (SP1 tabs) | n/a |
| footer: columns stack, links hittable | ✓ BASE | ☐ | ☐ | ✓ BASE | ☐ | ☐ | A ☐☐☐ | A ☐☐☐ | A ☐☐☐ |
| pixel per block at 1440 (DEC-H1-D5: < 1.5 % / < 2 %) | ✓ BASE | n/a | n/a | ✓ BASE | n/a | n/a | A ☐ (DM08) | A ☐ (DM10) | A ☐ (DM13) |

## How to check (per cell)
1. `page.setViewportSize({ width, height: 900 })`, DPR1, guest, demo data applied.
2. `document.documentElement.scrollWidth - clientWidth <= 0`.
3. Every visible CTA: bounding box inside the viewport and `elementFromPoint` at its centre is the CTA itself (the BASE "not covered" rule).
4. Screenshot to `tests/visual/actual/demo-qa-<surface>-<width>.png`; review side by side with `design-reference/final/demo-0710/` at 1440 only.
5. Record INTENTIONAL-DATA where text is canonical rather than the frame sample (DEMO-D8).

Known BASE deviations (not defects): no hero video (poster), generated map raster, partner wall "Dữ liệu minh hoạ" ([DEMO-HOME-ABOUT-01](../../implementation/reports/DEMO-HOME-ABOUT-01.md#known-deviations)).

## Related
- [DEMO_VERTICAL_FLOW_QA](DEMO_VERTICAL_FLOW_QA.md) · [DEMO_SMOKE_CHECKLIST](DEMO_SMOKE_CHECKLIST.md)
