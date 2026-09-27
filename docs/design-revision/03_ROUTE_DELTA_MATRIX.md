# Route Delta Matrix

Actions: KEEP · CHANGE · ADD · REMOVE · FUTURE · HUMAN_DECISION. No route is invented: a new page without an approved route is HUMAN_DECISION (HD-xx in [05](05_BUSINESS_API_DATA_CONFLICT_MATRIX.md)).

## Root "/" — PASS, no correction
| Check (read-only on https://1hubnetwork.io.vn, 2026-09-28) | Result | Contract | Action |
|---|---|---|---|
| Guest `GET /` | 200, public homepage (h1 "Một hồ sơ gốc cho mỗi người, mỗi dự án, mỗi tổ chức"), no redirect | Public homepage | KEEP |
| Signed-in `GET /` | Homepage with "Vào tài khoản của tôi" (DEC-P0-LANDING-D1) | Viewable | KEEP |
| Guest `/me`, `/onboarding/purpose`, `/ops/network` | 307 → `/auth` | Protected | KEEP |

## Screens
| Screen(s) | Expected route | Current route | Actor / auth | Current status | Action |
|---|---|---|---|---|---|
| H1 Homepage | `/` | `/` | any / public | IMPL | KEEP (restyle) |
| AUTH1–AUTH4 | `/auth`, `/auth/check-email`, `/auth/callback`, `/auth/error` | same | guest / public, token | IMPL | KEEP |
| ACC-05 intro | none defined | — | new account | NEW | HUMAN_DECISION (HD-02) |
| ACC-06 (+ L06b, L06c), ACC-07 | onboarding step routes | `/onboarding/profile` | new account | PART | HUMAN_DECISION (HD-02, HD-04, HD-05) |
| ACC-08 | onboarding step | `/onboarding/purpose` (intent) | new account | PART | HUMAN_DECISION (HD-02) |
| ACC-09 | onboarding step | `/onboarding/privacy` (consent) | new account | PART | HUMAN_DECISION (HD-02, HD-03) |
| ACC-10 | `/onboarding/complete` | same | new account | IMPL | KEEP |
| FP1-OWN | none defined (owner profile view) | — (`/me` = account overview) | owner | NEW | HUMAN_DECISION (HD-05) |
| L10 FP1 | none defined (member profile view) | — | member | NEW | HUMAN_DECISION (HD-08) |
| L11 ME0 | `/me/settings` (+ `/me/privacy`) | same | owner | IMPL | KEEP (merging pages = CHANGE, not proposed) |
| L12 FP1-EDIT | overlay on FP1-OWN | `/me/profile/edit` | owner | PART | HUMAN_DECISION (HD-05) |
| L13 ME7 | none defined | list in `/me`; `/demo/projects` | owner / member | PART | HUMAN_DECISION (HD-06) |
| L13a–c PRJ1–3 | `/projects/new` (steps in page) | `/projects/new` | onboarded member | IMPL | KEEP |
| L14 ORGP1 | `/organizations/[slug]` | same; ops `/ops/org/:id/profile` | public / member | IMPL | HUMAN_DECISION (HD-08) |
| L15 DIR1 · L17 NOTI1 | none | — (inert items) | public / member | NEW | FUTURE |
| **EV1 = L18 + L47** | **one canonical event page** (route to be approved) | — | public / member | NEW | HUMAN_DECISION (HD-09): one route for both frames; L47 is the external-partner variant |
| L16 EV2 | none defined (calendar) | — | public / member | NEW | HUMAN_DECISION (HD-09) |
| L19 CHP0 | `/organizations/[slug]` | same | public | IMPL | KEEP |
| L20 CHP1 · L23 CHP4 · L26 CHP7 | `/ops/org/:id`, `/ops/org/:id/events`, `/ops/org/:id/members` | same | leader / admin (server scope) | IMPL | KEEP |
| L21 · L22 · L24 · L25 | none | — | chapter ops | NEW | FUTURE |
| L27 CHP8 | none defined | — | head + successor | NEW | HUMAN_DECISION (HD-10) |
| L28 CH1 | none defined (public challenge) | — (`/demo/programmes/:id` is operator-only) | public | NEW | HUMAN_DECISION (HD-10) |
| **P1 = L29–L34** | one problem page with 6 tabs | — | public | NEW | FUTURE |
| L35 CS1 · L36 CS2 | none | — | public / participant | NEW | FUTURE |
| Existing WF04 operator demo | `/demo/programmes/*` | same | ops scope | IMPL | KEEP (UNCHANGED) |
| L37 SUB0 · L38–L43 SUB1–SUB3 | submission against a problem | `/demo/projects/:id/applications/:programmeId` (+ `/review`) | venture owner | PART | HUMAN_DECISION (HD-06, HD-07) |
| **SP1 = L44, L45, L48–L51** | one public startup page with 6 tabs | — (ventures private; foreign id → 404) | public | NEW | FUTURE |
| L46 WS1 | none | — | team / org / HUB | NEW | FUTURE |
| L52 ADM15 · L53 ADM17 | none defined (platform admin) | — | platform admin | NEW | HUMAN_DECISION (HD-10) |
| L54 SYS1 | 404 page; 500 error view; maintenance | Next 404 exists; no `error.tsx` | any | PART | KEEP (404) · ADD (500 view, no route) · FUTURE (maintenance) |

**Duplicate concepts:**
- **EV1 (L18 + L47):** one page, one route.
- **SP1 (L44, L45, L48–L51):** one page; tabs are anchors or query state, not separate routes.
- **P1 (L29–L34):** one page with tabs.
- **ACC-06 (+ L06b, L06c):** states of one step.
- **"Góp ý" floating button:** a component on every frame. The corrected set draws no feedback flow for it (HD-11).

## Navigation
| Area | Current | Corrected design | Action |
|---|---|---|---|
| Public header | Vấn đề · Sản phẩm · Tầm nhìn · Mạng lưới · Đăng nhập / Tham gia | Về HUB Network · Chương trình · Sự kiện · Mạng lưới đổi mới sáng tạo · VI \| EN · Đăng nhập · Tạo tài khoản | CHANGE: active only where a destination exists (HD-01) |
| Member shell | Sidebar + inert header items (Thư viện / Challenge / Sự kiện) | Top nav Thư viện · Chương trình · Sự kiện · Tin tức, VN·EN | CHANGE (HD-11); items without screens stay inert |
| Ops shell | Danh sách tổ chức · Tổng quan · Thành viên · Hồ sơ tổ chức · Sự kiện · Quan hệ tổ chức · Chương trình & Challenge | QUẢN TRỊ CHAPTER: Bảng điều khiển · Summit & chiến dịch · Sự kiện · Thành viên · CLB trực thuộc · Đường riêng · Vòng loại khu vực | CHANGE (HD-11); 4 items without screens; nothing removed |

## Homepage CTAs (image byte-identical to the superseded one; classes re-derived)
| CTA (exact label) | Class | Destination |
|---|---|---|
| Đăng nhập · Tạo tài khoản (header and one-profile block) | ACTIVE_EXISTING | `/auth` (sign-up = the same link) |
| Mạng lưới đổi mới sáng tạo · Khám phá mạng lưới → (block 03, closing) · Tìm hiểu về HUB Network → | ACTIVE_EXISTING | `/organizations/hub-network` |
| Tạo hồ sơ startup của bạn → | AUTH_REQUIRED · EXISTING_FEATURE | `/projects/new` via `/auth` + onboarding |
| Tham gia mạng lưới → | AUTH_REQUIRED | `/auth`, then chapter request in "Vai trò & liên kết" |
| Triển khai chương trình → ×2 · Tạo chương trình → | DEMO (ops scope) · BUSINESS_DECISION_REQUIRED | `/demo/programmes` (guest → `/auth`, member → 404) |
| Tạo sự kiện → | AUTH_REQUIRED (leader only) · BUSINESS_DECISION_REQUIRED | ops events |
| Về HUB Network · Chương trình · Sự kiện · Xem tất cả sự kiện → · event rows → · Chi tiết → ×3 · Khám phá cơ hội · Xem bài toán liên quan → ×3 · Câu hỏi thường gặp · Kết nối hợp tác → · Trao đổi giải pháp | NO_VALID_ROUTE | — |
| Đăng bài toán → · search "Tìm kiếm chương trình, sự kiện" · Khám phá mạng lưới → (Cửa 01 Giải pháp & Startup, Cửa 02 Nhà sáng lập) · Kết nối nguồn lực → · Xem deck → · Yêu cầu truy cập → · VI \| EN | FUTURE | — |
| Truy cập ihub.ventures ↗ · global@1hub.network | BUSINESS_DECISION_REQUIRED | external / mailto |
| Điều khoản sử dụng · Chính sách quyền riêng tư | ACTIVE_EXISTING (404 until legal text) | `/legal/…` |

## Related
- [02_SCREEN_INVENTORY.md](02_SCREEN_INVENTORY.md) · [05_BUSINESS_API_DATA_CONFLICT_MATRIX.md](05_BUSINESS_API_DATA_CONFLICT_MATRIX.md)
