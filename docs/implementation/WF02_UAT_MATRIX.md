# WF02 UAT Matrix

Automated in `tests/visual/specs/wf02-uat-journey.spec.ts` (Playwright, 1440×900, UI-driven, real magic-link sign-in). Runs on 2026-09-26: the dev DB, a fresh PostgreSQL (001→008 + seed), and the same fresh DB after an app + PostgreSQL restart. **7/7 PASS on each run.** Screen-level cases stay in each WF02-S0x spec.

The HC numbering below is the one given by the WF02 completion-audit authorization. It supersedes the older HC-WF02-01..07 checklist in the plan (mapping in the last column).

## Happy path — UAT-WF02-J1 (one journey, one new account + one invitee)
| ID | Case | Checked | Result | Old HC |
|---|---|---|---|---|
| HC-WF02-01 | Completed member opens account home | S08 → /me; name and server % shown; 1 profile, 0 role assignments | PASS | 01 |
| HC-WF02-02 | Member edits profile | S02 goal saved (200), avatar +10; the three completion endpoints agree; S01 shows the new % | PASS | 02 |
| HC-WF02-03 | Member changes profile visibility | S03 switch → PRIVATE, kept after reload; consent count and completion unchanged; avatar hidden to another member | PASS | 03 |
| HC-WF02-04 | Member views network roles | S04 empty state; request Chapter 02 → PENDING_APPROVAL only; no leadership, no role, capabilities []; S01 lists it | PASS | 05/06 |
| HC-WF02-05 | Member creates Project | S05 form → DRAFT PROJECT, no member row, completion unchanged | PASS | 07 |
| HC-WF02-06 | Member creates Startup | DRAFT STARTUP; rename saved; PATCH `type` → 422; `/me/network` and S04 show both as OWNER | PASS | 07 |
| HC-WF02-07 | Owner invites member | S06 form → PENDING_CONFIRMATION, `profile_id` NULL; UI states no email was sent | PASS | — |
| HC-WF02-08 | Invitee accepts | Invitee's second sign-in leaves the invitation pending; "Nhận lời mời" → ACTIVE; read-only team, no pending rows; `/me/network` MEMBER; completion unchanged; no RoleAssignment; venture PATCH 403 | PASS | — |
| HC-WF02-09 | Owner changes member role_label | "Tuỳ chọn" → "Sửa vai trò" → shown and stored | PASS | — |
| HC-WF02-10 | Owner removes member | "Gỡ khỏi đội" → REMOVED with `ended_at`, row kept; member loses the venture; team page 404 for them | PASS | — |
| HC-WF02-11 | Member manages sessions | Second session listed as "other"; revoke → that browser goes to /auth and gets API 401 at once; no token or hash in the list | PASS | — |
| HC-WF02-12 | Member requests account deletion | Confirmed request; duplicate → 200, 1 row; account, profile, avatar, memberships, leadership, ventures, team, consents and sessions unchanged; entity invariants and programme / event counts unchanged | PASS | — |

## Alternate / negative
| ID | Case | Result |
|---|---|---|
| ALT-01 | Guest on the 8 WF02 routes → /auth | PASS |
| ALT-02 | Signed in, onboarding incomplete: 8 routes → /onboarding/purpose; POST /ventures 403 | PASS |
| ALT-03 | A used magic link never signs in again | PASS |
| ALT-04 | Foreign session revoke 404 (victim still signed in); foreign venture / team / membership / accept 404; `completion_percent` write 422 | PASS |
| ALT-05 | ARCHIVED venture: PATCH 409, invite 409, edit page read-only, no invite button | PASS |
| ALT-06 | Decline from the page → REJECTED; owner cancel → REMOVED; decliner gains nothing | PASS |

**Manual remaining:** real-mailbox delivery of magic links and invitations (no provider in P0), and PO copy review.

## PO review
Strings with no approved bitmap text, pending PO copy review (DEC-WF02-S05-D3, DEC-WF02-S06-D3):

| Screen | Strings |
|---|---|
| S05 editor | "Dự án / startup mới", "Chưa lưu", "đã lưu lúc", "Chọn một lần khi tạo, không đổi được sau đó.", "Vài câu về việc dự án đang làm.", "Chọn từ danh mục HUB quản lý, không gõ tự do.", "Chọn lĩnh vực", "Chưa chọn", "Trường này là bắt buộc.", "Một mục đã chọn không còn khả dụng. Vui lòng chọn lại.", "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.", "Chưa lưu được thay đổi. Vui lòng thử lại.", "Dự án đã lưu trữ nên chỉ xem được, không sửa được.", "Chỉ chủ sở hữu mới sửa được thông tin này." |
| S06 team (owner / member) | "Tuỳ chọn", "Sửa vai trò", "Gỡ khỏi đội", "Huỷ lời mời", "Gỡ người này khỏi đội?", "Huỷ lời mời này?", "Gỡ", "Không", "Thành viên" (Quyền), "lời mời gửi dd/MM", "Mời thành viên mới", "Email người được mời", "Vai trò (không bắt buộc)", "Chỉ để hiển thị, không cấp thêm quyền.", "Hệ thống chưa gửi email mời. Hãy báo người được mời đăng nhập bằng đúng email này và mở trang đội để nhận lời mời.", "Tạo lời mời", "Đóng", "Đã tạo lời mời. Chưa có email nào được gửi.", "Email này đã có một lời mời đang chờ.", "Email chưa hợp lệ.", "Vai trò quá dài.", "Chỉ chủ sở hữu mới quản lý được đội. Bạn đang xem danh sách đội.", "Dự án đã lưu trữ nên đội chỉ xem được.", note cards "Vai trò chỉ để hiển thị" + body, "Gỡ thành viên không xoá lịch sử" + body |
| S06 recipient panel | "Lời mời tham gia đội", "Bạn được mời tham gia đội …", "Vai trò: …", "Mời ngày …", "Nhận lời mời", "Từ chối", "Bạn đã từ chối lời mời này." |

## Related
- [WF02_COMPLETION_AUDIT.md](WF02_COMPLETION_AUDIT.md) — audit and verdict
- [WF01_UAT_MATRIX.md](WF01_UAT_MATRIX.md) — WF01 journey
