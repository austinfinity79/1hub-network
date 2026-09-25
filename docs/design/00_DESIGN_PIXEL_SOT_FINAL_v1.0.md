# 1HUB.NETWORK — DESIGN PIXEL SOT FINAL v1.0

**Date:** 25/09/2026  
**Status:** FROZEN for WF01–WF03 implementation  
**Purpose:** Canonical visual source of truth for Claude implementation and pixel QA.

---

## 1. Design SOT precedence

```text
Business SOT  → what the screen must do
Data SOT      → what the screen reads/writes and what entities mean
Design SOT    → layout, composition, styling, interaction presentation
Code          → must conform to all three; code is never a source of truth by itself
```

Raw Thảo/Figma exports are preserved as source references. The approved implementation baselines are the normalized files under:

```text
design-reference/final/
```

The machine-readable map is:

```text
design-reference/final/manifest.yaml
```

---

## 2. Visual direction freeze

### 2.1 What is preserved from Thảo

- HUB Network red / burgundy visual identity.
- White/light neutral work surfaces.
- Desktop-first layouts.
- Dark burgundy navigation/header where present.
- Red primary actions and active states.
- Cards/tables/forms with restrained border and shadow.
- Existing information hierarchy and screen composition.
- Existing screen-specific spacing/geometry is judged against the approved baseline PNG, not re-invented by Claude.

### 2.2 What is changed/frozen from APEC

Typography is standardized to the implemented APEC font system:

```text
Primary product UI:  Be Vietnam Pro
Display/marketing:   Archivo Bold (only for large editorial/hero headings)
Technical/meta:      IBM Plex Mono Medium (only for IDs, compact metadata, numbered technical labels)
```

**Default rule for 1hub.network:** use **Be Vietnam Pro** for normal product UI. Do not introduce Archivo/IBM Plex Mono unless the approved pattern explicitly calls for a display or technical/meta treatment.

### 2.3 Font weights

```text
Be Vietnam Pro Regular   = 400
Be Vietnam Pro Medium    = 500
Be Vietnam Pro SemiBold  = 600
Archivo Bold             = 700
IBM Plex Mono Medium     = 500
```

### 2.4 Typography scale — APEC-aligned base tokens

These are implementation tokens. A screen baseline can require a local size variation where the approved visual clearly does so.

```text
meta-xs       13 / 18  Regular|SemiBold
body-sm       14 / 24  Regular|Medium
body-md       16 / 28  Regular
section-sm    17 / 26  SemiBold
subtitle      20 / 30  SemiBold
heading-2     26 / 36  SemiBold
display       34 / 44  Archivo Bold
button        16 / 20  SemiBold
```

### 2.5 Color anchors

Canonical base colors sampled from the approved 1hub visual language:

```text
--hub-primary:       #FC523C;
--hub-primary-soft:  #FFF3F0;
--hub-burgundy:      #160002;
--hub-canvas:        #EFEFEF;
--hub-surface:       #FFFFFF;
```

Other neutral/border/text shades remain screen-baseline-driven until extracted into a broader component token library. Claude must not replace the red system with APEC blue.

---

## 3. Web viewport rule — HARD RULE

### Standard screen

```text
Viewport: 1440 × 900 CSS px
DPR:      1
Zoom:     100%
Browser:  pinned Chromium
Locale:   vi-VN
```

All workflow screenshots use the same desktop viewport. Do not squeeze a screen to fit a workflow board.

### Scrollable page

- width remains exactly 1440 CSS px;
- above-fold baseline is 1440×900;
- a normalized full-page reference is also stored where the source exceeds 900px;
- implementation scrolls naturally;
- never scale a `1440×N` long page into `1440×900`.

---

## 4. Pixel baseline model

There are four reference modes in `manifest.yaml`:

### `strict`
One source export maps directly to one web state. Use normal pixel QA.

### `long-page`
Use the `1440×900` file for above-fold checks and `__full.png` for full-page visual regression.

### `state-board`
A source image contains multiple states of the same route (for example success/expired/used). Business/functional tests select the state; the board is the visual reference for those variants.

### `derived-crop`
A final baseline was cropped from a larger approved Thảo board. It is valid for composition/style of that scoped screen only.

---

## 5. Typography override and pixel QA

The raw Thảo images pre-date the final APEC-font freeze in some places. Therefore Design SOT is intentionally hybrid:

```text
Bitmap baseline → geometry, composition, color, spacing, surfaces, component sizing
DOM typography  → font family, weight, size, line-height, tracking
```

Pixel diff must not be “fixed” by switching back to an old font visible in a raw export.

For every production screen, QA must assert at minimum:

```text
font-family contains "Be Vietnam Pro" for normal UI text
expected weight token is used
font files are loaded before capture
document.fonts.ready has resolved
```

Text rasterization differences caused only by the approved font migration are classified as `INTENTIONAL-TYPOGRAPHY-MIGRATION`, not as a reason to change business/layout code.

Once a screen has been implemented and approved using the final APEC typography, its implementation capture may replace the old-font bitmap baseline only through an explicit baseline-approval commit.

---

## 6. Shared UI rules

- One responsive web application, not mobile mockups.
- 1440 desktop is the pixel-fidelity target; responsiveness may adapt below this width without changing business hierarchy.
- Primary CTA uses HUB red.
- Destructive actions require explicit destructive treatment/confirmation.
- Navigation shell is consistent within the same actor context.
- Form validation is inline and does not unexpectedly reflow the whole page.
- Loading, empty, error, disabled and permission-denied states must use the same component system.
- Icons are functional, not decorative noise.
- No gradients, new illustration language, or APEC-blue component system may be introduced unless an approved screen explicitly requires it.

---

## 7. Approved production workflow design set

### WF01 — Identity & Onboarding

Approved references: `WF01-S01` → `WF01-S08`.

### WF02 — Member Profile & Network Management

Approved references: `WF02-S01` → `WF02-S07`.

WF02 explicitly includes create/edit **Project/Startup Profile**, linked to WF05 but not the WF05 participation/application journey.

### WF03 — HUB / Chapter / CLB Operations

Approved references: `WF03-S01` → `WF03-S09`.

Terminology freeze from Thảo review:

```text
"Quản lý hoạt động" → "Quản lý sự kiện"
```

The implementation entity is `Event`, not a generic user-authored Activity CRUD module.

---

## 8. Auth future extension

WF01 P0 uses the approved account/auth flow. Architecture must preserve a future insertion point for:

```text
1Hub verified identity / CCCD verification
```

This is **future verification**, not a reason to couple P0 `UserAccount` or `IndividualProfile` directly to CCCD data.

---

## 9. Out-of-scope design behavior

Claude must not infer implementation scope from any raw design file that is absent from the final manifest.

Examples of raw screens that remain future/demo unless separately promoted:

- Investor/VC flows
- Dataroom
- advanced judging/governance
- future matching/discovery
- future 1Hub/CCCD verification UI

`DESIGNED` does not mean `APPROVED TO BUILD`.

---

## 10. Definition of visual done

A production screen is visually done only when:

1. correct Business/Data state is rendered;
2. route and actor are correct;
3. 1440×900 geometry matches the approved reference;
4. APEC typography tokens are used;
5. no V1/V2 mismatch remains;
6. V3 differences are fixed or explicitly approved;
7. long-page full screenshot is checked when applicable;
8. intentional deviations are recorded;
9. baseline is never overwritten merely to hide a mismatch.
