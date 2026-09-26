# Claude Task Report

## 1. Task
- Task ID / name: WF02-S07 — Settings / Sessions / Account Deletion Request (`/me/settings`), resumed after the G1–G6 freeze
- Status: **DONE**
- Mode: LOCAL REVIEW. Migration 006 created (authorised P13 subset). No push.

## 2. Decisions
- [DEC-WF02-S07-G1..G6](../decisions/DECISION_LOG.md#dec-wf02-s07-g1): human approved; OPEN-WF02-S07 CLOSED; remaining S07 decisions 0.
- [DEC-WF02-S07-D1..D3](../decisions/DECISION_LOG.md#dec-wf02-s07-d1): session rows, copy, server-read request and pixel fixture.
- SEC-OBS-01 stays OPEN (not addressed in S07).

## 3. Migration 006 (P13 subset)
| Check | Result |
|---|---|
| Shape | `account_deletion_requests(id uuid PK, account_id → user_accounts NOT NULL, requested_at timestamptz DEFAULT now())`, `UNIQUE(account_id)`; nothing else |
| Upgrade (dev DB) | applied; rerun skips |
| Fresh DB (PostgreSQL 17.6, temp container) | 001→006 applied, rerun skips all, seed OK, PK/FK/UNIQUE present |
| Tests | schema ledger lists 006; seed-quality test lists it as intentionally empty |

## 4. Scope implemented
| Part | Result |
|---|---|
| `GET /me/sessions` | Caller's active sessions `{id, created_at, expires_at, current}`, current first; no token, hash or device data |
| `DELETE /me/sessions/{id}` | Own → 204 (idempotent when already revoked/expired); current → 204 + cookie cleared; foreign/unknown/malformed → 404 alike |
| `DELETE /me/sessions` | Revokes every session of the account in one statement; 204 + cookie cleared |
| `POST /me/account-deletion-request` | First → 201 + one `ACCOUNT_DELETION_REQUESTED` audit; repeat/concurrent → 200 same row; body ignored |
| UI | Member shell; login card (email, "đã xác thực", passwordless note); sessions card ("Hiện tại" pill, "Đăng xuất", "Đăng xuất khỏi mọi thiết bị" → /auth); danger card with request → confirm → "Đã nhận yêu cầu…" |
| Not rendered | Đổi email, Google, email notifications, Chuyển giao + owner warning (P0 scope) |

## 5. Files changed
- New: `db/migrations/006_p0_account_deletion_request.sql`, `src/lib/account/settings.ts` (+ `.db-test.ts`, 10), `src/app/api/v1/me/sessions/{route.ts,[sessionId]/route.ts}`, `src/app/api/v1/me/account-deletion-request/route.ts`, `src/app/(member)/me/settings/{settings-view.tsx,settings.module.css}`, `tests/visual/specs/wf02-s07-settings.spec.ts` (12)
- Changed: `settings/page.tsx`, `audit.ts` (`ACCOUNT_DELETION_REQUESTED`), `schema.db-test.ts`, `qa-screens.ts`, `wf02-t00-member-foundation.spec.ts` (no placeholder left), `wf02-s02-profile-edit.spec.ts` (unused import)

## 6. Tests / build
| Gate | Result |
|---|---|
| Format / lint (0 warnings) / typecheck / build | PASS |
| Unit | 152/152 |
| DB | 248/248 |
| Playwright (full) | 337 passed, 24 skipped by design |
| WF01 pixel runs | 8 screens PASS |
| S01 / S03 / S04 / S02 / T00 | PASS (full suite) |
| Restart | sessions and page identical after app + PostgreSQL restart; request persisted (repeat → 200, 1 row, 1 audit, account ACTIVE); revoked token reuse → 401; app logs contain no email, cookie token, hash or cookie header |

## 7. Security
| Check | Result |
|---|---|
| Owner derivation | Session only; `account_id`/`profile_id` query or body ignored |
| Session IDOR | Foreign id → 404; the foreign session stays valid |
| Token leakage | Neither the cookie token nor any stored hash appears in `/me/sessions` |
| Concurrency | 5–6 parallel revokes of one session all 204; 6–8 parallel deletion requests → 1 row, 1 audit |
| Revoke-all | Other devices 401 immediately; no live session remains; a new login works |
| Deletion invariants | Account, profile, memberships, leadership, roles, projects, visibility, consents and sessions byte-identical after a request |

## 8. Visual QA
| Class | Result |
|---|---|
| Structural / Major / Component | 0 (login row, sessions head row and title line fixed to the reference) |
| Raster | shell/login 0; sessions head 31 px (0.02%), eyebrow line ±2px |
| Intentional-P0-Scope | Đổi email, Google row, email notifications card, transfer + owner warning, bell counter |
| Intentional-Contract | stored-only session rows; deletion request enabled with confirmation and request-only wording |
| Verdict | **PASS** (viewport authoritative; full page 1355 > 900) |

## 9. Deviations / blockers
None. Copy awaits PO review. SEC-OBS-01 remains a separate open task.

## 10. Git
- Branch: `main`; start HEAD `b22eab6`
- Implementation commit: `61e4673`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `fed0b25`
- Working tree: clean after commit, except the untracked `AGENTS.md`

## Related
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decisions, SEC-OBS-01
- [P0_STATUS.md](P0_STATUS.md) — status
