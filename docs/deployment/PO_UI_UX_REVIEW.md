# PO UI/UX Review

> **Superseded:** this describes the Phase 0 build `0a2df09`. The Internal Alpha release `9c61458` is recorded in [INTERNAL_ALPHA_DEPLOYMENT.md](INTERNAL_ALPHA_DEPLOYMENT.md); its test pack is a separate task.

Phase 0 integrated review build (WF01, WF02 and WF03 are all CLOSED / GREEN). This is **not** a production launch.

| Item | Value |
|---|---|
| Environment | PRE-UAT / PO REVIEW |
| URL | https://1hubnetwork.io.vn (VPS `103.252.93.145`, behind OneShield) |
| Entry | `/`: guests go to `/auth`, incomplete onboarding goes to its step, completed members go to `/me` |
| Deployed SHA | `0a2df094b941f6d0f0fc87cdb7767b2e92272198` (WF03 completion audit), deployed 2026-09-26 16:41 UTC |
| Previous SHA | `95e9ee87011fc67befdc6d87f7ce4513fc78fcab` (kept for rollback) |
| Data | deterministic NON-production fixtures (`seed_p0_deterministic.sql`): generic names, `@example.test` addresses |

## Review personas

| Persona | Role | Use it for |
|---|---|---|
| `ops@example.test` | PLATFORM_ADMIN | WF03: all `/ops/...` screens on any organization |
| `member@example.test` | completed member, venture owner | WF02: `/me`, profile edit, privacy, roles, settings, venture edit/team |
| `leader@example.test` | HUB_COMMUNITY_LEADER on Chapter 01, "Chapter Leader" record | pending venture invitation on `/projects/50000000-…-0001/team`; ops scoped to Chapter 01 only |
| `pending@example.test` | PENDING_APPROVAL membership | `/me/roles` pending state |
| `newcomer@example.test` | onboarding not done | WF01 onboarding S05–S08, which **completes it permanently** (see checklist) |

## Login (no email provider yet)

An operator issues a normal one-time magic link through the app's own service:

```
ssh hub-vps /opt/1hub-network/app/bin/issue-login-link.sh ops@example.test
```

- The link is printed to the operator's terminal only. It works **once** and expires after **15 minutes**. Open it in the PO's browser.
- Only `@example.test` personas are accepted. No login endpoint or bypass exists, and the token is redacted from the Nginx logs.
- A session lasts 30 days per browser. "Đăng xuất" is in `/me/settings`. Run the command again for a new link.

## Checklist

See [PO_REVIEW_CHECKLIST.md](PO_REVIEW_CHECKLIST.md).

## Known intentional P0 differences

- WF01: the "Mở Gmail" button is omitted; the S03 EXPIRED copy was reworded (DEC-WF01-S03-D6a); S04 GENERIC is a known design gap; the S05 investor option is out of P0.
- WF02: "Gửi lại" for team invitations is omitted (there is no email); the sidebar "Lời mời" item is not a P0 screen; fixture personas have no avatar image (completion shows 90%).
- WF03: S05 is FUTURE (WF04). `/ops/org/<id>/programmes` is not a P0 review screen.

## PO review blockers vs go-live blockers

| Item | PO review | Go-live |
|---|---|---|
| OneShield overrides `Referrer-Policy` (app sends `no-referrer`), so asset Referers carry the callback token (same-origin only) | not blocking (review tokens are single-use fixtures and logs are redacted) | **BLOCKER**: set OneShield to keep the origin header, or to `no-referrer` |
| OneShield injects `/_osh-cs/widget.js` and `/_rum/beacon.js` into pages | not blocking | review before launch |
| PRODUCTION_LEGAL_CONTENT_REQUIRED: the legal "Đọc" links return 404 | not blocking | BLOCKER |
| Outbound email provider (magic link, team invitations) | not blocking (operator links) | BLOCKER |
| REAL_PRODUCTION_ROSTER_DATA, PRODUCTION_REGION_DOMAIN_SKILL_TAXONOMY | not blocking | BLOCKER |
| OneShield→origin HTTPS; restricting origin to OneShield IPs; off-VPS backup; backup alerting; root password rotation | not blocking | hardening before launch |

## Deployed-environment captures (1440×900, not design baselines)

These are in [review/](review/).

| Area | Files |
|---|---|
| WF01 | `p0-01-auth`, `p0-05-onboarding-entry` |
| WF02 | `p0-10-me`, `p0-11-profile-edit`, `p0-12-privacy`, `p0-13-roles`, `p0-14-settings`, `p0-15-venture-new`, `p0-16-venture-edit`, `p0-17-venture-team`, `p0-18-leader-invitation`, `p0-19-roles-pending` |
| WF03 | `p0-30-ops-network`, `p0-31-ops-dashboard`, `p0-32-ops-members`, `p0-33-ops-member-detail`, `p0-34-ops-profile`, `p0-35-ops-events`, `p0-36-ops-settings`, `p0-40-public-org-chapter-01` |

## Related

- [PO_REVIEW_CHECKLIST.md](PO_REVIEW_CHECKLIST.md) — manual review journey
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — deploy, rollback, backup
