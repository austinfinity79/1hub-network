# Claude Task Report

## 1. Task
- Task ID / name: M0-T04 — shared UI primitives foundation
- Scope requested: Minimum reusable primitives required by the WF01–WF03 screen contracts, with states and accessibility. No product screens.
- Status: DONE
- Progress estimate: M0-T04 100%. M0 milestone 5 of 13 tasks complete. WF01 not started.

## 2. Primitives created
| Primitive | File | Element | Justified by |
|---|---|---|---|
| Button | `button.tsx` | native `<button>` | submit, create, invite, publish, approve actions |
| TextInput | `text-input.tsx` | native `<input>` | email entry, profile fields |
| Label | `label.tsx` | native `<label>` | every form control |
| Field | `field.tsx` | wrapper | label/control/message wiring |
| FieldMessage | `field-message.tsx` | `<p>` | validation and helper text |
| Surface | `surface.tsx` | `div`/`section`/`article`/`aside` | cards and panels |
| Notice | `notice.tsx` | `<div>` with role | auth error states, legal acceptance |

No speculative component was created. Select, checkbox, radio, toggle and table were deliberately left out; they were not in the authorised list and no primitive here needs them.

## 3. Supported states
| Primitive | States |
|---|---|
| Button | default, hover, focus-visible, disabled, loading, primary/secondary variant |
| TextInput | default, focus-visible, disabled, readonly, invalid |
| Field | default, with helper, with error (error replaces helper) |
| FieldMessage | helper, error |
| Notice | info, error |
| Surface | structural only |

Loading implies disabled so a form cannot be submitted twice, and the visible label is never swapped out mid-action.

## 4. Accessibility checks
All verified in a real browser by Playwright.

- Native elements throughout; no clickable div stands in for a control.
- Label associated by `htmlFor`, which `Field` supplies automatically. `htmlFor` is a required prop, so a label cannot ship unassociated. Clicking the label moves focus into the control.
- `aria-describedby` points at the error when invalid and the helper otherwise, never both, so exactly one message describes the control.
- `aria-invalid` conveys the error state non-visually rather than colour alone.
- Error message carries `role="alert"`; info notice carries `role="status"`. Tone is a semantic choice, not just a colour.
- Loading sets `aria-busy`; the spinner is `aria-hidden` because the label carries the meaning.
- Focus ring appears for keyboard focus and not for pointer click, verified by input modality.
- Disabled blocks pointer and keyboard activation through the native semantic.
- Each `Field` instance generates unique ids, verified across all instances on the page.

## 5. Existing tokens reused
- Typography: `--font-ui`, the eight-step type scale, `--weight-medium` / `--weight-semibold`, all frozen in Design SOT 2.4.
- Colour: the five frozen anchors through the M0-T02 semantic layer only.
- Derived sizes: focus ring, spinner and gap use `em` relative to the frozen type scale, so they need no new token.
- The only absolute literal in primitive CSS is the `1px` hairline border, enforced by test.

## 6. Unresolved design tokens
Seven, all in the `--unresolved-` namespace, listed in `src/lib/design-tokens.ts` with the screen that must settle each. Provisional values are NOT approved design.

| Token | Purpose | Provisional | Resolved by |
|---|---|---|---|
| `--unresolved-radius-control` | button and input radius | `0px` | WF01-S01 |
| `--unresolved-radius-surface` | card and notice radius | `0px` | WF01-S01 |
| `--unresolved-shadow-surface` | raised surface elevation | `none` | WF01-S01 |
| `--unresolved-space-control-x` | horizontal control padding | `1rem` | WF01-S01 |
| `--unresolved-space-control-y` | vertical control padding | `0.75rem` | WF01-S01 |
| `--unresolved-space-stack` | label/control/message gap | `0.5rem` | WF01-S06 |
| `--unresolved-space-surface` | card padding | `1.5rem` | WF01-S01 |

Radius and shadow are deliberately neutral so an unfinished primitive looks unfinished. A Playwright test asserts they stay `0px` and `none`, so a value cannot drift in unnoticed.

Also carried forward and still open: baseline colours outside the token set, including the `#8B281F` gradient on WF01-S01 and WF03-S09, and whether `#FEF3F1` or `#FFF3F0` is canonical.

## 7. Playwright tests
`tests/visual/specs/primitives.spec.ts`, 17 tests. Behaviour is asserted in a real browser rather than jsdom, because focus-visible, native disabled semantics and aria wiring all depend on real rendering; a simulated DOM would weaken exactly the evidence this task needs.

Coverage: native element check, click, Enter and Space activation, focus ring by input modality, disabled blocking activation, loading state and aria-busy, form submit, default `type="button"`, label association and label-click focus, describedby to helper, describedby to error with role alert, disabled versus readonly as distinct states, unique field ids, notice roles, 1440x900 at DPR 1 with Be Vietnam Pro at the frozen button step, unresolved radius/shadow staying unset, and spinner frozen under reduced motion.

Unit tests: `src/lib/design-tokens.test.ts`, 8 tests enforcing token discipline and that no primitive carries an inline style or hardcoded colour.

## 8. Validation results
All executed. `pnpm verify:visual` exits 0.

- Format: PASS
- Lint: PASS — 0 errors, 0 warnings
- Typecheck: PASS
- Unit/component tests: PASS — 32 passed / 32, 5 files. Component behaviour is covered by Playwright in a real browser rather than jsdom, as explained in section 7.
- Build: PASS — 30 routes
- Playwright primitive behaviour: PASS — 17 tests
- Playwright visual regression: PASS — 57 passed / 57 overall
- Route regression: PASS — all frozen routes 200, `/login` 404
- Production gating: PASS — `/dev/primitives` and `/dev/typography` both 404 without `ENABLE_DEV_ROUTES=1`, verified by direct HTTP check

Disclosed: the first Playwright run had 55 passed and 2 failed. One was my own test asserting a wrong premise about `:focus-visible` on programmatic focus, fixed by testing pointer versus keyboard modality. The other was the primitives baseline not yet existing. The baseline was then regenerated once more after the harness context fix in section 9. Runs after that pass 57 of 57.

## 9. Visual / Foundation QA
Result: **FOUNDATION PASS**. Not a product pixel PASS, and no such claim is made.

| Item | Value |
|---|---|
| Harness | `/dev/primitives`, dev-gated, not a product screen |
| Viewport / DPR | 1440x900, deviceScaleFactor 1, asserted in-test |
| Actual | `tests/visual/actual/primitives-1440x900.png` |
| Baseline | `tests/visual/baseline/primitives.png` — harness-owned |
| Diff | none produced; matched within `maxDiffPixelRatio: 0.01` |
| Comparison | PASS |

Found by inspecting the render: the readonly input and the info notice are canvas-backgrounded, which reads correctly inside a white card but vanishes on a canvas-coloured page. Their colours are right for their real context, so the harness was changed to render each primitive where it actually lives rather than changing the components to suit a misleading harness.

Baseline rule respected: `tests/visual/baseline/**` is harness-owned regression evidence; `design-reference/final/**` is the approved product baseline. Neither was copied into or compared against the other. No generic primitive was compared to any production design screen.

## 10. Regression impact
- Checked: M0-T01 bootstrap route and smoke, M0-T02 typography and fonts, M0-T03 shell and all 25 frozen routes, full code gate chain, existing visual suite.
- Result: PASS. `/` returns 200 with its bootstrap markup. All frozen routes 200. `/login` 404. M0-T02 and M0-T03 suites pass within the 57-test run.
- Regression found: None.

## 11. Route note
M0-T03 route decisions are preserved untouched. WF03-S09 public routing remains PROVISIONAL. Frontend route placement carries no authorisation or visibility meaning, and when WF03-S09 is implemented its auth and data visibility must be revalidated against the SOT.

## 12. Git
- Branch: `main`
- Commit hash: `cb0927dbebbd120c859b5a33bcfb863d697639d5`
- Commit message: `feat(m0-t04): shared UI primitives foundation`
- Working tree status: clean.

## 13. Recommended next task
M0-T05 — API client, error envelope and DTO conventions. Implement the `/api/v1` handler scaffold with the frozen error envelope `{error:{code,message,fields,request_id}}` and its 14 codes, the list envelope with cursor pagination, request-id correlation, and a typed client hand-written from the authoritative Markdown contract rather than generated from the YAML, which is a declared skeleton missing 21 endpoints and all request bodies. Include `GET /session` returning the unauthenticated shape. Exit criterion: contract-shape unit tests pass, the build passes, and the visual suite still passes as regression. Not started.
