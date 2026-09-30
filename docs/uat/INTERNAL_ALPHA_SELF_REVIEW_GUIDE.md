# Internal Alpha Self Review Guide

Team UAT / PO self-review of the **deployed** Internal Alpha on **https://1hubnetwork.io.vn**: release `ff052d70fe418cb092bd5e33fcc03ee712c76d14` (tag `internal-alpha-2026-09-30`, deployed 2026-09-30; rollback `c02cdd9`). Everything here describes what that release actually does. Accounts: [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md). Checklist to fill: [INTERNAL_ALPHA_UAT_CHECKLIST.csv](INTERNAL_ALPHA_UAT_CHECKLIST.csv).

## How to run a session
| Step | Rule |
|---|---|
| Window | one **private / incognito** window per account; close it to sign out |
| Sign in with your own address | `/auth` → your e-mail → "Gửi liên kết đăng nhập" → open the e-mail within 15 minutes. A new address becomes a new account (open sign-up) |
| Sign in as a review persona (`@example.test`) | ask the operator for a one-time link ([accounts](INTERNAL_ALPHA_TEST_ACCOUNTS.md#sign-in)); single use, 15 minutes |
| Naming | anything you create starts with `UAT <initials> <nn>` so the operator can find and clear it |
| Recording | for each case mark PASS / FAIL in the checklist; a FAIL needs the URL, time, account, screenshot and what you expected |
| Never | edit data you did not create, share a sign-in link, use "Đăng xuất khỏi mọi thiết bị" on a shared persona |

## Journeys
| # | Journey | Cases | File |
|---|---|---|---|
| 1 | Guest → auth → login | J1-01…04 | [journeys/j1-guest-auth.md](journeys/j1-guest-auth.md) |
| 2 | New member → onboarding | J2-01…04 | [journeys/j2-onboarding.md](journeys/j2-onboarding.md) |
| 3 | Member profile + venture | J3-01…05 | [journeys/j3-profile-venture.md](journeys/j3-profile-venture.md) |
| 4 | CLB / Chapter operations | J4-01…05 | [journeys/j4-chapter-ops.md](journeys/j4-chapter-ops.md) |
| 5 | Programme / Challenge | J5-01…03 | [journeys/j5-programme.md](journeys/j5-programme.md) |
| 6 | Startup → application | J6-01…05 | [journeys/j6-application.md](journeys/j6-application.md) |
| 7 | Library | J7-01…04 | [journeys/j7-library.md](journeys/j7-library.md) |
| 8 | Privacy / security | J8-01…05 | [journeys/j8-privacy-security.md](journeys/j8-privacy-security.md) |

Recommended order: 1 → 2 → 3 → 5 → 6 → 4 → 7 → 8.

## Reset guide (no tester ever edits the database)
| State | How to reset | Tooling |
|---|---|---|
| Onboarding | start again with a **new address** (e.g. `you+uat02@…`, or a new `@example.test` via the operator); a finished onboarding cannot be undone | new address |
| Venture | no archive or delete in Alpha: create a new `UAT …` venture; leave the old one | new record |
| Team invitation | owner: team row → "Huỷ lời mời" (pending) or "Gỡ khỏi đội" (member); invitee: "Từ chối" | in product |
| Membership request | a rejected request can be sent again from "Vai trò & liên kết"; an approved one stays — use a new account to repeat | in product / new address |
| Application DRAFT | keep editing; it is the same draft | in product |
| Application SUBMITTED | final by design: apply again with a **new venture** (quick team) | new record |
| WF04 programme demo edits | "Đặt lại demo" on `/demo/programmes` (browser-session only) | in product |
| Leftover `UAT …` data | ask the operator; removal is an operator step with a backup, never by testers | operator |

## Not required for Internal Alpha (do not report as defects)
Invite-by-link · Google OAuth ("Tiếp tục với Google" only explains it is not enabled) · the AI provider (AI blocks are inert) · L3 FUTURE screens (L21, L22, L24, L25, L27) · L4 FUTURE participant / operator flows (L28–L36) and real operator-side Challenge administration · L6 matching, ranking, recommendation and screens L46–L54 (workroom, event detail page, startup detail tabs, admin approvals, account list, system status) · investor / VC / data-room features · an advanced matching engine. A **broken or dead control** shown for any of these in the current UI is still a defect.

## Known limitations (expected behaviour)
| Area | Behaviour |
|---|---|
| Programme | one open programme, "Chương trình ươm tạo (demo)" (test data); two questions |
| Venture | PUBLIC grants no public page yet; no archive / delete |
| Application | owner only; team members, organisers and admins cannot read it; SUBMITTED cannot change |
| WF04 / WF05 labels | "· Demo" pages; WF04 programme edits live in the browser session only |
| Library | Startup / Nhà sáng lập come from the startup directory source; cards link out to a record's own site at most |
| Mobile | member and ops shells are desktop-first at 390 px (page-level sideways scroll) |
| Errors | no custom 500 page yet (HD-A9) |

## Related
- [INTERNAL_ALPHA_TEST_ACCOUNTS.md](INTERNAL_ALPHA_TEST_ACCOUNTS.md) · [../implementation/INTERNAL_ALPHA_RELEASE_MANIFEST.md](../implementation/INTERNAL_ALPHA_RELEASE_MANIFEST.md) · [../implementation/reports/INTERNAL-ALPHA-RC_deploy.md](../implementation/reports/INTERNAL-ALPHA-RC_deploy.md)
