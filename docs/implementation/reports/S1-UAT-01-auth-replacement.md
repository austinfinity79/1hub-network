# S1-UAT-01 auth replacement

Sprint1 AUTH replacement: username/email + password + Google + reset / session rules on the one canonical `/auth`. Decisions: [DEC-S1A](../../decisions/DECISION_LOG.md#dec-s1a). Contract: [05 amendment A12](../../architecture/05_API_CONTRACT_P0_v1.0.md). Tests, security and git: [S1-UAT-01-evidence](S1-UAT-01-evidence.md). DB incident: [S1-UAT-01-db-incident](S1-UAT-01-db-incident.md).

## Preflight
| Check | Result |
|---|---|
| Base | `main` = `origin/main` = `edd3d2472f140071290ab09040f2853f39329606` (`git ls-remote`) |
| Isolation | worktree `../1hub-network-s1-auth`, branch `feat/s1-uat-01-auth`; own database `hubnetwork_s1auth` (shared `hubnetwork_p0` restored untouched) |
| Migrations | 001 → 017 intact; 018 added |
| Read | Sprint1 UAT pack (US-01.02 … 05, Appendix B / C), feedback.md, auth / session code, onboarding resolver, legal, BD-01 ([DEC-P3UX-D5](../../decisions/DECISION_LOG.md#dec-p3ux-d5)) |

## Existing auth audit (before)
| Part | Before |
|---|---|
| `/auth` | e-mail field + "Gửi liên kết đăng nhập"; Google drawn, inert (D-G1) |
| Backend | magic-link request / resend / consume; account created at consume |
| Credentials | none: no username, no password, no provider link |
| Session | opaque token, SHA-256 at rest, HttpOnly, SameSite=Lax, 30-day row; fresh token per sign-in |
| Status | BLOCKED / DEACTIVATED refused at consume and at every session read |

## Final architecture
| Layer | After |
|---|---|
| `/auth` (WF01-S01) | views: sign-in · create account · forgot; Google control; no mode parameter; existing AUTH1 shell and components (PO decision 1) |
| `/auth/check-email` (S02) | also confirms the reset e-mail (`kind: reset`) |
| `/auth/callback` (S03) | magic-link token OR Google `code` / `state` |
| `/auth/reset-password` (**S11**, new) | new password from the e-mailed `#token=` |
| Services | `credentials.ts`, `google.ts`, `lockout.ts`, `password.ts`, `username.ts`; every method ends in `sign-in.ts` (roster, new session, resolver) |
| API | `register`, `login`, `password/forgot`, `…/resend`, `password/reset`, `…/check`, `google/start`, `google/callback`; `providers` lists GOOGLE when configured |

No parallel auth: one session table, one cookie, one resolver, one status gate.

## Rules implemented
| Topic | Rule (Appendix B) | Where |
|---|---|---|
| Username | 4–30, `[A-Za-z0-9.]`, unique case-insensitively; Google: generated | `username.ts`, UNIQUE `username_normalized` |
| Password | ≥ 8, letters + digits; scrypt N=16384; cap 256 | `password.ts`, `password-rules.ts` |
| Lockout | 5 consecutive → password sign-in off 15 min; server columns; audited; cleared by success / reset; Google unaffected | `lockout.ts` |
| Forgot / reset | 15 min, one use, resend ≥ 45 s retires older, a repeat forgot within 45 s sends nothing (silent), no existence leak, fragment token | `credentials.ts` |
| Reset effect | new hash + every session revoked in one transaction; no session created | `completePasswordReset` |
| Google | PKCE + state cookie; `sub` identity; verified e-mail links the SAME account; one Google per account; status before link | `google.ts` |
| Remember me | 30-day cookie; else browser-session cookie | `login` route |
| Enumeration (PO decision 3) | no answer says an e-mail has an account; sign-up conflict = neutral `AUTH_REGISTRATION_REJECTED`, reason audited internally (`AUTH_REGISTRATION_CONFLICT`); unknown identifiers lock like real ones | `credentials.ts`, `lockout.ts` |
| Limits (PO decision 4) | Sprint1 values only (5 / 15 min, 15 min link, 45 s); no invented per-IP bucket on the new endpoints | — |
| CSRF | new POST endpoints JSON-only (`body: json_required`) | `require-json.ts` |

## Magic-link disposition (task section 10)
| Part | Class |
|---|---|
| `/auth` e-mail form | REMOVE_FROM_PRIMARY_UI |
| `POST /auth/magic-link`, `/resend`, `/consume`, table, e-mail, S02 / S03 token states | KEEP_COMPATIBILITY_INTERNAL |
| New callers | DEPRECATE |
| Code / table removal | REMOVE: none (no migration risk) |

## Onboarding, legal, session
| Area | Outcome |
|---|---|
| Onboarding | new account → `/onboarding` (ACC-05 intro); returning → its step or `/me`; `?redirect=` per BD-02; resolver untouched |
| Prefill | sign-up name / Google name → stage 1 when empty (`signup_full_name`); not written to the profile |
| Legal v1.0 | create-account checkbox → existing `acceptConsent` (2 records, CONSENT_ACCEPTED, stale → 409); stage 4 unchanged |
| Session | new token every sign-in (fixation test); logout revokes; reset revokes all; BLOCKED / DEACTIVATED never authenticate |

## Migration 018 (additive)
`user_accounts` + `username`, `username_normalized` (partial UNIQUE), `password_hash`, `failed_password_attempts`, `password_locked_until`, `signup_full_name`; `auth_identities` (enum provider GOOGLE, UNIQUE provider+sub, UNIQUE account+provider); `password_reset_requests`. Documented lossless rollback. Proven fresh / upgrade / recovery.

## Related
- [S1-UAT-01-evidence](S1-UAT-01-evidence.md) — tests, security, regression, git
- [DECISION_LOG DEC-S1A](../../decisions/DECISION_LOG.md#dec-s1a)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
