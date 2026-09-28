# Guest Auth

| Field | Value |
|---|---|
| Flow ID | **FLOW 1 · WF-TEST-01** — Guest → landing → auth |
| Purpose | Public entry, the sign-in entry, one-time links, and signed-out protection |
| Classification | **PRODUCTION** (Internal Alpha review data) |
| Actor | A Guest, then C Member |
| Account | none; then `member@example.test` (operator link) |
| Precondition | A fresh private window; an operator link for `member@` for steps 7–11 |
| Starting URL | https://1hubnetwork.io.vn |
| Time | 10 min |

## Steps
| # | Actor | Action | Expected result | Route |
|---|---|---|---|---|
| 1 | Guest | Open https://1hubnetwork.io.vn | Headline "Một hồ sơ gốc cho mỗi người, mỗi dự án, mỗi tổ chức"; header "Vấn đề · Sản phẩm · Tầm nhìn · Mạng lưới · Đăng nhập / Tham gia"; burgundy branding; no error | `/` |
| 2 | Guest | Scroll the whole page | Sections read clearly; items marked "Tương lai" are plain text, not links | `/` |
| 3 | Guest | "Khám phá mạng lưới" | Public "HUB Network" page | `/organizations/hub-network` |
| 4 | Guest | Back → "Đăng nhập / Tham gia" | "Vào HUB NETWORK", an Email field, the button "Gửi link đăng nhập" | `/auth` |
| 5 | Guest | Type your own `<name>-t01@example.test` → "Gửi link đăng nhập" | "Mở hộp thư của bạn". **No email arrives** (known) | `/auth/check-email` |
| 6 | Guest | In the same window open https://1hubnetwork.io.vn/me | Sent back to the sign-in page | `/auth` |
| 7 | Tester | Open the operator link for `member@` in a new private window | Signed in: "Tài khoản của tôi", "Demo Member" | `/me` |
| 8 | Tester | Open the **same** link again in another private window | "Link đã dùng rồi" + "Gửi link mới"; not signed in | `/auth/callback?status=used` |
| 9 | Member | In the signed-in window open https://1hubnetwork.io.vn | The call to action now reads "Vào tài khoản của tôi" | `/` |
| 10 | Member | "Vào tài khoản của tôi" → sidebar "Cài đặt tài khoản" | "Cài đặt tài khoản"; under PHIÊN ĐĂNG NHẬP your row "Phiên này … Hiện tại" | `/me/settings` |
| 11 | Member | Close the window; open a new private window at https://1hubnetwork.io.vn/me | The sign-in page (signed out) | `/auth` |

## Negative checks
| Check | Action | Expected |
|---|---|---|
| Broken link | Open https://1hubnetwork.io.vn/auth/callback?token=abc | "Chưa đăng nhập được" |
| Expired link | Open an operator link after more than 15 minutes | "Link đã hết hạn"; not signed in |
| Signed out on member / ops / demo pages | Open `/me/profile/edit`, `/projects/new`, `/ops/network`, `/demo/projects` | Each goes to `/auth` |
| Unknown page | Open https://1hubnetwork.io.vn/khong-co | "Không tìm thấy trang" |

## Reset procedure
Close the private windows (reset A). Nothing persistent changes; step 5 only creates a sign-in request for your own address.

## PASS criteria
All 11 steps as expected; used, broken and expired links never sign in; every protected page sends a guest to `/auth`; no console-visible failure.

## Known Internal Alpha limitation
- No email is sent (operator links only).
- The footer legal links show "not found" (real legal text not supplied yet).
- The in-product sign-out "Đăng xuất khỏi mọi thiết bị" ends every session of the account: test it only with your own address.

## Related
- [../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — all flows · [new-member-onboarding.md](new-member-onboarding.md) — next
