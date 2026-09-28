# TASK-22-PREVIEW-AUTH Email Config Stop

**TASK 22-PREVIEW-AUTH — real e-mail magic-link login: BLOCKED CONFIGURATION.** Stopped at "connect email delivery", as the task requires when no provider credentials or verified sender exist. Product code, schema, RBAC: **0 changes**. The frozen preview `cc6ca28` stays the deployable preview; nothing new to deploy.

## Verified (read-only)
| Area | Fact |
|---|---|
| Provider | none: no provider dependency in `package.json`; `.env.example` holds only `DATABASE_URL`, `ENABLE_DEV_ROUTES`, `MEDIA_STORAGE_DIR`, `MEDIA_AVATAR_MAX_BYTES`; no provider variable in the environment; deploy docs: "There is no email provider: logins use operator links" |
| Request | `POST /api/v1/auth/magic-link` → `requestMagicLink`: stores only the token hash (`auth_magic_link_requests`), expiry 900 s, always 202, never looks up the account (no-disclosure rule, API 05:157-185); the raw token is dropped (no delivery step exists) |
| Consume | `/auth/callback` → `consumeMagicLink`: single-use (`consumed_at`), expiry checked, then **creates the account** (`INSERT … ON CONFLICT`) — auto-registration on first sign-in, plus roster reconciliation |
| Session / redirect | `createSession` → HttpOnly Secure cookie; onboarding incomplete → resolver step, complete → `/me`; no return path (see 28/09 BD-02) |
| Rate limit | none server-side; 429 exists only in the contract and the UI; a 60 s resend countdown on the client |
| Accounts | deployed data = `@example.test` personas only (reserved TLD, undeliverable); no real address is provisioned |

## What a human must configure
| # | Item | Where |
|---|---|---|
| 1 | E-mail provider account and a send-only API key (recommended: **Resend**, HTTP API, no SDK needed; Postmark or an SMTP relay also fit) | server `.env` as `RESEND_API_KEY` (secret; never in git) |
| 2 | Verified sender domain for `1hubnetwork.io.vn` (or a subdomain): the provider's DKIM and SPF / return-path DNS records, DMARC recommended; a From address, e.g. `1hub.network <no-reply@1hubnetwork.io.vn>` | DNS of the domain; `EMAIL_FROM` in the server `.env` |
| 3 | Canonical public base URL for links | `APP_PUBLIC_BASE_URL=https://1hubnetwork.io.vn` in the server `.env` |
| 4 | Real pre-provisioned demo addresses you control: A onboarding incomplete, B onboarded member, C project owner / member, and permission to create them in the review DB | send privately to the operator; not in git |
| 5 | Confirm: (a) the "Email này chưa được cấp quyền truy cập Internal Alpha." message replaces the "always 202, no disclosure" rule (it reveals whether an address is provisioned); (b) whether roster-listed addresses count as pre-provisioned; (c) whether operator links for new `@example.test` addresses may still create accounts (Test Pack flow 2) | PO decision |

## Implementation once configured (≈ 30–45 min, no migration)
1. Delivery adapter (`src/lib/email/`): provider over `fetch`, fails closed when unconfigured (never reports a send it did not make); logs provider message id + masked address only.
2. Request: look up an ACTIVE `user_accounts` row (per 5b); unknown → no token row, neutral error state; known → insert token (unchanged), send `${APP_PUBLIC_BASE_URL}/auth/callback?token=…` with subject "Đăng nhập 1hub.network", one CTA, the 15-minute expiry and an "ignore if not you" line.
3. Consume: no account creation for unknown addresses; everything else unchanged.
4. Server rate limit from `auth_magic_link_requests` counts (per address and per IP) → 429.
5. Tests: adapter (mocked HTTP), allowlist and no-create DB tests, WF01 auth specs, one real delivery to address B, preview regression; then a new APP PREVIEW SHA.

## Git
Start HEAD `c1c3611`. Docs-only commit; push **NOT RUN**.

## Related
- [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
