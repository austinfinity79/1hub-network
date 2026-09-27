# TASK-22.2 L1 Auth Onboarding

**TASK 22 — Bucket A, BATCH 22.2 Corrected L1 Auth / Onboarding: DONE.**
- References: `design-reference/final/revision/L1` (AUTH1–AUTH4, ACC-10), byte-identical copies from `L1.zip` (`c1049e5c…4467`).
- Governing decisions: [DEC-L1-D1…D8](../../decisions/DECISION_LOG.md#dec-l1-d1), under [DEC-HD-12](../../decisions/DECISION_LOG.md#dec-hd-12) and the Task 21 v2 defaults (HD-02, HD-03, HD-11).

## Scope
| Screen | Route | Result |
|---|---|---|
| AUTH1 | `/auth` | Brand panel: wordmark and headline; card: "Đăng nhập", "Email", "Gửi liên kết đăng nhập"; terms notice kept (D3); no Google or divider (D2) |
| AUTH2 | `/auth/check-email` | "Kiểm tra hòm thư của bạn", masked address, spam reminder, resend row, "Dùng email khác"; no "Mở Gmail" (D4) |
| AUTH3 | `/auth/callback` | Success / expired / used copy per board; the success body names the real destination; minutes from config (D5) |
| AUTH4 | `/auth/error` | Blocked / session expired per board without untrue claims; generic unchanged (D6) |
| ACC-10 subset | `/onboarding/complete` | "Hồ sơ của bạn đã sẵn sàng", one project card, info panel, header exit "Vào Tài khoản của tôi" → `/me` (D7) |

- **Skipped, Bucket B:** ACC-05, ACC-06, L06b, L06c (AI), ACC-07, ACC-08 (roles), ACC-09 (consent removal), FP1-OWN (8 frames).
- **Bucket C:** none belongs to L1.
- **AI UI:** not rendered. No AI call, CV upload or LinkedIn import; no new persistence.
- **Consent / visibility:** unchanged. The S07 step, versioned acceptance and NETWORK_ONLY default are untouched; the terms notice is informational.
- **Roles / intents:** the S05 intent allowlist is unchanged; no ecosystem-role selection and no new roles.
- **Unchanged:** routes, guards, APIs, DB, RBAC, audit codes and the auth model (magic link only, no password, no fake provider).
- **Shared primitives:** `AuthSplitLayout` (brand panel), `OnboardingShell` (< 768 px only: the header wraps); `AuthCard` unchanged (440 px).

## Typography
- Space Grotesk 400 / 500 / 600 (self-hosted, DEC-HD-12) on the `(auth)` group and on the S08 card and exit, set by re-pointing `--font-ui`.
- Mono index and "i" use IBM Plex Mono 500. The onboarding shell keeps its legacy type.
- Violations: **0** on every audited state (`REVISION_FACES`).

## Pixel QA (1440×900 DPR1, production build, `tests/visual/pixel-qa/revision.ts`)
- **Rule** (as DEC-H1-D5): per segment, diff outside text < 1.5 % and diff beyond a ±2 px shift < 2 %.
- **Anchors:** segments sit at their own anchors where omissions move the card (shorter AUTH1 / AUTH2 cards; board → centred card).

| Reference | Segments | Max outside text | Max beyond ±2 px |
|---|---|---|---|
| AUTH1 | panel, canvas ×2, card title, form | 1.10 % | 1.12 % |
| AUTH2 | panel, canvas ×2, card head, resend block | 0.48 % | 0.24 % |
| AUTH3 success / expired / used | one panel each | 0.14 % | 0.34 % |
| AUTH4 blocked / session expired | disc, title, body, action | 0.05 % | 1.15 % |
| ACC-10 | card head, project card, info corner, exit | 0.25 % | 0.98 % |

| Class | Count | Notes |
|---|---|---|
| P0 structural | 0 | Every kept component is present, in order |
| P1 major | 0 | Face, size, weight, colour and position match |
| P2 component | 0 | Input 50 px, button 47 px, card 440 px, discs, info panel and mono "i" match |
| P3 raster | residual | The reference button sits on a half pixel (two AA rows); the reference input's side border is darker than its top border |
| Intentional | 8 | D2 Google / divider; D3 terms notice; D4 "Mở Gmail", plain spam text; D6 blocked / session-expired bodies; D7 shell and stepper, single card numbered 01, neutral lede and info, no "Góp ý" |

## Responsive
- 1440 / 1024 / 768 / 390 on the five routes, including the three AUTH4 states and two AUTH3 states: **0 overflow**, 0 off-screen controls, 0 `href="#"`.
- The input and button stay full width in the card; the /me exit stays reachable.
- Fixes found by the sweep:
  - the ACC-10 card follows the viewport below 1024 px;
  - the onboarding header wraps below 768 px (D8).
- Pre-existing, outside this batch: S07's own privacy card overflows by 13 px at 390 px (was 40 px).

## Functional QA
- **Auth:**
  - `/auth` validation and submit;
  - magic link request / mail-check / resend countdown;
  - success routing to onboarding or `/me`;
  - expired, used, blocked, session expired and generic states;
  - rate limit inline;
  - protected routes redirect a guest to `/auth`;
  - logout and re-entry.
- **Onboarding:**
  - S05–S08 steps, validation, back / next, refresh and resume;
  - vocabulary persistence;
  - completion is idempotent;
  - the exit appears only after the server confirms;
  - no re-onboarding.
- **Security:**
  - no token, cookie or PII in the URL, HTML or storage (S01–S04 and release specs);
  - the callback query is never server-rendered;
  - 0 console errors.

## Regression and gates
- Gates: format, lint, typecheck, unit 237, DB 349, production build: all PASS.
- **Full visual suite** on the final build: 668 = **644 passed / 24 opt-in skipped / 0 failed**.
  - The first full run had 1 failure. The P0-LANDING scope test used `/auth` as its "legacy screen", but `/auth` became a revision screen under DEC-L1-D1. It now checks `/onboarding/purpose` (WF01-S05, legacy until HD-02) and passes.
- **Per group:** WF01 153 (protected, full); P0-LANDING 10, P0-SHELL 14; WF02 94, WF03 66, WF04 115, WF05 66; Internal Alpha release 7; auth-session 13, authz-session 8, SEC-OBS-01 3; shell routes 33; pixel-QA 39 (24 opt-in skips); others 32. All green.
- Business, API, DB, RBAC, audit and migration changes: 0.

## Git
- Branch `main`; start HEAD `5827ac2`, checked again before each commit.
- Implementation commit: `5735d789680ebd3f0558b076d65f646278e52cd4`. Report / docs commit: the commit that contains this report.
- Push: **NOT RUN** — LOCAL REVIEW MODE.

## Related
- [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [TASK-22.1_public-homepage.md](TASK-22.1_public-homepage.md)
- [../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md](../../design-revision/07_TASK22_IMPLEMENTATION_ORDER.md)
