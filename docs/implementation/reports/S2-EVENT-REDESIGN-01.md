# S2-EVENT-REDESIGN-01

`/events` visual redesign after the PO reference "DIR2.2 - Sự kiện" (1440 × 2042). Presentation only: same source module, rows, order, month grouping, upcoming/past split, paging. No DB change.

| Area | Change |
|---|---|
| Header | the homepage's dark header (approved white logo `/brand/hub-network-logo-white.png`, 44 px) on a dark bar, as the founder page draws it; the light-tone symbol variant is no longer used here |
| Featured | white 32 px container, poster left (16:10 cover), date badge + time + venue, title, organiser, "17/50 người đã đăng ký" with bar, status tag; flag moved to the poster foot so the poster's own title stays visible |
| Bar | segmented "Sắp diễn ra · 7" / "Đã diễn ra · 40": in-page jumps to the two sections (no filter existed; none added) |
| Grid | month groups, 3 / 2 / 1 columns, poster cards with date badge, red kicker (Vai trò HUB), title, organiser · time, venue, seats (red) + status tag |
| Past | compact rows (112 × 84 thumbnail, two-line title, organiser · date, venue), 9 per page |

Not taken from the reference (no source data): year, weekday, "Đăng ký" / "Thêm vào lịch" / "Xem recap" actions, date / type / HUB filters.

Tests: `s2-events` 3/3 (links = the two section jumps; header logo = homepage artwork).

## Related
- [S2-PROGRAMME-EVENT-CONTENT-01](S2-PROGRAMME-EVENT-CONTENT-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
