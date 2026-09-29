# L6 Ecosystem Inventory

TASK 24.5 inventory for `Luồng 6 · Ecosystem Data & Matching.png` (PO, 29/09 19:27; 16440×4262, sha256 `aaa7e7e8…04be0fd`). Business SOT: [DEC-2809-D7](../../decisions/DECISION_LOG.md#dec-2809-d7), the [L6 matrix](../../design-revision/scope-refreeze/matrix-extensions.md), [DEC-PDF-D1](../../decisions/DECISION_LOG.md#dec-pdf-d1). Feature classes: [l6-ecosystem-features.md](l6-ecosystem-features.md). Decision: [DEC-L6-D1](../../decisions/DECISION_LOG.md#dec-l6-d1).

## Board identity
All nine frames are **pixel-identical** to the corrected 28/09 set (`L6.zip`, `0a2c91f8…fc56`, frames L46–L54): 0 pixels differ over 30 levels at origins x 120 + 1800·n, y 120. The board is a re-delivery, not new evidence, so the frozen classification holds (ALPHA 0 · FUTURE 9).

## Frames
| Frame (board x) | User type | Route | Data source | Search / filter | CTA | Permission | State | Implement / defer |
|---|---|---|---|---|---|---|---|---|
| L46 WS1 Phòng làm việc (120) | team, partner org, HUB | none | workroom, milestones, sandbox, jury scores, room log — none exist | none | Nộp, Ký ngay, Xác nhận, Nhận quyền truy cập dữ liệu, Xác nhận tham dự | — | FUTURE (Workspace) | DEFER |
| L47 EV1 Chi tiết sự kiện (1920) | guest, member | none | canonical Event (WF03, org-scoped); seats, waitlist, partner org, problems — none | none | Đăng ký dự, Thêm vào lịch, Xem bài toán, Xác nhận dự, Xem summit | public | FUTURE (standalone Event Detail; would reuse the canonical Event) | DEFER |
| L48 SP1-T2 Traction & Gọi vốn (3720) | guest, investor | none | traction, rounds, investors, support count — no field | none | Ủng hộ startup này, Yêu cầu xem data room | public | FUTURE (Startup tab) | DEFER |
| L49 SP1-T3 Đội ngũ (5520) | guest | none | Venture team (ProjectMember) — no public read | none | none (contacts behind consent) | public | FUTURE (Startup tab) | DEFER |
| L50 SP1-T4 Rủi ro & Đang cần (7320) | guest | none | risks, needs — no field | none | none | public | FUTURE (Startup tab) | DEFER |
| L51 SP1-T6 Tuyển dụng & FAQ (9120) | guest | none | jobs, FAQ — no entity | none | Ứng tuyển | public | FUTURE (Hiring / FAQ) | DEFER |
| L52 ADM15 Duyệt chapter & CLB mới (10920) | platform admin | none | organization proposals — none (orgs are seeded) | none | Duyệt & gán người đứng đầu, Từ chối, Trả lời người đề xuất, Lịch sử duyệt | admin | FUTURE (was B / HD-10) | DEFER |
| L53 ADM17 Danh sách tài khoản (12720) | platform admin | none | UserAccount (email, status), profile region, role assignments | name / email / organisation search; Chưa xác thực, Đang bị khoá, Tỉnh, Vai trò HUB | Xuất CSV, Mở → | admin | FUTURE (account management; was B / HD-10) | DEFER |
| L54 SYS1 Trạng thái hệ thống (14520) | anyone | Next 404 only | health / maintenance telemetry — none | none | Về Thư viện bài toán, Thử lại, Xem lịch bảo trì | public | FUTURE (System Status; HD-A9 default: no 500 view outside L54) | DEFER |

No frame is a public discovery directory or a search page. The public discovery layer that exists stays as built: `/library` (L2, DIR1, [TASK-24.1](../reports/TASK-24.1_l2-library-delta.md)) over its shipped and cached sources, and `/organizations/:slug` (L3, public projection without persons).

## Related
- [l6-ecosystem-features.md](l6-ecosystem-features.md) · [l5-startup-inventory.md](l5-startup-inventory.md) · [l4-challenge-inventory.md](l4-challenge-inventory.md)
