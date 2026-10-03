# WF06-PROD-06_visual-closure

**WF06-PROD-06 — pixel / responsive closure** of candidate `9733bf3` (runtime unchanged since `d113d14`). Parent: [WF06-PROD-06_production-readiness.md](WF06-PROD-06_production-readiness.md). Spec: `tests/visual/specs/wf06-prod-visual.spec.ts`; evidence PNGs `tests/visual/actual/pixel-qa/WF06-PROD-06.<width>.<state>.png` (90), measurements `WF06-PROD-06.responsive.json`.

## Preflight (evidence 1)
Branch `feat/wf06-prod-hardening` at `9733bf3` (PROD-05), clean except `AGENTS.md`; migrations 001 → 016 (`db/` unchanged since `5199e07`); origin/main and production `78f21f2`; `fb2130f`, `a957876`, `c1b60c3` not in HEAD; PROD-00 … 05 reports present (4 / 3 / 6 / 5 / 5 / 4 files).

## Viewport matrix and coverage (evidence 2, 3)
DPR 1, 1440 / 1024 / 768 / 430 / 390 / 320, 14 measured states each (84) plus the transition (1440, 390), URL and focus / contrast runs.

| Surface | States |
|---|---|
| Library guest | default (Bài toán, full page), filtered (Logistics), Startup default (canonical + external), founder tab = sign-in state (hidden founders) |
| Library member | Startup canonical (`q`), page 2 with a long Unicode title (full page), founder tab with visible founders |
| Library states | loading (delayed answer), error, retried, refused next page ("invalid cursor"), empty |
| Organization | chapter with children (full page), organization without children, DRAFT organization (404) |
| Organization list / search | NOT_APPLICABLE: no public organization list or search exists in P0 |
Each state is measured for: page overflow, controls outside the viewport, clipped text (screen-reader-only text excluded), overlapping controls, equal card widths, overlapping cards, the founder "role · startup" line, and state blocks inside the viewport.

## Responsive results (evidence 7 – 9)
| Check | Result |
|---|---|
| horizontal overflow | 0 px in all 84 states |
| clipped text / overlapping controls / card overlap / founder line clipped / state block outside | 0 / 0 / none / 0 / 0 |
| card widths | one width per state (canonical, external and long-title cards alike) |
| controls outside the viewport | only at 320 px, only a tab of the Library tab bar (the bar is wider than 320 px): **identical on the pre-WF06 build** (`5199e07`, measured side by side) → KNOWN_BASELINE_DEBT, pinned in the spec to the tab bar only |
| filters / load-more / retry | filters fold behind "Bộ lọc" below 900 px and open; "Xem thêm" and "Thử lại" visible and reachable at every width |
| organization page | grid aligned, metadata and stats drawn, no-children state fits, a DRAFT organization is a 404 with nothing of it shown |
| Library cards | no duplicate card; founder hidden = no card and no gap; founder visible line fits |

## Guest → member → guest, URL state (evidence 10, 11)
Guest (sign-in state, no names) → real magic-link sign-in → member (Hải, Lan, Minh, Quân, no duplicate) → logout → guest (no names; no founder name in the page HTML). The tab bar stays at y = 810 px in all three steps at 1440 and 390 (no layout jump). URL: `?q=` survives refresh, a copied link in a new context, homepage search → Back → Forward; tabs, filters and pages are page state (unchanged behaviour), so a refresh returns to page 1.

## Pixel (1440) and skipped-suite closure (evidence 4 – 6)
| Item | Result | Class |
|---|---|---|
| L15 hero, filtered directory, load-more; L15b Startup; L15c founder (member view); L19 organization page | every compared segment under the thresholds (worst outside-text ratio 0.0124 / 0.015, shift ratio 0.0097 / 0.02); typography violations 0 | differences: CONTENT_VARIANCE (data, counts, 0 open problems = the file) and INTENTIONAL_APPROVED_CHANGE (DEC-L15 / DEC-W6P scope) |
| `pixel-qa-screens` (24 opt-in M0-T11 runs) | 7 PASS_EXECUTED (WF02-S02, S05, S06; WF03-S01, S03, S05, S08); 13 typography + 4 dimension failures | KNOWN_BASELINE: same 17 screens, same first error, on `9733bf3` and on `5199e07` |
| feed-down, crafted-feed cases | passed on their servers (PROD-05) | ENVIRONMENT_ONLY_WITH_PROOF |
REAL_REGRESSION = 0. No baseline image was changed.

## Font / baseline analysis (evidence 5)
Product font: Be Vietnam Pro by default; Space Grotesk on Corrected Design Revision screens under DEC-HD-12 (adopted by TASK 22.2 auth 28/09, 22.4 public organization / ops 28/09, onboarding and workspace fixes 29/09 — all before WF06). The M0-T11 runner (26/09) checks those screens with the legacy allowlist (`APPROVED_FACES`) and against their original references; the revision harness (`auditRevision`, `REVISION_FACES`) used by the current specs passes them. WF06 changed no font, `font-family` or font file (`git diff 5199e07..HEAD`: none). Classification: PRE_EXISTING_BASELINE_DEBT / TEST_BASELINE_STALE (runner configuration), product state APPROVED_CHANGE; NEW_WF06_REGRESSION = 0. Product typography was not changed.

## Accessibility smoke and runtime (evidence 12, 13)
Focus: 2 px solid outline on the search field, the selected tab, "Xem thêm" and the sign-in link (the page's shared `:focus-visible` rule). Labels and names: as PROD-04 / 05. Contrast: titles, links and buttons of the new states 17.65:1; muted texts 3.65:1 = the Library's `--muted` token (`#8e7677`, since 28/09, also on the pre-WF06 error block) → KNOWN_BASELINE_DEBT, pinned (no regression). Console errors 0, hydration errors 0, unexpected 5xx 0 in every visual journey.

## Related
- [WF06-PROD-06_production-readiness.md](WF06-PROD-06_production-readiness.md) · [WF06-PROD-05_prod06-handoff.md](WF06-PROD-05_prod06-handoff.md)
