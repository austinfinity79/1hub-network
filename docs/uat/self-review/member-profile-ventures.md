# Member Profile Ventures

**WF-TEST-03 — Member → profile / account → Project / Startup → team** · PRODUCTION-LIKE INTERNAL ALPHA

| Preconditions | Account to use | Starting URL | Expected duration | Reset required before run |
|---|---|---|---|---|
| Links for `member@example.test`, `pending@example.test`, and a new invitee address `<name>-mate-<nn>@example.test` | Member (owner); invitee; `pending@` (unrelated) | https://1hubnetwork.io.vn/me | 25 min | NO |

| Step | Actor | Action | Expected UI / result | Expected route / state | PASS / FAIL | Notes |
|---|---|---|---|---|---|---|
| 1 | Member | Open "Tài khoản của tôi" | Sidebar: Tổng quan · Hồ sơ cá nhân · Quyền riêng tư & hiển thị · Cài đặt tài khoản · Vai trò & liên kết · Dự án & Startup · Demo. "Hồ sơ hoàn thiện …%"; "Demo Startup · Chủ sở hữu"; "TỔ CHỨC CỦA TÔI": Chapter 01 · Thành viên | `/me` | ☐ PASS ☐ FAIL | |
| 2 | Member | "Sửa hồ sơ" → change "Chức danh" → "Lưu" | "… đã lưu lúc HH:MM" | `/me/profile/edit` | ☐ PASS ☐ FAIL | Restore it afterwards |
| 3 | Member | "← Tài khoản của tôi", then "Sửa hồ sơ" again (and refresh) | The new title is still there | `/me/profile/edit` | ☐ PASS ☐ FAIL | |
| 4 | Member | Sidebar "Vai trò & liên kết" | "VAI TRÒ THEO TỔ CHỨC" (Chapter 01, member) and "YÊU CẦU THAM GIA TỔ CHỨC" ("Gửi yêu cầu") | `/me/roles` | ☐ PASS ☐ FAIL | Membership ≠ leadership |
| 5 | Member | Sidebar "Cài đặt tài khoản" | "ĐĂNG NHẬP", "PHIÊN ĐĂNG NHẬP", "VÙNG NGUY HIỂM" | `/me/settings` | ☐ PASS ☐ FAIL | **Do not** click "Yêu cầu xoá tài khoản" |
| 6 | Member | "Tổng quan" → "+ Tạo dự án / startup" → Loại "Dự án", Tên "Dự án UAT <initials> <dd/mm>", Tóm tắt, optional "Tỉnh / Thành phố" and "Chọn lĩnh vực" → "Lưu" | The new venture's editor opens | `/projects/<id>/edit` | ☐ PASS ☐ FAIL | Your PROJECT (actor D) |
| 7 | Member | "Đội ngũ" → "Mời thành viên" → email `<name>-mate-<nn>@example.test`, role "CTO" → "Tạo lời mời" | "Đã tạo lời mời. Chưa có email nào được gửi."; the row shows as pending | `/projects/<id>/team` | ☐ PASS ☐ FAIL | Copy this page address for the invitee |
| 8 | Invitee | Open the invitee's link, finish onboarding (as in WF-TEST-02), then open the copied team address | "Demo … · Thành viên đội" with "Nhận lời mời · Từ chối" | `/projects/<id>/team` | ☐ PASS ☐ FAIL | No in-app notice; the address is shared by hand |
| 9 | Invitee | "Nhận lời mời" | The invitee is now an ACTIVE team member | `/projects/<id>/team` | ☐ PASS ☐ FAIL | Actor E |
| 10 | Invitee | "Hồ sơ dự án" | Read-only: "Chỉ chủ sở hữu mới sửa được thông tin này." | `/projects/<id>/edit` | ☐ PASS ☐ FAIL | |
| 11 | Member | Back on "Đội ngũ" | The invitee is now listed as a member | `/projects/<id>/team` | ☐ PASS ☐ FAIL | Same data in both views |
| 12 | Member | "Tổng quan" | The new PROJECT appears in the venture list | `/me` | ☐ PASS ☐ FAIL | |

## Negative / permission checks
| Check | Actor | Action | Expected | PASS / FAIL |
|---|---|---|---|---|
| Unrelated member | `pending@` | Open the team address from step 7 | "Không tìm thấy trang" | ☐ |
| Unrelated member | `pending@` | Open https://1hubnetwork.io.vn/projects/50000000-0000-0000-0000-000000000001/edit (Demo Startup) | "Không tìm thấy trang" | ☐ |
| Pending invitee (seed) | `leader@` | Open https://1hubnetwork.io.vn/projects/50000000-0000-0000-0000-000000000001/team | "Nhận lời mời · Từ chối" only; **do not click** (shared seed) | ☐ |
| Non-owner edit | Invitee | Try to change a field on "Hồ sơ dự án" | Not editable | ☐ |

Reset: none needed. Your PROJECT and the invitee stay and are reused in WF-TEST-06. Do not rename or change Demo Startup.

## Related
- [new-member-onboarding.md](new-member-onboarding.md) — previous · [leader-operations.md](leader-operations.md) — next
