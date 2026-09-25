# Claude Task Report

## 1. Task
- Task ID / name: WF01-S01-FINAL-AUDIT — shared token / typography scope check
- Scope requested: verify WF01-S01 did not promote screen-specific measurements into global design rules; localise any proven accidental promotion without changing S01 pixels.
- Status: **PASS WITH LOCALIZATION**
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S02 not started.

## 2. Method
Evidence came from the 24 approved references, not from S01 alone:
- A colour survey: pixels within ±2 of each value S01 introduced.
- Geometry probes: card and input corner radii, input heights, and the heights of the red CTAs.

| Value S01 introduced | Found in other references | Verdict |
|---|---|---|
| Card hairline `#e4dede` | 24 / 24 | multi-reference |
| Muted text `#534041` | 24 / 24 | multi-reference |
| Notice fill `#f7f4f4` | ~15 | multi-reference |
| Placeholder `#a79b9b` | S02, S05–S08, WF03 | multi-reference |
| Burgundy CTA label | 16 / 16 with a red CTA | multi-reference |
| Card radius 14px | WF01-S03/S07 ≈14; WF02 ≈11; WF03 7–11 | **contradicted** |
| Input height 49px | WF02-S02/S05 = 44px | **contradicted** |
| Button height 47px | 42–46px elsewhere; WF03 31–38px | **contradicted** |
| Input border `#c9bfbf` / fill `#fbfafa`, shadow, 36px card padding, 5px stack, notice 13px padding and 8px radius | S01 only, or not measurable elsewhere | **S01-only** |

## 3. Classification
| Item | Before audit | Class | Action |
|---|---|---|---|
| radius-control 8px, radius-surface 14px | global | SCREEN_LOCAL_VALUE | reverted to 0px globally; set on the S01 card |
| notice radius 8px (primitive rule changed) | global | COMPONENT_LOCAL_VALUE | new `--unresolved-radius-notice`, defaulting to radius-surface (M0 behaviour); S01 sets 0.5rem |
| shadow | global | SCREEN_LOCAL_VALUE | `none` globally; set on the S01 card |
| control-y 12.5px, surface 36px, stack 5px | global | SCREEN_LOCAL_VALUE | reverted to 0.75rem / 1.5rem / 0.5rem; set on the S01 card |
| input-y, notice-x, border-control, fill-control | GLOBAL_NEW_TOKEN | COMPONENT_LOCAL_VALUE | kept as primitive parameters defaulting to M0 behaviour; S01 sets its values |
| control-x 1rem | global | GLOBAL_EXISTING_TOKEN | unchanged (S01 measures the same) |
| border-surface, fill-notice, fg-muted, fg-placeholder | GLOBAL_NEW_TOKEN | GLOBAL_NEW_TOKEN, multi-reference | kept global, evidence recorded in the manifest |
| `--color-fg-on-accent` burgundy | GLOBAL_EXISTING_TOKEN | GLOBAL_EXISTING_TOKEN, multi-reference | kept (16/16 references; WCAG AA) |
| Gradient mid-stop `#58040b` | screen-local | SCREEN_LOCAL_BASELINE_VALUE | no change; it lives only in `auth-split-layout.module.css`. Also appears in WF03-S09, noted for later |
| Archivo 700 headline | via existing `.type-display` | S01 SCREEN-APPROVED DISPLAY TREATMENT | no change |
| `Button fullWidth`, `TextInput ref` | shared | generic API | no change |

Mechanism: primitives read `var(--unresolved-*)`. The S01 card, `.card` in `auth-entry.module.css`, overrides those properties for its own subtree only. No other screen inherits S01 geometry.

## 4. Archivo evidence (case A)
- Design SOT §2.3, line 51: "Display/marketing: Archivo Bold (only for large editorial/hero headings)".
- The S01 headline is the brand panel's large marketing hero heading.
- The bitmap measures the frozen `display` step exactly: 34px size and a 44px line pitch (348→392→436).
- It is applied through the pre-existing `.type-display` class, so no new rule was created. The card title stays Be Vietnam Pro.

## 5. Proof S01 is unchanged
- The S01 capture after localisation is **byte-identical** to the capture before it: 0 differing bytes, and pixelmatch at threshold 0 gives 0.
- WF01-S01 Playwright 12/12. Segments outside text: 0 / 0 / 0 / 0 / 1 px, the same as before.

## 6. Baselines
- `design-reference/final/**`: 67 files, hash unchanged.
- `tests/visual/baseline/primitives.png` (harness-owned) regenerated after inspection. The harness now shows the global state: square and flat, as in M0-T04, plus only the multi-reference changes (burgundy CTA label, surface hairline, notice fill and muted text, placeholder). Shell and typography baselines are unchanged.
- The M0-T04 test "leaves unresolved cosmetic values visibly unset" is restored. The harness copy is restored.

## 7. Regression
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS |
| Unit | 109 / 109 |
| DB integration | 121 / 121 |
| Build | PASS |
| Playwright | 124 / 124, plus 24 screen runs skipped by design |

## 8. Residual risk for S02–S24
- Multi-reference neutrals are established by colour presence, not by confirmed role. For example, `#f7f4f4` may be a panel fill rather than a notice fill on some screens. Each screen's pixel gate will confirm or override them.
- Burgundy CTA labels now apply to every primary button. The evidence is strong.
- Geometry stays neutral globally. Each screen settles its own geometry locally until several screens agree on a shared value.

## 9. Git
- Branch: `main`; start HEAD `95ffe38`, unchanged before commit
- Implementation commit: `6efee37` fix(wf01-s01): localise single-screen measurements to the auth card
- Report/final commit: the commit containing this report
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `2390ce2`
- Working tree: clean after commit except the untracked `AGENTS.md`, preserved and not committed

## Related
- [reports/WF01-S01_auth-entry.md](reports/WF01-S01_auth-entry.md) — the WF01-S01 implementation report
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
