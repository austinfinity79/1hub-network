# Internal Alpha Preview Real Email Deployment

TASK 22-PREVIEW-03 record: **INTERNAL ALPHA PREVIEW — HOMEPAGE + L1 (login UI hotfix, real e-mail magic link) + L2**. This is not the final Internal Alpha release. The governing manifest is `docs/implementation/INTERNAL_ALPHA_PREVIEW_RELEASE.md` (`main` `aa8748a`).

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Preview SHA (deployed) | `5a195f72acf05dd6537b6c70ad185e0737acd916` (tag `internal-alpha-preview-03`). The prompt spelled it with 41 characters (`…acd1916`, not an object); the PO confirmed the 40-character SHA before the deploy |
| Rollback SHA | `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` (image and sources kept; `db/`, `patches/`, lockfile identical) |
| Tooling | `deploy/vps-foundation` `bd498ef`; `deploy/` unchanged |
| Image | `onehub-app:5a195f72…` = `sha256:10b9bd13a6fe…`; kept images: 5a195f7 and cc6ca28 |
| Deployed | 2026-09-28 06:51 → 06:55 UTC (13:55 ICT) |
| Identity proof | server `releases/<sha>` content hash equals `git archive 5a195f7` (838 files, `e1aca2f6…`) |
| Patch proof | `next@15.5.26` patch hash `989560c2…` (unchanged); patched lines present in the image's `react-dom-client.production.js` |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260928T065152Z.dump` (100 KB, sha256 `457026ef…`). Daily timer active |
| Migrations / seed | 9 × skip; no seed; no schema change |
| Env | `RESEND_API_KEY`, `EMAIL_FROM` (verified `1hubnetwork.io.vn` sender), `APP_PUBLIC_BASE_URL=https://1hubnetwork.io.vn` present in the recreated container; no `NEXT_PUBLIC_*` copy; `ENABLE_DEV_ROUTES` unset. Values never printed |
| Health | app and DB healthy; `/`, `/auth`, `/api/v1/session`, `/api/v1/auth/providers`, `/api/v1/vocabularies/REGION` 200; `/me` → `/auth` for guests; `/dev/outbox`, `POST /dev/login` 404; 14 / 14 page assets 200 |
| Real e-mail | UI request (`/` → "Đăng nhập" → `/auth` → "Gửi liên kết đăng nhập") for the operator-approved inbox `q***@gmail.com`: 202, `/auth/check-email`; Resend accepted (provider id logged, masked address). The operator received it and opened the link in their own browser: `/auth/callback` 200 → consume 200 → `/onboarding/purpose` (onboarding incomplete); one new session |
| Completed member | callback for `member@example.test` → `/me` |
| Negative | unknown address → 403 `AUTH_ACCOUNT_NOT_PROVISIONED` + notice, 0 accounts, 0 tokens, 0 e-mails; reused links → `status=used`; link older than 15 min → `status=expired`; malformed token → `/auth/error`; no session in any case |
| L1 / L2 demo | new persona through onboarding (purpose → profile → privacy → complete) → `/me` → profile edit → settings → privacy → project create (team step skipped) → edit saved → team → `/me` |
| Runtime | #418 = 0; unexpected console errors 0; broken assets 0; app 5xx 0 |
| Responsive | 1440: 0 overflow on every route. 390: home, auth, onboarding, settings, project create 0 overflow; `/me` (+260), `/me/privacy` (+109), project edit (+534) keep the desktop frame (PL-07); 0 off-screen controls |
| Restart | `docker compose restart app`: same image and SHA, healthy, env present, row counts unchanged, domain and assets 200, public endpoint answers |
| Logs | Nginx 5xx: one 502 on `GET /health` from the external monitor at 07:13:16, inside the restart window; app ERROR 0; key or token strings 0. The two DB errors are the operator's own precheck queries |

## Provisioning note

The server wrapper `issue-login-link.sh` refuses real addresses. With PO approval the same `issue-login-link.mjs` ran inside the app container for the test inbox, and the app's own callback created the account. Real testers are now provisioned with `provision-account.sh` (`1f558d6`, see below).

## Tester provisioning (2026-09-28 07:26 UTC)

`provision-account.sh` for 3 operator-supplied addresses (`g***@1hub.network`, `t***@gmail.com` × 2): run 1 CREATED × 3, run 2 ALREADY EXISTS × 3; accounts 9 → 12, no other table changed. Each: 1 ACTIVE account (normalised address), 1 `account_created`, 0 profile (onboarding incomplete), 0 role / admin / leadership / membership / roster / project invite. `POST /api/v1/auth/magic-link` → 202 and Resend accepted for all three. One tester signed in meanwhile: callback → consume → `/onboarding/purpose`.

## Test data created by this smoke

- `q***@gmail.com` (operator's real inbox): account + profile, onboarding not completed, 2 sessions.
- `preview03-demo-1790578980954@example.test`: onboarded, owns "Dự án Demo Preview 03 (đã sửa)".
- Extra sessions for `member@example.test` (link checks).

## Related

- [INTERNAL_ALPHA_PREVIEW_DEPLOYMENT.md](INTERNAL_ALPHA_PREVIEW_DEPLOYMENT.md) — TASK 22-PREVIEW-02 (cc6ca28)
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
- Screenshots: `review/preview-03/`
