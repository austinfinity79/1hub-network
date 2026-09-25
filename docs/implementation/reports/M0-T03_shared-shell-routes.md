# Claude Task Report

## 1. Task
- Task ID / name: M0-T03 — shared web shell and frozen route groups
- Scope requested: Minimum shared shell and the frozen route-group foundation for WF01–WF03. Placeholders only, no product screens, no business logic.
- Status: DONE
- Progress estimate: M0-T03 100%. M0 milestone 4 of 13 tasks complete. WF01 not started.

## 2. Screen Contract source used
`docs/design/SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml` (status `FROZEN_WF01_WF03`), parsed directly. 24 screen ids map to 25 routes because WF02-S05 declares two alternatives.

## 3. Route groups and exact paths
Route groups are Next.js parenthesised folders. They organise layouts, do not appear in the URL, and are not a security boundary; the server re-authorises every request.

| Group | Screen | Route |
|---|---|---|
| auth | WF01-S01 | `/auth` |
| auth | WF01-S02 | `/auth/check-email` |
| auth | WF01-S03 | `/auth/callback` |
| auth | WF01-S04 | `/auth/error` |
| onboarding | WF01-S05 | `/onboarding/purpose` |
| onboarding | WF01-S06 | `/onboarding/profile` |
| onboarding | WF01-S07 | `/onboarding/privacy` |
| onboarding | WF01-S08 | `/onboarding/complete` |
| member | WF02-S01 | `/me` |
| member | WF02-S02 | `/me/profile/edit` |
| member | WF02-S03 | `/me/privacy` |
| member | WF02-S04 | `/me/roles` |
| member | WF02-S05 | `/projects/new` and `/projects/:id/edit` |
| member | WF02-S06 | `/projects/:id/team` |
| member | WF02-S07 | `/me/settings` |
| ops | WF03-S01 | `/ops/network` |
| ops | WF03-S02 | `/ops/org/:orgId` |
| ops | WF03-S03 | `/ops/org/:orgId/members` |
| ops | WF03-S04 | `/ops/org/:orgId/members/:profileId` |
| ops | WF03-S05 | `/ops/org/:orgId/programmes` |
| ops | WF03-S06 | `/ops/org/:orgId/profile` |
| ops | WF03-S07 | `/ops/org/:orgId/events` |
| ops | WF03-S08 | `/ops/org/:orgId/settings` |
| public | WF03-S09 | `/organizations/:slug` |

## 4. Shell and shared primitives created
| File | Purpose |
|---|---|
| `src/lib/routes.ts` | Single frozen route manifest driving pages, tests and smoke |
| `src/components/shell/page-container.tsx` | Content width wrapper |
| `src/components/shell/route-placeholder.tsx` | Scaffolding marker, manifest-driven |
| `src/app/(group)/layout.tsx` x5 | Thin route-group boundary |
| `src/app/not-found.tsx` | Token-styled route-not-found boundary |

No header, sidebar or product chrome was created. None is justified while no approved screen exists, and the task forbids designing product UI from imagination. Spacing uses Tailwind defaults because the Design SOT still defers spacing tokens.

## 5. Route conflicts discovered
1. **Architecture doc 04 vs Screen Contract.** Doc 04 lists `/login`, `/register`, `/verify-email`, `/ops/members`, `/me/memberships`. The contract defines none of them. Screen Contract wins per the precedence order, so they are not implemented. A unit test and a Playwright test both assert they stay absent, and all four return 404 on a production server.
2. **WF03-S09 workflow mode vs screen scope.** The screen sits in the WF03 workflow whose mode is `PRODUCTION_INTERNAL`, but its own contract entry carries `scope: public_or_network_visibility`. Routed into the public group because the screen-level scope is more specific. Recorded, not silently reconciled.

Neither conflict prevented implementation.

## 6. Playwright tests added
`tests/visual/specs/shell-routes.spec.ts`, 15 test declarations expanding to 33 cases:
- 25 per-route resolution tests, one per frozen route, so a failure names the exact route.
- Manifest covers 25 routes across all five groups.
- Shell declares exactly one route-group boundary and one container.
- Be Vietnam Pro remains the default UI font on a shell page; heading is SemiBold 600; background is `--hub-canvas`.
- Capture conditions are 1440x900 at deviceScaleFactor 1.
- Unknown route returns 404 and renders the shell not-found boundary.
- Doc 04 routes are not implemented.
- Typography harness reachable only with dev routes enabled and absent from the manifest.
- Shell render matches the harness-owned baseline.

Changed: `tests/visual/visual.config.ts` now sets `ENABLE_DEV_ROUTES=1` on its web server so the gated harness stays testable.

## 7. Typography harness handling
Gated to dev/test only. `/dev/typography` returns 404 unless `ENABLE_DEV_ROUTES=1`, which only the dev server and the Playwright visual config set. `force-dynamic` keeps the check per-request rather than baking a build-time 404 into static output. It is also absent from the frozen route manifest, so it cannot appear in product navigation.

Verified against a production server started without the flag: `/dev/typography` returns 404 while `/`, `/auth`, `/me` and `/organizations/x` return 200. That is an HTTP gating check rather than a browser test, so `curl` is the appropriate tool and no Playwright PASS is claimed for it.

## 8. Validation results
All executed. `pnpm verify:visual` exits 0.

- Format: PASS — `prettier --check .`
- Lint: PASS — `eslint .`, 0 errors, 0 warnings
- Typecheck: PASS — `tsc --noEmit`
- Unit/integration: PASS — 24 passed / 24, 4 files (7 new route-manifest tests)
- Build: PASS — `next build`, 28 routes
- Playwright route smoke: PASS — 25 of 25 routes resolve
- Playwright shell smoke: PASS
- Visual regression suite: PASS — 40 passed / 40 overall, exit 0

Run sequence disclosed: the first Playwright run reported 38 passed and 2 failed. One was a genuine bug of mine (the layout boundary and the placeholder both claimed `data-route-group`), fixed by giving the placeholder `data-placeholder-group`. The other was the shell baseline not yet existing, which Playwright wrote on that pass. Runs after the fix pass 40 of 40.

## 9. Visual / Foundation QA
Result: **FOUNDATION PASS**. Not a product-screen pixel PASS, and no such claim is made.

| Item | Value |
|---|---|
| Page | `/me` shell placeholder |
| Viewport / DPR | 1440x900, deviceScaleFactor 1, both asserted in-test |
| Actual | `tests/visual/actual/shell-member-1440x900.png` |
| Baseline | `tests/visual/baseline/shell-member.png` — harness-owned |
| Diff | none produced; matched within `maxDiffPixelRatio: 0.01` |
| Comparison | PASS |

Baseline distinction respected: `tests/visual/baseline/**` is harness-owned regression evidence. `design-reference/final/**` is the read-only approved design baseline. Neither was copied from, synchronised with, or compared against the other. No shell placeholder was compared to any design-reference screen.

## 10. SOT compliance
- Business SOT: routes only. No workflow behaviour implemented.
- Data SOT: not exercised.
- Design SOT: M0-T02 tokens and typography reused unchanged; verified still correct on a shell page.
- API Contract: not exercised.
- Deviations: none new. Doc 04's route table is not implemented, which is a documented contract precedence decision rather than a deviation.
- Carried forward: the Design SOT still defers spacing, radius, border and shadow tokens; baseline colours outside the token set remain open and block M1.

## 11. Regression impact
- Checked: M0-T01 bootstrap route and smoke, M0-T02 typography and font foundation, full code gate chain, and the existing visual suite.
- Result: PASS. `/` returns 200 with `lang="vi"` and its bootstrap markup. The M0-T02 suite passes 7 of 7 within the 40-test run.
- Regression found: None.

## 12. Git
- Branch: `main`
- Commit hash: `8f93d8a0094fb176006590834ce79eb474fe06c5`
- Commit message: `feat(m0-t03): shared web shell and frozen route groups`
- Working tree status: clean.

## 13. Recommended next task
M0-T04 — shared UI primitives. Build the reusable components the approved WF01–WF03 designs actually require, driven by the screen contracts and the baselines rather than invented: button, text input with label and error slot, form field, card/surface panel, and notice/alert. Exit criterion: each primitive has a unit test, the typography harness is extended or a primitives harness added under the same dev gating, and the visual suite still passes as regression.

Note before M1 rather than M0-T04: the open design decisions still stand — the spacing, radius and shadow token scale; gradient stops and token names for WF01-S01 and WF03-S09; and whether `#FEF3F1` or `#FFF3F0` is canonical. Primitives that need radius or shadow will hit the first of these, so it is worth resolving alongside M0-T04. Not started.
