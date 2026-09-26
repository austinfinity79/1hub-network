# Claude Task Report

## 1. Task
- Task ID / name: SEC-OBS-01 — Magic-link callback Referrer-Policy remediation
- Status: **DONE — SEC-OBS-01 CLOSED**
- Mode: LOCAL REVIEW. No business logic, DB or visual change. No push.

## 2. Issue (from the WF02-S07 preflight)
- `/auth/callback?token=…` loaded its same-origin CSS/JS before the page's `<meta name="referrer" content="no-referrer">` took effect.
- 10 asset requests carried the token-bearing URL as `Referer`.
- No `Referrer-Policy` header was sent.

## 3. Fix
| Item | Result |
|---|---|
| Header location | `next.config.ts` → `headers()`: `Referrer-Policy: no-referrer` for `source: '/auth/callback'` |
| Scope | Callback route only; `/auth`, `/me`, `/auth/error` send no such header (asserted) |
| Kept | The existing meta tag (defence in depth) |
| Business logic changed | None: token TTL, single use, session creation, redirects, URL stripping and callback states untouched |

## 4. Evidence
| Check | Before | After |
|---|---|---|
| Callback response header | none | `Referrer-Policy: no-referrer` |
| Token-bearing Referers (production build, 20 requests) | 10 | **0** |
| Spec `sec-obs-01-referrer.spec.ts` | — | valid link (1 session, redirect, re-use → USED), expired, invalid: every document/CSS/JS/font/image request has no `token=`, token value or `/auth/callback?` in Referer |
| App log | 0 token hits | 0 token hits; no logging added |
| Proxy/access-log exposure | Referer carried the token | Browsers send no Referer from the callback page, so access logs cannot record it; the token hash stays server-only |

## 5. Regression
| Gate | Result |
|---|---|
| Format / lint (0 warnings) / typecheck / build | PASS |
| Unit / DB | 152/152 · 248/248 |
| Playwright (full) | 340 passed, 24 skipped by design (includes the WF01-S03 callback spec, auth-session, WF01 UAT, WF02 screens) |
| Pixel | WF01 8/8 PASS; no rendering change |

## 6. Files changed
- `next.config.ts`
- `tests/visual/specs/sec-obs-01-referrer.spec.ts` (new, 3 tests)
- `docs/decisions/DECISION_LOG.md` (SEC-OBS-01 CLOSED with evidence)
- `P0_STATUS.md`, this report and its archive

## 7. Git
- Branch: `main`; start HEAD `8363956`
- Implementation commit: `283bdb9`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `fed0b25`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [P0_STATUS.md](../P0_STATUS.md) — status
- [DECISION_LOG.md](../../decisions/DECISION_LOG.md) — SEC-OBS-01 record
