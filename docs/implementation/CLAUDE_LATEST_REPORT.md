# Claude Task Report

## 1. Task
- Task ID / name: M0-T02 — design tokens, typography and font foundation
- Scope requested: Build-time self-hosted fonts with pinned families/weights, no runtime CDN; design token integration; global typography primitives; normalize the token foundation where the Design SOT supports it.
- Status: DONE
- Progress estimate: M0-T02 100%. M0 milestone 2 of 12 tasks complete. WF01 not started.

## 2. What was implemented
- Self-hosted 15 woff2 faces under `public/fonts`, served from our own origin. No CDN request at runtime and no network needed at build.
- `scripts/sync-fonts.mjs` owns the font layer: it copies the pinned files and regenerates `src/styles/fonts.css`. A test fails if the committed CSS stops matching the generator, so the shipped faces cannot drift from the frozen list.
- `globals.css` imports `docs/design/DESIGN_TOKENS_v1.0.css` in place and unchanged, so the build reads the frozen file rather than a copy that could drift.
- `src/styles/tokens.css` adds a semantic background/foreground layer plus the eight type-scale primitives from Design SOT 2.4. Every value resolves to a frozen token; the file contains no raw colour at all.
- Archivo and IBM Plex Mono are reachable only through `.type-display` and `.type-mono-meta`, matching the SOT rule that neither face may be used unless an approved pattern calls for it.
- Weight utilities expose only the three shipped Be Vietnam Pro weights. A generic bold is deliberately withheld so no caller can request an unshipped Be Vietnam Pro 700 and get a synthesised faux-bold.
- `/dev/typography` foundation harness rendering every primitive with the family and weight the SOT requires, as machine-readable data attributes.
- 17 unit tests, including a font asset resolution check, a generator drift guard, a no-CDN check and an APEC-blue guard.

Two defects found and fixed during validation, not worked around:
- Vitest transformed JSX in classic mode, so the harness test failed. Fixed at source with `esbuild: { jsx: 'automatic' }` rather than adding a React import.
- `noUncheckedIndexedAccess` caught a possibly-undefined regex capture in a test. Fixed properly with `flatMap`, not a non-null assertion.

## 3. Fonts and weights installed
Exactly the set frozen by Design SOT 2.3. Each family ships latin, latin-ext and vietnamese subsets, because the product locale is vi-VN.

| Family | Weights | Faces | Approved usage |
|---|---|---|---|
| Be Vietnam Pro | 400, 500, 600 | 9 | default product UI |
| Archivo | 700 | 3 | large editorial/hero display only |
| IBM Plex Mono | 500 | 3 | IDs, compact metadata, technical labels only |

- Asset path: `public/fonts/<pkg>-<subset>-<weight>-normal.woff2`, served at `/fonts/...`. Total 236 KB.
- Source: `@fontsource/*` packages as devDependencies, copied at sync time. Nothing is fetched at runtime.
- `font-display: block` on all 15 faces, so text never paints in a fallback and then reflows.
- Be Vietnam Pro 400 latin and vietnamese are preloaded in the document head.

## 4. Files changed
Created:
- `scripts/sync-fonts.mjs`, `scripts/sync-fonts.d.mts`
- `src/styles/fonts.css` (generated), `src/styles/tokens.css`
- `src/styles/fonts.test.ts`, `src/styles/tokens.test.ts`
- `src/app/dev/typography/page.tsx`
- `public/fonts/` — 15 woff2 files
- `docs/implementation/reports/evidence/m0-t02/` — 2 QA screenshots

Modified:
- `src/app/globals.css` — import order: Tailwind, frozen SOT tokens, fonts, semantic layer
- `src/app/layout.tsx` — font preload links
- `package.json` — `fonts:sync` script, fontsource devDependencies
- `.prettierignore` — exclude the generated `fonts.css`

No frozen SOT file was modified. Verified: 0 changes under `docs/`, `db/` or `design-reference/` outside our own `docs/implementation/` report area.

## 5. DB / API / Data changes
- Migration/schema: None.
- API: None.
- Seed/data: None.

## 6. Validation results
All executed. Composite `pnpm verify` exits 0.

- Format: PASS — `prettier --check .`
- Lint: PASS — `eslint .`, 0 errors, 0 warnings
- Typecheck: PASS — `tsc --noEmit`
- Unit/integration: PASS — 17 passed / 17 total, 3 files
- Build: PASS — `next build`, 3 routes
- Font asset resolution: PASS — all 15 files exist and are non-empty; all served 200 as `font/woff2`
- Workflow/E2E: NOT RUN. No WF01–WF03 workflow exists yet and Playwright is M0-T11.

## 7. Visual / Foundation QA
Result: **NOT RUN**, superseding the FOUNDATION PASS originally reported for this task.

A browser-testing rule added after M0-T02 makes Playwright the only authoritative
mechanism and forbids reporting any Visual PASS that rests on Chrome-extension
observation. See `browser-testing-rule.md`. The verification below was performed
through the Chrome extension, so it no longer counts as proof and the result is
withdrawn. The observations are retained as informational only; nothing about the
implementation changed, and re-verification under Playwright is the next task.

Informational observations, not accepted as evidence:

- Harness: `/dev/typography`, production build, Chrome via MCP.
- Evidence: `docs/implementation/reports/evidence/m0-t02/typography-harness-scale.jpg` and `typography-harness-anchors.jpg`.
- Computed font-family: 10 of 10 samples match the SOT-required family.
- Computed font-weight: 10 of 10 match, covering all five pinned faces.
- Size/line-height: all 10 match the SOT 2.4 scale exactly (34/44, 26/36, 20/30, 17/26, 16/28, 14/24, 13/18, 16/20).
- Font loading: `document.fonts.check` true for all five pinned faces; 15 `@font-face` rules registered.
- Fallback substitution: none. Canvas width probe against a deliberately absent family differed for every sample.
- Network: 9 font requests, all `localhost/fonts/*`, all 200. Zero CDN or `fonts.googleapis.com` requests.
- Body defaults: Be Vietnam Pro, background `rgb(239,239,239)` = `--hub-canvas`, colour `rgb(22,0,2)` = `--hub-burgundy`.
- Colour anchors: all five render from the frozen tokens.
- Deviation: capture was at devicePixelRatio 2 and 1728 CSS px, not 1440x900 DPR1. Chrome reported the resize as successful but the window stayed at screen width, so the target viewport could not be forced. Playwright sets viewport and `deviceScaleFactor` programmatically and will remove this deviation on re-verification.
- No pixel comparison against `design-reference/final` was attempted or claimed; the harness is not a product screen and has no baseline.

## 8. SOT compliance
- Business SOT: not exercised. No workflow behaviour implemented.
- Data SOT: not exercised.
- Design SOT: implemented as frozen. Sections 2.2, 2.3, 2.4 and 2.5 are all reflected. Be Vietnam Pro is the default UI font; Archivo and IBM Plex Mono are opt-in only; the red/burgundy identity is preserved and a test fails the build on any blue-dominant colour.
- API Contract: not exercised.
- Deviation, declared: the task asked me to normalize spacing, radius, borders and shadows. Design SOT 2.5 explicitly defers these ("remain screen-baseline-driven until extracted into a broader component token library"), and the same task forbids adding values the SOT does not support. I implemented none of them and left Tailwind's defaults as the interim scale. A test asserts no such scale is invented. This needs a design decision before M1 screens land.
- Open gap, unchanged from the readiness report: baselines use colours absent from the token set, including the `#8B281F` gradient on WF01-S01 and the `#FEF3F1` vs `#FFF3F0` soft-tint inconsistency. Not resolvable in M0-T02; blocks M1.

## 9. Issues / blockers
- Remaining bugs: None.
- Technical debt: the harness lives at `/dev/typography` inside the normal app and is included in the production build. It should be route-gated or excluded once M0-T03 defines route groups.
- Human decisions required before M1: spacing/radius/shadow token scale (see section 8); gradient stops and token names for WF01-S01 and WF03-S09; whether `#FEF3F1` or `#FFF3F0` is canonical.
- None of the above blocks M0-T03.

## 10. Regression impact
- Previous functionality checked: M0-T01 bootstrap route and the full quality gate chain.
- Result: PASS. `/` still returns 200 with `lang="vi"` and its bootstrap markup intact. All five gates green after the typography changes.
- Regression found: None.

## 11. Git
- Branch: `main`
- Commit hash: `88289e19cd2bcd4e35448394631d41f385ed857c`
- Commit message: `feat(m0-t02): self-hosted font foundation and design tokens`
- Working tree status: clean.

## 12. Recommended next task
M0-T02b — re-verify the typography foundation under Playwright, replacing the withdrawn Chrome-extension result.

Install Playwright, add `tests/visual/` with the `actual/`, `diff/`, `reports/`, `specs/` structure, and write one spec that loads `/dev/typography` at 1440x900 with `deviceScaleFactor: 1`, waits for `document.fonts.ready`, asserts computed family, weight and size/line-height for all ten samples, asserts no fallback substitution, asserts every font request is same-origin, and captures a screenshot into `tests/visual/actual/`. Chromium builds are already cached locally, so no environment blocker is expected.

Exit criterion: the Playwright command executes successfully and the M0-T02 visual result can be restated as a genuine FOUNDATION PASS. This is the smallest slice of the M0-T11 harness that the new browser-testing rule requires now; the manifest-driven pixel diffing stays in M0-T11.

Then M0-T03 — shared web shell and route groups, taking routes from `SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml` rather than architecture doc 04, whose route table conflicts with the frozen contract. Not started.
