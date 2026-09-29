# WF02 UAT Matrix

Automated in `tests/visual/specs/wf02-uat-journey.spec.ts` (Playwright, 1440×900, UI-driven, real magic-link sign-in). Rewritten for TASK 22-L1-L2-SOT-REALIGN L2 ([DEC-L2R](../decisions/DECISION_LOG.md#dec-l2r)): the business matrix A–M of the PO task replaces the journey of 2026-09-26. Local run of 2026-09-29 on the final production build: **16 / 16 PASS** (A–M and ALT-01…03). Screen-level cases stay in each WF02-S0x spec.

## Business matrix A–M
| ID | Case | Checked | Result |
|---|---|---|---|
| A | Profile | FP1-OWN after sign-in and onboarding; an education record added in the dialog (required fields refused first), shown after reload, edited through its pencil; the three completion endpoints agree | PASS |
| B | Create Project | PRJ1 names the five required fields and sends nothing; then DRAFT PROJECT, owner = the session's profile, no team row; ME7 shows "Chủ sở hữu" | PASS |
| C | Create Startup | as B for STARTUP | PASS |
| D | Duplicate | double click → one POST; the same `Idempotency-Key` again → the same id; refresh, "Quay lại", "Lưu nháp", browser Back → still one venture | PASS |
| E | Stage | Pilot stored and shown after reload; changed to "Đang bán" in the editor; ME7 shows it | PASS |
| F | Creator role | Co-founder stored and shown in the wizard, the editor and the owner row; 0 role assignments, leadership or community memberships; session capabilities `[]`; `/ops/network` 404; "Thành viên" as own role is still OWNER | PASS |
| G | E-mail invitation | PRJ2 → PENDING_CONFIRMATION with EDIT and Co-founder, no profile; the outbox message names venture, role and level, links to `/projects`, carries no token | PASS |
| H | Link invitation | NOT SUPPORTED BY CONTRACT (D-T1): "Sao chép link" is inert, pressing it sends nothing; link paths answer 404 / 405 | PASS |
| I | Accept | ME7 banner → "Chấp nhận" → ACTIVE at the invited level EDIT; `/me/ventures` MEMBER / EDIT; the member may update the venture (200) and may not invite (403) | PASS |
| J | IDOR | another member gets 404 on the venture, team and invitation APIs and pages; the venture name does not leak | PASS |
| K | Role spoof | `x-role`, `x-permission`, `x-profile-id` headers, query values and body `permission: OWNER`, `owner_profile_id`, `status` → 403 or 422; level unchanged; RBAC rows 0 | PASS |
| L | Pending invitations | only the invited address sees the invitation (case-insensitive match); owner and bystander lists empty; a bystander's accept or decline → 404 | PASS |
| M | DRAFT never public | guest: API 401, pages → `/auth`; `/`, `/library`, `/organizations/chapter-01` answer 200 without the venture's name or id; `PATCH status` → 422; `submit-for-review` 404 / 405; still DRAFT | PASS |

## Guards
| ID | Case | Result |
|---|---|---|
| ALT-01 | Guest on every WF02 route → `/auth` | PASS |
| ALT-02 | Onboarding incomplete: pages and APIs refuse | PASS |
| ALT-03 | A used magic link never signs in again | PASS |

## Earlier journey rows
The 2026-09-26 journey (HC-WF02-01…12, ALT-04…06) is retired from this file; each step keeps a screen spec:

| Old row | Now in |
|---|---|
| HC-01 home, HC-02 profile edit | `wf02-s01-account-home` (FP1-OWN), `wf02-s02-profile-edit` |
| HC-03 visibility | `wf02-s03-privacy-visibility` |
| HC-04 network roles | `wf02-s04-roles-network` |
| HC-05, 06 create; ALT-05 archived | `wf02-s05-project-startup`, B, C |
| HC-07…10 team; ALT-04, 06 | `wf02-s06-venture-team`, `wf02-s08-projects`, G, I, J |
| HC-11 sessions, HC-12 deletion | `wf02-s07-settings` |

**Not automated:** a failed provider send (`INVITATION_EMAIL_DELIVERY_FAILED`) needs a broken transport; real-inbox delivery belongs to the deployed domain.

## PO review
Copy added by L2 with no approved bitmap text (D-E1 and DEC-WF02-S05-D3 / S06-D3 still apply to the earlier strings):

| Screen | Strings |
|---|---|
| ME7 | "Nháp · chỉ đội thấy", "Đang hoạt động · chỉ đội thấy", "Lời mời này không còn hiệu lực.", "Chưa thực hiện được. Vui lòng thử lại." |
| S05 editor | "Chọn giai đoạn", "Không chọn", "Bạn có quyền Xem nên chỉ xem được hồ sơ này." |
| S06 team | "Sửa vai trò và quyền", "Quyền", "Đã gửi lời mời.", "Người được mời nhận email và xác nhận trên trang Dự án & startup của họ. Chưa xác nhận thì chưa vào đội.", the levels note |
| Invitation e-mail | subject and body built from the ME7 sentence (D-E1) |

## Related
- [WF02_COMPLETION_AUDIT.md](WF02_COMPLETION_AUDIT.md) — the audit of 2026-09-26
- [l1-l2-realign/l2-closure.md](l1-l2-realign/l2-closure.md) — L2 evidence
- [WF01_UAT_MATRIX.md](WF01_UAT_MATRIX.md) — WF01 journey
