# Guest Auth

**WF-TEST-01 — Guest → landing → sign-in → sign-out** · PRODUCTION-LIKE INTERNAL ALPHA

| Preconditions | Account to use | Starting URL | Expected duration | Reset required before run |
|---|---|---|---|---|
| An operator link for `member@example.test` (steps 7–11). Use a fresh private window | Guest, then `member@example.test` | https://1hubnetwork.io.vn | 10 min | NO |

| Step | Actor | Action | Expected UI / result | Expected route / state | PASS / FAIL | Notes |
|---|---|---|---|---|---|---|
| 1 | Guest | Open https://1hubnetwork.io.vn | Landing loads. Headline "Một hồ sơ gốc cho mỗi người, mỗi dự án, mỗi tổ chức"; header "Vấn đề · Sản phẩm · Tầm nhìn · Mạng lưới · Đăng nhập / Tham gia"; burgundy branding; no error shown | `/` | ☐ PASS ☐ FAIL | |
| 2 | Guest | Scroll the whole page | Sections read clearly; items marked "Tương lai" are text only, not links | `/` | ☐ PASS ☐ FAIL | |
| 3 | Guest | Click "Khám phá mạng lưới" | Public HUB Network page | `/organizations/hub-network` | ☐ PASS ☐ FAIL | |
| 4 | Guest | Back, then click "Đăng nhập / Tham gia" | "Vào HUB NETWORK", an Email field, the button "Gửi link đăng nhập" | `/auth` | ☐ PASS ☐ FAIL | |
| 5 | Guest | Type your own `<name>-t01@example.test` → "Gửi link đăng nhập" | "Mở hộp thư của bạn". **No email will arrive** (known) | `/auth/check-email` | ☐ PASS ☐ FAIL | Do not wait for mail |
| 6 | Guest | In the same window open https://1hubnetwork.io.vn/me | Sent back to the sign-in page | `/auth` | ☐ PASS ☐ FAIL | Protected page as guest |
| 7 | Tester | Open the operator link for `member@example.test` in a new private window | Signed in; "Tài khoản của tôi" with "Demo Member" | `/me` | ☐ PASS ☐ FAIL | Within 15 min |
| 8 | Tester | Open the **same** link again in another private window | "Link đã dùng rồi" + "Gửi link mới"; not signed in | `/auth/callback?status=used` | ☐ PASS ☐ FAIL | One-time link |
| 9 | Member | In the signed-in window open https://1hubnetwork.io.vn | The CTA now reads "Vào tài khoản của tôi" | `/` | ☐ PASS ☐ FAIL | |
| 10 | Member | "Vào tài khoản của tôi" → sidebar "Cài đặt tài khoản" | "Cài đặt tài khoản"; under PHIÊN ĐĂNG NHẬP your row reads "Phiên này … Hiện tại" | `/me/settings` | ☐ PASS ☐ FAIL | |
| 11 | Member | Close the private window, open a new one, go to https://1hubnetwork.io.vn/me | Sign-in page again (signed out) | `/auth` | ☐ PASS ☐ FAIL | See note |

Sign-out note: the in-product sign-out is "Đăng xuất khỏi mọi thiết bị". It signs out **everyone** using that account, so test it only while signed in with your own new address. Expected: the sign-in page, and `/me` then goes to `/auth`.

## Negative checks
| Check | Action | Expected | PASS / FAIL |
|---|---|---|---|
| Broken link | Open `https://1hubnetwork.io.vn/auth/callback?token=abc` | "Chưa đăng nhập được" (`/auth/error`) | ☐ |
| Expired link | Open an operator link after more than 15 minutes | Expired-link screen (`/auth/callback?status=expired`); not signed in | ☐ |
| Guest on member / ops / demo pages | Signed out, open `/me/profile/edit`, `/projects/new`, `/ops/network`, `/demo/projects` | Each goes to `/auth` | ☐ |
| Legal links (known) | Footer "Điều khoản sử dụng" | "not found": known limitation, do not report | — |

## Related
- [../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — all journeys
- [new-member-onboarding.md](new-member-onboarding.md) — next
