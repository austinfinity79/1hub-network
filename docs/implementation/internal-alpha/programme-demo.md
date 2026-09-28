# Programme Demo

| Field | Value |
|---|---|
| Flow ID | **FLOW 5 · WF-TEST-05** — Programme / Challenge setup |
| Purpose | WF04 demo: list, create / basic info, journey, events, registration, operating team, review, publish, detail / manage, reset |
| Classification | **DEMO / INTERNAL ALPHA**: state lives only in this browser tab; nothing is saved to the system or seen by anyone else |
| Actor | G Community Leader (or H Platform Admin) |
| Account | `leader@example.test` (or `ops@example.test`) |
| Precondition | Operator link; start from a clean demo (reset B) |
| Starting URL | https://1hubnetwork.io.vn/ops/network → sidebar "Chương trình & Challenge" |
| Time | 20 min |

## Steps
| # | Action | Expected result | Route |
|---|---|---|---|
| 1 | Sidebar "Chương trình & Challenge" | Banner "DỮ LIỆU DEMO · INTERNAL ALPHA"; "Chương trình ươm tạo (demo)" (Chương trình, 01/09/2026 – 15/12/2026) and "Thử thách đổi mới (demo)" (Challenge); "Tạo mới", "Đặt lại demo" | `/demo/programmes` |
| 2 | Open "Chương trình ươm tạo (demo)" | "Thông tin chung", "Hành trình", "Sự kiện", "Đăng ký", "Đội vận hành"; "← Danh sách · Rà soát · Sửa · Quản lý" | `/demo/programmes/<id>` |
| 3 | "← Danh sách" → "Tạo mới" → Loại "Chương trình", Tên "Chương trình UAT <initials>", Tóm tắt, Ngày bắt đầu / kết thúc → "Lưu" | "Đã tạo bản nháp “…”."; owner fixed to Chapter 01; "Hành trình" opens | `…/setup/journey` |
| 4 | "Thêm giai đoạn" → Tên, Ngày bắt đầu, Ngày kết thúc → "Lưu giai đoạn" → "Tiếp theo" | Stage listed; next step opens | `…/setup/events` |
| 5 | "Thêm sự kiện" → Tên, Bắt đầu, Kết thúc → "Lưu sự kiện" → "Tiếp theo" | Event listed under this programme | `…/setup/registration` |
| 6 | "Cấu hình đăng ký" → tick Cá nhân / Đội / Startup → "Thêm câu hỏi" → "Câu hỏi 1" → "Lưu cấu hình" | "Đã lưu cấu hình đăng ký." | same |
| 7 | "Tiếp theo" | "Chưa có thành viên trong đội vận hành." (display only) | `…/setup/team` |
| 8 | "Tiếp theo" | Checklist, "Sẵn sàng xuất bản", "Xuất bản" | `…/setup/review` |
| 9 | "Xuất bản" | "Đã xuất bản “…”."; detail with "Rà soát · Sửa · Quản lý" | `/demo/programmes/<id>` |
| 10 | Refresh; "← Danh sách" | Still published; listed with the two built-in records | `/demo/programmes` |
| 11 | "Đặt lại demo" → "Đặt lại" | "Đã đặt lại dữ liệu demo."; only the two built-in records remain | `/demo/programmes` |

## Negative checks
| Check | Action | Expected |
|---|---|---|
| Stays in the tab | After step 9, open a new private window as the same account | Your programme is not there |
| Challenge rule | "Tạo mới" → Loại "Challenge"; try to publish with no problem, then add one ("Tên bài toán") | Publishing is blocked until a problem exists |
| Member has no access | `member@` opens https://1hubnetwork.io.vn/demo/programmes | "Không tìm thấy trang" |

## Reset procedure
Reset B: "Đặt lại demo" → "Đặt lại" (step 11), or close the private window (reset A). Nothing persistent is touched.

## PASS criteria
Every setup step saves in the tab; publish needs a complete setup; refresh keeps the tab state; reset returns exactly the two built-in records; a member cannot open the demo.

## Known Internal Alpha limitation
**DEMO**: not stored in the database, not visible to other testers, not sent anywhere. No application review, scoring, matching or investor tools (FUTURE).

## Related
- [leader-operations.md](leader-operations.md) — previous · [application-demo.md](application-demo.md) — next
