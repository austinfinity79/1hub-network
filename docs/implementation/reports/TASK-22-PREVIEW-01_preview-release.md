# TASK-22-PREVIEW-01 Preview Release

**INTERNAL ALPHA PREVIEW — HOMEPAGE + L1 + L2: GREEN.** Verify-and-freeze only: no product code changed, no migration, no RBAC change. Manifest for the deploy: [INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md).

## Precheck
- HEAD `75db535` (docs); last product commit `cc6ca28`; `git diff cc6ca28 HEAD` touches `docs/` only; working tree clean except the untracked `AGENTS.md`.
- Implemented revisions: Homepage `a05917a` (22.1), L1 `5735d78` (22.2), L2 `2a57fe9` (22.3); `cc6ca28` (22.4, L3) is included and GREEN.
- 19 preview routes read from `src/app` (list in the manifest). `/about`, `/events`, `/programmes`, `/login` do not exist and nothing links to them.

## Demo-blocking fixes
None needed. Every homepage `href` answers 200 (or 307 → `/auth` for member routes); 0 `href="#"`; 26 inert items are not links (PL-01).

## Demo happy path (UI only, operator link as on the review site)
`/` → "Đăng nhập" → `/auth` → e-mail → `/auth/check-email` → one-time link → onboarding purpose → profile → privacy → complete → "Vào Tài khoản của tôi" `/me` → "Hồ sơ cá nhân" → back → "Cài đặt tài khoản" → "Quyền riêng tư & hiển thị" → "Tổng quan" → `/projects/new` (type, name, summary) → step 2 "Bỏ qua, mời sau" → step 3 → "Hoàn thiện hồ sơ" → edit + "Lưu" → team → `/me`: **19 / 19 steps**, 0 console errors, 0 #418, 0 HTTP 5xx, 0 failed assets.

## QA
| Gate | Result |
|---|---|
| Targeted suite (production build) | **342 passed / 0 failed** (10.9 min): WF01 153, WF02 102, P0-LANDING 10, P0-SHELL 14, console-health 4, Internal Alpha release 7 (REL-SEC, REL-RESP, IA-P2-03), auth-session 13, authz-session 8, SEC-OBS 3, smoke WF03 3 / WF04 15 / WF05 10 |
| Pixel (1440 DPR1, refs of the preview screens) | Structural / Major / Component 0; H1 22 blocks max 0.99 % / 1.40 %; AUTH1–4 max 1.10 % / 1.15 %; ACC-10 0.25 % / 0.98 %; L11 0.13 % / 0.40 %; L13a–c max 0.61 % / 0.95 %; typography 0 violations |
| Responsive 1440 / 768 / 390 (16 routes each) | 1440: 0 overflow. 768 / 390: home, auth, onboarding, settings, wizard, team 0 overflow; desktop-frame member pages scroll sideways with reachable controls (PL-07); consent step 13 px at 390 (PL-08, P3) |
| Hydration / console | #418 = 0 (console-health, happy path, sweep); 0 fatal console errors; 0 5xx; 0 broken assets |
| Security / privacy | guest → `/auth` on 8 protected routes; member APIs 401 for a guest; session cookie HttpOnly / Secure / SameSite=Lax; token absent from URL after the callback, from console and HTML; link reuse refused; unknown venture 404; RBAC untouched |
| Build | format, lint, typecheck PASS; unit 237 / 237; production build PASS |

## Freeze
| Field | Value |
|---|---|
| APP PREVIEW SHA | `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` (local tag `internal-alpha-preview-01`) |
| ROLLBACK SHA | `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (deployed now; schema-safe) |
| REPORT / DOCS SHA | the commit that contains this report |
| Branch / tree | `main`; clean after the commit except `AGENTS.md` |

Limitations PL-01…PL-12: see the manifest. None blocks the Homepage + L1 + L2 demo.

## Git
Start HEAD `75db535`, checked again before the commit. Push: **NOT RUN** — LOCAL REVIEW MODE. Nothing deployed.

## Related
- [../INTERNAL_ALPHA_PREVIEW_RELEASE.md](../INTERNAL_ALPHA_PREVIEW_RELEASE.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
