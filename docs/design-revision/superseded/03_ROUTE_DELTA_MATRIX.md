# Route Delta Matrix

> **SUPERSEDED — DO NOT IMPLEMENT.** Unfinished TASK 21 draft (paused 2026-09-28), built from the Homepage / L1–L6 ZIPs that the designer / PO has since replaced with a corrected revision. Nothing in this file is approved or frozen, and it is not a Design Revision SOT. Do not use it for Task 22. The corrected package will be audited from scratch; only the generic method in [AUDIT_METHODOLOGY.md](../AUDIT_METHODOLOGY.md) carries over.

Status: KEEP · CHANGE · ADD · REMOVE · FUTURE · CONFLICT. No route is invented. "Undefined" means the design implies a page but names no route, so any route needs a PO decision.

## Root "/" contract — PASS, no correction
| Check | Current (verified read-only on https://1hubnetwork.io.vn) | Expected | Result |
|---|---|---|---|
| Guest `GET /` | 200, public homepage (P0-LANDING); no redirect | Public homepage | KEEP |
| Signed-in `GET /` | Homepage; CTA "Vào tài khoản của tôi" (DEC-P0-LANDING-D1) | Homepage viewable | KEEP |
| `/auth`, `/onboarding/*`, `/me*`, `/ops/*` | Auth page; incomplete-onboarding guard; member area; ops with server-side scope (guest → `/auth`) | Same | KEEP |

## Screens
| Revision screen | Expected route | Current route | Auth / actor | Status | Required action |
|---|---|---|---|---|---|
| HOME-1 | `/` | `/` | public; any | KEEP | Restyle only |
| L1-1 feedback | overlay (no page) + `POST /api/v1/feedback` | none (contract only) | signed-in (SOT: always linked to an account) | ADD | Only after HD-02 |
| L2-FP1 | undefined (member profile view) | none | member viewing member | ADD (undefined) | HD-05 |
| L2-FP1E | overlay on FP1-OWN | `/me/profile/edit` | owner | KEEP | Restyle only if the host is supplied (HD-10) |
| L2-ME0 | settings | `/me/settings` + `/me/privacy` | owner | KEEP (merge = CHANGE, not proposed) | Restyle existing blocks |
| L2-ME7 | undefined ("Dự án & startup của tôi") | list inside `/me`; `/demo/projects` | owner / member | ADD (undefined) | HD-03 |
| L2-PRJ1…3 | `/projects/new` (steps in page) | `/projects/new` | onboarded member | KEEP | Steps on the same route |
| L2-ORGP1 | `/organizations/[slug]` | `/organizations/[slug]`; ops `/ops/org/:id/profile` | public / member | KEEP · CONFLICT | HD-05 (account model) |
| L2-DIR1 | undefined ("Thư viện") | none (header item inert) | public | FUTURE | — |
| L2-EV2 | undefined ("Lịch sự kiện") | none | public / member | ADD (undefined) | HD-06 |
| L2-NOTI1 | undefined | none (bell inert) | member | FUTURE | — |
| L2-EV1 | undefined (event detail) | none | public / member | ADD (undefined) | HD-06 |
| L3-S1 | `/organizations/[slug]` | same | public | KEEP | Restyle existing data |
| L3-S2 | `/ops/org/:id` | same | leader / admin (scope) | KEEP | Restyle existing cards |
| L3-S3, S4, S6, S7 | undefined | none | chapter ops | FUTURE | — |
| L3-S5 | `/ops/org/:id/events` | same | leader / admin | KEEP | Restyle existing states |
| L3-S8 | `/ops/org/:id/members` (+ `/members/:profileId`) | same | leader / admin | KEEP | Restyle; tabs via the existing filter |
| L3-S9 | undefined (handover) | none | head + successor | ADD (undefined) | HD-07 |
| L4-1…4 | undefined (public programme / problem) | none; `/demo/programmes/*` is operator-only | public / participant | FUTURE · CONFLICT | HD-08 |
| Existing WF04 demo | `/demo/programmes/*` | same | ops scope | KEEP (UNCHANGED) | None |
| L5-1…4 | undefined (submit flow against a problem) | `/demo/projects/:id/applications/:programmeId` (+ `/review`) | venture owner | CONFLICT | HD-04 |
| SP1 | undefined (public startup page) | none (ventures private; foreign id → 404) | public | FUTURE | HD-05 |
| L6-S3 | undefined (room) | none | team + organisation + HUB | FUTURE | — |
| L6-S4, S5 | undefined (HUB admin) | none | platform admin | ADD (undefined) | HD-07 |
| L6-S6 | 404 page; 500 boundary; maintenance | 404 exists; no `error.tsx` | any | KEEP (404) · ADD (500 UI) · FUTURE (maintenance) | Restyle 404; add a 500 view |

## Navigation
| Area | Current | Revision | Status |
|---|---|---|---|
| Public header | "Vấn đề · Sản phẩm · Tầm nhìn · Mạng lưới · Đăng nhập / Tham gia" | "Về HUB Network · Chương trình · Sự kiện · Mạng lưới đổi mới sáng tạo · VI \| EN · Đăng nhập · Tạo tài khoản" | CHANGE: only items with a destination are active (HD-01) |
| Member shell | Sidebar (Tổng quan … Dự án & Startup · Demo); header "Thư viện / Challenge / Sự kiện" inert | Top nav "Thư viện · Chương trình · Sự kiện · Tin tức" (varies per frame) | CHANGE (HD-09); items without screens stay inert |
| Ops shell | "Danh sách tổ chức · Tổng quan · Thành viên · Hồ sơ tổ chức · Sự kiện · Quan hệ tổ chức · Chương trình & Challenge" | "Bảng điều khiển · Summit & chiến dịch · Sự kiện · Thành viên · CLB trực thuộc · Đường riêng · Vòng loại khu vực" | CHANGE (HD-09); four items have no screen; "Hồ sơ tổ chức" and "Quan hệ tổ chức" are absent from the revision (not removed) |

## Homepage CTAs
Classes: ACTIVE_ROUTE · AUTH_REQUIRED_ROUTE · EXISTING_FEATURE · DEMO · FUTURE · NO_VALID_ROUTE · BUSINESS_DECISION_REQUIRED.

| CTA (exact label) | Class | Destination if kept |
|---|---|---|
| Đăng nhập · Tạo tài khoản · Tạo tài khoản → | ACTIVE_ROUTE | `/auth` (sign-up = the same magic link) |
| Mạng lưới đổi mới sáng tạo · Khám phá mạng lưới → (hero-3, closing) · Tìm hiểu về HUB Network → | ACTIVE_ROUTE | `/organizations/hub-network` |
| Tạo hồ sơ startup của bạn → | AUTH_REQUIRED_ROUTE · EXISTING_FEATURE | `/projects/new` (guest → `/auth` → onboarding) |
| Tham gia mạng lưới → | AUTH_REQUIRED_ROUTE | `/auth` (then "Vai trò & liên kết" to request a chapter) |
| Tạo sự kiện → | AUTH_REQUIRED_ROUTE (leader only) | `/ops/network` → events; a member gets 404 → BUSINESS_DECISION_REQUIRED |
| Triển khai chương trình → ×2 · Tạo chương trình → | DEMO (ops scope only) | `/demo/programmes`: guests and members get `/auth` / 404 → BUSINESS_DECISION_REQUIRED |
| Về HUB Network · Chương trình · Sự kiện · Xem tất cả sự kiện → · event rows → · Chi tiết → ×3 · Khám phá cơ hội · Xem bài toán liên quan → ×3 · Câu hỏi thường gặp · Kết nối hợp tác → · Trao đổi giải pháp | NO_VALID_ROUTE | none |
| Đăng bài toán → · search "Tìm kiếm chương trình, sự kiện" · Khám phá mạng lưới → (Cửa 01 Giải pháp & Startup, Cửa 02 Nhà sáng lập) · Kết nối nguồn lực → · Xem deck → · Yêu cầu truy cập → · VI \| EN | FUTURE | none (WF06, data room, i18n) |
| Truy cập ihub.ventures ↗ · global@1hub.network | BUSINESS_DECISION_REQUIRED | external site / mailto |
| Điều khoản sử dụng · Chính sách quyền riêng tư | ACTIVE_ROUTE (404 until legal text) | `/legal/…` |

## Related
- [02_SCREEN_INVENTORY.md](02_SCREEN_INVENTORY.md) — screens
- [05_BUSINESS_DELTA_CONFLICT_MATRIX.md](05_BUSINESS_DELTA_CONFLICT_MATRIX.md) — decisions HD-01…10
