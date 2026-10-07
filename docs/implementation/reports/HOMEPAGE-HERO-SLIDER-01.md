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

## Related
- [HOME-LOGO-HOTFIX-01](HOME-LOGO-HOTFIX-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
