# DB-SAFETY-01 incident

Second change of the SHARED dev database `hubnetwork_p0` by mistake (first: S1-UAT-01, migration 018 applied). Recovered to the canonical 017 baseline; destructive and mutating DB commands now fail closed. Risk audit and tests: [DB-SAFETY-01-guardrail](DB-SAFETY-01-guardrail.md).

## Root cause
| Item | Finding |
|---|---|
| Trigger | S1-UAT-05 setup wrote the task URL (`hubnetwork_s1profile`) into `.env.local`, then ran `node scripts/db.mjs reset` and `migrate` |
| Mechanism | `db.mjs` read `process.env.DATABASE_URL ?? <hubnetwork_p0 URL>`; it never reads `.env.local`, so the variable was absent and the runner silently fell back to the shared database |
| Missed check | the target database was not printed or verified before a destructive command |
| Class | same as S1-UAT-01: a script defaulting to `hubnetwork_p0` when `DATABASE_URL` is missing in the child process |

## Shared DB before recovery (read-only inspection)
| Field | Value |
|---|---|
| DB name | `hubnetwork_p0` |
| Migration max / count | `019_p0_profile_sprint1.sql` / 19 |
| Unexpected migrations | 018 (S1-UAT-01 branch), 019 (uncommitted S1-UAT-05 file) |
| Unexpected objects | `vocab_status` value `UNNORMALIZED`; `profile_experience.employment_type`, `.location`; `user_accounts.username`, `password_hash`, …; table `auth_identities` |
| Rows | seed only (5 accounts, 5 profiles): the reset had already replaced the previous content |

## Recovery
| Step | Value |
|---|---|
| Worktree | `../1hub-network-db-restore`, detached at `edd3d2472f140071290ab09040f2853f39329606` (origin/main), clean, migrations 001 → 017 only |
| Target printed first | `TARGET_DB postgresql://hubnetwork:***@localhost:55432/hubnetwork_p0` · `TARGET_HOST localhost:55432` · `TARGET_DATABASE hubnetwork_p0` · `EXPECTED_MAX_MIGRATION 017` |
| Command | explicitly exported `DATABASE_URL` (…/hubnetwork_p0), `node scripts/db.mjs reset` of `edd3d24` (drop public schema, migrate 001 → 017, deterministic seed), authorised by the DB-SAFETY-01 PO decision |

## After recovery
| Check | Result |
|---|---|
| Ledger | 17 rows, 001 → 017 contiguous; no 018, no 019; second `migrate` = all skipped |
| Leftover objects | none: `vocab_status` = {ACTIVE, ARCHIVED}; no experience / auth columns; no `auth_identities` |
| Baseline equality | `db.mjs introspect` of `hubnetwork_p0` equals a fresh reference DB (`hubnetwork_dbsafety_ref`, migrated + seeded from `edd3d24`): server version, tables, enums, columns, row counts all MATCH (109 seed rows) |
| Classification | **SCHEMA_BASELINE_RESTORED** (with the canonical seed). NOT full data: there is no backup, so any non-seed rows the database held before the incident are lost |

## Other databases
| Database | State |
|---|---|
| `hubnetwork_s1profile` (S1-UAT-05) | created after the incident with an explicit URL: 019 + seed, intact; recreate it with the guarded runner when S1-UAT-05 resumes |
| `hubnetwork_dbsafety_test` | this task's isolated test database |
| `hubnetwork_dbsafety_ref` | throwaway reference for the baseline comparison |

## Related
- [DB-SAFETY-01-guardrail](DB-SAFETY-01-guardrail.md)
- [S1-UAT-01-db-incident](S1-UAT-01-db-incident.md)
- [CLAUDE.md §15](../../../CLAUDE.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
