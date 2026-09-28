# Member Profile Ventures

| Field | Value |
|---|---|
| Flow ID | **FLOW 3 · WF-TEST-03** — Member → profile / account → Project / Startup → team |
| Purpose | Core WF02: profile view / edit, roles, privacy, settings and sessions, Project / Startup create and edit, team, canonical venture |
| Classification | **PRODUCTION** |
| Actor | C Member (owner, D); new invitee (becomes E); I `pending@` (unrelated) |
| Account | `member@example.test`; `<name>-mate-<nn>@example.test`; `pending@example.test` |
| Precondition | Operator links for the three accounts, each in its own private window |
| Starting URL | https://1hubnetwork.io.vn/me |
| Time | 25 min |

**Create journey on the deployed release:** "+ Tạo dự án / startup" opens **one form**: Loại, Tên, Tóm tắt, Lĩnh vực, Tỉnh / Thành phố, then "Lưu". The venture editor opens next, and the team is a separate page. The 3-step wizard exists only in the repository (TASK 22.3) and is **not deployed**.

## Steps
| # | Actor | Action | Expected result | Route |
|---|---|---|---|---|
| 1 | Member | Open "Tài khoản của tôi" | Sidebar "Tổng quan · Hồ sơ cá nhân · Quyền riêng tư & hiển thị · Cài đặt tài khoản · Vai trò & liên kết · Dự án & Startup · Demo"; "Hồ sơ hoàn thiện …%"; "Demo Startup · Chủ sở hữu"; "TỔ CHỨC CỦA TÔI": Chapter 01 · Thành viên | `/me` |
| 2 | Member | "Sửa hồ sơ" → change "Chức danh" → "Lưu" | "… đã lưu lúc HH:MM" | `/me/profile/edit` |
| 3 | Member | "← Tài khoản của tôi", then "Sửa hồ sơ" again; refresh | The new title is still there (restore it afterwards) | same |
| 4 | Member | "Vai trò & liên kết" | "VAI TRÒ THEO TỔ CHỨC" (Chapter 01, member) and "YÊU CẦU THAM GIA TỔ CHỨC" | `/me/roles` |
| 5 | Member | "Quyền riêng tư & hiển thị" (look only), then "Cài đặt tài khoản" | Privacy: switch + current terms + consent history. Settings: "ĐĂNG NHẬP", "PHIÊN ĐĂNG NHẬP" (this session "Hiện tại"), "VÙNG NGUY HIỂM" | `/me/privacy`, `/me/settings` |
| 6 | Member | "Tổng quan" → "+ Tạo dự án / startup" → Loại "Dự án", Tên "Dự án UAT <initials> <dd/mm>", Tóm tắt, optional Tỉnh / Lĩnh vực → "Lưu" | The new venture's editor opens | `/projects/<id>/edit` |
| 7 | Member | "Đội ngũ" → "Mời thành viên" → the invitee's email, role "CTO" → "Tạo lời mời" | "Đã tạo lời mời. Chưa có email nào được gửi."; the row is pending. Copy this page address | `/projects/<id>/team` |
| 8 | Invitee | Sign in with its link, finish onboarding (as in Flow 2), open the copied address | "… · Thành viên đội" with "Nhận lời mời · Từ chối" | same |
| 9 | Invitee | "Nhận lời mời" | The invitee is an ACTIVE team member (actor E) | same |
| 10 | Invitee | "Hồ sơ dự án" | Read only: "Chỉ chủ sở hữu mới sửa được thông tin này." | `/projects/<id>/edit` |
| 11 | Member | Back on "Đội ngũ"; refresh | The invitee is listed as a member | `/projects/<id>/team` |
| 12 | Member | "Tổng quan" | The new PROJECT is in the venture list, once | `/me` |

## Negative checks
| Actor | Action | Expected |
|---|---|---|
| `pending@` | Open the team address from step 7 | "Không tìm thấy trang" |
| `pending@` | Open the ready-made Demo Startup link https://1hubnetwork.io.vn/projects/50000000-0000-0000-0000-000000000001/edit | "Không tìm thấy trang" |
| `leader@` | Open https://1hubnetwork.io.vn/projects/50000000-0000-0000-0000-000000000001/team | Only "Nhận lời mời · Từ chối" (pending invite, actor F): **do not click** |
| Invitee | Try to change a field on "Hồ sơ dự án" | Not editable |

## Reset procedure
None needed. Your PROJECT and invitee stay and are reused in Flow 6. Restore the title changed in step 2. Never rename or change Demo Startup. Do not click "Yêu cầu xoá tài khoản".

## PASS criteria
Profile edits persist after refresh; roles and privacy read correctly; exactly one venture per "Lưu"; the invitation needs acceptance before membership; a member reads but cannot edit; unrelated users get "Không tìm thấy trang".

## Known Internal Alpha limitation
Invitations send no email: the owner shares the team page address by hand. There is no venture archive action. Member pages may scroll sideways on phones (desktop-first shell).

## Related
- [new-member-onboarding.md](new-member-onboarding.md) — previous · [leader-operations.md](leader-operations.md) — next
