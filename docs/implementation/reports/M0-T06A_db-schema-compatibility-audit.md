# Claude Task Report

## 1. Task
- Task ID / name: M0-T06A — PostgreSQL migration foundation and frozen schema compatibility audit
- Scope requested: Reproducible PostgreSQL foundation, apply `001_p0_init.sql` unchanged, seed, introspect, and audit the frozen schema against higher-priority SOT. No fixes, no migration 002.
- Status: **PARTIAL**
- Why not DONE: the infrastructure and the audit are both complete, but the audit found five BLOCKING gaps, one of which is a genuine disagreement between two frozen SOT sources. Per the task's own rule, PostgreSQL running is not sufficient to claim DONE while blocking conflicts stand unresolved.
- Progress estimate: infrastructure 100%, audit 100%, blocking gaps 0% resolved (out of scope). M0 milestone 7 of 13.

## 2. PostgreSQL version and config
| Item | Value |
|---|---|
| Engine | PostgreSQL 17.6 (`postgres:17.6-alpine`, pinned) |
| Host port | 55432, chosen because other local containers hold 5432 |
| Database / user | `hubnetwork_p0` / `hubnetwork` |
| initdb args | `--locale=C --encoding=UTF8`, so index and ORDER BY behaviour does not drift with host locale |
| Volume | named `hubnetwork_p0_data` |
| Healthcheck | `pg_isready`, so `db:up` waits for readiness rather than racing |

Commands: `db:up`, `db:down`, `db:destroy`, `db:migrate`, `db:seed`, `db:reset`, `db:status`, `db:introspect`, `db:setup`, `test:db`.

## 3. Migration result
PASS. `db/migrations/001_p0_init.sql` applied **unchanged** and byte-for-byte. `git diff` on `db/` reports zero changed lines.

- 27 contract tables created, plus one `schema_migrations` ledger = 28 total.
- 12 enum types created.
- The ledger stores a sha256 per migration, so a second `db:migrate` is a no-op (`skip ... already applied`) and editing an applied migration is refused loudly rather than diverging silently.

## 4. Seed result
PASS as an operation, with quality defects recorded. `seed_dev.sql` applied to a fresh database, populating 16 tables.

Empirically confirmed on the live engine, not assumed:
- **Not idempotent.** A second run took `leadership_records` from 1 to 2 and `role_assignments` from 2 to 4. Those two inserts lack `ON CONFLICT`, unlike every other statement in the file, and neither table has a unique constraint.
- **Not deterministic.** Across a reset, membership ids changed from `bbd32fd6…` to `5a24fbf6…` and `events.starts_at` moved from `13:40:45Z` to `13:41:28Z`. Profile ids are fixed, so the file is only partly deterministic.
- **Eleven tables left empty**, including `consent_records`, `membership_bootstrap` and `user_sessions`.

## 5. Schema and table count
| Metric | Value |
|---|---|
| Tables (contract) | 27 |
| Tables (incl. ledger) | 28 |
| Enum types | 12 |
| Tables seeded | 16 |
| Tables empty | 11 |

## 6. Compatibility matrix summary
Full matrix: `docs/implementation/DB_SCHEMA_GAPS_P0.md`. Built from live introspection, asserted by `src/lib/db/schema.db-test.ts` against the running engine.

| Severity | Count |
|---|---|
| BLOCKING | 5 |
| PRE-WF | 13 |
| DEFERRED | 7 |

Clean, needing no action: `visibility_level`, `consent_type`, `programme_type`, `project_type`, `project_status`, `vocab_status`, `account_status`.

## 7. BLOCKING gaps
| ID | Gap | Human decision |
|---|---|---|
| B1 | Completion group 3: data freeze says "Current role/headline", API contract says `NETWORK_CONTEXT`. **Two frozen sources genuinely disagree, so no resolution is proposed** | Required |
| B2 | `role_code` and `scope_type` are untyped `text`; the live seed contains `ORG_ADMIN` and `PLATFORM_OPS`, which appear in no role catalogue. Blocks M0-T09 RBAC | Required |
| B3 | `role_assignments` is anchored on `account_id` where SOT and Auth architecture say `individual_profile_id`, and lacks `valid_from`/`valid_to`/`assigned_by`, so the "assignment is active" rule has nothing to evaluate | Required |
| B4 | Seed is neither deterministic nor idempotent. Blocks M0-T07 and every authenticated pixel scenario | Reconfirm |
| B5 | Seed leaves eleven tables empty, so WF01-S07 consent, the D2 preseed path and any logged-in scenario have no fixture | No |

## 8. PRE-WF gaps (13)
Most are cases where the higher-priority SOT clearly states a value and the migration is simply stale: profile `INACTIVE` should be `DEACTIVATED`; event status lacks `LIVE`/`ENDED`/`CANCELLED`; membership lacks `SUSPENDED`/`ALUMNI`/`WITHDRAWN`; leadership lacks `ALUMNI`/`REVOKED`. Also missing entirely: event registration, `file_assets`, an idempotency key store, notification preferences and deletion requests. Visibility has three incompatible storage shapes across three frozen documents.

## 9. Is migration 002 required?
**Yes, and it was deliberately not created.** P1–P6, P12 and B3 are stale-migration cases where an additive 002 is the correct fix.

002 must not be authored until B1 is ruled on and the B2 role catalogue is confirmed, because both change what 002 should contain.

## 10. Human decisions required
1. B1 — which source wins on the tenth completion group. Blocks M1.
2. B2 — the canonical role code catalogue, and whether the columns become enums.
3. B3 — whether RoleAssignment anchors on account or profile.
4. P8 — canonical visibility group codes and which storage shape wins.
5. P10 — approval for an idempotency key table, absent from the schema SOT.
6. B4 — reconfirm a deterministic seed may supersede `seed_dev.sql`.

## 11. PostgreSQL acceptance
Proven end to end on a clean instance. SQLite was not used.

| Step | Result |
|---|---|
| Fresh database | PASS |
| Migrate | PASS, 27 tables + ledger |
| Seed | PASS, 16 tables populated |
| Application start | PASS, `/`, `/api/v1/session`, `/me` all 200 with `DATABASE_URL` set |
| DB connectivity | PASS, 3 accounts read through the app's own pooled client, engine 17.6 |
| Restart | PASS, `docker compose restart db` |
| Data still present | PASS, 3 accounts, same profile id, 28 tables, ledger intact |

## 12. Validation results
- Format: PASS
- Lint: PASS — 0 errors, 0 warnings (one unused eslint-disable directive found and removed)
- Typecheck: PASS
- Unit tests: PASS — 61 passed / 61, hermetic, no Docker required
- DB integration tests: PASS — 13 passed / 13 against live PostgreSQL
- Build: PASS
- Playwright regression: PASS — 64 passed / 64
- M0-T01–T05 regression: PASS

## 13. Visual QA
N/A. No UI changed. The existing visual suites ran as regression and passed; baselines were not touched and `design-reference/final/**` is untouched.

## 14. Contract gap carryover
Preserved from M0-T05 and not resolved here: the three `UNCONTRACTED_` error codes for 401/404/500, the Markdown-over-YAML authority note, and `GET /session` returning `{authenticated:false}` with no identity. The session endpoint still does not read the database, which is correct: there is no session store until M0-T08.

## 15. Git
- Branch: `main`
- Commit hash: `cc71468f7dcc44994d16471c8a2d366f94a89ee5`
- Commit message: `feat(m0-t06a): PostgreSQL foundation and frozen schema compatibility audit`
- Working tree status: clean.

## 16. Recommended next task
**A human decision round, not a coding task.** Rule on B1, B2 and B3, since M0-T07 (deterministic seed) needs the role catalogue from B2, and migration 002 cannot be scoped until B1 and B3 are settled.

If you would rather keep implementing, the next codeable task is **M0-T07 — deterministic seed system**, which can proceed on B4 and B5 alone: fixed ids and fixed timestamps for every row, idempotent re-runs, and fixtures for the eleven empty tables including a `PENDING_APPROVAL` membership and `membership_bootstrap` rows. It would have to leave the seeded role codes as they are until B2 is ruled on, and I would flag that rather than guess. Not started.
