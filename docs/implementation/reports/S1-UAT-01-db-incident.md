# S1-UAT-01 db incident

Migration 018 was applied once to the SHARED local dev database during S1-UAT-01. It was rolled back by hand to 017 the same session; all later work used an isolated task database. Closed with evidence below. No real environment was touched (CLAUDE.md §8, §13).

## Timeline (2026-10-05, local machine)
| Step | What happened |
|---|---|
| 1 | Early in the task, `pnpm db:migrate` ran in the worktree with the default `DATABASE_URL` → `hubnetwork_p0` (container `hubnetwork-p0-db`, shared by every worktree). 018 (then without `signup_full_name`) was applied and recorded |
| 2 | Before any test ran, the shared-container risk was noticed. 018's objects were dropped by hand in one transaction (two tables, enum, partial index, five columns) and its ledger row deleted |
| 3 | A dedicated database `hubnetwork_s1auth` was created in the same container; the worktree's ignored `.env.local` and every test command point at it. Every later migrate, reset, DB test and browser run used it only |

Only DDL was applied; 018 writes no data, and no test or server ever ran against `hubnetwork_p0` with 018 present.

## Proof — shared dev DB (`hubnetwork_p0`) = 017
| Check | Result |
|---|---|
| Ledger | 17 rows, last `017_p0_admin_foundation.sql`; no 018 row |
| Ledger checksums 001 … 017 | 17 / 17 match the files on disk (sha256) |
| 018 tables (`auth_identities`, `password_reset_requests`) | 0 |
| 018 columns on `user_accounts` | 0 (7 columns = the 001 shape) |
| Enum `auth_identity_provider`, index `uq_user_accounts_username_normalized` | 0 / 0 |
| `AUTH_*` audit rows, S1 test accounts | 0 / 0 |

## Proof — isolated task DB (`hubnetwork_s1auth`) = 018
| Path | Result |
|---|---|
| Fresh 001 → 018 + seed (`db reset`) | ledger 18, `user_accounts` 13 columns |
| Documented 018 rollback (from the migration header) | ledger 17, 7 columns, 018 tables 0 |
| 017 → 018 upgrade (`db migrate`) | `applied 018_p0_password_auth.sql`; ledger 18 |
| Re-run | nothing applied (idempotent) |
| Scratch DBs (`password-auth-migration.db-test.ts`) | FRESH, UPGRADE with data (rows, sessions, links unchanged), RECOVERY (rollback refused with data, lossless without, re-apply) |
| 017 recovery test (`admin-migration.db-test.ts`) | unwinds 018 first, then 017; re-applies both |

## Prevention
The worktree DB is isolated by `.env.local`; the report records the DB for every test run. Recommendation for future tasks: one database per worktree, set before the first `db:*` command.

## Related
- [S1-UAT-01-auth-replacement](S1-UAT-01-auth-replacement.md)
- [S1-UAT-01-evidence](S1-UAT-01-evidence.md)
