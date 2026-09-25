# Claude Task Report

## 1. Task
- Task ID / name: M0-T11 — Manifest-driven Pixel QA Foundation
- Scope requested: Reusable infrastructure that goes from an approved manifest entry to a deterministic capture, a pixel/geometry diff and a structured report. Infrastructure only; no WF screen.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed.

## 2. Pre-flight
- Single writer: **PASS**. Only this session wrote to the worktree.
- Starting HEAD: `61e80cc`. Re-checked before commit: unchanged. No concurrent mutation.
- Working tree clean at start, 0 stashes. Migrations 001, 002, 003 present.
- Existing visual regression before any change: **PASS**, 93 of 93.
- `design-reference/**`: 67 files hashed before the task. The same hash was verified after all runs.

## 3. Manifest audit
| Item | Result |
|---|---|
| Entries | 24 (WF01 ×8, WF02 ×7, WF03 ×9), all production |
| Viewport references resolved | 24 / 24, every one 1440×900 |
| Full-page references | 15, every one 1440 wide |
| Missing references | 0 |
| Duplicate screen IDs | 0 |
| Invalid configuration | 0 manifest errors; `manifest.json` equals `manifest.yaml` |

The manifest defines screen ID, reference paths, mode, source size and typography override. It does **not** define route, actor or fixture. Those live in a tests-owned mapping (`tests/visual/pixel-qa/qa-screens.ts`), following Pixel QA §4. Routes come from `FROZEN_ROUTES`; parameters and actors come from `seed_p0_deterministic.sql`. `manifest.yaml` was not modified.

## 4. What was built
`tests/visual/pixel-qa/` holds the Node engine:

| File | Role |
|---|---|
| `paths.ts` | Path policy. References may resolve only inside `design-reference/final`. Outputs may go only to `tests/visual/{actual,diff,reports}/pixel-qa`. Any write under `design-reference/` is refused. |
| `manifest.ts` | YAML load and validation: frozen viewport/DPR, ID format, duplicates, mode enum, traversal, existence, and dimensions read from the PNG IHDR. |
| `qa-screens.ts` | Tests-owned route/actor/fixture mapping, plus the dry run. |
| `compare.ts` | `pixelmatch` comparison: IDENTICAL, DIFFERENT, DIMENSION_MISMATCH, diff pixel count/ratio, diff bounding box. Always writes a diff image when sizes match. |
| `report.ts` | Per-screen JSON listing explicit `REFERENCE` / `ACTUAL` / `DIFF` paths and `reference_kind` (APPROVED_DESIGN or HARNESS_REGRESSION). Classification is `PENDING_REVIEW` with the §6 taxonomy. `product_pixel_pass_claimed: false`. |
| `capture.ts` | The Pixel QA §5 sequence: seed, persona login through the real magic-link flow, navigate, `document.fonts.ready`, stabilisation CSS, viewport/DPR/font assertions, DOM typography contract, viewport capture and full-page capture. |

Other changes:
- `src/app/dev/pixel-qa`: dev-only harness page, gated by `ENABLE_DEV_ROUTES`. Not a product screen.
- Two Playwright specs:
  - `pixel-qa-harness.spec.ts` proves the engine in a real browser.
  - `pixel-qa-screens.spec.ts` always runs the audit and dry run. Screen runs execute only when named via `PIXEL_QA_SCREENS`.
- New devDependencies: `pixelmatch`, `pngjs`, `yaml`, `@types/pngjs`. `pixelmatch` is the diff engine Playwright itself uses.
- `vitest.config.ts` now includes `tests/visual/pixel-qa/**/*.test.ts`.
- Two harness-owned baselines added: `tests/visual/baseline/pixel-qa-harness.{viewport,full_page}.png`. They were created only with an explicit `PIXEL_QA_UPDATE_HARNESS=1` run.

Future screen task usage: `PIXEL_QA_SCREENS=WF01-S01 pnpm visual pixel-qa-screens`. A screen run fails on V0 conditions, dimension mismatch or typography violations. Pixel differences produce evidence for review and do not fail the run.

## 5. Pixel QA proof
| Item | Result |
|---|---|
| 1440×900 DPR1 | PASS, asserted; a wrong viewport and DPR 2 are rejected |
| Deterministic state | PASS. Seed re-apply is idempotent; the leader persona resolves the Chapter 01 scope; a guest mapping clears the session; two captures are pixel-identical |
| Font assertion | PASS. Approved faces with no fallback; Georgia and Be Vietnam Pro 700 are flagged |
| Actual capture | PASS, written at exactly 1440×900 |
| Diff generation | PASS, diff PNG written and visually checked |
| Identical comparison | PASS, 0 differing pixels |
| Intentional mismatch | PASS. DIFFERENT, and the bounding box covers both the old and new block positions |
| Long page | PASS. Full page stays 1440 wide and grows past 1500px; a change wholly below the fold leaves the viewport identical and is located exactly at `{64,1500,200,80}` |
| Design baseline write protection | PASS. Path policy tests pass, and the `design-reference/final` hash is unchanged after every run |

## 6. Production dry run
- READY_FOR_SCREEN_IMPLEMENTATION: **13**
- REFERENCE_CONFIGURATION_GAP: **11**
- Product pixel PASS claimed: **NO**. No placeholder route was compared to a design.

| Gap | Screens | Fact |
|---|---|---|
| G1 state-board | WF01-S03, WF01-S04 | One reference holds several route states. Neither the manifest nor the Design SOT defines per-state regions, so a single capture has no comparable region. |
| G2 short full-page | WF02-S01, S02, S05, S06; WF03-S01, S02, S03, S05, S08 | `__full.png` is 550–893px tall. Pixel QA §9 makes full-page capture mandatory, but a browser full-page capture is never under 900px (verified: a 550px page captures at 1440×900). The comparison rule for this case is undefined. |

G2 note: WF03-S03 and WF03-S08 are `long-page` mode with full references under 900px (893 and 888), which is internally inconsistent in the frozen manifest. `design-reference/final/README.md` explicitly allows full references shorter than 900, so the validator does not reject them. The runner refuses to run a gap screen rather than invent a crop rule.

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit | PASS — 94 / 94 (61 existing + 33 Pixel QA) |
| DB integration | PASS — 118 / 118 |
| Build | PASS |
| Pixel QA Playwright | PASS — 15 / 15, plus 24 screen runs skipped by design |
| Full Playwright regression | PASS — 108 / 108 (93 existing + 15), including auth, RBAC, idempotency and seed specs |

The 16 required tests map to the unit tests (manifest, traversal, dimensions, comparison, report, ownership, reference immutability) and the harness spec (viewport, DPR, fonts, capture, diff).

## 8. Decisions needed (not blockers for M0 completion)
1. **G1:** how state-board references are compared. For example, per-state crop regions in a tests-owned map, or functional-only checks for those states.
2. **G2:** the full-page rule when the reference is shorter than the viewport. For example, viewport comparison only, or comparing the top N rows.

Both are design/QA decisions. Neither was resolved here.

## 9. Git
- Branch: `main`
- Starting HEAD: `61e80cc`
- Implementation commit: `8fd8a09` feat(m0-t11): manifest-driven Pixel QA foundation
- Report/final commit: the commit containing this report
- Remote: `origin` → `austinfinity79/1hub-network`
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `2390ce2`, deliberately behind local
- Working tree: clean after commit
- Secrets: none committed

## 10. Recommended next task
**M0 Foundation Completion Audit.** Every M0 item is now built. G1 and G2 need a decision before the affected screens reach their pixel gate, but they do not block the audit.

## Related
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md) — session handoff (as of M0-T10)
- [05_PIXEL_QA_ARCHITECTURE_v1.1.md](../qa/05_PIXEL_QA_ARCHITECTURE_v1.1.md) — Pixel QA SOT
