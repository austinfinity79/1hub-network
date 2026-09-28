# Internal Alpha Preview Deployment

TASK 22-PREVIEW-02 record for **INTERNAL ALPHA PREVIEW — HOMEPAGE + L1 + L2**. This is **not** the final Internal Alpha release. The governing manifest is `docs/implementation/INTERNAL_ALPHA_PREVIEW_RELEASE.md` (`main` `c1c3611`).

## Release identity

| Item | Value |
|---|---|
| Domain | https://1hubnetwork.io.vn (VPS `103.252.93.145`, behind OneShield) |
| Preview SHA (deployed) | `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` |
| Rollback SHA | `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`. The prompt spelled it with 41 characters (`…fa7ef7bc0`, not an object); the manifest value was used |
| Tooling | `deploy/vps-foundation` `6604fd8`; `deploy/` unchanged since `68488cf` (`COPY patches` before the install) |
| Image | `onehub-app:cc6ca287…` = `sha256:81d91274640d…`; kept images: cc6ca28 and 9c61458 |
| Deployed | 2026-09-28 04:45:31 → 04:48:51 UTC (11:48 ICT) |
| Identity proof | server `releases/<sha>` content hash equals `git archive cc6ca28` (809 files, `302ae4a7…`) |
| Patch proof | `next@15.5.26_patch_hash=989560c2…`; the fix is in `react-dom-client.production.js` |

## Checks

| Area | Result |
|---|---|
| Backup | `onehub-20260928T044528Z.dump` (95,230 B, sha256 `2e9080d6…`, 202 entries). Daily timer active |
| Migrations / seed | `db/` identical to 9c61458: 9 × skip; no seed; no schema change |
| Env | unchanged (no new variables in the preview) |
| Health | `/api/v1/auth/providers` 10 × 200 locally and 10 × 200 on the domain; the app and DB are healthy |
| Homepage | `/` 200 for guests. CTAs "Tạo hồ sơ startup của bạn", "Đăng nhập" and "Tạo tài khoản" go to `/auth`; "Mạng lưới đổi mới sáng tạo" goes to `/organizations/hub-network`; anchors `#cong-dong` and `#co-hoi` work. There are 17 links and 26 inert items (PL-01) |
| L1 | Operator link; a new account `preview-demo1@example.test` completed purpose → profile → privacy (consent required and validated) → complete → `/me` with manual onboarding only. No AI UI |
| L2 | `/me`, `/me/profile/edit`, `/me/settings`, `/me/privacy`, `/me/roles`, `/projects/new`, `/projects/:id/edit` and `/projects/:id/team` return 200. The wizard created 2 test ventures (`POST /api/v1/ventures` 201, "Nháp"). Shell navigation clicks work |
| Hydration / console | #418 = 0; console errors 0; failed responses 0 (apart from the legal links below) |
| Responsive | 1440 / 768 / 390: no clipped controls. Sideways scroll only at `/me` 390 (+205) and project edit at 768 (+156) and 390 (+534) (PL-07) |
| Restart | `docker compose restart app`: SHA and image unchanged; accounts, profiles, ventures and sessions unchanged; health, domain, CSS and font return 200 |
| Logs | app errors 0, DB ERROR/FATAL 0, Nginx 5xx 0; `token=` and secret or cookie strings 0 |
| Rollback | `rollback.sh` → 9c61458 (image kept; `db/` identical, so schema-safe); round trip proven in Task 20 |

## Test data created by this smoke

These are Internal Alpha test data (`@example.test`):
- `preview-demo1@example.test`: onboarded, owns the test ventures "Preview Demo Project (test)" (step-1 draft) and "Preview Demo Startup (test)".
- `preview-demo2@example.test`: signed in, onboarding not started.

## Preview limitations (non-blocking, from the manifest)

PL-01 inert homepage items · PL-02 unbuilt `/about`, `/events`, `/programmes`, `/login` · PL-03 no iHub Ventures CTA · PL-04 no return-to after login · PL-05 no L1 AI suggestion · PL-06 3-step onboarding · PL-07 desktop frame below 1024 · PL-08 consent overflow at 390 · PL-09 no owner profile page · PL-10 L4/L5/L6 not built, applications session-only · PL-11 legal content · PL-12 final Test Pack, regression and Alpha freeze pending.

## Observations for review

| Item | Detail |
|---|---|
| PL-11 wording vs. the server | The manifest says the legal pages show P0 fixture texts. On this server `LEGAL_CONTENT_DIR` is unset (release-manifest decision), so `/legal/terms/p0-2026-09` and `/legal/privacy/p0-2026-09` return **404**. The homepage footer and the consent links therefore reach 404. Serving the fixtures needs a human decision (for example `LEGAL_CONTENT_DIR` → fixtures) |
| `/health` 404 | An external monitor (103.72.96–98.x, no user agent) polls `GET /health` about every minute and has done so since before this deploy. The app has no `/health` route, so it gets 404. This does not affect users |
| OneShield `Referrer-Policy` | still rewritten at the edge (known go-live item) |

## Related

- [INTERNAL_ALPHA_DEPLOYMENT.md](INTERNAL_ALPHA_DEPLOYMENT.md) — Task 20 (9c61458)
- [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) — server layout and commands
