# S2-FB3-WAVE-A

Feedback Sprint 2 (lần 3), Wave A: three scoped commits, one build, one deploy. No DB change.

| Task | Commit | Change |
|---|---|---|
| S2-COPY-QUICKFIX-01 | `4a4d3f9` | /events subtitle removed; /products title "Sản phẩm", load-more "xem thêm" (no count, `MoreButton` `label`); /talents title "Nhân tài" |
| S2-HOME-CONTENT-REFRESH-01 | `3ab093c` | ticker: APEC Innovation Challenge · Data for Life · Fintech Challenge Vietnam · Agritech Innovation Challenge; "Cập nhật chương trình": exactly the PO's three lines (no time, tag or link; APEC row keeps the approved APEC mark, others initials) |
| S2-HOME-HERO-SLIDE-ASSET-01 | `04ab55a` | slide 07 "Dành cho quỹ đầu tư" appended last; supplied AVIF / WebP / JPG (desktop ≥ 768 px, mobile below, 1x / 2x) via `<picture>`, unmodified (`public/home/hero/hero-still-07-vi-*`) |

Pixel QA classification (intentional copy):
- DM09 `/talents` hero: the title band is masked ("Nhân tài" replaces the frame's counted title); hero 1.23 %.
- DM01 segment 04 (programme updates) measured, no longer gated: the PO's updates have no time line or tag.

Known, not from this wave: homepage hero-counter typography (IBM Plex Mono 400); `thao-03-home` DM01P pitch card fails locally because the isolated DB has no investor-carousel startup (empty state).

Tests: batch recheck `hero-slider`, `public-content-publish`, `demo-dir2-01`, `s2-events`, `thao-05-discovery` 51/51.

## Related
- [S2-EVENT-REDESIGN-01](S2-EVENT-REDESIGN-01.md) · [S2-QUICKFIX-234-01](S2-QUICKFIX-234-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
