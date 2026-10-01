# New Member Onboarding

| Field | Value |
|---|---|
| Flow ID | **FLOW 2 · WF-TEST-02** — New member → onboarding → member home |
| Purpose | WF01 end to end: sign-in, onboarding, profile basics, controlled lists, consent, visibility, completion, member shell |
| Classification | **PRODUCTION** |
| Actor | B New member |
| Account | Your own **new** address `<name>-new-<nn>@example.test` (or `newcomer@example.test`, first run only) |
| Precondition | An operator link for that address; one address per run |
| Starting URL | The operator link (opens `/onboarding/purpose`) |
| Time | 15 min |

## Steps
| # | Action | Expected result | Route |
|---|---|---|---|
| 1 | Open the link (private window) | "Bạn đến HUB để làm gì?" with 4 choices ("Tôi có giải pháp và muốn nộp cho bài toán", "Đơn vị tôi có bài toán cần giải", "Tôi tổ chức cộng đồng ở địa phương", "Tôi chỉ muốn xem trước đã"); "Tiếp tục", "Bỏ qua, làm sau" | `/onboarding/purpose` |
| 2 | Pick one → "Tiếp tục" | "Bạn là ai" (step 2) | `/onboarding/profile` |
| 3 | "Tiếp tục" with everything empty | "Vui lòng nhập họ và tên."; stays on step 2 | same |
| 4 | Fill "Họ và tên", "Chức danh hiện tại"; choose "Tỉnh / thành phố" from the list; one chip under "Chuyên môn · chọn tối đa 5" | Province and expertise come only from lists (no free typing) | same |
| 5 | "Tiếp tục" | "Ai được thấy gì" (step 3 of 3); preview card "THẺ CỦA BẠN TRONG THƯ VIỆN" with your name, title, province, expertise | `/onboarding/privacy` |
| 6 | Toggle "Hiện thẻ của tôi trong Thư viện" off, then on | The switch changes visibility only; the consent box is separate | same |
| 7 | Leave "Tôi đồng ý với Điều khoản sử dụng & Chính sách quyền riêng tư." unticked → "Xong, vào HUB" | Stays on step 3; cannot finish without consent | same |
| 8 | Tick the consent box → "Xong, vào HUB" | "Xong. Giờ làm gì?" | `/onboarding/complete` |
| 9 | "Vào 1hub.network" | "Tài khoản của tôi" with "Hồ sơ hoàn thiện NN % · còn thiếu …" | `/me` |
| 10 | Refresh; then open https://1hubnetwork.io.vn/onboarding/purpose | Returns to "Tài khoản của tôi"; onboarding does not repeat | `/me` |
| 11 | Sidebar "Quyền riêng tư & hiển thị" | "HIỂN THỊ HỒ SƠ", "ĐIỀU KHOẢN ĐANG ÁP DỤNG", "LỊCH SỬ ĐỒNG Ý" (your acceptance listed) | `/me/privacy` |
| 12 | Sidebar "Hồ sơ cá nhân" → add "Giới thiệu" or another chip → "Lưu" → "Tổng quan" | The percent rises; you never type it | `/me` |

## What this proves
| Rule | Where you see it |
|---|---|
| Consent ≠ Visibility | Steps 6–7: the switch and the consent box are separate; step 11 shows them in separate sections |
| Completion is computed by the system | Steps 9 and 12: the percent changes only with your profile content; there is no field to type it |
| Controlled vocabulary | Step 4: lists only |

## Negative checks
| Check | Action | Expected |
|---|---|---|
| Member pages before finishing | During steps 1–7 open https://1hubnetwork.io.vn/me | Back to the current onboarding step |
| Resume | Stop at step 2, close the window, ask for a new link for the same address | Resumes at the first unfinished step with your data kept |

## Reset procedure
None: use a new address for the next run. Do not reuse `newcomer@` after its first run.

## PASS criteria
Onboarding completes only with a name, province, expertise and consent; visibility and consent are independent; the percent is shown by the system and rises with content; onboarding never repeats after it is finished.

## Known Internal Alpha limitation
The "Điều khoản sử dụng" link on step 3 shows "not found" (legal text not supplied yet). Seed personas show "còn thiếu ảnh đại diện" (no image file).

## Related
- [guest-auth.md](guest-auth.md) — previous · [member-profile-ventures.md](member-profile-ventures.md) — next
