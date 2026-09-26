# PO UI/UX Review

| Item | Value |
|---|---|
| Environment | PRE-UAT / PO REVIEW (not Production Go-Live) |
| URL | https://1hubnetwork.io.vn |
| Review entry | https://1hubnetwork.io.vn/auth (`/` is still the M0 bootstrap placeholder by design) |
| Deployed SHA | `95e9ee87011fc67befdc6d87f7ce4513fc78fcab` (WF02-S04 report; implementation `39c4e57`) |
| Data | deterministic NON-production fixtures (`seed_p0_deterministic.sql`): generic names, `@example.test` emails |

## Review accounts

| Persona | Use it for |
|---|---|
| `leader@example.test` (Demo Leader) | main account: onboarding done, profile 90%, ACTIVE membership in Chapter 01, "Chapter Leader" leadership record, consents |
| `pending@example.test` (Demo Pending) | `/me/roles` with a PENDING_APPROVAL membership |

## Login

There is no outbound email yet. An operator issues a one-time link with the app's own magic-link service:

```
ssh hub-vps /opt/1hub-network/app/bin/issue-login-link.sh leader@example.test
```

- The link is printed to the operator's terminal only. It is valid for **15 minutes** and works **once**. Open it in the PO's browser.
- Only `@example.test` personas are accepted. The token is never stored raw, and it is redacted from the Nginx logs.
- The session then lasts 30 days in that browser. To get a new link, run the command again.

## Screens ready for review

| Workflow | Screens |
|---|---|
| WF01 (8/8 closed) | S01 `/auth`. S02 check email appears after submitting any `@example.test` address on `/auth`; no email is actually sent. S03 callback shows while an operator link is opened, and reopening it shows the USED state. S04 `/auth/error`. S05–S08 onboarding are only reachable by a persona with incomplete onboarding (`newcomer@example.test`) |
| WF02 (3/7 closed) | S01 Account Home `/me`, S03 Privacy / Visibility `/me/privacy`, S04 Roles / Network `/me/roles` |

## Not ready yet (placeholders; do not review)

- S02 Profile Edit `/me/profile/edit`: Claude A is implementing it.
- S07 Settings `/me/settings`, S05 Venture, and S06 Venture Team.
- Top navigation (Thư viện, Challenge, Sự kiện) and the sidebar items "Lời mời" and "Tổ chức của tôi".

## Known intentional P0 differences

- The WF01-S02 "Mở Gmail" button is omitted by contract.
- The WF01-S03 EXPIRED copy was reworded (DEC-WF01-S03-D6a).
- WF01-S04 GENERIC error is a known design gap (DESIGN-GAP-GENERIC).
- On `/me/roles`, rows are read-only, and a membership request only creates PENDING_APPROVAL.
- Leadership is shown separately from permissions (RBAC).
- Fixture personas have no avatar image, so completion reads 90%, "còn thiếu ảnh đại diện".

## Known release-only dependencies

- PRODUCTION_LEGAL_CONTENT_REQUIRED: the "Đọc" links on `/me/privacy` return 404 until real Terms/Privacy text is supplied.
- REAL_PRODUCTION_ROSTER_DATA: organisations are "Chapter 01" and similar fixtures.
- PRODUCTION_REGION_DOMAIN_SKILL_TAXONOMY: there are 7 fixture vocabulary items.
- Outbound email provider: login currently goes through operator links.

## PO review focus

- Layout, visual hierarchy, and spacing.
- Copy (Vietnamese wording).
- Navigation clarity in the member shell.
- Component consistency across `/auth`, `/me`, `/me/privacy`, and `/me/roles`.
- Perceived usability, and how the P0 scope is presented (what is shown vs. deliberately absent).

Infrastructure is out of scope for this review.

## Deployed-environment captures (1440×900, not design baselines)

| File | Screen |
|---|---|
| [01-auth.png](review/01-auth.png) | `/auth` |
| [02-me.png](review/02-me.png) | `/me` (Demo Leader) |
| [03-me-privacy.png](review/03-me-privacy.png) | `/me/privacy` |
| [04-me-roles.png](review/04-me-roles.png) | `/me/roles` |
| [05-me-roles-pending.png](review/05-me-roles-pending.png) | `/me/roles` (Demo Pending) |

## Related

- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — deploy, rollback, backup
