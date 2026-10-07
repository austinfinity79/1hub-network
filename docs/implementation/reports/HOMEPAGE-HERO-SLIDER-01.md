# HOMEPAGE-HERO-SLIDER-01

The homepage hero is the PO's six still artworks (video cancelled). UI only: no DB, API, auth or data change.

| Item | Value |
|---|---|
| Assets | `public/home/hero/hero-still-01 … 06.png`, byte-identical to the PO files (1920 × 1080 each) |
| Component | `src/components/home/hero-slider.tsx`: one 16:9 frame, slides stacked and cross-faded (500 ms; none with reduced motion), `object-fit: contain`, alt = slide number + the label printed on the art |
| Behaviour | 01 first; 10 s per slide, 06 → 01; Previous / Next change at once and restart the 10 s; one timeout per shown slide, cleared on change and unmount; indicator `0N / 06` |
| Layout | header, frame, controls, then the existing search cluster and intents (moved below the frame, never over the art); the video placeholder is removed |
| Loading | slide 01 `priority` (preloaded), the others lazy; quality 90 |
| Tests | `hero-slider` spec (bytes, order, loop, prev / next, timer reset via the Playwright clock, 5 widths); `thao-03-home` hero assertions and the DM01 / DM01H hero pixel blocks re-scoped (superseded, reported); `thao-01` logo assertion updated for HOME-LOGO-HOTFIX-01 |

A filter mistake (the worktree path contains "hero-slider") made one run select every spec: 1433 tests, 1401 pass, 29 skip, 3 failures — all in the specs fixed above. The final targeted run: 36 / 36.

## Frame correction (PO reference "HUB Network Red Globe Landing Page.png")
The first layout (frame = full width × 9/16, controls and search below) was rejected. Now one composed first screen: hero `clamp(760px, 100svh, 980px)` from 1280 px (natural height below), a size-container slider whose stage is the largest 16:9 frame that fits (`min(100cqw, (100cqh − 52px) × 16/9)`), framed (radius, shadow) on the dark hero; arrows on the hero's sides centred on the frame; counter `0N / 06` + six bars under the frame's left edge; search and intents at the hero's foot. Under 1024 px: natural height, arrows in the counter row. 1440 × 900: hero 900, frame 1022 × 575. Slider logic unchanged.

## Full-fill overlay correction (PO review of the frame)
The framed poster on the dark hero was rejected. Now the stills ARE the hero's canvas: header, then a canvas (`#eeeeee`, the stills' own edge colour) the artwork fills edge to edge — full width, 16:9, from the top, `object-fit: cover`, no side crop; where the canvas is shorter only the stills' empty foot (below 81 % of their height) is clipped. Arrows float on the canvas sides at its vertical centre; the counter + bars (on the stills' text column), the search and the intents sit in an overlay in the canvas's lower part, below the artwork content (search/intents are passed to the slider as `children`). Hero `clamp(760px, min(100svh, 64px + 56.25vw + 100px), 980px)`; tablets `64px + 56.25vw + 100px`; phones ≤ 720 px: artwork on top of the canvas, the arrows join the counter row, search and intents under it on the same canvas. 1440 × 900: hero 900, artwork 1440 × 810, search at y 745. 390: hero 601. Slider logic unchanged. Targeted run 36 / 36.

## Related
- [HOME-LOGO-HOTFIX-01](HOME-LOGO-HOTFIX-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
