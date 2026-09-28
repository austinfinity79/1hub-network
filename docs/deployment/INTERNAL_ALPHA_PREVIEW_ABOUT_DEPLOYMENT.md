# Internal Alpha Preview About Deployment

TASK 22-PREVIEW-ABOUT-DEPLOY record: **INTERNAL ALPHA PREVIEW — HOMEPAGE + ABOUT + L1 (real e-mail login) + L2**. Not the final Internal Alpha release. Governing manifest: `docs/implementation/INTERNAL_ALPHA_PREVIEW_RELEASE.md` (`main` `4aed631`).

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn |
| Preview SHA (deployed) | `04795794cd72e70c58652dfa037a4c2fab6c0304` (tag `internal-alpha-preview-04`) |
| Rollback SHA | `5a195f72acf05dd6537b6c70ad185e0737acd916` (image and sources kept; `db/`, dependencies and `patches/` identical). The prompt spelled it with 41 characters (`…acd1916`), the typo resolved in TASK 22-PREVIEW-03 |
| Tooling | `deploy/vps-foundation` `8e0335b`; deploy scripts unchanged |
| Image | `onehub-app:04795794…` = `sha256:10a3025a907b…`; kept images: 0479579 and 5a195f7 |
| Deployed | 2026-09-28 08:01 → 08:04 UTC |
| Identity proof | `releases/<sha>` content hash equals `git archive 0479579` (895 files, `e9fd14aa…`) |
| Patch / assets | hydration patch lines in the image; `public/about` 12 + 34 WebP present |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260928T080129Z.dump` (104 KB) |
| Migrations / seed | 9 × skip; no seed; no schema change |
| Env | `RESEND_API_KEY`, `EMAIL_FROM`, `APP_PUBLIC_BASE_URL` (= domain) set in the recreated container; dev routes off. Values not printed |
| About | `/about` 200 for guests, refresh, back / forward; 46 images, 0 broken, 0 distorted, 43 lazy; 34 Humans of HUB portraits in the organisation section; overflow 0 and footer links 8 / 8 at 1440 / 1024 / 768 / 390 |
| Homepage | "Về HUB Network" (nav, footer) → `/about` at 1440 and 390 |
| Auth | UI request for the operator's test inbox 202, Resend accepted; new persona → `/onboarding/purpose`; `member@example.test` → `/me`; `/me/profile/edit`, `/me/settings`, `/me/privacy`, `/projects/new` 200; guest `/me` → `/auth`; unknown address 403 |
| Runtime | #418 0; console errors 0; Nginx 5xx since deploy 0 (including the restart); app error, key or token lines 0 |
| Restart | `docker compose restart app`: same image and SHA, healthy, env present, row counts unchanged, `/about`, WebP and `/_next/image` 200 |
| Rollback | `rollback.sh` → 5a195f7 (state `previous`, image and sources present) |

## Observation

One domain callback of eight (08:07:46 UTC, headless) sent `consume` twice (200, then 409) and showed the "used" state although a session had been created; the retry landed on `/me`. Pre-existing callback code (unchanged since `5735d78`); follow-up FU-AUTH-DOUBLE-CONSUME on `main`.

## Test data created by this smoke

- `preview04-demo-…@example.test`: account from the operator link, onboarding not started.
- Sessions for `member@example.test`; one magic-link request for the operator's test inbox.

## Related

- [INTERNAL_ALPHA_PREVIEW_REAL_EMAIL_DEPLOYMENT.md](INTERNAL_ALPHA_PREVIEW_REAL_EMAIL_DEPLOYMENT.md) — TASK 22-PREVIEW-03 (5a195f7)
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
