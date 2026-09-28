# Internal Alpha Self Review Guide

The main guide for the PO and the team: review **https://1hubnetwork.io.vn** from the browser, without code, database or API knowledge.
- Release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (deployed GREEN).
- This guide prepares the review; it does not record a result. **Team UAT: PENDING.**

## What each label means
| Label | Areas | How to treat it |
|---|---|---|
| **PRODUCTION** (Internal Alpha review data) | Landing · sign-in · onboarding · member home, profile, privacy, settings, roles · Project / Startup profile and team · HUB / Chapter / CLB operations · public organisation pages | Real rows in the review database: test fully |
| **DEMO** (banner "DỮ LIỆU DEMO · INTERNAL ALPHA") | WF04 Programme / Challenge setup · WF05 application | State lives only in your browser tab; nothing is sent or stored. Test the flow; do not expect persistence |
| **FUTURE / NOT IMPLEMENTED** | WF06 discovery and matching · investor / VC / dataroom · ranking · landing items "Tương lai" · header "Thư viện", "Challenge", "Sự kiện" and the bell (tooltip "…chưa có trong phiên bản này") | Not testable: do not report them |

## Before you start
1. Get a sign-in link per account from the operator ([accounts](INTERNAL_ALPHA_TEST_ACCOUNTS.md)); use one private window per account.
2. Use a desktop browser at full width (1440 px is the design target).
3. Keep this checklist open; screenshot anything that fails. Never capture a sign-in link.
4. Reset rules: [test data and reset](INTERNAL_ALPHA_TEST_DATA_RESET.md).

## The six flows (run in this order)
| Flow | Journey | Label | Account(s) | Start | Time | Reset before |
|---|---|---|---|---|---|---|
| [1](internal-alpha/guest-auth.md) | Guest → landing → auth | PRODUCTION | Guest, `member@` | https://1hubnetwork.io.vn | 10 min | No |
| [2](internal-alpha/new-member-onboarding.md) | New member → onboarding → member home | PRODUCTION | new address | operator link | 15 min | No (new address) |
| [3](internal-alpha/member-profile-ventures.md) | Member → profile / account → Project / Startup → team | PRODUCTION | `member@`, invitee, `pending@` | `/me` | 25 min | No |
| [4](internal-alpha/leader-operations.md) | Community Leader → HUB / Chapter / CLB ops | PRODUCTION | `leader@`, `member@`, `ops@` | `/me` → "Vận hành tổ chức" | 25 min | Once per reseed |
| [5](internal-alpha/programme-demo.md) | Programme / Challenge setup | DEMO | `leader@` | "Chương trình & Challenge" | 20 min | Yes: "Đặt lại demo" |
| [6](internal-alpha/application-demo.md) | Founder / Project → programme application | DEMO (application) | `member@`, invitee, `pending@` | "Dự án & Startup · Demo" | 20 min | Yes: "Đặt lại demo" |

Flow 6 reuses the PROJECT and the team member created in Flow 3. Project / Startup creation on the deployed release is **one form** ("Lưu"), not the 3-step wizard (that is in the repository only, not deployed).

## Self-review checklist
Tester: __________ Date: __________ Browser / width: __________

| Check | F1 | F2 | F3 | F4 | F5 | F6 |
|---|---|---|---|---|---|---|
| Can enter the flow | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Correct role and data shown | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Main happy path works | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Back / refresh keep the right screen and state | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Loading / error / empty states acceptable | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| No broken layout | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| No dead link (known: legal links) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| No visible product failure (error page, blank screen, stuck spinner) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Permission boundary correct (negative checks) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Expected final state reached | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| **Flow verdict** (PASS / PASS WITH ISSUE / FAIL) | | | | | | |

**Final reviewer verdict:** [ ] PASS  [ ] PASS WITH ISSUE  [ ] FAIL
Notes (flow · step · account · expected · actual · screenshot · severity P0–P3):

______________________________________________________________________

Severity: **P0** security / privacy / data loss · **P1** core journey broken, no workaround · **P2** one feature wrong, workaround exists · **P3** cosmetic or copy.

## Current Internal Alpha limitations (do not report)
| Item | Status |
|---|---|
| WF04 Programme / Challenge | **DEMO** (browser session) |
| WF05 application | **DEMO** where accepted (browser session; not sent to the organiser) |
| WF06 discovery / matching | **FUTURE / VISION / NOT IMPLEMENTED** |
| Investor / VC / dataroom | **FUTURE** |
| Mobile | Basic responsive works (1440 / 768 / 390 smoke PASS). Member and ops pages are desktop-first and may scroll sideways on phones; mobile polish is future work |
| OneShield / CDN `Referrer-Policy` override | Accepted for Internal Alpha: the sign-in callback is served with `strict-origin-when-cross-origin` instead of the app's `no-referrer`. **Must be fixed before public production go-live** |
| No email is ever sent | No email provider: the operator issues sign-in links; invitations are shared by page address |
| "Điều khoản sử dụng" / "Chính sách quyền riêng tư" → "not found" | Real legal text not supplied yet |
| Auth page panel figures ("12 bài toán đang mở…") | Approved artwork; PO decision pending |
| "Fixture …", "Demo …", "(demo)" names; "còn thiếu ảnh đại diện" on personas | Seed test data |

## How this pack was verified (2026-09-28)
- **Live domain, read-only and signed out:**
  - landing headline, header and CTA targets;
  - `/auth` form;
  - used / expired / generic sign-in states;
  - Chapter 01 and HUB public pages (Demo Event listed, draft hidden);
  - "Không tìm thấy trang" and the legal 404s;
  - every signed-out member, ops, onboarding and demo address → `/auth`;
  - 0 console errors;
  - no sideways scroll on landing / auth at 1440 and 390;
  - callback header as above.
- **Signed-in steps:** replayed by visible labels on a local copy of the same release with the same seed (test pack `2d19cad`). The Task 20 deployment smoke passed the same workflows on the domain. No data was changed on the domain for this pack.

## Related
- [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md) · [INTERNAL_ALPHA_TEST_DATA_RESET.md](INTERNAL_ALPHA_TEST_DATA_RESET.md) · [internal-alpha/](internal-alpha/guest-auth.md)
