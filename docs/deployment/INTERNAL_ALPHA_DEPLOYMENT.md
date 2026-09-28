# Internal Alpha Deployment

Task 20 record. The governing manifest is `docs/implementation/INTERNAL_ALPHA_RELEASE_MANIFEST.md` on `main` (`652c383`). This is an Internal Alpha review environment, not a production launch. Team UAT: **PENDING**.

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn (VPS `103.252.93.145`, behind OneShield) |
| Deployed application SHA | `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (manifest release SHA) |
| Deploy tooling SHA | `68488cfe9732b46aad297e24ab6f2811ce6d9caf` (`deploy/vps-foundation`; adds `COPY patches ./patches` before the install) |
| Image | `onehub-app:9c614585…` = `sha256:f80211919c49…` |
| Deployed | 2026-09-27 17:34:24 → 17:37:27 UTC (2026-09-28 00:37 ICT) |
| Rollback SHA | `0a2df094b941f6d0f0fc87cdb7767b2e92272198` (image kept; round trip verified) |
| Release identity proof | server `releases/<sha>` content hash equals `git archive 9c61458` (722 files, `046c9f1d…`) |
| Patch proof | image installs `next@15.5.26_patch_hash=989560c2…` (matches the lockfile); the fix is present in the production `react-dom-client` bundle |

The task prompt spelled the release SHA with 41 characters (`…c78fa7ef7bc0`), which is not a valid object. The manifest, the freeze commit `652c383` ("release SHA 9c61458") and the only matching commit give `…c78fafe7bc0`, and that commit was deployed.

## Checks

| Area | Result |
|---|---|
| Backup (before) | `onehub-20260927T173413Z.dump` (92,530 B; `pg_restore --list` 202 entries; DB `onehub_p0`), plus media `media-20260927T173414Z.tar.gz` (media dir empty) |
| Migrations | ledger before: 001–009; deploy: 9 × skip; no checksum mismatch |
| Seed | not rerun: the DB was already seeded (manifest rule) |
| Env | `DATABASE_URL` present and well-formed; `NODE_ENV=production`; `MEDIA_STORAGE_DIR=/data/media`; `ENABLE_DEV_ROUTES` unset; `LEGAL_CONTENT_DIR` unset (decision) |
| Health | `/api/v1/auth/providers`: 10 × 200 locally and 10 × 200 on the domain |
| Domain smoke | `/`, `/auth`, `/api/v1/session` and `/api/v1/vocabularies/REGION` return 200. Guest `/me` returns 307 → `/auth`. `/dev/typography`, `POST /dev/login`, unknown pages and unknown APIs return 404. HTTP 301 → HTTPS |
| Workflow smoke | P0-LANDING, P0-SHELL, WF01 (onboarding entry), WF02, WF03 (ops), WF04 demo (ops-only; a member gets 404 by guard), WF05 demo: all PASS at 1440×900 |
| Hydration | #418 = 0; console errors = 0; failed responses = 0; mixed content = 0 |
| Responsive | 1440 / 768 / 390: no clipped controls. Page-level sideways scroll at 390 on the member, ops and onboarding shells (accepted: IA-P3-08, IA-L1) |
| Security / logs | cookie Secure, HttpOnly, SameSite=Lax. `token=` count 0 in the Nginx, app and DB logs; no secrets in logs. App errors 0, DB ERROR/FATAL 0, Nginx 5xx 0. The public DTO carries no PII keys |
| Rollback | `rollback.sh` 9c61458 → 0a2df09 → 9c61458, smoke PASS each way; schema unchanged (no migration since 0a2df09) |

## Re-verification (Task 20 re-issue, 2026-09-28 01:00–01:10 UTC)

The task was re-issued with the same 41-character SHA. It was not redeployed; the running release was re-verified.

| Check | Result |
|---|---|
| Running release | `APP_SHA=9c61458…fafe7bc0`, image `f80211919c49`, state current 9c61458 / previous 0a2df09. The deploy worktree `81da9bd` is clean, and `deploy/` is unchanged since `68488cf` |
| No-cache build | `docker build --no-cache` of `releases/9c61458…`: `COPY patches` runs before `pnpm install --frozen-lockfile` (lockfile up to date, +385 packages), production build compiled, EXIT=0. The image installs `next@15.5.26_patch_hash=989560c2…` and the fix is in `react-dom-client.production.js`. The verify image was removed |
| Backup | `onehub-20260928T010155Z.dump` (93,524 B, sha256 `674cf1999bc0…`, 202 entries) |
| App restart | `docker compose restart app`. Row counts unchanged (9 migrations, 5 profiles, 3 memberships, 1 venture, 2 events, 17 live sessions). A pre-restart signed-in session still opens `/me` and `/me/roles`. Health 5/5 locally and on the domain |
| Domain smoke after restart | 5/5 suites PASS: #418 = 0, console errors 0, failed responses 0, clipped controls 0. 390 px sideways scroll only on the accepted shells (IA-P3-08) |
| Logs | app errors 0, DB ERROR/FATAL 0, Nginx 5xx 0; `token=` and secret or cookie strings 0 |

## Rollback procedure

```
ssh hub-vps /opt/1hub-network/app/bin/rollback.sh   # previous = 0a2df09 (reuses the kept image)
ssh hub-vps /opt/1hub-network/app/bin/rollback.sh   # run again to return to 9c61458
```

Rollback never reverts the schema. Going back to `0a2df09` brings back the recoverable hydration #418 (IA-P2-02).

## Known limitations (not blocking the Internal Alpha deploy)

- OneShield rewrites `Referrer-Policy` to `strict-origin-when-cross-origin` (the origin sends `no-referrer` on the callback). Same-origin asset Referers can carry the one-time token; logs are redacted. This is a go-live item.
- There is no email provider: logins use operator links (`issue-login-link.sh <name>@example.test`).
- Legal content returns 404 (`PRODUCTION_LEGAL_CONTENT_REQUIRED`). The proxy sets no CSP. Media is not part of `pg_dump`.
- Real roster and taxonomy are post-alpha. The accepted P3s are IA-P3-01..08 and IA-L1, with IA-OBS-01 on watch.

## Captures (deployed domain)

`review/ia-*.png`: landing, auth, shell, WF01–WF05 entries, and responsive captures at 768 and 390.

## Related

- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
