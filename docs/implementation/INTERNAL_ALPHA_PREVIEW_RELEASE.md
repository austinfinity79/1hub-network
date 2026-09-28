# Internal Alpha Preview Release

**INTERNAL ALPHA PREVIEW — HOMEPAGE + L1 + L2 + REAL E-MAIL LOGIN.** Not the final Internal Alpha release. Frozen 2026-09-28 by TASK 22-PREVIEW-01 ([report](reports/TASK-22-PREVIEW-01_preview-release.md)); refrozen by TASK 22-PREVIEW-LOGIN-UI and TASK 22-PREVIEW-AUTH ([report](reports/TASK-22-PREVIEW-AUTH_real-email.md)). Deploy EXACTLY the app SHA below; never a branch name or HEAD (CLAUDE.md §14).

## Release
| Field | Value |
|---|---|
| **APP PREVIEW SHA** (branch `main`) | **`5a195f72acf05dd6537b6c70ad185e0737acd916`** — local tag `internal-alpha-preview-03`; TASK 22-PREVIEW-AUTH (real e-mail magic link through Resend, invite-only, rate-limited, [DEC-AUTH-EMAIL](../decisions/DECISION_LOG.md#dec-auth-email)) on top of `33f8b0c` (login UI hotfix, [DEC-L1-D9](../decisions/DECISION_LOG.md#dec-l1-d9)). Later `main` commits are docs only |
| Deployment | **Deployed** by TASK 22-PREVIEW-03 on 2026-09-28 06:55 UTC ([report](reports/TASK-22-PREVIEW-03_real-email-deploy.md)); real-inbox sign-in confirmed |
| Previous previews | `33f8b0c2c2cb7b78ce7d6b8979def4d7660025bd` (tag `internal-alpha-preview-02`, never deployed) · `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` (tag `internal-alpha-preview-01`, deployed by TASK 22-PREVIEW-02) |
| **ROLLBACK SHA** | `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` — the previous preview (image and sources kept on the server; `rollback.sh` returns to it); before it, `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` |
| Deploy tooling | branch `deploy/vps-foundation` (worktree `/Users/thanosvn/workspace/1hub-network-deploy`, tip `958a2ae`); `deploy/` unchanged since `68488cf` (copies `patches/` before the install) |
| Product commits since `9c61458` | `a05917a` 22.1 homepage · `5735d78` 22.2 auth / completion · `2a57fe9` 22.3 settings / project wizard · `cc6ca28` 22.4 chapter (ops, outside the demo scope) · `33f8b0c` login UI hotfix · `5a195f7` real e-mail login |
| Schema | no migration, seed or dependency change since `9c61458` (`db/`, `package.json`, `pnpm-lock.yaml` identical): migrate expects 9 × skip; rollback is schema-safe |
| Dependencies | unchanged since the first preview (Space Grotesk `woff2` committed in `public/fonts`; no `fonts:sync` at deploy) |
| Environment | [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) plus `RESEND_API_KEY` (secret), `EMAIL_FROM`, `APP_PUBLIC_BASE_URL` — present in `/opt/1hub-network/shared/env/app.env`; the container must be recreated to read them. Missing or invalid → 500 `AUTH_EMAIL_DELIVERY_FAILED`, no token kept |

## Deploy (Claude B, done by TASK 22-PREVIEW-03)
| Step | Command / check |
|---|---|
| Backup | `/opt/1hub-network/app/bin/backup.sh` |
| Deploy | `deploy/bin/deploy.sh 5a195f72acf05dd6537b6c70ad185e0737acd916` from the deploy worktree (the SHA must be present in the local repo it archives from; nothing is pushed) |
| Smoke | `deploy/bin/smoke.sh`, then over HTTPS: `/` 200 without login; `/auth` 200; `/me` → `/auth` for a guest; operator link for `member@example.test` → `/me`; `/me/settings`, `/projects/new` 200; hero "Tạo hồ sơ startup của bạn" → `/auth` for a guest; `/auth` shows the disabled "Tiếp tục với Google" + "Sắp có" and the divider; real e-mail: a link requested on `/auth` for an operator-approved provisioned inbox arrives from `no-reply@1hubnetwork.io.vn`, opens on `https://1hubnetwork.io.vn/auth/callback`, lands on `/me` or onboarding; reopening it shows "Liên kết không còn hiệu lực"; an unknown address shows "Email này chưa được cấp quyền truy cập Internal Alpha." |
| Rollback | `rollback.sh` → `cc6ca28` |

## Preview routes (19)
`/` · `/auth` · `/auth/check-email` · `/auth/callback` · `/auth/error` · `/onboarding/purpose` · `/onboarding/profile` · `/onboarding/privacy` · `/onboarding/complete` · `/me` · `/me/profile/edit` · `/me/privacy` · `/me/settings` · `/me/roles` · `/projects/new` · `/projects/:id/edit` · `/projects/:id/team` · `/organizations/hub-network` (homepage network link) · `/legal/:kind/:version`

## Demo sign-in
**Real e-mail magic link, invite-only** ([DEC-AUTH-EMAIL](../decisions/DECISION_LOG.md#dec-auth-email)): a provisioned address (existing account, or a launch-roster row added with `pnpm roster:import <file.csv>`) requests a link on `/auth` and receives it from Resend; unknown addresses get a notice and no account. Limits: 10 links per address and 30 requests per IP per 15 minutes. The operator path is unchanged: `issue-login-link.sh <address>@example.test` issues a one-time link for a new review persona ([test accounts](INTERNAL_ALPHA_TEST_ACCOUNTS.md)). A new address gives the manual onboarding path; `member@example.test` is an onboarded member who owns Demo Startup.

## Preview limitations
| ID | Limitation | Planned |
|---|---|---|
| PL-01 | 26 homepage items are inert (`aria-disabled`, reason on hover only), e.g. "Chương trình", "Sự kiện", "Tạo chương trình", search. Not links, so no dead navigation; the 28/09 rule wants them hidden or visibly "Sắp có" | 22.8 |
| PL-02 | `/about`, `/events`, `/programmes`, `/programmes/create`, `/login` are not built; the homepage does not link to them | 22.6 / 22.8 |
| PL-03 | iHub Ventures external CTA not rendered (DEC-H1-D2) | 22.8 |
| PL-04 | Login from a CTA does not return to the original action (e.g. the hero startup CTA lands on onboarding / "Tài khoản của tôi", not `/projects/new`) | 22.6 |
| PL-05 | L1 AI suggestion not built; no AI UI appears; manual onboarding is complete | 22.9 (HD-A1) |
| PL-06 | Onboarding keeps the current 3 steps (ACC-05…09 flow is HD-02) | open |
| PL-07 | Below 1024 px `/me`, `/me/profile/edit`, `/me/privacy`, `/me/roles`, `/projects/:id/edit` keep the desktop frame (sideways scroll at 768 / 390, controls reachable); pre-existing (DEC-P0-SHELL-D7) | 22.10 (HD-11) |
| PL-08 | Consent step overflows 13 px at 390 px (privacy card); no control clipped (P3) | 22.10 |
| PL-09 | No owner profile page (FP1-OWN, HD-05); profile = `/me` overview + editor | open |
| PL-10 | WF05 applications stay browser-session only; L4 / L5 / L6 remaining scope not built | 22.5 / 22.7 |
| PL-11 | Legal pages show the P0 fixture texts (`PRODUCTION_LEGAL_CONTENT_REQUIRED`) | release input |
| PL-12 | Final Test Pack refresh, final consolidated regression and final Alpha freeze pending | 22.10 |

## Related
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) — the running release
- [../design-revision/scope-refreeze/task-sequence.md](../design-revision/scope-refreeze/task-sequence.md) — remaining batches
