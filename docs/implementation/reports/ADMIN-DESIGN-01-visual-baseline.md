# ADMIN-DESIGN-01-visual-baseline

**ADMIN-DESIGN-01 — freeze the canonical visual baseline of the Admin Portal P0. Verdict: PASS_WITH_EVIDENCE — current Admin UI ready for PO visual-baseline approval.** No redesign, no new shell / IA / workflow; the existing OpsShell and design system stay authoritative. Pack: [`design-reference/candidate/admin/`](../../../design-reference/candidate/admin/README.md) · [route / state matrix](ADMIN-DESIGN-01-route-state-matrix.md) · [known debt](ADMIN-DESIGN-01-known-debt.md).

## PO review summary
| Question | Answer |
|---|---|
| What was captured | 6 modules + Admin Home: 12 screens (7 queues / lists, 5 details) × 1440 viewport + 1440 / 1024 / 768 full pages; 11 shared states at 1440 (4 inline confirm forms, weekly summary, empty, loading, error, denied, not found, leader home). 82 frames: **70 CANONICAL_REFERENCE**, **12 KNOWN_DEBT** (390) |
| What was corrected | 7 clear design-system violations (table below); nothing subjective, no new visual language |
| Known visual debt | 390 px shell layout; raw capability codes and grantor ids in the access table; no modal / drawer pattern by design; minor items in [known debt](ADMIN-DESIGN-01-known-debt.md) |
| Ready to become the PROD-08 reference | **Yes** for 1440 (baseline) and 1024 / 768 (responsive references); 390 stays smoke-only. After PO approval PROD-08 promotes the pack into `design-reference/final` (+ manifest) |

What the PO needs to look at: the 12 `__1440x900.png` screens and the 4 `__confirm__` frames. Every other frame is the same screen at another width or state.

## Consistency audit vs OpsShell / WF03
| Area | Finding |
|---|---|
| navigation, page title, typography | OpsShell sidebar, active item and grouping unchanged; one `h1` per screen in Be Vietnam Pro (asserted on every frame); same title / subtitle scale as WF03 |
| cards, tables, chips, buttons, inputs | same radii, borders, surface, uppercase table head, chip and primary / secondary / text-action shapes as WF03; every admin colour is already used elsewhere in the app (two tints exist only on the "Cao" priority chip — accepted, not a violation) |
| spacing, density | 1rem block rhythm; exceptions fixed below |
| empty / error / denied / loading | shared notices, never blank or raw; feedback history empty state added (it was a blank card) |
| icons | no icon set in use (text actions, ↑ ↓ glyphs), same as WF03 settings |

## Corrections (visual only; routes, APIs, RBAC, states, actions, test ids unchanged)
| # | Class | Screen | Was | Now |
|---|---|---|---|---|
| 1 | NEW_ADMIN_VISUAL_BUG | Access manager grants | missing column tracks: headers stacked, rows vertical, date glued to "Thu hồi" | `.colsGrants` like every other admin table; actions cell; revoke confirm spans the row |
| 2 | NEW_ADMIN_VISUAL_BUG | Feedback detail triage | type / priority / status selects broken across lines by inline " · " text | one `filters` row (the queues' own filter row) |
| 3 | NEW_ADMIN_VISUAL_BUG | Feedback queue | type column 4.5rem: "Lỗi kỹ t…", header "TRẠNG TH…" truncated at 1440 | wider type / status tracks |
| 4 | NEW_ADMIN_VISUAL_BUG | Venture / feedback detail history, feedback subtitle | raw codes `SUBMITTED`, `NEW / IN_REVIEW` (verification already used labels) | Vietnamese labels, same map style as verification |
| 5 | NEW_ADMIN_VISUAL_BUG | Verification / venture reject, account decline | page-level confirm loose on the canvas, 0 gap to the next card | `.confirmCard`: the card frame and 1rem rhythm |
| 6 | NEW_ADMIN_VISUAL_BUG | Owner filter, grantee id, reason inputs | placeholders truncated at 1440 | `.inputWide` (20rem, max 100%) |
| 7 | NEW_ADMIN_VISUAL_BUG | All tables + category tabs at ≤ 1279 | flexible column collapsed to 0 at 768 / 390 (text overlapping); tab labels broke ("Khu / vực") | WF03 IA-P2-03 idiom: rows keep 45rem and scroll inside the table card; tabs nowrap + scroll |

## Responsive check
| Width | Result | Class |
|---|---|---|
| 1440 / 1024 | clean on every screen | CANONICAL_REFERENCE |
| 768 | clean; wide tables scroll inside their card (as WF03) | CANONICAL_REFERENCE · ACCEPTABLE_DESKTOP_FIRST |
| 390 | no page overflow; main column 174 px beside the fixed 216 px sidebar | PRE_EXISTING_OPSSHELL_DEBT (KNOWN_DEBT frames) |

## Tests / regression (after the fixes)
format · lint · typecheck PASS · unit 37 / 367 · build PASS · Admin + shell specs (`admin-prod-03…07`, `p0-shell-navigation`, `console-health`, `shell-routes`, `wf03-t00`): **109 passed, 0 failed, 0 flaky** · console 0 / hydration 0 / unexpected 5xx 0 · responsive smoke 1440 / 1024 / 768 / 390 no page overflow. No runtime behaviour changed. Capture spec `tests/visual/specs/admin-design-01-capture.spec.ts` is opt-in (`ADMIN_DESIGN_CAPTURE`), skipped in normal runs like `pixel-qa-screens`.

## Related
- [ADMIN-DESIGN-01-route-state-matrix.md](ADMIN-DESIGN-01-route-state-matrix.md) · [ADMIN-DESIGN-01-known-debt.md](ADMIN-DESIGN-01-known-debt.md) · [ADMIN-PROD-07-prod08-handoff.md](ADMIN-PROD-07-prod08-handoff.md)
