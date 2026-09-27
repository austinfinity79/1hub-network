# Programme Demo

**WF-TEST-05 — Programme / Challenge setup** · **DEMO / INTERNAL ALPHA**: everything stays in your browser tab; nothing is saved to the system or seen by others.

| Preconditions | Account to use | Starting URL | Expected duration | Reset required before run |
|---|---|---|---|---|
| Link for `leader@example.test` (or `ops@example.test`) | Demo operator: Chapter 01 leader | https://1hubnetwork.io.vn/ops/network → "Chương trình & Challenge" | 20 min | YES: "Đặt lại demo" → "Đặt lại" |

| Step | Actor | Action | Expected UI / result | Expected route / state | PASS / FAIL | Notes |
|---|---|---|---|---|---|---|
| 1 | Leader | Sidebar "Chương trình & Challenge" | Banner "DỮ LIỆU DEMO · INTERNAL ALPHA"; rows "Chương trình ươm tạo (demo)" (Chương trình, 01/09/2026 – 15/12/2026) and "Thử thách đổi mới (demo)" (Challenge); "Tạo mới", "Đặt lại demo" | `/demo/programmes` | ☐ PASS ☐ FAIL | |
| 2 | Leader | Open "Chương trình ươm tạo (demo)" | Detail: "Thông tin chung", "Hành trình", "Sự kiện", "Đăng ký", "Đội vận hành"; "← Danh sách · Rà soát · Sửa · Quản lý" | `/demo/programmes/<id>` | ☐ PASS ☐ FAIL | Read only |
| 3 | Leader | "← Danh sách" → "Tạo mới" → Loại "Chương trình"; Tên "Chương trình UAT <initials>"; Tóm tắt; Ngày bắt đầu / kết thúc → "Lưu" | "Đã tạo bản nháp “…”."; owner fixed to Chapter 01; opens Hành trình | `/demo/programmes/<id>/setup/journey` | ☐ PASS ☐ FAIL | Basic info |
| 4 | Leader | "Thêm giai đoạn" → Tên giai đoạn, Ngày bắt đầu, Ngày kết thúc → "Lưu giai đoạn" → "Tiếp theo" | Stage listed; next step opens | `…/setup/events` | ☐ PASS ☐ FAIL | Structure / journey |
| 5 | Leader | "Thêm sự kiện" → Tên sự kiện, Bắt đầu, Kết thúc → "Lưu sự kiện" → "Tiếp theo" | Event listed under this programme | `…/setup/registration` | ☐ PASS ☐ FAIL | Events |
| 6 | Leader | "Cấu hình đăng ký" → tick applicant types (Cá nhân / Đội / Startup) → "Thêm câu hỏi" → "Câu hỏi 1" → "Lưu cấu hình" | "Đã lưu cấu hình đăng ký." | same | ☐ PASS ☐ FAIL | Registration configuration |
| 7 | Leader | "Tiếp theo" | "Chưa có thành viên trong đội vận hành." (display only) | `…/setup/team` | ☐ PASS ☐ FAIL | Operating team |
| 8 | Leader | "Tiếp theo" | Checklist; "Sẵn sàng xuất bản"; button "Xuất bản" | `…/setup/review` | ☐ PASS ☐ FAIL | Review |
| 9 | Leader | "Xuất bản" | "Đã xuất bản “…”."; detail page with "Rà soát · Sửa · Quản lý" | `/demo/programmes/<id>` | ☐ PASS ☐ FAIL | Publish |
| 10 | Leader | Refresh; "← Danh sách" | Still published; listed with the two fixtures | `/demo/programmes` | ☐ PASS ☐ FAIL | Detail / manage |
| 11 | Leader | "Đặt lại demo" → "Đặt lại" | "Đã đặt lại dữ liệu demo."; only the two fixtures remain | `/demo/programmes` | ☐ PASS ☐ FAIL | Reset |

## Checks
| Check | Action | Expected | PASS / FAIL |
|---|---|---|---|
| Demo stays in the tab | After step 9, open a new private window as the same account | Your programme is not there | ☐ |
| Challenge variant | "Tạo mới" → Loại "Challenge"; try to publish without a problem, then add one ("Tên bài toán") | Publishing blocked until a problem exists; then publishes | ☐ |
| Member has no access | `member@` opens https://1hubnetwork.io.vn/demo/programmes | "Không tìm thấy trang" | ☐ |
| No future features | — | No application review, scoring, matching or investor tools: they are not part of Internal Alpha | — |

## Related
- [leader-operations.md](leader-operations.md) — previous · [application-demo.md](application-demo.md) — next
