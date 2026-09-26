# PO Review Checklist

This is a manual journey for https://1hubnetwork.io.vn. It is a review aid only; nothing here changes runtime behaviour. Log in with the persona named in each section (see [PO_UI_UX_REVIEW.md](PO_UI_UX_REVIEW.md)). Record findings as the **PO-REVIEW-01** batch, one row per finding: screen, route, what you saw, what you expected, severity.

Review focus: layout, visual hierarchy, copy, spacing, navigation clarity, component consistency, perceived usability, and how the P0 scope is presented.

## A. WF01 — Identity & onboarding

| # | Persona | Route | Check |
|---|---|---|---|
| A1 | guest | `/` → `/auth` | sign-in entry: copy, single email field, terms note |
| A2 | guest | `/auth` → submit any `@example.test` address | check-email screen: masked address, resend countdown (no email is really sent) |
| A3 | any | operator link → `/auth/callback` | success hand-off. Reopen the same link to see the USED state |
| A4 | guest | `/auth/error` | error presentation |
| A5 | `newcomer` | `/onboarding/purpose` → `profile` → `privacy` → `complete` | purpose, profile fields and DOMAIN/SKILL picker, privacy and consent, completion. **This finishes onboarding for `newcomer` permanently; do it last** |

## B. WF02 — Member profile & network

| # | Persona | Route | Check |
|---|---|---|---|
| B1 | `member` | `/me` | member home: identity, completion, organisations, ventures |
| B2 | `member` | `/me/profile/edit` | profile edit form and field layout |
| B3 | `member` | `/me/privacy` | NETWORK_ONLY / PRIVATE toggle, current terms, consent history |
| B4 | `member`, `pending` | `/me/roles` | membership rows, source labels, PENDING_APPROVAL (pending), membership request form |
| B5 | `member` | `/projects/new`, `/projects/50000000-0000-0000-0000-000000000001/edit` | venture (project/startup) create and edit |
| B6 | `member` | `/projects/50000000-0000-0000-0000-000000000001/team` | venture team: owner row, pending invitation, invite and cancel |
| B7 | `leader` | `/projects/50000000-0000-0000-0000-000000000001/team` | the invitee's own pending invitation: "Nhận lời mời" / "Từ chối" (accepting changes the fixture) |
| B8 | `member` | `/me/settings` | sessions, sign-out, account deletion request |

## C. WF03 — HUB / Chapter / CLB operations (`ops` persona)

| # | Route | Check |
|---|---|---|
| C1 | `/ops/network` | organization selector / list and hierarchy |
| C2 | `/ops/org/10000000-0000-0000-0000-000000000101` | Chapter 01 dashboard: counters, "việc cần làm" |
| C3 | `…/members` | members list |
| C4 | `…/members/40000000-0000-0000-0000-000000000002` | member detail: membership review and leadership |
| C5 | `…/profile` | organization profile / detail |
| C6 | `…/events` | standalone event management (draft, published) |
| C7 | `…/settings` | organization settings and relationships |
| C8 | guest: `/organizations/chapter-01`, `/organizations/hub-network`, `/organizations/club-01` | public organization page: public-safe data only |
| C9 | `leader`: `/ops/org/…0101` allowed, `/ops/org/…0102` not found | scope presentation for a chapter leader |

Mutating actions (approve, publish, invite, submit) change the shared review data. They are allowed, but tell the operator so the fixtures can be re-seeded.

## Related

- [PO_UI_UX_REVIEW.md](PO_UI_UX_REVIEW.md) — environment, personas, login, blockers
