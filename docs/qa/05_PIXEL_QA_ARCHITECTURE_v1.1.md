# 1HUB.NETWORK — PIXEL QA ARCHITECTURE v1.1

**Status:** FROZEN FOR CLAUDE IMPLEMENTATION  
**Objective:** Repeatable visual QA using Thảo-approved geometry/color references plus APEC typography tokens.

---

## 1. Source precedence

```text
Business SOT → behavior/state
Data SOT     → entity/data semantics
Design Pixel SOT Final → layout/style/interaction presentation
```

Approved visual inputs live only in:

```text
design-reference/final/
```

Machine map:

```text
design-reference/final/manifest.yaml
```

Raw exports under `source-thao` are evidence, not automatic pass baselines.

---

## 2. Frozen capture environment

```text
viewport: 1440 × 900 CSS px
DPR: 1
zoom: 100%
locale: vi-VN
browser: pinned Chromium
motion: reduced / animations disabled for capture
```

Long pages preserve 1440px width. Capture both above-fold and full-page when a `__full.png` reference exists.

---

## 3. Hybrid final Design SOT

Because font was intentionally migrated to the APEC typography system, final visual QA has two authorities:

### A. Bitmap reference
Checks:
- shell geometry;
- section positions;
- dimensions;
- spacing;
- colors;
- borders/radii/shadows;
- asset/icon placement;
- clipping/overflow.

### B. Typography DOM contract
Checks computed styles:

```text
normal UI: Be Vietnam Pro
weights: 400 / 500 / 600
large approved display only: Archivo 700
technical/meta only: IBM Plex Mono 500
```

Do not regress to an old screenshot font just to reduce raw image diff.

---

## 4. Deterministic visual state contract

Every test fixture declares:

```yaml
screen_id: WF02-S05
route: /projects/proj_visual_01/edit
actor: member_founder_01
fixture: p0_project_profile_draft
viewport: 1440x900
scroll_y: 0
locale: vi-VN
motion: reduced
```

No random names, avatars, timestamps, recommendations or remote API content.

---

## 5. Capture sequence

1. reset deterministic seed state;
2. authenticate exact actor/session;
3. navigate exact route/state;
4. set viewport/DPR/locale/timezone;
5. wait for API settle and stable layout marker;
6. `await document.fonts.ready`;
7. disable animation, transition and caret blinking;
8. assert typography tokens;
9. capture viewport;
10. capture full page when specified;
11. diff against mapped baseline;
12. classify differences before changing code.

Suggested test CSS:

```css
*, *::before, *::after {
  animation-duration: 0s !important;
  transition-duration: 0s !important;
  caret-color: transparent !important;
}
```

---

## 6. Visual classifications

### V0 — wrong state/source
Wrong actor, route, fixture, source mapping, missing asset or unloaded font.

### V1 — structural
Wrong layout, missing block, wrong shell, large clipping/overflow.

### V2 — major visual
Wrong dimensions, spacing scale, surface/color system, typography token.

### V3 — component detail
Input/button/card/icon/radius/shadow details.

### V4 — raster noise
Anti-aliasing, minor font rasterization/browser image variance.

### INTENTIONAL-TYPOGRAPHY-MIGRATION
Raw Thảo bitmap contains pre-freeze glyph raster/family but implementation uses the approved APEC font token correctly.

### INTENTIONAL-BUSINESS
Business/Data SOT legitimately requires a difference from a source bitmap.

All intentional differences are recorded; they are not silently hidden by replacing baselines.

---

## 7. Hard pass gate

A screen passes only when:

```text
functional state PASS
V0 = none
V1 = none
V2 = none
V3 = none or explicitly approved
APEC typography computed-style assertions PASS
no unexplained clipping/overflow
workflow smoke PASS
```

Raw percentage diff is diagnostic, not the sole pass criterion.

---

## 8. Claude screen loop

```text
Read Business/Data/Screen Contract + Baseline
→ Implement only requested screen/component
→ Typecheck/Lint/Tests
→ Run route-state fixture
→ Typography assertions
→ Capture 1440×900
→ Pixel/perceptual diff
→ Classify
→ Fix verified V1/V2/V3
→ Workflow smoke
→ Regression
→ Commit
→ STOP
```

Claude must never continue into the next workflow opportunistically.

---

## 9. Long-page rule

Where `manifest.yaml` has `full_page`:

- viewport test is mandatory;
- full-page capture is mandatory before workflow final approval;
- do not scale the page to 900px height;
- sticky/fixed shell behavior is checked separately from full-page content flow.

---

## 10. Baseline promotion

The old-font source screenshot remains geometry/color evidence. After an implemented screen passes final review with Be Vietnam Pro, the captured result may be promoted to a new baseline only when:

1. Business/Data state is approved;
2. typography assertions pass;
3. visual reviewer approves geometry and surfaces;
4. promotion is a separate explicit commit;
5. old source remains in `source-thao/` for provenance.
