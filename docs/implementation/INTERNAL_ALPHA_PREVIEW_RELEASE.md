# Internal Alpha Preview Release

**INTERNAL ALPHA PREVIEW — HOMEPAGE + ABOUT + LIBRARY + L1 + L2 + REAL E-MAIL LOGIN.** Consolidated pre-production release of the approved surface; not the final Internal Alpha release. Frozen 2026-09-28 by TASK 22-PREVIEW-01 ([report](reports/TASK-22-PREVIEW-01_preview-release.md)); refrozen by TASK 22-PREVIEW-LOGIN-UI, TASK 22-PREVIEW-AUTH ([report](reports/TASK-22-PREVIEW-AUTH_real-email.md)), TASK 22-PREVIEW-ABOUT-DEPLOY ([report](reports/TASK-22-PREVIEW-ABOUT-DEPLOY_about-deploy.md)) the FINAL PRE-PRODUCTION CONSOLIDATION ([report](reports/TASK-22-FINAL-RELEASE_final-release.md)) and the FINAL RELEASE BLOCKER CLOSURE ([report](reports/TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md)). Deploy EXACTLY the app SHA below; never a branch name or HEAD (CLAUDE.md §14).

## Release
| Field | Value |
|---|---|
| **APP RELEASE SHA** (branch `main`) | **`2033264b9f8314cee8e8c1bf9c0022d2906ac4e9`** — local tag `internal-alpha-preview-06`; approved legal text and `/legal/<kind>` links ([DEC-LEGAL](../decisions/DECISION_LOG.md#dec-legal)) on top of `08bbbb9` (tag `-05`: favicon, `/library`, `/about`, real e-mail magic link, login UI). `3fd00e4` (homepage alignment, [DEC-H1-R2](../decisions/DECISION_LOG.md#dec-h1-r2)) is on `main` and **not deployed** |
| Deployment | **Deployed** by the FINAL RELEASE BLOCKER CLOSURE on 2026-09-28 12:30 UTC; image `sha256:2f5e2f9bc32682409d0f05473c44b4d0ac04207b0e475cc7732ea595649b8cc8` |
| Previous deployed | `08bbbb9e25a2d51f41323dd93dab33cfcf04001c` (tag `-05`) · `c535c3523472789a813c726815cfb32c513efd3e` · `04795794cd72e70c58652dfa037a4c2fab6c0304` (tag `-04`) · `5a195f7` (`-03`) · `cc6ca28` (`-01`) |
| **ROLLBACK SHA** | `08bbbb9e25a2d51f41323dd93dab33cfcf04001c` — `state/previous`; image and sources kept on the server; `rollback.sh` returns to it (it has no `content/legal`, so legal links answer 404 again) |
| Backup before deploy | `/opt/1hub-network/shared/backups/onehub-20260928T122736Z.dump`; env copy `app.env.bak-20260928T122736Z` |
| Deploy tooling | branch `deploy/vps-foundation` (worktree `/Users/thanosvn/workspace/1hub-network-deploy`); deploy scripts unchanged since `68488cf`; `provision-account.sh` since `1f558d6` |
| Schema | no migration, seed, dependency or patch change since `9c61458`: migrate 9 × skip; rollback is schema-safe |
| Environment | [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) plus `RESEND_API_KEY` (secret), `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `LEGAL_CONTENT_DIR=content/legal` (present); `ENABLE_DEV_ROUTES` unset; optional `LIBRARY_STARTUP_SOURCE_URL` (default `https://startup.1hub.cloud/data/startup.json`, outbound HTTPS required) |
| Health endpoint | `GET /api/v1/auth/providers` (200 JSON; also the container healthcheck). There is no `/health` route; the external monitor must use this path |

## Deploy (done)
| Step | Command / check |
|---|---|
| Backup | `/opt/1hub-network/app/bin/backup.sh` |
| Deploy | `deploy/bin/deploy.sh 2033264b9f8314cee8e8c1bf9c0022d2906ac4e9` from the deploy worktree (nothing is pushed) |
| Smoke | `smoke.sh`; `/`, `/about`, `/library`, `/auth`, `/icon.png`, `/api/v1/auth/providers` 200; `/legal/terms` and `/legal/privacy` 307 → 200; homepage → `/about` (nav, footer) and "Mạng lưới đổi mới sáng tạo" → `/library`; `/library` tabs Bài toán 6 · Startup 72 · Nhà sáng lập 84; new persona → `/onboarding/purpose`; `member@example.test` → `/me`, L2 routes 200; guest `/me` → `/auth` |
| Rollback | `rollback.sh` → `08bbbb9` |

## Preview routes (22)
`/` · `/about` · `/library` · `/auth` · `/auth/check-email` · `/auth/callback` · `/auth/error` · `/onboarding/purpose` · `/onboarding/profile` · `/onboarding/privacy` · `/onboarding/complete` · `/me` · `/me/profile/edit` · `/me/privacy` · `/me/settings` · `/me/roles` · `/projects/new` · `/projects/:id/edit` · `/projects/:id/team` · `/organizations/hub-network` · `/legal/:kind` · `/legal/:kind/:version`

## Demo sign-in
**Real e-mail magic link, invite-only** ([DEC-AUTH-EMAIL](../decisions/DECISION_LOG.md#dec-auth-email)): a provisioned address (`ssh hub-vps /opt/1hub-network/app/bin/provision-account.sh <email>`) requests a link on `/auth` and receives it from Resend; unknown addresses get a notice and no account. Limits: 10 links per address and 30 requests per IP per 15 minutes. Operator path: `issue-login-link.sh <address>@example.test` ([test accounts](INTERNAL_ALPHA_TEST_ACCOUNTS.md)).

## Open go-live items
| ID | Item | Owner |
|---|---|---|
| ~~`PRODUCTION_LEGAL_CONTENT_REQUIRED`~~ **CLOSED** | Approved v1.5 text served since `2033264` ([DEC-LEGAL](../decisions/DECISION_LOG.md#dec-legal)) | — |
| EDGE-H3-POST-RESEND | The OneShield edge advertises HTTP/3 (`alt-svc: h3`); POSTs over it fail with `ERR_QUIC_PROTOCOL_ERROR` and Chrome resends them over TCP. When the first copy already reached the origin, the one-time link is consumed twice (200, then 409): the user sees "Liên kết không còn hiệu lực" with no session and must request a new link (~1 in 8 Chrome logins; 0 with QUIC off). Disable HTTP/3 on the edge for this domain or fix its POST handling. Replaces the FU-AUTH-DOUBLE-CONSUME diagnosis. **BLOCKER**, unchanged on 28/09 15:03 UTC | edge owner |
| EDGE-REFERRER | The edge rewrites `Referrer-Policy` to `strict-origin-when-cross-origin`; the origin sends `no-referrer` on `/auth/callback` | edge owner |
| HEALTH-MONITOR | The external monitor polls `/health` (404); point it at `/api/v1/auth/providers` | monitor owner |

## Preview limitations
| ID | Limitation | Planned |
|---|---|---|
| PL-01 | Homepage inert items (`aria-disabled`, reason on hover), e.g. "Chương trình", "Sự kiện", search; `/library` header items other than Thư viện are inert too | 22.8 |
| PL-02 | `/events`, `/programmes`, `/programmes/create`, `/login` are not built and not linked; some `/about` photo slots keep placeholders | 22.6 / 22.8 |
| PL-03 | iHub Ventures external CTA not rendered (DEC-H1-D2) | 22.8 |
| PL-04 | Login from a CTA does not return to the original action | 22.6 |
| PL-05 | L1 AI suggestion not built; manual onboarding is complete | 22.9 (HD-A1) |
| PL-06 | Onboarding keeps the current 3 steps (ACC-05…09 flow is HD-02) | open |
| PL-07 | Below 1024 px `/me` and the L2 editors keep the desktop frame (sideways scroll at 768 / 390); pre-existing (DEC-P0-SHELL-D7) | 22.10 (HD-11) |
| PL-08 | Consent step overflows 13 px at 390 px (P3) | 22.10 |
| PL-09 | No owner profile page (FP1-OWN, HD-05) | open |
| PL-10 | L4 / L5 / L6, AI, investor, summit, admin and system-status scope not built | later tasks |
| PL-11 | `/library` Bài toán is a labelled demo fixture (DEC-L15-D2); Startup / Nhà sáng lập depend on `startup.1hub.cloud` (error state with "Thử lại" if unreachable) | open |
| PL-12 | Final Test Pack refresh and final Alpha freeze pending | 22.10 |

## Related
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) — the running release
- [reports/TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md](reports/TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md) — this release's report
