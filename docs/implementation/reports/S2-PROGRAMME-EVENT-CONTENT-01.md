# S2-PROGRAMME-EVENT-CONTENT-01

Programmes + Events from the PO's sheet "1hub.network - Chương trình cuộc thi, Sự kiện" (`1Xx1dNIO0RBWrZlN0cd9Y1GnrSFcJQGSlhk7UL012BzU`, xlsx export sha256 `86318220…`). No DB change.

## Programmes (`/programmes`)
| Item | Result |
|---|---|
| Filters | "Loại" (rail + Challenge/Programme quick chips) and "Đơn vị chủ quản" removed; `?loai=` / `?don-vi=` ignored. Kept: search, Trạng thái, sort, address, reset, paging |
| Images | 4 announced cards: the homepage covers (same Drive files as the sheet's programme folder `1Ob1LV6…`, provenance PUBLIC-CONTENT-PUBLISH-01); 8 finished: the sheet's own Drive file per row |
| Past | 8 rows with Trạng thái "Đã kết thúc" → phase "Đã kết thúc"; organisers as written (one per line) |
| Visible | 12 (4 Sắp công bố + 8 Đã kết thúc); no duplicate |

## Events (`/events`, header "Chương trình ▾ → Sự kiện")
| Sheet tab | Rows | Published |
|---|---|---|
| Sự kiện sắp tới | 7 | 7: row 1 featured (its "Thông tin khác"), 6 cards by month; images from folder `1FPXW12H…` matched by STT prefix 01–07 and name |
| Sự kiện đã tổ chức | 40 | 40, newest first (9 per page); organiser = first line (sheet rule); "Link liên quan" / "Vai trò HUB" marked "(bỏ)" not carried |

No CTA, registration, calendar or detail link (none in source); no year or weekday added.

## Source gaps (not inferred)
- Upcoming dates are day/month only ("29/10"): shown as written, no year / weekday.
- Past event "HUB INSIDER 2024 - Accelerate AI Startup Spin-off from University": date "21/22/2024" is not a date → date omitted, listed last.
- Finished programmes: no dates and no type in source → no timeline, no type tag.
- Programme row 10 title spelled "Cuôc thi…" in source: kept as written (PO to correct).
- Sheet "Lĩnh vực" column not used (no domain filter requested).

## Shared-route effect
`PUBLIC_ROUTES.events = '/events'`: the header entry and About's "Xem lịch sự kiện" (DM02, "until /events") now open `/events`; no About code changed.

## Files
`src/lib/public/programme-event-source.ts` (canonical data), `programme-directory.ts`, `discovery-views.ts`, `routes.ts`, `components/discovery/programme-directory.tsx` + css, `components/events/*`, `app/(public)/events/page.tsx`, `public/programmes/past/*` (8), `public/events/**` (47), provenance `docs/data/programme-event-assets-provenance.json`.

## Tests
Unit `src/lib/public` 10/10. Playwright (targeted): `s2-events`, `thao-05-discovery`, `thao-01-global-nav`, `demo-home-about-01`, `public-content-publish`, `thao-04-about`, `alpha-interaction-gaps` — all pass except the known homepage hero-counter typography debt (IBM Plex Mono 400).

## Related
- [PROGRAMME-PRESENTATION-DATA-01](PROGRAMME-PRESENTATION-DATA-01.md) · [PUBLIC-CONTENT-PUBLISH-01](PUBLIC-CONTENT-PUBLISH-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
