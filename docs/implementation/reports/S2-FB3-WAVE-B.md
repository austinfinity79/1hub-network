# S2-FB3-WAVE-B

Feedback Sprint 2 (lần 3), Wave B: canonical programme data first, homepage reuses it. Two scoped commits, one build, one deploy. No DB change.

| Task | Commit | Change |
|---|---|---|
| S2-PROGRAMME-CATALOG-REFRESH-01 | `8991bf0` | `UPCOMING_PROGRAMMES` (programme-event-source.ts) = canonical upcoming set: APEC, Kawai kept; VPBank, Agritech removed; Data for Life, Fintech Challenge Vietnam, AI Thực chiến, Global Builder Camp, VietChallenge added (status, organiser, description, sector verbatim from §4 table). /programmes hero: the PO's line (40 px, one line at desktop), counter cluster removed; "Lĩnh vực" tag on every card; 8 finished programmes unchanged |
| S2-HOME-INNOVATION-PROGRAMMES-01 | `10e678e` | homepage cards derived from `UPCOMING_PROGRAMMES` by slug: APEC Innovation Challenge, Data for Life, Fintech Challenge Vietnam, AI Thực chiến (same names / pictures as /programmes); APEC title → https://apec.1hub.cloud/ (new tab) — the §2 link was not yet on this card |

Assets: the five banners of the §4 "Ảnh 16:9" Drive folder `1uKdq60…` (dataforlife, Fintech Challenge Vietnam, aithuchien, global builder camp, vietchallenge — the three homepage files of §2 are the same Drive ids), WebP ≤ 1280 px in `public/programmes/upcoming/`; APEC and Kawai keep their approved covers. Provenance appended to `docs/data/programme-event-assets-provenance.json`. Asset gaps: none.

Type: only APEC and Kawai carry a "Tag phân loại" (Cuộc thi) in a source; the five new rows have none, so no type chip / tag is drawn.

Unused, kept on disk: `public/home/content-v2/programme-vpbank-…` and `…-agritech-…` covers.

Pixel QA: DM06 masks the PO's title band and the removed counter row (INTENTIONAL-COPY); hero 0.51 %.

Tests: unit 10/10; `thao-05-discovery`, `public-content-publish`, `hero-slider` 38/38; `demo-home-about-01` all but the known hero-counter typography debt.

## Related
- [S2-FB3-WAVE-A](S2-FB3-WAVE-A.md) · [S2-PROGRAMME-EVENT-CONTENT-01](S2-PROGRAMME-EVENT-CONTENT-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
