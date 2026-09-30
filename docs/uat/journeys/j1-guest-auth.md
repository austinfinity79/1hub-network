# J1 Guest Auth

Journey 1 — guest → auth → login. Accounts: [../INTERNAL_ALPHA_TEST_ACCOUNTS.md](../INTERNAL_ALPHA_TEST_ACCOUNTS.md).

### J1-01 · Public pages
| Field | Value |
|---|---|
| Persona · account | Guest · none |
| Start URL | `https://1hubnetwork.io.vn/` |
| Preconditions | private window, signed out |
| Steps | 1. Open `/`. 2. Open the About page (`/about`) from the homepage. 3. Open the Library (`/library`). 4. Type `/me` in the address bar |
| Expected UI | homepage, about page and library render with images; header shows "Đăng nhập" |
| Expected route | `/`, `/about`, `/library` stay; `/me` goes to `/auth` |
| Expected data / state | nothing created |
| Permission | public pages open to everyone; member pages need sign-in |
| Negative | `/me/settings`, `/projects` as guest → `/auth`; no error page |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J1-02 · Request a magic link
| Field | Value |
|---|---|
| Persona · account | Guest → your own address |
| Start URL | `/` → "Đăng nhập" |
| Preconditions | an inbox you can read |
| Steps | 1. Click "Đăng nhập". 2. Enter your address. 3. "Gửi liên kết đăng nhập" |
| Expected UI | a "check your e-mail" screen; the e-mail arrives from the 1hubnetwork sender within a few minutes |
| Expected route | `/auth` → `/auth/check-email` |
| Expected data / state | a sign-in request; no session yet |
| Permission | anyone may request a link (open sign-up); the screen never says whether the address already has an account |
| Negative | a malformed address shows an inline error; "Tiếp tục với Google" only explains that Google sign-in is not enabled (not a defect) |
| Reset | none |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J1-03 · Open the link
| Field | Value |
|---|---|
| Persona · account | your own address (or a persona link from the operator) |
| Start URL | the link in the e-mail |
| Preconditions | link younger than 15 minutes, not used |
| Steps | 1. Open the link in the same private window. 2. Look at the address bar |
| Expected UI | signed in; no auth error |
| Expected route | new address → onboarding (`/onboarding…`); onboarded account → `/me`; the address bar holds **no token** |
| Expected data / state | one account for that address; a session in this window |
| Permission | the session belongs to that address only |
| Negative | open the same link again → "Link đã dùng rồi"; a link older than 15 minutes → expired notice; neither signs you in |
| Reset | close the window to sign out |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

### J1-04 · Session
| Field | Value |
|---|---|
| Persona · account | a signed-in account |
| Start URL | `/me/settings` |
| Preconditions | J1-03 done |
| Steps | 1. Reload `/me`. 2. Open "Cài đặt tài khoản" → sessions list. 3. "Đăng xuất" |
| Expected UI | still signed in after reload; the current session is listed; after sign-out member pages ask for sign-in |
| Expected route | after sign-out `/me` → `/auth` |
| Expected data / state | the session ends; data unchanged |
| Permission | you see only your own sessions |
| Negative | "Đăng xuất khỏi mọi thiết bị" only on **your own** address, never on a shared persona |
| Reset | sign in again with a new link |
| Result | ☐ PASS ☐ FAIL |
| Notes | |

## Related
- [j2-onboarding.md](j2-onboarding.md) · [../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md)
