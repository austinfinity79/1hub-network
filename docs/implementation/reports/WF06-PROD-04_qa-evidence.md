# WF06-PROD-04_qa-evidence

**Responsive and accessibility smoke, cross-WF identity, privacy rendering, test totals, regression and bugs** (evidence 18 – 25). Parent: [WF06-PROD-04_frontend-integration.md](WF06-PROD-04_frontend-integration.md).

## Responsive smoke (evidence 18)
| Width | Startup + "Xem thêm" | Founders (member, "role · startup") | Empty | Guest sign-in | Filters panel |
|---|---|---|---|---|---|
| 1440 | 0 px overflow | 0 | 0 | 0 | sidebar |
| 768 | 0 | 0 | 0 | 0 | folds behind "Bộ lọc", opens |
| 390 | 0 | 0 | 0 | 0 | folds behind "Bộ lọc", opens |
Loading and error states use the same blocks (checked at 1440 in the state test). No layout was redesigned; the hidden quick row keeps its height, so switching tabs does not move the page.

## Accessibility smoke (evidence 19)
Every facet checkbox has its label text; every visible button has a name; the count line is `aria-live="polite"` and reads "Đang tải…" while an answer loads; the results region carries `aria-busy` while loading; tabs move with the arrow keys; "Xem thêm" takes keyboard focus (outline `solid`) and Enter loads the next page; "Thử lại" and "Đăng nhập" are named controls; the error block keeps `role="status"`.

## Cross-WF identity (evidence 20)
A Startup card shows the `projects` row's name and VENTURE_STAGE label; a founder card shows `individual_profiles.display_name` with the owned venture's name in its row (both read back from the database in the spec); the API keys derive from `projects.id` / `individual_profiles.id` (PROD-03); organizations stay the WF03 slug read. No discovery id, no copied record.

## Privacy rendering (evidence 21)
For a member browsing Startup and founders, the rendered text and every attribute (scripts excluded) hold none of the answers' keys, no UUID, no private profile value, no hidden owner's name, no e-mail, no fixture slug, no `/media` URL; the founders drawn are exactly the visible ones. A guest page's HTML holds no founder name at all. Card title ids come from `useId()`, not record keys.

## Targeted tests (evidence 22)
| Suite | Result |
|---|---|
| `wf06-prod-library.spec.ts` (new) | 8 passed + the feed-down case 1 passed on a server with an unreachable feed |
| `public-library.spec.ts` (realigned) | 18 / 18 |
| `l6-discovery-privacy.spec.ts` (realigned `/library` scan) | 4 / 4 |
| `alpha-interaction-gaps.spec.ts` (realigned founder tab) | 15 / 15 |
| unit `library-model` + `startup-adapter` | in the unit gate below |
| gates | format, lint, typecheck PASS; unit 36 files / 344 tests; DB 38 files / 611 tests; production build PASS |

## Protected regression (evidence 23, 24)
All 81 visual specs (WF01 – WF06, auth, shell, API, landing, Library) in one run on the rebuilt server: **1091 passed, 1 failed, 25 skipped** in 18.7 min. The failure was `alpha-interaction-gaps` › `/library` card controls (guest founder tab, a contract-driven expectation, realigned in the [matrix](WF06-PROD-04_spec-realignment.md)); the spec then passed 15 / 15. Skips: 24 `pixel-qa-screens` cases gated by `PIXEL_QA_SCREENS` (unchanged), 1 feed-down case run separately. Console errors 0, hydration errors 0 (L6 runtime #418 probe, console-health), unexpected 5xx 0 (spec checks; server log 7 lines, no error). The ACC-07 QA vocabulary fixture was re-applied after the DB suite's reset; fixture rows are removed after each suite; no canonical data mutated.

## Bugs found / fixed (evidence 25)
| Class | Finding | Action |
|---|---|---|
| FRONTEND_INTEGRATION_BUG | the organization page heading counted the listed children; with the PROD-03 bound it must show the total | fixed: `stats.children` |
| FRONTEND_INTEGRATION_BUG | search placeholders promised founder-name / role search the API does not run | fixed copy |
| FILTER_UI_BUG | "Chưa xác định" stage value cannot be sent to the API | not drawn (no unsupported chip); PO / design note V6 |
| PAGINATION_UI_BUG | a pixel test measured the grid before the answer arrived (test race) | UI marks a pending state from its first render; the spec waits for the answer |
| SPEC_DRIFT (valid) | fixture-era founder / no-API expectations | realigned with reasons ([matrix](WF06-PROD-04_spec-realignment.md)) |
| FIXTURE_DEPENDENCY | none at runtime | — |
| VISUAL_REGRESSION | none objective in the regression; data-driven differences listed as PROD-06 risks | [handoff](WF06-PROD-04_prod05-handoff.md) |
No CONTRACT_CONFLICT or PRIVACY_RENDER_BUG.

## Related
- [WF06-PROD-04_library-behaviour.md](WF06-PROD-04_library-behaviour.md) · [WF06-PROD-04_prod05-handoff.md](WF06-PROD-04_prod05-handoff.md)
