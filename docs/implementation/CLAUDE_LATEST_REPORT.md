# Claude Task Report

## 1. Task
- Task ID / name: M0-T02b — Playwright re-verification of the typography foundation
- Scope requested: Install Playwright, establish `tests/visual/`, and re-verify the M0-T02 typography foundation under a real Playwright run at 1440x900 DPR1, replacing the withdrawn Chrome-extension result.
- Status: DONE
- Progress estimate: M0-T02b 100%. M0 milestone 3 of 13 tasks complete. WF01 not started.

## 2. What was implemented
- Installed `@playwright/test` 1.63.0 and downloaded the matching Chromium build (revision 1243, Chrome for Testing 153.0.8010.12). The cache held 1208/1228/1234, none of which matched, so no `executablePath` pinning was needed after the download.
- Created `tests/visual/` with the `actual/`, `baseline/`, `diff/`, `reports/`, `specs/` structure required by the browser-testing rule.
- `tests/visual/visual.config.ts` fixes the frozen capture conditions: Chromium, viewport 1440x900, `deviceScaleFactor: 1`, locale `vi-VN`, timezone `Asia/Ho_Chi_Minh`, `reducedMotion: 'reduce'`, serial with one worker and no retries. It serves the production build on its own port, not the dev server.
- `typography-foundation.spec.ts` with 7 tests re-verifying every claim M0-T02 originally made through the Chrome extension.
- Scripts: `visual`, `visual:update`, `visual:report`, and `verify:visual` which chains the code gates then the visual suite.
- Updated `browser-testing-rule.md` to record that the M0-T02 gap is closed.

One defect found and fixed: Playwright loads its config and specs as CommonJS, so `import.meta.url` threw `SyntaxError: Cannot use 'import.meta' outside a module`. Fixed at source by using `__dirname` in both files.

## 3. Files changed
Created:
- `tests/visual/visual.config.ts`
- `tests/visual/specs/typography-foundation.spec.ts`
- `tests/visual/baseline/typography-foundation.png` — harness baseline, tracked

Modified:
- `package.json` — `@playwright/test` devDependency and four scripts
- `.gitignore` — ignore `tests/visual/actual/`, `diff/`, `reports/`; baselines stay tracked
- `docs/implementation/browser-testing-rule.md` — impact table and command table

No frozen SOT file was modified. `design-reference/final` was neither read nor written by the harness.

## 4. DB / API / Data changes
- Migration/schema: None.
- API: None.
- Seed/data: None.

## 5. Validation results
All executed.

- Format: PASS — `prettier --check .`
- Lint: PASS — `eslint .`, 0 errors, 0 warnings
- Typecheck: PASS — `tsc --noEmit`, now covering the Playwright config and spec
- Unit/integration: PASS — 17 passed / 17, 3 files
- Build: PASS — `next build`
- Visual/E2E: PASS — `pnpm visual`, 7 passed / 7, exit 0
- Workflow smoke: NOT RUN. No WF01–WF03 workflow exists yet to smoke.

Run sequence disclosed in full: the first `pnpm visual` run reported 6 passed and 1 failed, because no harness baseline existed and Playwright wrote one on that pass. The second run, with the baseline in place, passed 7 of 7. Two later confirmation runs also passed 7 of 7. The PASS above refers to those complete runs, not the first.

## 6. Visual / Foundation QA
Result: **FOUNDATION PASS**, now resting on an actual Playwright execution.

| Item | Value |
|---|---|
| Harness route | `/dev/typography` (not a product screen) |
| Runner | Playwright 1.63.0, Chromium 1243 |
| Viewport | 1440 x 900, asserted in-test |
| deviceScaleFactor | 1, asserted in-test; capture is 1440 px wide, confirming it |
| Actual screenshot | `tests/visual/actual/typography-foundation-1440x900.png` (1440x1178 full page) |
| Baseline | `tests/visual/baseline/typography-foundation.png` — harness-owned |
| Diff image | none produced; comparison matched within `maxDiffPixelRatio: 0.01` |
| Comparison result | PASS |
| Report | `tests/visual/reports/results.json` — expected 7, unexpected 0, flaky 0 |

What the 7 tests assert:
1. Capture conditions are exactly 1440x900 at DPR 1 with `document.fonts.status === 'loaded'`.
2. All 10 samples match the required family, weight, font-size and line-height against the SOT 2.4 scale.
3. Every sample resolves its real face, with no fallback substitution (canvas width probe against an impossible family).
4. All five pinned faces load and exactly 15 `@font-face` rules register.
5. Every font request is same-origin under `/fonts/`; no CDN.
6. Body background is `rgb(239,239,239)` and colour `rgb(22,0,2)`, the frozen anchors.
7. Full-page render matches the harness baseline.

Baseline distinction: `tests/visual/baseline/` holds harness-owned regression baselines, not approved design baselines. `design-reference/final` remains read-only and untouched. No design pixel comparison was performed or claimed; the harness has no approved baseline, and manifest-driven comparison is M0-T11.

## 7. SOT compliance
- Business SOT: not exercised.
- Data SOT: not exercised.
- Design SOT: re-confirmed under Playwright. Sections 2.3, 2.4 and 2.5 all verified by assertion rather than observation. The capture now runs at the frozen 1440x900 DPR1 that section 3 requires.
- API Contract: not exercised.
- Deviations: none new. The DPR 2 / 1728 px deviation reported in M0-T02 is resolved; Playwright forces the correct conditions and the test fails if they drift.
- Carried forward from M0-T02, unchanged: the Design SOT defers spacing, radius, border and shadow tokens, so none are implemented. Baseline colours outside the token set, including the `#8B281F` gradient and the `#FEF3F1` vs `#FFF3F0` inconsistency, remain open and block M1.

## 8. Issues / blockers
- Remaining bugs: None.
- Technical debt: `/dev/typography` still ships in the production build and should be route-gated or relocated when M0-T03 defines route groups. The harness baseline is platform-specific, so it will need regenerating if the suite ever runs on a different OS or in CI.
- Human decisions required before M1: spacing/radius/shadow token scale; gradient stops and token names for WF01-S01 and WF03-S09; whether `#FEF3F1` or `#FFF3F0` is canonical.
- None blocks M0-T03.

## 9. Regression impact
- Previous functionality checked: M0-T01 bootstrap route and smoke, M0-T02 typography foundation, and the full code gate chain.
- Result: PASS. `/` returns 200 with `lang="vi"` and its bootstrap markup. All five code gates green. Visual suite 7 of 7 after a reformat pass.
- Regression found: None.

## 10. Git
- Branch: `main`
- Commit hash: recorded below in section 12 after commit.
- Commit message: `test(m0-t02b): re-verify typography foundation under Playwright`
- Working tree status: clean.

## 11. Recommended next task
M0-T03 — shared web shell and route groups. Create the public, auth, onboarding, me and ops route groups with placeholder layouts built on the M0-T02 tokens, taking routes from `docs/design/SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml` rather than architecture doc 04, whose route table conflicts with the frozen contract. Gate or relocate `/dev/typography` as part of defining the groups. Exit criterion: every WF01–WF03 route resolves, the build passes, and the visual suite still passes as regression. Not started.

## 12. Commit
- `test(m0-t02b): re-verify typography foundation under Playwright` — see `git log` for the hash; the report is committed immediately after the implementation commit.
