# New Member Onboarding

**WF-TEST-02 — New member → sign-in → onboarding → profile → consent → visibility → member home** · PRODUCTION-LIKE INTERNAL ALPHA

| Preconditions | Account to use | Starting URL | Expected duration | Reset required before run |
|---|---|---|---|---|
| An operator link for a **new** address. One address per run | `<name>-new-<nn>@example.test` (or `newcomer@example.test`, first run only) | The operator link | 15 min | NO |

| Step | Actor | Action | Expected UI / result | Expected route / state | PASS / FAIL | Notes |
|---|---|---|---|---|---|---|
| 1 | New member | Open the link (private window) | "Bạn đến HUB để làm gì?" with 4 choices: "Tôi có giải pháp và muốn nộp cho bài toán", "Đơn vị tôi có bài toán cần giải", "Tôi tổ chức cộng đồng ở địa phương", "Tôi chỉ muốn xem trước đã"; buttons "Tiếp tục" and "Bỏ qua, làm sau" | `/onboarding/purpose` | ☐ PASS ☐ FAIL | Account created now |
| 2 | New member | Pick one choice → "Tiếp tục" | "Bạn là ai" (step 2) | `/onboarding/profile` | ☐ PASS ☐ FAIL | |
| 3 | New member | Click "Tiếp tục" with everything empty | "Vui lòng nhập họ và tên."; stays on step 2 | `/onboarding/profile` | ☐ PASS ☐ FAIL | Required data |
| 4 | New member | Fill "Họ và tên" and "Chức danh hiện tại"; choose "Tỉnh / thành phố" from the list; click one chip under "Chuyên môn · chọn tối đa 5" | Province and expertise come only from lists (no free typing) | `/onboarding/profile` | ☐ PASS ☐ FAIL | Controlled vocabulary |
| 5 | New member | "Tiếp tục" | "Ai được thấy gì" (step 3 of 3); a preview card "THẺ CỦA BẠN TRONG THƯ VIỆN" shows your name, title, province, expertise | `/onboarding/privacy` | ☐ PASS ☐ FAIL | |
| 6 | New member | Toggle "Hiện thẻ của tôi trong Thư viện" off, then back on | The switch changes visibility only; the consent box is separate | `/onboarding/privacy` | ☐ PASS ☐ FAIL | Visibility ≠ consent |
| 7 | New member | Leave "Tôi đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư." unticked → "Xong, vào HUB" | Stays on step 3; cannot finish without consent | `/onboarding/privacy` | ☐ PASS ☐ FAIL | |
| 8 | New member | Tick the consent box → "Xong, vào HUB" | "Xong. Giờ làm gì?" | `/onboarding/complete` | ☐ PASS ☐ FAIL | |
| 9 | New member | "Vào 1hub.network" | "Tài khoản của tôi" with "Hồ sơ hoàn thiện NN % · còn thiếu …" (e.g. 40 %) | `/me` | ☐ PASS ☐ FAIL | The system computes the percent; you never type it |
| 10 | Member | Refresh; then open https://1hubnetwork.io.vn/onboarding/purpose | Stays / returns to "Tài khoản của tôi"; onboarding does not repeat | `/me` | ☐ PASS ☐ FAIL | Persistence |
| 11 | Member | Sidebar "Quyền riêng tư & hiển thị" | Sections "HIỂN THỊ HỒ SƠ", "ĐIỀU KHOẢN ĐANG ÁP DỤNG", "LỊCH SỬ ĐỒNG Ý" (your acceptance is listed) | `/me/privacy` | ☐ PASS ☐ FAIL | Consent history separate from visibility |
| 12 | Member | Sidebar "Hồ sơ cá nhân" → add "Giới thiệu" or more chips → "Lưu" → back to "Tổng quan" | The percent rises | `/me` | ☐ PASS ☐ FAIL | |

## Optional checks
| Check | Action | Expected | PASS / FAIL |
|---|---|---|---|
| Resume | Stop at step 2, close the window, ask for a new link for the same address | Resumes at the first unfinished step with your data kept | ☐ |
| Skip purpose | Step 1 "Bỏ qua, làm sau" | Goes on to step 2; onboarding still completes | ☐ |
| Legal links (known) | "Điều khoản sử dụng" link on step 3 | "not found": known limitation | — |

## Related
- [guest-auth.md](guest-auth.md) — previous · [member-profile-ventures.md](member-profile-ventures.md) — next
- [../INTERNAL_ALPHA_TEST_ACCOUNTS.md](../INTERNAL_ALPHA_TEST_ACCOUNTS.md) — accounts
