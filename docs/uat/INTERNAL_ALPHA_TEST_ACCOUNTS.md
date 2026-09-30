# Internal Alpha Test Accounts

Accounts for the [self-review guide](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) on **https://1hubnetwork.io.vn** (release `ff052d7`). Read from the production database on 2026-09-30 (read-only). Every persona is a review account on `@example.test`: no real person, **no passwords**. Real testers use their own e-mail address; those addresses are never written here.

## <a id="sign-in"></a>Sign-in
| Account kind | How | Notes |
|---|---|---|
| Your own address | `/auth` → e-mail → "Gửi liên kết đăng nhập" → open the link in the e-mail | open sign-up: a new address becomes a new account at first sign-in and starts onboarding |
| Review persona `@example.test` | the operator runs `ssh hub-vps /opt/1hub-network/app/bin/issue-login-link.sh <persona>@example.test` and sends you the link privately | one link, one use, 15 minutes; the tool refuses any other domain; e-mail is never sent to `@example.test` |
| A second persona at once | a second private window | never two accounts in one window |

## Personas
| # | Role | Account | State on 2026-09-30 | Use in | Status |
|---|---|---|---|---|---|
| 1 | Guest | none (private window, signed out) | — | J1, J7, J8 | READY |
| 2 | New member, onboarding not done | **your own new address** (recommended) · `newcomer@example.test` (onboarding not done; usable once) | account only, no completed onboarding | J1, J2 | READY |
| 3 | Normal member (no venture) | `pending@example.test` | onboarded; Chapter 01 membership **pending approval**; no venture | J4, J8 (outsider) | READY |
| 4 | Venture owner | `member@example.test` | onboarded; Chapter 01 ACTIVE (HUB_MEMBER); owns **Demo Startup** (STARTUP, ACTIVE, PRIVATE) | J3, J5, J6, J8 | READY |
| 5 | ACTIVE venture member | — | no persona is an ACTIVE team member today | J3, J6 (negative) | **NEEDS PROVISIONING** — made in J3-04: owner invites your second address with "Biên tập" or "Xem"; you accept with "Nhận lời mời" |
| 6 | Invitee (pending invitation) | `leader@example.test` | invited to Demo Startup as "Contributor", PENDING_CONFIRMATION | J3 (look only) | READY — do not accept; it is shared |
| 7 | Chapter leader | `leader@example.test` | HUB_COMMUNITY_LEADER of **Chapter 01**; leadership ACTIVE; Chapter 01 member | J4, J5 (WF04 demo) | READY |
| 7b | CLB leader (Club 01) | — | no CLB-level leader exists | not required: J4 runs at chapter scope | **NEEDS PROVISIONING** only if a CLB-scope test is wanted (a leadership record for Club 01, operator task) |
| 8 | Platform admin / internal ops | `ops@example.test` | PLATFORM_ADMIN | J4 (`/ops/network`), J8 | READY |

## Organisations and records
| Record | State | Notes |
|---|---|---|
| HUB Network → Chapter 01, Chapter 02; Club 01 under Chapter 01 | PUBLISHED | Chapter 02 has no leader: use it for cross-org checks |
| Chương trình ươm tạo (demo), `d4000000-0000-0000-0000-000000000001` | PUBLISHED, Chapter 01; form: TEAM + STARTUP, 2 required questions | the only open programme |
| Demo Challenge | DRAFT | not open; never shown to founders |
| Demo Event · Demo Draft Event | PUBLISHED · DRAFT (Chapter 01) | the published one is on `/organizations/chapter-01` |

## Other accounts you may see (do not use)
`preview-demo*`, `preview03-*`, `preview04-*`, `final05-*`, `final07-*`, `smoke-alpha09-*`, `smoke-rc-*` on `@example.test` are earlier operator test runs. Their data are not UAT fixtures; the operator clears them. Five real-address accounts exist (testers and the operator); they are not listed.

## Related
- [INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) · [INTERNAL_ALPHA_UAT_CHECKLIST.csv](INTERNAL_ALPHA_UAT_CHECKLIST.csv)
