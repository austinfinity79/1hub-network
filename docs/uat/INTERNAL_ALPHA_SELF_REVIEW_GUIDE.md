# Internal Alpha Self-Review Guide

For the product owner and internal team: review **https://1hubnetwork.io.vn** without reading code or reports. Release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`. This guide **prepares** UAT; it does not record a result. **Team UAT: PENDING.**

## What is testable
| Label | Areas | Test? |
|---|---|---|
| **PRODUCTION-LIKE INTERNAL ALPHA** | Landing · Sign-in · Onboarding · Member home / profile / privacy / settings / roles · Project / Startup profile and team · HUB / Chapter / CLB operations (members, leadership, profile, relationships, events) · public organization pages | Yes: data are real rows in the review database |
| **DEMO** (banner "DỮ LIỆU DEMO · INTERNAL ALPHA") | WF04 Programme / Challenge setup · WF05 application (draft → review → submit) | Yes: state lives only in your browser tab; nothing is sent or stored |
| **FUTURE / NOT TESTABLE** | WF06 discovery / matching · investor / VC / dataroom · recommendation / ranking · landing items labelled "Tương lai" · header items "Thư viện", "Challenge", "Sự kiện" and the bell (tooltip "Tính năng giai đoạn sau — chưa có trong phiên bản này" / "Chưa có trong phiên bản này") | No: do not look for them or report them |

## Before you start
1. Get your sign-in links from the operator ([accounts](INTERNAL_ALPHA_TEST_ACCOUNTS.md)): one private window per account.
2. Use a desktop browser at full width (1440 px is the design target). Tablets and phones work, but member / ops pages may scroll sideways on phones (known).
3. Keep the [checklist](INTERNAL_ALPHA_UAT_CHECKLIST.md) and the [results template](INTERNAL_ALPHA_UAT_RESULTS_TEMPLATE.md) open. Take a screenshot of anything that fails.

## Journeys (run in this order)
| ID | Journey | Account(s) | Start | Time | Reset before |
|---|---|---|---|---|---|
| [WF-TEST-01](self-review/guest-auth.md) | Guest → landing → sign-in → sign-out | Guest, `member@` | https://1hubnetwork.io.vn | 10 min | No |
| [WF-TEST-02](self-review/new-member-onboarding.md) | New member → onboarding → member home | new address | operator link | 15 min | No (new address) |
| [WF-TEST-03](self-review/member-profile-ventures.md) | Member → profile / account → Project / Startup → team | `member@`, new invitee, `pending@` | `/me` | 25 min | No |
| [WF-TEST-04](self-review/leader-operations.md) | Community Leader → Chapter operations | `leader@`, `member@`, `ops@` | `/me` → "Vận hành tổ chức" | 25 min | Once per reseed (approval) |
| [WF-TEST-05](self-review/programme-demo.md) | Programme / Challenge setup (DEMO) | `leader@` | "Chương trình & Challenge" | 20 min | Yes: "Đặt lại demo" |
| [WF-TEST-06](self-review/application-demo.md) | Founder → programme → application → submit (DEMO) | `member@`, invitee, `pending@` | "Dự án & Startup · Demo" | 20 min | Yes: "Đặt lại demo" |

WF-TEST-06 reuses the PROJECT and the ACTIVE team member created in WF-TEST-03.

## Known limitations (do not report)
| Item | Why |
|---|---|
| No email ever arrives ("Mở hộp thư của bạn") | No email provider in Internal Alpha; the operator issues links |
| "Điều khoản sử dụng" / "Chính sách quyền riêng tư" links → "not found" | Real legal text not supplied yet |
| Auth page panel figures ("12 bài toán đang mở…") | Approved design artwork; PO decision pending (IA-P3-01) |
| Text "Fixture …" / "(demo)" on data | Seed test data |
| Profile shows "còn thiếu ảnh đại diện" for seed personas | Seed avatars have no image file |
| Sideways page scroll on phones for member / ops pages | Desktop-first shells (IA-P3-08) |

## How this guide was verified (2026-09-28)
- **Real domain (read-only, signed out):** landing, header and CTA labels, `/auth` form, the public Chapter 01 page, the "not found" legal links, and every signed-out redirect to `/auth`.
- **Signed-in steps:** replayed click by click on a local copy of the **same release** with the **same seed**. Sign-in links came from the operator tool's own code path. All six journeys passed, with 0 page errors.
- The Task 20 deployment smoke passed the same workflows on the real domain.

## Related
- [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md) · [INTERNAL_ALPHA_TEST_DATA_RESET.md](INTERNAL_ALPHA_TEST_DATA_RESET.md) · [INTERNAL_ALPHA_UAT_CHECKLIST.md](INTERNAL_ALPHA_UAT_CHECKLIST.md)
