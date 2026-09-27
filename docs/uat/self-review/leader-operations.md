# Leader Operations

**WF-TEST-04 — Community Leader → HUB / Chapter / CLB operations** · PRODUCTION-LIKE INTERNAL ALPHA

| Preconditions | Account to use | Starting URL | Expected duration | Reset required before run |
|---|---|---|---|---|
| Links for `leader@example.test` and `member@example.test`; optionally `ops@example.test`. Chapter 01 has 1 pending request (Demo Pending) until someone approves it | `leader@example.test` (Chapter Leader of Chapter 01) | https://1hubnetwork.io.vn/me | 25 min | NO. The approval step works once per reseed; otherwise create a request first (step 3 note) |

| Step | Actor | Action | Expected UI / result | Expected route / state | PASS / FAIL | Notes |
|---|---|---|---|---|---|---|
| 1 | Leader | "Tài khoản của tôi" → "Vận hành tổ chức" | "Tổ chức & thành viên"; the list shows **only Chapter 01**; sidebar "Danh sách tổ chức · Chương trình & Challenge · ← Tài khoản của tôi" | `/ops/network` | ☐ PASS ☐ FAIL | Leader scope |
| 2 | Leader | "Chapter 01" | "Chapter 01 · Bảng điều khiển": THÀNH VIÊN, YÊU CẦU CHỜ DUYỆT, BAN ĐIỀU HÀNH, SỰ KIỆN ĐÃ CÔNG KHAI, VIỆC CẦN LÀM; sidebar "Tổng quan · Thành viên · Hồ sơ tổ chức · Sự kiện · Quan hệ tổ chức" | `/ops/org/<id>` | ☐ PASS ☐ FAIL | |
| 3 | Leader | "Thành viên" | "Chapter 01 · N đang hoạt động · M chờ duyệt"; filters "Chờ duyệt (M)", "Ban điều hành (1)"; search | `/ops/org/<id>/members` | ☐ PASS ☐ FAIL | No pending request? Have a member send one from "Vai trò & liên kết" → "Gửi yêu cầu" |
| 4 | Leader | "Chờ duyệt" → "Mở →" on Demo Pending | Member detail "Demo Pending" with "Duyệt thành viên · Từ chối · Thêm vai trò lãnh đạo →" | `/ops/org/<id>/members/<profile>` | ☐ PASS ☐ FAIL | |
| 5 | Leader | "Duyệt thành viên" | Now "Thành viên Chapter 01 — chưa giữ vai trò lãnh đạo" | same | ☐ PASS ☐ FAIL | Membership ≠ leadership |
| 6 | Leader | (optional) "Thêm vai trò lãnh đạo →" → enter a title → save | Leadership shown separately from membership | same | ☐ PASS ☐ FAIL | Shared data: agree first |
| 7 | Leader | "Hồ sơ tổ chức" → "Chỉnh sửa" | Fields "Tên tổ chức", "Giới thiệu"; "Lưu thay đổi" / "Huỷ" | `/ops/org/<id>/profile` | ☐ PASS ☐ FAIL | Use "Huỷ" unless testing a save |
| 8 | Leader | "Quan hệ tổ chức" | "Chapter 01 · quan hệ tổ chức": VỊ TRÍ TRONG CÂY HUB, ĐANG HIỆU LỰC, ĐÃ KẾT THÚC · GIỮ LỊCH SỬ, THÊM QUAN HỆ | `/ops/org/<id>/settings` | ☐ PASS ☐ FAIL | Look only; do not end relationships |
| 9 | Leader | "Sự kiện" → "+ Tạo sự kiện" → Tên, Bắt đầu, Kết thúc, Địa điểm → "Lưu nháp" | "Đã tạo bản nháp sự kiện."; it appears under "SỰ KIỆN ĐỘC LẬP" | `/ops/org/<id>/events` | ☐ PASS ☐ FAIL | Name it "Sự kiện UAT <initials>" |
| 10 | Leader | "Công khai" | "Đã công khai sự kiện." | same | ☐ PASS ☐ FAIL | |
| 11 | Anyone | Open https://1hubnetwork.io.vn/organizations/chapter-01 | The new event is listed under "Sự kiện"; "Xin vào chapter" CTA | `/organizations/chapter-01` | ☐ PASS ☐ FAIL | Public page |

## Negative / permission checks
| Check | Actor | Action | Expected | PASS / FAIL |
|---|---|---|---|---|
| Other organization | Leader | Open https://1hubnetwork.io.vn/ops/org/10000000-0000-0000-0000-000000000102 (Chapter 02) | "Không tìm thấy trang" | ☐ |
| Member has no ops | `member@` | Open https://1hubnetwork.io.vn/ops/network | "Không tìm thấy trang"; no "Vận hành tổ chức" entry on `/me` | ☐ |
| Guest | — | Open `/ops/network` signed out | Sign-in page | ☐ |
| Admin scope (compare) | `ops@` | "Vận hành tổ chức" | Lists Chapter 01, Chapter 02, Club 01, HUB Network | ☐ |

Reset: the approval, event and any leadership stay until an operator reseed (events you created stay even then). Name your records with your initials.

## Related
- [member-profile-ventures.md](member-profile-ventures.md) — previous · [programme-demo.md](programme-demo.md) — next
