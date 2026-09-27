# UI Delta Matrix

> **SUPERSEDED — DO NOT IMPLEMENT.** Unfinished TASK 21 draft (paused 2026-09-28), built from the Homepage / L1–L6 ZIPs that the designer / PO has since replaced with a corrected revision. Nothing in this file is approved or frozen, and it is not a Design Revision SOT. Do not use it for Task 22. The corrected package will be audited from scratch; only the generic method in [AUDIT_METHODOLOGY.md](../AUDIT_METHODOLOGY.md) carries over.

Current implemented UI vs the revision, per screen that maps to existing behaviour (Bucket A, plus the B screens that have a current page). Impact is measured by real component and layout change, not by slice count: XS < ½ day · S ≈ 1 day · M 2–3 days · L ≈ 1 week · XL > 1 week. New or future screens have no current UI; they are sized in 06 (never written) only if promoted.

Shared observations:
- **Tokens:** the palette already equals `DESIGN_TOKENS_v1.0` (`#fc523c`, `#160002`, `#efefef`). Typefaces must be confirmed by Task 22 typography assertions.
- **Shells:** each frame draws a different header / nav (varies per frame), so Task 22 must choose one shell per area (HD-09).
- **States:** only the ideal state is drawn. Empty / loading / error states are not supplied except the ME7 empty state and L6-S6, so existing states are kept.

| Screen | Shell / header / nav | Structure & section order | Components (cards, tables, forms, buttons, badges, icons) | Copy | Responsive & states | Impact |
|---|---|---|---|---|---|---|
| HOME-1 `/` | New public header (4 items, VI \| EN, "Đăng nhập", outlined "Tạo tài khoản") replaces the current P0 header | Completely new: coral hero with search and 2 CTAs → huge "1hub.network" wordmark → journey strip "Đăng ký → Xác thực → Đánh giá → Cố vấn → Thử nghiệm" → 3 audience blocks (founder / organiser / fund) → events → one-profile → network doors → loop → community stats → partner wall → closing → footer. Current: 5-section P0 landing | New hero, horizontal problem carousel with chip filters, programme cards with status pills, event rows, stat blocks, logo wall, big display wordmark | All copy new; claims (30 bài toán Hà Nội / QĐ 1193, community numbers) need confirmation | 1440 only drawn; responsive to be derived; placeholder blocks | **XL** |
| L2-ME0 settings | Settings sidebar | One overview page with cards: login, privacy / consent, notifications, organisations, danger zone. Current: two pages (settings; privacy) | Summary rows with "Đổi →" / "Xem →"; new blocks omitted in the subset | Mostly new | Existing states kept | **M** (subset) |
| L2-PRJ1…3 create | Focused wizard header with step counter | 3-step wizard (core info → invite team → done). Current: one form, then team page | Radio cards "Dự án / ý tưởng" vs "Startup", stepper, invite rows, done card with next actions | New helper copy | Keep validation states | **M** |
| L2-FP1E | Modal over owner profile | Per-card edit modal vs one long edit page | Modal, org picker | New | Host FP1-OWN missing | S (blocked, HD-10) |
| L2-ORGP1 | Dark org header, tabs | Unified profile with rail | Capability chips, rail, tabs | New | — | L (B) |
| L3-S1 `/organizations/[slug]` | Public org nav "Giới thiệu / Sự kiện / CLB trực thuộc / Bài toán" | Hero with KPIs → leadership → CLB cards → upcoming events → join band. Current: hero, about, events, child CLB, join | KPI tiles, leader cards, CLB cards with counts, event cards; "Xin vào chapter" ×3 | New | 1440 only | **L** (subset: KPIs and leadership per HD-05) |
| L3-S2 `/ops/org/:id` | Revision draws no sidebar (1440 frame) | KPI row → funnel → todo list with "Chờ HUB / Chờ chapter" chips | KPI tiles, funnel bar, todo rows | New | — | **M** (subset: existing cards only) |
| L3-S5 events | Same as S2 | Filter chips "Sắp diễn ra / Đã kết thúc / Bản nháp" → rows with type badge, owner warning, "Quản lý" | Chip filters, type badges, row action | New | — | **M** (subset: existing statuses; no type / owner) |
| L3-S8 members | 1600 ops shell with a new sidebar | Tabs "Đơn chờ duyệt / Đang hoạt động / Đã rời" → rows with inline "Duyệt / Từ chối" → leadership block | Tabs, inline actions, leadership rows with "Chuyển giao / Gỡ quyền" (omitted) | New | — | **M** (subset) |
| L5-2 / L5-3 (current WF05-S03 / S04) | Focused submit shell, countdown, autosave | 4-step wizard + review. Current: one form + review | Stepper, word counters, upload zones, milestone table, checklist pill | New | Autosave / countdown states | L (B, HD-04) |
| L6-S6 404 / 500 | Minimal | Three state cards | Illustration / code, message, action button | New | 404 / 500; maintenance omitted | **S** |

Unchanged screens (listed in [02](02_SCREEN_INVENTORY.md)) get no UI change in Task 22, except shared shell/header changes decided under HD-09.

## Related
- [02_SCREEN_INVENTORY.md](02_SCREEN_INVENTORY.md) — screens
- 07_TASK22_IMPLEMENTATION_ORDER.md (never written) — batches
