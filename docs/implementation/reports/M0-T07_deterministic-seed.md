# Claude Task Report

## 1. Task
- Task ID / name: M0-T07 — deterministic seed system
- Scope requested: Replace the dev seed with a deterministic, idempotent P0 fixture system. No migration changes, no auth, no RBAC, no WF01.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed.

## 2. Pre-flight
- Single writer: **PASS**. Three `claude` processes exist, but only one has this worktree as its cwd and that one is this session; the other two are in `steam-topup` and `apec27`.
- Starting HEAD: `f5e7266`.
- Working tree was clean. All three DOC-README-02 files (`README.md`, `CLAUDE_LATEST_REPORT.md`, `P0_STATUS.md`) were already committed, so nothing unrelated was at risk and none was overwritten.

## 3. Approach
`db/seed/seed_dev.sql` is **not edited**. It stays byte-identical as frozen evidence of the defects that retired it, and a test asserts it still contains `now()` and `ORG_ADMIN` so it cannot be quietly "fixed" instead of replaced. `scripts/db.mjs` now applies `db/seed/seed_p0_deterministic.sql`.

Determinism and idempotency come from one decision: every fixture row carries an explicit UUID primary key and is written `ON CONFLICT (pk) DO UPDATE`. That needed no schema change, so migration 003 was not required.

## 4. What the seed fixes
| Defect | Before | After |
|---|---|---|
| Invented role codes | `ORG_ADMIN`, `PLATFORM_OPS` | `HUB_COMMUNITY_LEADER`, `PLATFORM_ADMIN`, plus `INDIVIDUAL_USER` and `HUB_MEMBER` |
| Non-deterministic ids | 4 tables took `gen_random_uuid()` | every row has a fixed UUID |
| Non-deterministic time | `now()` in 5 inserts | every timestamp a literal |
| Not idempotent | leadership 1→2, roles 2→4 on rerun | counts unchanged across three runs |
| Coverage | 11 tables empty | 7 empty, all intentionally |

Role mapping follows DECISION-P0-01: the Data SOT catalogue (:316) restricted to the four the Auth/RBAC doc marks P0-active (:80-83). The seeded leader now holds `HUB_COMMUNITY_LEADER` scoped to Chapter 01, so WF03 ops screens have a real authorization path for the first time.

`role_assignments` are written through `individual_profile_id` only, with `account_id` left NULL. That demonstrates the transitional column and trigger migration 002 had to keep are now unused and can be dropped by a later migration.

## 5. Fixture coverage
Five personas, up from three. The two new ones close scenario gaps B5 flagged:
- **newcomer@example.test** — `DRAFT` profile, no onboarding, so WF01-S05..S08 have an empty state to render.
- **pending@example.test** — `PENDING_APPROVAL` membership from `SELF_DECLARED` source, so the frozen fallback UI (FREEZE:76) is renderable. The old seed had no pending membership at all.

Also seeded: both consumed and unclaimed `membership_bootstrap` rows so the D2 preseed primary path can be exercised end to end; consent records for WF01-S07; organization relationships for WF03-S08; a published and a draft event; a challenge programme; a venture with an active and a pending team member.

Profile completion uses the frozen ten groups, with Demo Member at 10/10 and Demo Pending deliberately below the 80 percent KPI so both sides of that boundary are testable. Membership is not part of completion, per DECISION-P0-01.

## 6. Empty table audit
Down from 11 to 7. Every remaining one is **INTENTIONALLY_EMPTY_IN_M0**; none is REQUIRED_FOR_P0_SEED.

| Table | Classification |
|---|---|
| `analytics_events`, `audit_events` | written at runtime, not fixtures |
| `auth_magic_link_requests`, `user_sessions` | belong to M0-T08 auth |
| `feedback_submissions` | no frozen pixel screen exists (API:671 says so) |
| `profile_education`, `profile_links` | not profile-completion groups |

Nothing was filled merely to raise coverage.

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS, 0 errors 0 warnings |
| Unit tests | PASS — 61 of 61 |
| DB integration tests | PASS — 37 of 37 (18 new) |
| Build | PASS |
| Playwright regression | PASS — 64 of 64 |
| Fresh DB, 001 → 002 → seed | PASS |
| Second seed run | PASS, zero duplication |
| Reset + reseed | PASS, snapshot byte-identical |
| Restart persistence | PASS, same ids and counts |
| 001 / 002 / seed_dev.sql unchanged | PASS, 0 changed lines each |

Determinism was proven by capturing a snapshot of ids, states and timestamps, running a full reset, and diffing: identical. Idempotency was proven by re-running the seed and comparing row counts across all 14 fixture tables.

Three M0-T06A tests failed after this change and were flipped, the same pattern as M0-T06B: they asserted the invented role codes were present, that only three personas existed, and that eleven tables were empty. All three were recording defects this task fixed.

## 8. Remaining gaps
- Seed-only gaps remaining: **0**. B2, B4 and B5 are all closed.
- Blocking gaps remaining: **0**.
- Still open but not seed work: `role_code` and `scope_type` remain untyped `text` columns. Constraining them needs a catalogue decision and a migration, so it was left alone. Also open: P5–P13 in the gap register, and the two contract items (API completion-group example, idempotency store).

## 9. Git
- Branch: `main`
- Implementation commit: see section 11
- Report/final commit: same commit
- Remote: `origin` → `austinfinity79/1hub-network`
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `f5e7266`, deliberately behind local
- Working tree status: clean after commit

## 10. Files changed
- `db/seed/seed_p0_deterministic.sql` (new)
- `src/lib/db/seed.db-test.ts` (new, 18 tests)
- `src/lib/db/schema.db-test.ts` (three stale assertions flipped)
- `scripts/db.mjs` (points at the new seed; log now names the file actually applied)
- `docs/implementation/P0_STATUS.md` (updated; it was committed and clean, so safe to touch)
- `docs/implementation/CLAUDE_LATEST_REPORT.md` plus archived copy

## 11. Recommended next task
**M0-T08 — auth/session foundation.** It owns `auth_magic_link_requests` and `user_sessions`, the two fixture tables deliberately left empty here, and it is what turns `GET /api/v1/session` from a contract shape into a real identity.
