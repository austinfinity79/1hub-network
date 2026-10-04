# S1-UAT-01 evidence

Final evidence for [S1-UAT-01-auth-replacement](S1-UAT-01-auth-replacement.md), run on the rebuilt final HEAD against the isolated task database `hubnetwork_s1auth`. DB incident: [S1-UAT-01-db-incident](S1-UAT-01-db-incident.md).

## Build and HEAD
| Item | Value |
|---|---|
| Implementation commit | `1ac26b0` feat(auth) |
| Fix commit (final code) | `d502f9a` fix(auth) — reveal toggle off the input, stage 1 prefill, env contract, test drift |
| Final build | clean `rm -rf .next && pnpm build` on `d502f9a`, tree clean, BUILD_ID `QvOf9LgLv8WH-IyfrqitG` |
| Stale-build runs | discovery only; no PASS below relies on them |

## Gates (final HEAD)
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit (`pnpm test`) | 38 files · 398 / 398 |
| DB (`pnpm test:db`, isolated) | 49 files · 789 / 789 (incl. 018 fresh / upgrade / recovery, 017 recovery) |
| Protected browser regression | 92 specs · 1213 tests · 1184 PASS · 0 FAIL · 29 SKIP (opt-in) · 0 FLAKY |
| L1–L2 UAT subset | 19 / 19 — TECHNICAL_UAT_PASS · BUSINESS_UAT_NOT_YET_RUN |

## Auth matrix (DB `password-auth.db-test.ts` 33 · browser `wf01-s01-auth-entry` + `s1-uat-01-auth-flows`)
| Area | Covered and passing |
|---|---|
| Password | e-mail + password, username + password (case-insensitive), wrong password, unknown account (same 401), 5 failures → 429 lock 15 min, right password refused while locked, unlock after expiry clears state, consecutive rule, BLOCKED / DEACTIVATED 403 only after a correct password, 256-char cap |
| Username | 4–30 `[A-Za-z0-9.]`, accents / space / `_` / `-` refused, case-insensitive UNIQUE, suggestion on conflict, Google seed always valid |
| Reset | request (same shape known / unknown / username), resend < 45 s 429, repeat forgot < 45 s silent, 15-min expiry, one-time, replay, forged / invalid, open-time check read-only, other sessions revoked in the same transaction, lockout cleared, no session created |
| Google (mocked provider) | new user (generated username, no password, name prefill), same-email linking to the SAME account (1 account, 1 identity, 0 extra profiles), duplicate prevention (second Google identity refused, concurrent first sign-ins → 1 account), unverified e-mail refused, state mismatch / forged callback 400, BLOCKED / DEACTIVATED refused and never linked, lockout does not block Google, missing env → providers `[]`, start → `/auth?google=unavailable`, secret / code never logged |
| Onboarding / Legal | new account → `/onboarding` (intro), returning completed → `/me`, `?redirect=` per BD-02 (unsafe ignored), consents recorded once at sign-up (2 records, 2 CONSENT_ACCEPTED), not duplicated at stage 4, stale version 409 |

## Google ENV status
`GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` are not configured here. Live Google E2E: **ENV_BLOCKED** (neither product PASS nor FAIL). Code path, env contract (`.env.example`), state / PKCE / linking proven with a stubbed provider. Release / UAT prerequisite: an OAuth client with redirect `<APP_PUBLIC_BASE_URL>/auth/callback`.

## Enumeration
| Surface | Result |
|---|---|
| Login | one 401 copy for unknown / wrong / password-less; unknown identifiers lock after 5 like real ones |
| Sign-up | e-mail conflict → neutral 409 `AUTH_REGISTRATION_REJECTED`, no field marked, reason only in audit `AUTH_REGISTRATION_CONFLICT`; browser test asserts no "đã gắn với" copy |
| Reset | identical 202 body for known / unknown / username / spaced; e-mail sent after the answer |
| Google-link conflict | generic Google failure copy |

## Stale-test audit (217 hits)
| Class | Hits | Examples |
|---|---|---|
| COMPATIBILITY_ONLY | 181 | `/dev/login` (85), `requestMagicLink` / `/auth/magic-link` (96): magic link kept as compatibility (DEC-S1A-D7) |
| VALID_CURRENT | 36 | WF01-S02 / S03 compat states, reset "Gửi liên kết mới", route-absence asserts (`/login`, `/signup`, `/dang-ky`), register-form `Email` labels |
| STALE_TEST (fixed) | 16 specs | WF01-S01 / S02 / S04, e-mail magic link, WF01–WF05 journeys, shell navigation, alpha gaps, release REL-AUTH / REL-RESP selector, L1–L2 UAT helper, shell-routes count, WF03 audit allowlist |
| STILL_VALID_AND_MISSING | **0** | — |

## Related
- [S1-UAT-01-security](S1-UAT-01-security.md) — security checks, responsive, regression detail, git
- [S1-UAT-01-auth-replacement](S1-UAT-01-auth-replacement.md)
- [S1-UAT-01-db-incident](S1-UAT-01-db-incident.md)
