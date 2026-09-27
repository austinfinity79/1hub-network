# Internal Alpha Test Accounts

Review environment: **https://1hubnetwork.io.vn**, release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (deployed 2026-09-28). Every account below is a **non-production review persona** on `@example.test`. There are no passwords.

## How to sign in (no email is sent)
The Internal Alpha has **no email provider**. Typing an address on `/auth` shows "Mở hộp thư của bạn", but no email arrives. Sign-in works only through a **one-time link issued by the operator**.

| Who | Step |
|---|---|
| Tester | Ask the operator (privately) for a link for one account below, or for your own new address `<name>-<purpose>-<nn>@example.test` |
| Operator | Run `ssh hub-vps /opt/1hub-network/app/bin/issue-login-link.sh <address>@example.test`. It prints one link (`…/auth/callback?token=…`) and "single use; expires in 900s". It refuses anything that is not `@example.test` |
| Operator | Send the link to that tester **only**, in a private message. Never paste it into a shared channel, a ticket, a document or a screenshot |
| Tester | Open the link within **15 minutes**, in a **private / incognito window** (one window per account). It works **once**: a second open shows "Link đã dùng rồi" |
| Tester | A new address becomes a **new account** at first sign-in and starts onboarding. The session lasts 30 days in that window |

Signing out: close the private window. **Avoid** "Cài đặt tài khoản → Đăng xuất khỏi mọi thiết bị" on a shared account: it signs out every tester using that account. Use it only on your own address.

## Actor matrix
| ID | Actor | Account | Organization / relationship | Project / Startup | Can do | Workflows | Starting state | Reset implication |
|---|---|---|---|---|---|---|---|---|
| A | Guest | — (not signed in) | — | — | Landing, sign-in page, public organization pages | WF-TEST-01 | — | None |
| B | New member (onboarding not done) | **Your own new address** `<name>-new-<nn>@example.test` (recommended) · `newcomer@example.test` (Demo Newcomer, first run only) | none | none | Onboarding only; every member / ops / demo page sends it back to onboarding | WF-TEST-02, 03 (invitee) | Account created at first sign-in; step 1 "Bạn đến HUB để làm gì?" | A new address per run needs no reset. `newcomer@` is used up after one run; a reseed does not fully reset it (see reset guide) |
| C | Active member | `member@example.test` (**Demo Member**) | Chapter 01: ACTIVE member | Owner of **Demo Startup** (STARTUP) | Profile, privacy, settings, roles, own ventures, WF05 demo | WF-TEST-01, 03, 06 | Onboarding done; profile about 90 % (no avatar file) | Shared: keep edits reversible; do not rename or delete Demo Startup |
| D | Project / Startup owner | STARTUP: `member@example.test` (Demo Startup) · PROJECT: `member@example.test` after creating "Dự án UAT …" in WF-TEST-03 | — | STARTUP → applies as **Startup**; PROJECT → applies as **Đội** | Edit own venture, invite team, apply (WF05 demo) | WF-TEST-03, 06 | No PROJECT in the seed: **MISSING TEST ACTOR**, created in 1 minute through the product | Each run adds one PROJECT (kept; harmless) |
| E | ACTIVE project team member | Your own address `<name>-mate-<nn>@example.test`, invited in WF-TEST-03 and accepted with "Nhận lời mời" | — | ACTIVE member of that PROJECT | View the venture and team; cannot edit or apply | WF-TEST-03, 06 | Not in the seed: **MISSING TEST ACTOR**, created through the product (invite + accept) | New address per run |
| F | Pending project invitee | `leader@example.test` | — | Invited to Demo Startup as "Contributor" (pending) | Sees "Nhận lời mời · Từ chối" on the Demo Startup team page | WF-TEST-03 | Invitation pending | **Do not accept** unless that is the test: accepting changes the shared seed (operator reseed restores it) |
| G | Community Leader | `leader@example.test` (**Demo Leader**) | Chapter 01: ACTIVE member + **Chapter Leader**; operates Chapter 01 only | Pending invite (F) | "Vận hành tổ chức" for Chapter 01; WF04 Programme / Challenge demo | WF-TEST-04, 05 | Chapter 01 has 1 pending request (Demo Pending) | Approving the pending request changes the seed |
| H | Platform Admin | `ops@example.test` (**Demo Ops**) | Platform admin: sees every organization | none | Ops view of HUB Network, Chapter 01, Chapter 02, Club 01; WF04 demo | WF-TEST-04 (compare), 05 | — | Shared: avoid structural changes (relationships) |
| I | Unrelated member | `pending@example.test` (**Demo Pending**) or your own new address | Chapter 01: membership request **pending** | none | Own member pages only; any foreign venture or ops page → "Không tìm thấy trang" | WF-TEST-03, 04, 06 (negative) | Profile 60 %; request pending | If WF-TEST-04 approves the request, Demo Pending becomes an ACTIVE Chapter 01 member (still unrelated to ventures) |

Optional roster actor: `unclaimed@example.test` is pre-listed on the Chapter 02 roster. Its **first** sign-in creates an account that is an ACTIVE member of Chapter 02 without any request (roster pre-seed). It works once per environment.

## Missing test actors
| Missing | Covered by | Smallest deterministic addition (not made) |
|---|---|---|
| D — PROJECT owner | WF-TEST-03 step 6 (member creates a PROJECT) | Seed one PROJECT owned by Demo Member |
| E — ACTIVE team member | WF-TEST-03 steps 7–9 (invite + accept) | Seed a 6th persona `teammate@example.test` with an ACTIVE `project_members` row on that PROJECT |

## Never put in any document or chat
Login links or tokens, cookies, `DATABASE_URL` or any server secret, real people's emails.

## Related
- [INTERNAL_ALPHA_TEST_DATA_RESET.md](INTERNAL_ALPHA_TEST_DATA_RESET.md) — data and reset
- [INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — journeys
- [INTERNAL_ALPHA_UAT_CHECKLIST.md](INTERNAL_ALPHA_UAT_CHECKLIST.md) — PO checklist
