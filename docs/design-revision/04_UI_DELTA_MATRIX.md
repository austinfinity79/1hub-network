# UI Delta Matrix

Current deployed UI vs the corrected design, for every screen that has a current equivalent (Bucket A, plus the B screens that already have a page). Impact is sized by real layout and component change, not file count: XS < ½ day · S ≈ 1 d · M 2–3 d · L ≈ 1 wk · XL > 1 wk. NEW / FUTURE screens have no current UI and are sized only if promoted.

**Across all screens:**
- **Colour / tokens:** the palette equals `DESIGN_TOKENS_v1.0` (`--hub-primary #fc523c`, `--hub-burgundy #160002`, `--hub-canvas #efefef`), so no token change.
- **Typography:** the revision is set in **Space Grotesk** (glyph-mask evidence, TASK 22.1 precheck). **DEC-HD-12 CLOSED:** Space Grotesk is approved for revision screens only; legacy screens keep Be Vietnam Pro / Archivo / IBM Plex Mono. Mono labels are monospace of an unproven family; the approved IBM Plex Mono is used. The earlier line ("looks consistent with Be Vietnam Pro …") was wrong.
- **Icons:** outline icons plus the floating "Góp ý" button on every frame; the button has no flow (HD-11).
- **States:** only ideal states are drawn, except AI states (L06c), SYS1 (404 / 500 / maintenance) and AUTH3 / AUTH4 variants. Current empty / loading / error states are kept.
- **Responsive:** only 1440 (L26, L27, L46, L52, L53 at 1600) is drawn. Basic responsive safety (IA-P2-03 rules) is kept.

| Screen | Shell / header / nav | Layout, sections, spacing | Cards / forms / tables / CTA / badges | Copy | Impact |
|---|---|---|---|---|---|
| H1 `/` | New public header (4 items, VI \| EN, Đăng nhập, outlined Tạo tài khoản) | New long page: coral hero with search + 2 CTAs → giant wordmark → journey strip (Đăng ký → Xác thực → Đánh giá → Cố vấn → Thử nghiệm) → 3 audience blocks → events → one-profile → network doors → loop → community → partner wall → closing → footer | Problem carousel with chip filters, programme cards with status pills, event rows, stats, logo wall | All new; claims and placeholders (HD-01) | **XL** |
| AUTH1 `/auth` | Auth split layout kept | Brand panel re-laid (hero "Đồng hành cùng cộng đồng đổi mới sáng tạo Việt Nam"); stats line and side notes removed (18 % pixels differ) | Card title "Đăng nhập"; "Gửi liên kết đăng nhập"; divider "hoặc tiếp tục bằng email"; Google + magic link kept | Changed; terms line removed (HD-03) | **S** |
| AUTH2 `/auth/check-email` | Same | "BA CHỖ HAY THẤT LẠC" box removed; spam reminder added (17 %) | "Dùng email khác", "Mở Gmail" | "Kiểm tra hòm thư của bạn" | **S** |
| AUTH3 `/auth/callback` | Same | Layout identical (4 %) | Same states | "Đăng nhập thành công", "Liên kết không còn hiệu lực", "Gửi liên kết mới" | **XS** |
| AUTH4 `/auth/error` | Same | "Vì sao viết thế này" row removed (28 %) | 4 error rows | Rewritten; rate-limit numbers and support email dropped (PO to confirm) | **S** |
| ACC-10 `/onboarding/complete` | Onboarding shell | Re-laid (38 %) | 3 next-action cards (the 3rd, "Theo dõi xác minh chức vụ HUB", depends on HD-02, so the current card stays) | "Hồ sơ của bạn đã sẵn sàng"; percent is server-derived | **S** |
| L11 ME0 `/me/settings` (+ privacy) | Settings sidebar | One overview of cards: login, privacy / consent, notifications, organisations, danger zone | Summary rows "Đổi → / Xem →". Subset shows existing blocks only: sessions, logout all, deletion request, visibility default, consent history | New | **M** |
| L13a–c PRJ1–3 `/projects/new` | Focused wizard header | 3 steps: core info → invite team → done. Today: one form, then the team page | Radio cards "Dự án / ý tưởng" vs "Startup", stepper, invite rows, done card. Subset: existing fields and email invitation | New | **M** |
| L19 `/organizations/[slug]` | Public org nav (Giới thiệu / Sự kiện / CLB trực thuộc / Bài toán) | Hero + KPIs → leadership → CLB cards → events → partners → join band | KPI tiles, leader cards, CLB cards, event cards, "Xin vào chapter". Subset: existing public data; KPIs / leadership per HD-08 | New | **L** |
| L20 `/ops/org/:id` | Revision frame without sidebar (keep the ops shell) | KPI row → funnel → "Việc cần làm" with "Chờ HUB / Chờ chapter" chips | Subset: existing cards (members, pending requests, leadership, published events, to-do) | New | **M** |
| L23 `/ops/org/:id/events` | Same | Filter chips (Sắp diễn ra / Đã kết thúc / Bản nháp) → rows with type badge, owner, capacity, "Quản lý" | Subset: existing statuses and actions; no type / owner / capacity | New | **M** |
| L26 `/ops/org/:id/members` | 1600 ops shell, new sidebar (HD-11) | Tabs Đơn chờ duyệt / Đang hoạt động / Đã rời → inline Duyệt / Từ chối → leadership block | Subset: tabs over the existing filter, existing approve / reject; no email invite, export or handover | New | **M** |
| L54 404 / 500 | Minimal | Three state cards | Restyled 404; new 500 view (no route; fixes IA-P3-05); maintenance card omitted | New | **S** |
| B screens with a current page (not Task 22): ACC-06 / 07 / 08 / 09, L12 FP1-EDIT, L14 ORGP1, L38–L43 | — | Flow and layout changes tied to HD-02 … HD-07 | — | — | M–L each, if approved |

Screens not redrawn ([02](02_SCREEN_INVENTORY.md)) get no change beyond the shell decisions of HD-11.

## Related
- [02_SCREEN_INVENTORY.md](02_SCREEN_INVENTORY.md) · [07_TASK22_IMPLEMENTATION_ORDER.md](07_TASK22_IMPLEMENTATION_ORDER.md)
