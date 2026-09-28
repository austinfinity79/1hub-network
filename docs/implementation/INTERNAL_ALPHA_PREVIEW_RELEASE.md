# Internal Alpha Preview Release

**INTERNAL ALPHA PREVIEW — HOMEPAGE + ABOUT + LIBRARY + L1 + L2 + REAL E-MAIL LOGIN.** Consolidated pre-production release of the approved surface; not the final Internal Alpha release. Frozen 2026-09-28 by TASK 22-PREVIEW-01 ([report](reports/TASK-22-PREVIEW-01_preview-release.md)); refrozen by TASK 22-PREVIEW-LOGIN-UI, TASK 22-PREVIEW-AUTH ([report](reports/TASK-22-PREVIEW-AUTH_real-email.md)), TASK 22-PREVIEW-ABOUT-DEPLOY ([report](reports/TASK-22-PREVIEW-ABOUT-DEPLOY_about-deploy.md)) and the FINAL PRE-PRODUCTION CONSOLIDATION ([report](reports/TASK-22-FINAL-RELEASE_final-release.md)). Deploy EXACTLY the app SHA below; never a branch name or HEAD (CLAUDE.md §14).

## Release
| Field | Value |
|---|---|
| **APP RELEASE SHA** (branch `main`) | **`08bbbb9e25a2d51f41323dd93dab33cfcf04001c`** — local tag `internal-alpha-preview-05`; latest favicon (`08bbbb9`, patch-equal to `c535c35`) on top of `/library` (`4c38745`, `e128d1c`: real `startup.json` Startup / Nhà sáng lập, full L15 remap), `/about` (`4d1e2dd`, `0479579`), real e-mail magic link (`5a195f7`, [DEC-AUTH-EMAIL](../decisions/DECISION_LOG.md#dec-auth-email)) and the login UI (`33f8b0c`, [DEC-L1-D9](../decisions/DECISION_LOG.md#dec-l1-d9)). Later `main` commits are docs only |
| Deployment | **Deployed** by the FINAL PRE-PRODUCTION CONSOLIDATION on 2026-09-28 11:02 UTC; image `sha256:3d616538131c90aff2d119f15908eabae7074f4d86f61e446f7ac4cd68e69b87` |
| Previous deployed | `c535c3523472789a813c726815cfb32c513efd3e` (favicon on About, deployed from its own branch by another session) · before it `04795794cd72e70c58652dfa037a4c2fab6c0304` (tag `internal-alpha-preview-04`) · `5a195f7` (`-03`) · `cc6ca28` (`-01`) |
| **ROLLBACK SHA** | `c535c3523472789a813c726815cfb32c513efd3e` — `state/previous`; image `onehub-app:c535c35…` and sources kept on the server; `rollback.sh` returns to it |
| Backup before deploy | `/opt/1hub-network/shared/backups/onehub-20260928T110146Z.dump` (107,419 B, 31 table-data entries) |
| Deploy tooling | branch `deploy/vps-foundation` (worktree `/Users/thanosvn/workspace/1hub-network-deploy`); deploy scripts unchanged since `68488cf`; `provision-account.sh` since `1f558d6` |
| Schema | no migration, seed, dependency or patch change since `9c61458`: migrate 9 × skip; rollback is schema-safe |
| Environment | [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) plus `RESEND_API_KEY` (secret), `EMAIL_FROM`, `APP_PUBLIC_BASE_URL` (present); `ENABLE_DEV_ROUTES`, `LEGAL_CONTENT_DIR` unset; optional `LIBRARY_STARTUP_SOURCE_URL` (default `https://startup.1hub.cloud/data/startup.json`, outbound HTTPS required) |
| Health endpoint | `GET /api/v1/auth/providers` (200 JSON; also the container healthcheck). There is no `/health` route; the external monitor must use this path |

## Deploy (done)
| Step | Command / check |
|---|---|
| Backup | `/opt/1hub-network/app/bin/backup.sh` |
| Deploy | `deploy/bin/deploy.sh 08bbbb9e25a2d51f41323dd93dab33cfcf04001c` from the deploy worktree (nothing is pushed) |
| Smoke | `smoke.sh`; `/`, `/about`, `/library`, `/auth`, `/icon.png`, `/api/v1/auth/providers` 200; homepage → `/about` (nav, footer) and "Mạng lưới đổi mới sáng tạo" → `/library`; `/library` tabs Bài toán 6 · Startup 72 · Nhà sáng lập 84; new persona → `/onboarding/purpose`; `member@example.test` → `/me`, L2 routes 200; guest `/me` → `/auth` |
| Rollback | `rollback.sh` → `c535c35` |

## Preview routes (21)
`/` · `/about` · `/library` · `/auth` · `/auth/check-email` · `/auth/callback` · `/auth/error` · `/onboarding/purpose` · `/onboarding/profile` · `/onboarding/privacy` · `/onboarding/complete` · `/me` · `/me/profile/edit` · `/me/privacy` · `/me/settings` · `/me/roles` · `/projects/new` · `/projects/:id/edit` · `/projects/:id/team` · `/organizations/hub-network` · `/legal/:kind/:version`

## Demo sign-in
**Real e-mail magic link, invite-only** ([DEC-AUTH-EMAIL](../decisions/DECISION_LOG.md#dec-auth-email)): a provisioned address (`ssh hub-vps /opt/1hub-network/app/bin/provision-account.sh <email>`) requests a link on `/auth` and receives it from Resend; unknown addresses get a notice and no account. Limits: 10 links per address and 30 requests per IP per 15 minutes. Operator path: `issue-login-link.sh <address>@example.test` ([test accounts](INTERNAL_ALPHA_TEST_ACCOUNTS.md)).

## Open go-live items
| ID | Item | Owner |
|---|---|---|
| BLOCKER `PRODUCTION_LEGAL_CONTENT_REQUIRED` | `/legal/terms` and `/legal/privacy` return 404: no production legal copy exists (only the marked non-production fixtures). Nothing invented | PO / legal |
| EDGE-H3-POST-RESEND | The OneShield edge advertises HTTP/3 (`alt-svc: h3`); POSTs over it fail with `ERR_QUIC_PROTOCOL_ERROR` and Chrome resends them over TCP. When the first copy already reached the origin, the one-time link is consumed twice (200, then 409): the user sees "Liên kết không còn hiệu lực" with no session and must request a new link (~1 in 8 Chrome logins; 0 with QUIC off). Disable HTTP/3 on the edge for this domain or fix its POST handling. Replaces the FU-AUTH-DOUBLE-CONSUME diagnosis | edge owner |
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
- [reports/TASK-22-FINAL-RELEASE_final-release.md](reports/TASK-22-FINAL-RELEASE_final-release.md) — this release's report
