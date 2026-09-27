# Screen Inventory

All 64 corrected assets (62 screens + 2 annotations). Design L1–L6 and engineering WF01–WF06 are **different systems**; the mapping is explicit in "Workflow". Status: **IMPL** implemented · **PART** partly · **NEW** none. Classification codes: UNCH unchanged · VIS visual only · LAY layout · CMP component · COPY · NAV navigation · BIZ business delta · API API/data delta · NEW screen · CONF conflict · FUT future. Actors: G guest · M member · N new account · O owner · L chapter leader · A platform admin · P participant.

| Grp | Screen ID · asset | Route (current) | Current page / component | Actor | Auth | Workflow | Status | Classification | Bucket |
|---|---|---|---|---|---|---|---|---|---|
| HOME | H1 · Homepage | `/` | `src/app/page.tsx` (P0-LANDING) | G / M | public | P0-LANDING | IMPL | LAY · CMP · COPY · NAV · BIZ (CTAs) | A |
| L1 | AUTH1 · Đăng nhập & đăng ký | `/auth` | WF01-S01 auth entry | G | public | WF01 | IMPL | LAY · COPY | A |
| L1 | AUTH2 · Kiểm tra hộp thư | `/auth/check-email` | WF01-S02 | G | public | WF01 | IMPL | LAY · COPY | A |
| L1 | AUTH3 · Kết quả bấm link | `/auth/callback` | WF01-S03 | G | token | WF01 | IMPL | COPY | A |
| L1 | AUTH4 · Lỗi & chặn | `/auth/error` | WF01-S04 | G | public | WF01 | IMPL | COPY | A |
| L1 | ACC-05 · Giới thiệu onboarding | — (flow starts at `/onboarding/purpose`) | — | N | session | WF01 | NEW | NEW · NAV · BIZ | B |
| L1 | ACC-06 · Bước 1 Thông tin cơ bản | `/onboarding/profile` (partly) | WF01-S06 | N | session | WF01 | PART | LAY · API (country, phone, email view) · BIZ | B |
| L1 | L06b · ACC-06 sau khi AI gợi ý | — | — | N | session | WF01 | NEW | API · BIZ (AI) | B |
| L1 | L06c · ACC-06 trạng thái khối AI | — | — | N | session | WF01 | NEW | API · BIZ (AI) | B |
| L1 | ACC-07 · Bước 2 Lĩnh vực & chuyên môn | `/onboarding/profile` (chips) | WF01-S06 | N | session | WF01 | PART | API · CONF (free-text skills) | B |
| L1 | ACC-08 · Bước 3 Vai trò trong hệ sinh thái | `/onboarding/purpose` (replaced) | WF01-S05 | N | session | WF01 / WF03 | PART | CONF (intent allowlist) · BIZ (HUB position claim) | B |
| L1 | ACC-09 · Bước 4 Rà soát (đề xuất) | `/onboarding/privacy` (replaced) | WF01-S07 | N | session | WF01 | PART | CONF (consent removed) · marked "CHỜ SPEC" | B |
| L1 | ACC-10 · Hoàn tất | `/onboarding/complete` | WF01-S08 | N | session | WF01 | IMPL | LAY · COPY (subset) | A |
| L1 | FP1-OWN · Hồ sơ của tôi (owner) | — (`/me` is the account overview) | — | O | member | WF02 | NEW | NEW · API · BIZ | B |
| L2 | L10 · FP1 Hồ sơ nhà sáng lập (viewer) | — | — | M | member | WF02 / WF06 | NEW | NEW · BIZ · FUT (connect, follow) | B |
| L2 | L11 · ME0 Cài đặt hồ sơ & tài khoản | `/me/settings` + `/me/privacy` | WF02-S07 + S03 | O | member | WF02 | IMPL | LAY · NAV · BIZ (new blocks) | A |
| L2 | L12 · FP1-EDIT Sửa một thẻ | `/me/profile/edit` | WF02-S02 | O | member | WF02 | PART | LAY · CMP · BIZ (org auto-link); host FP1-OWN is B | B |
| L2 | L13 · ME7 Dự án & startup của tôi | list in `/me`; `/demo/projects` | WF02-S01 list | O / M | member | WF02 | PART | NEW · API (invitation inbox, lifecycle) | B |
| L2 | L13a · PRJ1 Tạo — B1 | `/projects/new` | WF02-S05 | M | member | WF02 | IMPL | LAY · CMP · BIZ (stage, deck, AI) | A |
| L2 | L13b · PRJ2 Tạo — B2 Mời đội | invite on `/projects/:id/team` | WF02-S06 | O | member | WF02 | IMPL | LAY · BIZ (permission levels, link invite) | A |
| L2 | L13c · PRJ3 Tạo xong | after "Lưu" | WF02-S05 | O | member | WF02 | PART | NEW (UI) · COPY | A |
| L2 | L14 · ORGP1 Hồ sơ tổ chức | `/organizations/[slug]`; `/ops/org/:id/profile` | WF03-S09 / S06 | G / M | public | WF03 | IMPL | LAY · BIZ · CONF (org = shared account; 8 types) | B |
| L2 | L15 · DIR1 Thư viện — Bài toán | — ("Thư viện" inert) | — | G | public | WF06 / WF04 | NEW | FUT | C |
| L2 | L16 · EV2 Lịch sự kiện | — | — | G / M | public | WF03 events | NEW | NEW · API (read model) | B |
| L2 | L17 · NOTI1 Trung tâm thông báo | — (bell inert) | — | M | member | — | NEW | FUT | C |
| L2 | L18 · EV1 Chi tiết sự kiện | — | — | G / M | public | WF03 events | NEW | NEW · API · FUT (registration, calendar) | B |
| L2 | Cầu nối · Luồng 2 ↔ Luồng 5 | — | — | — | — | WF02 ↔ WF05 | — | ANNOTATION (PRJ1 and SUB0 = same draft record) | — |
| L3 | L19 · CHP0 Trang chapter công khai | `/organizations/[slug]` | WF03-S09 | G | public | WF03 | IMPL | LAY · CMP · BIZ (KPIs, public leadership, join form) | A |
| L3 | L20 · CHP1 Bảng điều khiển | `/ops/org/:id` | WF03-S02 | L / A | ops scope | WF03 | IMPL | LAY · API (landing views, funnel, Q&A inbox) | A |
| L3 | L21 · CHP2 Trình soạn summit | — | — | L | ops | WF04+ | NEW | FUT | C |
| L3 | L22 · CHP3 Người đăng ký | — | — | L | ops | events+ | NEW | FUT (registration, CSV, email) | C |
| L3 | L23 · CHP4 Sự kiện của chapter | `/ops/org/:id/events` | WF03-S07 | L / A | ops | WF03 | IMPL | LAY · CMP · BIZ (type, owner, capacity) | A |
| L3 | L24 · CHP5 Vòng loại khu vực | — | — | L | ops | WF04+ | NEW | FUT (judging) | C |
| L3 | L25 · CHP6 Gửi mail chiến dịch | — | — | L | ops | — | NEW | FUT (email provider) | C |
| L3 | L26 · CHP7 Thành viên & duyệt | `/ops/org/:id/members` (+ detail) | WF03-S03 / S04 | L / A | ops | WF03 | IMPL | LAY · NAV · BIZ (email invite, export) | A |
| L3 | L27 · CHP8 Chuyển giao người đứng đầu | — | — | L | ops | WF03 | NEW | NEW · BIZ (2-signature handover) | B |
| L4 | L28 · CH1 Chi tiết challenge | — (`/demo/programmes/:id` is operator-only) | WF04 demo data | G | public | WF04 | NEW | BIZ · CONF (demo = tab session) | B |
| L4 | L29 · P1 Đề bài | — | — | G | public | WF04+ | NEW | FUT (problem entity) | C |
| L4 | L30 · P1-T2 Quyền lợi | — | — | G | public | WF04+ | NEW | FUT | C |
| L4 | L31 · P1-T3 Đơn vị | — | — | G | public | WF04+ | NEW | FUT | C |
| L4 | L32 · P1-T4 Hỏi – đáp | — | — | G / P | public | WF04+ | NEW | FUT | C |
| L4 | L33 · P1-T5 Cập nhật | — | — | G | public | WF04+ | NEW | FUT | C |
| L4 | L34 · P1-T6 Đội đã nộp | — | — | G | public | WF04+ | NEW | FUT | C |
| L4 | L35 · CS1 Landing chapter summit | — | — | G | public | WF04+ | NEW | FUT | C |
| L4 | L36 · CS2 Form đăng ký summit | — | — | P | member | WF04+ | NEW | FUT (EventRegistration) | C |
| L5 | L37 · SUB0 Tạo nhanh hồ sơ đội | — | — | P | member | WF05 | NEW | CONF · BIZ | B |
| L5 | L38 · SUB1-B1 Hiểu đề | `/demo/projects/:id/applications/:programmeId` | WF05-S03 | O | member | WF05 | PART | CONF (schema, target, persistence) | B |
| L5 | L39 · SUB1-B2 Cách giải | same | WF05-S03 | O | member | WF05 | PART | CONF · API (uploads) | B |
| L5 | L40 · SUB1-B3 Đội & kế hoạch | same | WF05-S03 | O | member | WF05 | PART | CONF | B |
| L5 | L41 · SUB1-B4 Cần hỗ trợ gì | same | WF05-S03 | O | member | WF05 | PART | CONF | B |
| L5 | L42 · SUB2 Soát trước khi nộp | `…/review` | WF05-S04 | O | member | WF05 | PART | CONF (edit after submit) | B |
| L5 | L43 · SUB3 Nộp thành công | "Đã nộp" state | WF05-S04 | O | member | WF05 | PART | BIZ (code, emails) | B |
| L5 | L44 · SP1 tab Bài toán & Cách giải | — (ventures private) | — | G | public | WF05 / WF06 | NEW | FUT | C |
| L5 | L45 · SP1-T5 Tiến trình | — | — | G | public | WF05 / WF06 | NEW | FUT | C |
| L5 | Lối vào khác · PRJ1 (Luồng 2) | — | — | — | — | WF02 → WF05 | — | ANNOTATION | — |
| L6 | L46 · WS1 Phòng làm việc | — | — | team / org / HUB | member | — | NEW | FUT (new product scope) | C |
| L6 | L47 · EV1 Chi tiết sự kiện (partner) | same concept as L18 | — | G / M | public | WF03 events | NEW | NEW · API · FUT (waitlist, calendar) | B |
| L6 | L48 · SP1-T2 Traction & Gọi vốn | — | — | G | public | WF06 | NEW | FUT · API (no fields) | C |
| L6 | L49 · SP1-T3 Đội ngũ | — | — | G | public | WF05 / WF06 | NEW | FUT | C |
| L6 | L50 · SP1-T4 Rủi ro & Đang cần | — | — | G | public | WF06 | NEW | FUT | C |
| L6 | L51 · SP1-T6 Tuyển dụng & FAQ | — | — | G | public | WF06 | NEW | FUT | C |
| L6 | L52 · ADM15 Duyệt chapter & CLB mới | — (orgs are seeded) | — | A | admin | WF03 | NEW | NEW · BIZ (admin capability) | B |
| L6 | L53 · ADM17 Danh sách tài khoản | — | — | A | admin | ops | NEW | NEW · API (account states) | B |
| L6 | L54 · SYS1 Trạng thái hệ thống | Next 404; no `error.tsx`; no maintenance | shell | any | public | shell | PART | VIS · LAY (404 / 500) · FUT (maintenance) | A |

**Not redrawn (UNCHANGED):** WF02-S01 `/me`, WF02-S04 roles, WF03-S01 organisation list, WF03-S04 member detail, WF03-S08 relationships, the whole WF04 operator demo (9 screens), and WF05-S01 / S02.

## Related
- [01_CORRECTED_ASSET_INVENTORY.md](01_CORRECTED_ASSET_INVENTORY.md) — files and hashes
- [03_ROUTE_DELTA_MATRIX.md](03_ROUTE_DELTA_MATRIX.md) · [06_SCOPE_BUCKETS.md](06_SCOPE_BUCKETS.md)
