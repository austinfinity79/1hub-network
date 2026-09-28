# TASK-22-PREVIEW-AUTH Real Email

**TASK 22-PREVIEW-AUTH — real e-mail magic link through Resend, invite-only: GREEN.** Decisions: [DEC-AUTH-EMAIL](../../decisions/DECISION_LOG.md#dec-auth-email) D1–D4. Continues the [configuration stop](TASK-22-PREVIEW-AUTH_email-config-stop.md) and the [Resend precheck](TASK-22-PREVIEW-AUTH-CONFIG_resend-precheck.md).

## Precheck
| Item | Result |
|---|---|
| Resend domain `1hubnetwork.io.vn` | **Verified**: a send from `no-reply@1hubnetwork.io.vn` to Resend's test sink `delivered@resend.dev` was accepted (200 + id). The key is sending-only, so `GET /domains` answers 401 `restricted_api_key` (expected) |
| Server env (`/opt/1hub-network/shared/env/app.env`, mode 600) | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL` present; no `NEXT_PUBLIC_*` variant; values never printed |

## Flow
`/auth` e-mail → provisioned? (account or launch-roster row) → no: 403 `AUTH_ACCOUNT_NOT_PROVISIONED`, no token, no account, notice "Email này chưa được cấp quyền truy cập Internal Alpha." → yes: rate limits → existing `requestMagicLink` (sha256 hash, 15 min, single use) → Resend e-mail with `https://1hubnetwork.io.vn/auth/callback?token=…` → callback consumes once → session cookie (HttpOnly, Secure, SameSite=Lax) → onboarding if incomplete, `/me` if complete.

| Piece | File |
|---|---|
| Resend adapter (HTTPS, no SDK; key never logged or returned) | `src/lib/email/resend.ts` |
| Link origin, template, delivery, dev outbox | `src/lib/auth/magic-link-email.ts`, `src/app/dev/outbox/route.ts` (404 without dev routes) |
| Invite-only check | `src/lib/auth/provisioning.ts` |
| Rate limit: 10 links / address / 15 min, 30 requests / IP / 15 min, 429 `AUTH_RATE_LIMITED` | `src/lib/auth/rate-limit.ts` |
| Request / resend routes; send failure rolls back or retires the token, 500 `AUTH_EMAIL_DELIVERY_FAILED` | `src/app/api/v1/auth/magic-link/route.ts`, `…/resend/route.ts`, `src/lib/auth/magic-link.ts` |
| Form notice | `src/app/(auth)/auth/auth-entry-form.tsx` |
| Error codes, env template | `src/lib/api/error-codes.ts`, `.env.example` (key empty) |

## Verification
| Case | Result |
|---|---|
| Real delivery | Production build, dev routes off, real key injected at runtime from the server env (not printed): `POST /api/v1/auth/magic-link` for a locally provisioned `delivered@resend.dev` → **202**; log `magic-link e-mail accepted { provider: 'resend', id, to: 'd***@resend.dev' }`; 1 hashed token row. Human inbox receipt: post-deploy smoke (the link targets the public domain) |
| A onboarding-incomplete account | e-mail link → callback → `/onboarding/purpose`, HttpOnly session cookie, still 1 account |
| B onboarded member | e-mail link → `/me` |
| C unknown e-mail | 403 + notice, 0 accounts, 0 token rows, nothing sent (also checked with the real key: 0 rows) |
| D reused token | second open → `/auth/callback?status=used`, "Liên kết không còn hiệu lực", no session |
| E expired / invalid | expired → `status=expired`; malformed → `/auth/error` |
| Rate limit (server mode) | IP: requests 31+ in the window → 429; address limit: DB test (11th link → 429) |
| Secrets | key in no file, commit, log line, client chunk (`.next/static`: 0 matches) or report; logs carry no link or token |

## QA
| Gate | Result |
|---|---|
| Unit | 245 / 245 (Resend adapter, link origin, template, delivery logging) |
| DB | 354 / 354 (provisioning, rate limits by address and IP, window expiry) |
| Targeted regression (final build) | **239 passed / 0 failed**: WF01 153 + e-mail flow 5 (A, B, C, D, E), P0-SHELL 14, P0-LANDING 10, auth-session 13, authz-session 8, SEC-OBS 3, console-health 4, Internal Alpha release 7, idempotency 7, API contract 8, WF02 smoke 7 |
| Build | format, lint, typecheck PASS; production build PASS |
| Runtime | #418 = 0; 0 HTTP 5xx; 0 unexpected console errors; no schema, seed or dependency change since `cc6ca28` |

## Deploy notes
- Recreate the app container so it reads the three variables (`deploy.sh` does). A missing or invalid variable fails closed: 500 `AUTH_EMAIL_DELIVERY_FAILED`, no token kept.
- Only provisioned addresses can request a link: existing accounts (including `@example.test` personas already used on the server) or roster rows (`pnpm roster:import <file.csv>`). New `@example.test` personas keep the operator link (`issue-login-link.sh`, D4).
- Post-deploy smoke: request a link for an operator-approved provisioned inbox, open it, land on `/me` or onboarding; reopen → "used"; an unknown address → the notice.

## Git
| Field | Value |
|---|---|
| NEW APP PREVIEW SHA | `5a195f72acf05dd6537b6c70ad185e0737acd916` (local tag `internal-alpha-preview-03`) = `33f8b0c` login UI hotfix + this task |
| ROLLBACK SHA | `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` (the deployed preview; schema-safe, no migration) |
| REPORT / DOCS SHA | the commit that contains this report |

Branch `main`; start HEAD `6d6947b`, checked again before each commit. Push **NOT RUN**; nothing deployed.

## Related
- [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md) · [TASK-22-PREVIEW-LOGIN-UI_login-hotfix.md](TASK-22-PREVIEW-LOGIN-UI_login-hotfix.md)
