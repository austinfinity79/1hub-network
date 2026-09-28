# Internal Alpha Preview Release

**INTERNAL ALPHA PREVIEW — HOMEPAGE + ABOUT + LIBRARY + L1 + L2 + REAL E-MAIL LOGIN.** Consolidated pre-production release of the approved surface; not the final Internal Alpha release. Frozen 2026-09-28 by TASK 22-PREVIEW-01 ([report](reports/TASK-22-PREVIEW-01_preview-release.md)); refrozen by TASK 22-PREVIEW-LOGIN-UI, TASK 22-PREVIEW-AUTH ([report](reports/TASK-22-PREVIEW-AUTH_real-email.md)), TASK 22-PREVIEW-ABOUT-DEPLOY ([report](reports/TASK-22-PREVIEW-ABOUT-DEPLOY_about-deploy.md)) the FINAL PRE-PRODUCTION CONSOLIDATION ([report](reports/TASK-22-FINAL-RELEASE_final-release.md)) the FINAL RELEASE BLOCKER CLOSURE ([report](reports/TASK-22-FINAL-BLOCKER-CLOSURE_blocker-closure.md)) TASK 22-HOMEPAGE-FINAL-DEPLOY ([report](reports/TASK-22-HOMEPAGE-FINAL-DEPLOY_homepage-deploy.md)) and the favicon hotfix ([report](reports/TASK-22-FAVICON-HOTFIX_favicon-hotfix.md)). Deploy EXACTLY the app SHA below; never a branch name or HEAD (CLAUDE.md §14).

## Release
| Field | Value |
|---|---|
| **APP RELEASE SHA** (branch `main`) | **`935fd4ada12160f744d87c64bcf17409309401a0`** — tag `internal-alpha-preview-08` (on `origin` since 28/09); new favicon on top of `3fd00e4` (tag `-07`: homepage aligned, [DEC-H1-R2](../decisions/DECISION_LOG.md#dec-h1-r2)), `2033264` (tag `-06`: approved legal text, [DEC-LEGAL](../decisions/DECISION_LOG.md#dec-legal)) and `08bbbb9` (tag `-05`: `/library`, `/about`, real e-mail magic link, login UI). Later `main` commits are docs only |
| Deployment | **Deployed** by the favicon hotfix on 2026-09-28 16:48 UTC; image `sha256:b66cfffdd49d4795d6835313a2314021d795d7095bd8ebdd187390775b41e31e` |
| Previous deployed | `3fd00e4c30103aa6ffcc36753c6b5f11324948e9` (tag `-07`) · `2033264b9f8314cee8e8c1bf9c0022d2906ac4e9` (tag `-06`) · `08bbbb9` (tag `-05`) · `c535c35` · `0479579` (tag `-04`) · `5a195f7` (`-03`) · `cc6ca28` (`-01`) |
| **ROLLBACK SHA** | `3fd00e4c30103aa6ffcc36753c6b5f11324948e9` — `state/previous`; image and sources kept on the server; `rollback.sh` returns to it (same product, previous favicon) |
| Backup before deploy | `/opt/1hub-network/shared/backups/onehub-20260928T164551Z.dump` |
| Deploy tooling | branch `deploy/vps-foundation` (worktree `/Users/thanosvn/workspace/1hub-network-deploy`); deploy scripts unchanged since `68488cf`; `provision-account.sh` since `1f558d6` |
| Schema | no migration, seed, dependency or patch change since `9c61458`: migrate 9 × skip; rollback is schema-safe |
| Environment | [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) plus `RESEND_API_KEY` (secret), `EMAIL_FROM`, `APP_PUBLIC_BASE_URL`, `LEGAL_CONTENT_DIR=content/legal` (present); `ENABLE_DEV_ROUTES` unset; optional `LIBRARY_STARTUP_SOURCE_URL` (default `https://startup.1hub.cloud/data/startup.json`, outbound HTTPS required) |
| Health endpoint | `GET /api/v1/auth/providers` (200 JSON; also the container healthcheck). There is no `/health` route; the external monitor must use this path |

## Deploy (done)
| Step | Command / check |
|---|---|
| Backup | `/opt/1hub-network/app/bin/backup.sh` |
| Deploy | `deploy/bin/deploy.sh 935fd4ada12160f744d87c64bcf17409309401a0` from the deploy worktree (the deploy archives from the local repository) |
| Smoke | `smoke.sh`; `/`, `/about`, `/library`, `/auth`, `/icon.png`, `/api/v1/auth/providers` 200; `/legal/terms` and `/legal/privacy` 307 → 200; homepage → `/about` (nav, footer) and "Mạng lưới đổi mới sáng tạo" → `/library`; `/library` tabs Bài toán 6 · Startup 72 · Nhà sáng lập 84; new persona → `/onboarding/purpose`; `member@example.test` → `/me`, L2 routes 200; guest `/me` → `/auth` |
| Rollback | `rollback.sh` → `3fd00e4` |

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
| EDGE-ICON-CACHE | Two edge nodes still serve the previous favicon for the bare `/icon.png` from cache; pages link to the versioned address and get the new one. Purge `/icon.png` in the panel | edge owner |
| FU-IMAGE-CACHE | The image cache is empty after each deploy; two About photos answered 504 once under a burst right after the 15:23 deploy (not reproduced). Keep the cache across deploys or warm it | follow-up |

## Preview limitations
| ID | Limitation | Planned |
|---|---|---|
| PL-01 | Homepage inert items (`aria-disabled`, reason on hover), e.g. "Chương trình", "Sự kiện", search, card actions ("Chi tiết", "Xem deck", "Yêu cầu truy cập", "Truy cập ihub.ventures"); `/library` header items other than Thư viện are inert too | 22.8 |
| PL-02 | `/events`, `/programmes`, `/programmes/create`, `/login` are not built and not linked; some `/about` photo slots keep placeholders | 22.6 / 22.8 |
| PL-03 | Homepage events, programmes, pipeline cards and the partner matrix are illustrative, labelled "Dữ liệu minh hoạ" (DEC-H1-R2-D2); the iHUB Ventures link is inert | 22.8 |
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
