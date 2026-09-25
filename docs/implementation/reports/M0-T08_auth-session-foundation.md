# Claude Task Report

## 1. Task
- Task ID / name: M0-T08 — auth/session foundation
- Scope requested: The minimum production-ready auth/session foundation for WF01. No WF01 UI, no RBAC engine.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed.

## 2. Pre-flight
- Single writer: **PASS**. Only one `claude` process has this worktree as cwd and it is this session; the other two are in `steam-topup` and `apec27`.
- Starting HEAD: `2390ce2`, re-checked before commit.
- Working tree was clean; no unrelated work at risk.
- M0-T07 seed regression: **PASS** (37 of 37) before any change.
- Seed entrypoint unambiguous: `scripts/db.mjs` applies `seed_p0_deterministic.sql`.

## 3. No migration was needed
Migration 001 already provides everything. `auth_magic_link_requests` has `token_hash UNIQUE`, `expires_at`, `consumed_at`, `request_ip`; `user_sessions` has `token_hash UNIQUE`, `expires_at`, `revoked_at`. Single-use, expiry and revocation all map onto existing columns, so no migration was created and 001 and 002 are unchanged.

## 4. What was implemented
| Module | Purpose |
|---|---|
| `auth/config.ts` | Frozen constants plus the manifest of values no frozen source defines |
| `auth/tokens.ts` | 256-bit opaque tokens, sha256 hashing, email masking and validation |
| `auth/sessions.ts` | Create, resolve, revoke; revoke-all for security changes |
| `auth/session-cookie.ts` | HttpOnly cookie directives and header parsing |
| `auth/magic-link.ts` | Request, resend, consume with single-use enforcement |

Endpoints: `POST /auth/magic-link`, `/resend`, `/consume`, `POST /auth/logout`, `GET /auth/providers`, and `GET /session` replacing the M0-T05 placeholder.

## 5. Three judgement calls worth your review
**Unstated values are named, not chosen silently.** Session TTL, the SameSite value and the CSRF mechanism are defined by no frozen source; grep returns zero hits for a TTL or a SameSite value, and 03_AUTH_RBAC:201 qualifies CSRF as "when applicable" with no mechanism. All three sit in `UNSTATED_AUTH_VALUES` with a provisional value, a reason and what would settle them, test-pinned. **No CSRF mechanism is implemented**, because inventing one would be inventing contract; SameSite=lax is the only mitigation currently present.

**`capabilities` and `managed_scopes` return empty.** They are the authorization engine's output and that is M0-T09. The contract shape is present; the content is deliberately empty rather than guessed from role rows, which would be exactly the invented authority the frozen rules forbid. A Playwright test asserts they stay empty.

**Dev login drives the real flow.** `/dev/login` is dev-gated, absent from the route manifest, served outside `/api/v1`, and 404s in production. It does not mint a session directly: it calls `requestMagicLink` then `consumeMagicLink`, so the browser smoke exercises the production token lifecycle and cookie attributes rather than a shortcut.

## 6. Security properties
| Concern | Handling |
|---|---|
| Raw token storage | Never stored. Only sha256 reaches the database, asserted by test |
| Raw token leakage | Never returned by an endpoint, never logged. The request response is asserted to contain neither the token nor the word |
| Reused consumed token | `AUTH_LINK_ALREADY_USED`. Single use enforced by a conditional `UPDATE ... WHERE consumed_at IS NULL`, so two concurrent attempts cannot both win |
| Expired token | `AUTH_LINK_EXPIRED`, filtered in SQL |
| Malformed token | `AUTH_LINK_INVALID`, including null, empty and oversized |
| Session fixation | A fresh token is minted on every consume; a pre-auth token can never become authenticated |
| Session enumeration | `resolveSession` returns null for every failure mode without distinguishing them |
| Cookie exposure | HttpOnly asserted in a real browser; `document.cookie` is asserted not to contain it |
| Account disclosure | The request endpoint never looks up the account, so behaviour is identical for known and unknown addresses. Asserted |
| Blocked account | `AUTH_ACCOUNT_BLOCKED` at consume time |

## 7. A contract deviation I found and fixed
My first implementation returned 200 from the magic-link request and resend. The contract specifies **202** (05:168, 05:197). The API wrapper hardcoded 200, so I added explicit status support and set 202 on both. Caught by reading the contract rather than by a test, which is why the test now asserts 202.

## 8. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS, 0 errors 0 warnings |
| Unit tests | PASS — 61 of 61 |
| DB integration tests | PASS — 64 of 64 (27 new auth) |
| Build | PASS |
| Playwright auth smoke | PASS — 14 new tests |
| Playwright regression | PASS — 78 of 78 overall |
| Deterministic seed regression | PASS |
| Production gating | PASS — `/dev/login`, `/dev/typography`, `/dev/primitives` all 404 without `ENABLE_DEV_ROUTES` |
| 001 / 002 unchanged | PASS, 0 changed lines, no third migration |

Three tests failed during validation and were fixed rather than worked around:
1. An M0-T05 test asserted `/auth/magic-link` was unimplemented. It now returns 405 for GET because M0-T08 implemented it POST-only. Flipped, and a new test asserts the auth endpoints exist as POST-only.
2. My cookie test read `context.cookies()` while logging in through the standalone `request` fixture, which has an isolated cookie jar. Fixed by using `context.request`.
3. My auth tests create accounts and sessions, which broke the schema suite's exact-match fixture assertions depending on file order. Fixed by giving that suite its own reset, making every DB suite order-independent.

## 9. Auth blockers remaining
**0.** Two items are carried forward as contract gaps, not blockers: no CSRF mechanism is specified, and the session TTL and SameSite value are unstated. Both are declared in the manifest and neither prevents M0-T09.

## 10. Git
- Branch: `main`
- Implementation commit: see section 12
- Remote: `origin` → `austinfinity79/1hub-network`
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `2390ce2`, deliberately behind local
- Working tree status: clean after commit

## 11. Files changed
New: `src/lib/auth/{config,tokens,sessions,session-cookie,magic-link}.ts`, `src/lib/auth/auth.db-test.ts`, five auth route handlers, `src/app/dev/login/route.ts`, `tests/visual/specs/auth-session.spec.ts`.
Modified: `src/app/api/v1/session/route.ts` (real identity), `src/lib/api/handler.ts` (cookies and explicit status), `src/lib/db/schema.db-test.ts` (reset for independence), `tests/visual/specs/api-contract.spec.ts` (flip), `tests/visual/visual.config.ts` (`DATABASE_URL` for the test server).

## 12. Recommended next task
**M0-T09 — RBAC / authorization foundation.** It fills the `capabilities` and `managed_scopes` this task deliberately left empty, and it consumes the profile-anchored `role_assignments` that migration 002 aligned and M0-T07 populated with real catalogue codes.
