# TASK-22-PREVIEW-PROVISION Alpha Accounts

**PRE-PROVISION 3 INTERNAL ALPHA LOGIN ACCOUNTS: DONE.** Account provisioning only, on the deployed preview `5a195f7` (https://1hubnetwork.io.vn). No product code, schema, migration or auth change.

## Precheck
| Item | Finding |
|---|---|
| Account entity | `user_accounts` (`email`, `email_normalized` UNIQUE, `status`, `last_login_at`) |
| Normalisation | `normalizeEmail` = trim + lower-case (`src/lib/auth/email.ts`) |
| Default state | the callback creates `status = 'ACTIVE'` plus `account_created` (WF01 funnel, exactly once) |
| Normal member | no `role_assignments` row (every self-onboarded account has 0; the 6 role rows are seed fixtures) |
| Onboarding | `individual_profiles.onboarding_completed_at`; no profile = incomplete, first step `/onboarding/purpose` |
| Existing mechanisms | callback (creates on first sign-in; unprovisioned addresses cannot request a link since DEC-AUTH-EMAIL-D1); `pnpm roster:import` (requires an organisation and an ACTIVE membership, so not account-only); `issue-login-link.sh` (`@example.test` only) |

## Mechanism
New operator command `deploy/bin/provision-account.sh` (`deploy/vps-foundation` `1f558d6`): runs inside the app container with the app's own `normalizeEmail`, `withTransaction` and `trackEvent`, and creates exactly what the callback creates (`INSERT … ON CONFLICT (email_normalized) DO NOTHING` + `account_created`). Nothing else. Idempotent; masked output; no credentials leave the container. Tested locally (created once, case-insensitive re-run = ALREADY EXISTS, 1 event, 0 profile, 0 role, implausible address refused).

## Result (addresses masked)
| Address | Before | Action | After |
|---|---|---|---|
| `g***@1hub.network` | no account (3 expired link rows from sign-in attempts before invite-only, never used) | CREATED; re-run ALREADY EXISTS | 1 ACTIVE account, onboarding incomplete |
| `t***@gmail.com` (Thảo) | no account | CREATED; re-run ALREADY EXISTS | 1 ACTIVE account; the tester has since signed in → `/onboarding/purpose`, onboarding incomplete |
| `t***@gmail.com` (Thanh Long) | no account | CREATED; re-run ALREADY EXISTS | 1 ACTIVE account, onboarding incomplete |

All three: 0 role, 0 platform admin, 0 leadership, 0 community membership, 0 roster row, 0 project or invite. `POST /api/v1/auth/magic-link` → 202, Resend accepted (provider ids logged, addresses masked). Duplicate normalised e-mails in the table: 0. Row counts: accounts 9 → 12, every other table unchanged by the provisioning.

## Security
No auth bypass: the public endpoint still refuses unprovisioned addresses; dev routes stay closed (`/dev/login`, `/dev/outbox` 404). App log: key, token and delivery-failure lines 0. No token printed or stored in any file.

## Git
Branch `main`; start HEAD `2dc6c7e`, checked again before the commit. Deploy branch `1f558d6` (command) and `8e0335b` (record). Push **NOT RUN**.

## Related
- [TASK-22-PREVIEW-03_real-email-deploy.md](TASK-22-PREVIEW-03_real-email-deploy.md) · [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md)
