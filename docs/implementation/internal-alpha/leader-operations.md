# Leader Operations

| Field | Value |
|---|---|
| Flow ID | **FLOW 4 · WF-TEST-04** — Community Leader → HUB / Chapter / CLB operations |
| Purpose | WF03: organisation selection, dashboard, members, membership review, leadership, profile, relationships, events, public page, scope isolation |
| Classification | **PRODUCTION** |
| Actor | G Community Leader; C Member (negative); H Platform Admin (compare) |
| Account | `leader@example.test`; `member@example.test`; optionally `ops@example.test` |
| Precondition | Operator links. Chapter 01 has 1 pending request (Demo Pending) until someone approves it |
| Starting URL | https://1hubnetwork.io.vn/me → "Vận hành tổ chức" |
| Time | 25 min |

## Steps
| # | Action (as Leader) | Expected result | Route |
|---|---|---|---|
| 1 | "Tài khoản của tôi" → "Vận hành tổ chức" | "Tổ chức & thành viên" lists **only Chapter 01**; sidebar "Danh sách tổ chức · Chương trình & Challenge · ← Tài khoản của tôi" | `/ops/network` |
| 2 | "Chapter 01" | "Chapter 01 · Bảng điều khiển": THÀNH VIÊN, YÊU CẦU CHỜ DUYỆT, BAN ĐIỀU HÀNH, SỰ KIỆN ĐÃ CÔNG KHAI, VIỆC CẦN LÀM | `/ops/org/<id>` |
| 3 | "Thành viên" | "Chapter 01 · N đang hoạt động · M chờ duyệt"; filters "Chờ duyệt", "Ban điều hành"; search | `/ops/org/<id>/members` |
| 4 | "Chờ duyệt" → "Mở →" on Demo Pending | "Demo Pending" with "Duyệt thành viên · Từ chối · Thêm vai trò lãnh đạo →" | `…/members/<profile>` |
| 5 | "Duyệt thành viên" | "Thành viên Chapter 01 — chưa giữ vai trò lãnh đạo" (membership ≠ leadership) | same |
| 6 | (optional, agree first) "Thêm vai trò lãnh đạo →" → a title → save | Leadership shown separately from membership | same |
| 7 | "Hồ sơ tổ chức" → "Chỉnh sửa" | "Tên tổ chức", "Giới thiệu"; "Lưu thay đổi" / "Huỷ" (use "Huỷ") | `…/profile` |
| 8 | "Quan hệ tổ chức" (look only) | VỊ TRÍ TRONG CÂY HUB, ĐANG HIỆU LỰC, ĐÃ KẾT THÚC · GIỮ LỊCH SỬ, THÊM QUAN HỆ | `…/settings` |
| 9 | "Sự kiện" → "+ Tạo sự kiện" → Tên "Sự kiện UAT <initials>", Bắt đầu, Kết thúc, Địa điểm → "Lưu nháp" | "Đã tạo bản nháp sự kiện."; listed under "SỰ KIỆN ĐỘC LẬP" | `…/events` |
| 10 | "Công khai" | "Đã công khai sự kiện." | same |
| 11 | Anyone: open https://1hubnetwork.io.vn/organizations/chapter-01 | The new event is listed next to "Demo Event"; "Xin vào chapter" | `/organizations/chapter-01` |

No pending request left (already approved)? Have a member send one from "Vai trò & liên kết" first.

## Negative checks (scope isolation)
| Actor | Action | Expected |
|---|---|---|
| Leader | Open the ready-made Chapter 02 link https://1hubnetwork.io.vn/ops/org/10000000-0000-0000-0000-000000000102 | "Không tìm thấy trang": no access outside the granted organisation |
| `member@` | Open https://1hubnetwork.io.vn/ops/network | "Không tìm thấy trang"; no "Vận hành tổ chức" on `/me` |
| Guest | Open `/ops/network` signed out | The sign-in page |
| `ops@` (compare) | "Vận hành tổ chức" | Lists HUB Network, Chapter 01, Chapter 02, Club 01 |

## Reset procedure
The approval, the event and any leadership stay until an operator reseed; events you created stay even after it. Name records with your initials.

## PASS criteria
The leader sees and changes only Chapter 01; membership and leadership stay separate; a published event appears on the public page; the member, the guest and Chapter 02 access are denied; the admin sees every organisation.

## Known Internal Alpha limitation
The approval works once per reseed. Ops pages are desktop-first (sideways scroll on phones). No email or notification is sent to the approved member.

## Related
- [member-profile-ventures.md](member-profile-ventures.md) — previous · [programme-demo.md](programme-demo.md) — next
