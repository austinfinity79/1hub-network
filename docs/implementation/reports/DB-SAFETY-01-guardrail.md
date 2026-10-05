# DB-SAFETY-01 guardrail

Fail-closed database targeting after the [DB-SAFETY-01 incident](DB-SAFETY-01-incident.md). Rule: [CLAUDE.md §15](../../../CLAUDE.md).

## db.mjs behaviour
| Command | Class | Old | New |
|---|---|---|---|
| `reset` | DESTRUCTIVE | `DATABASE_URL ?? hubnetwork_p0` | explicit `DATABASE_URL` or exit 2 `DATABASE_URL_REQUIRED_FOR_DESTRUCTIVE_DB_COMMAND`; on `hubnetwork_p0` also `--confirm-shared-db=hubnetwork_p0` or exit 2 `SHARED_DB_DESTRUCTIVE_COMMAND_REFUSED` |
| `migrate`, `seed` | MUTATING | same fallback | explicit `DATABASE_URL` or exit 2 `DATABASE_URL_REQUIRED_FOR_MUTATING_DB_COMMAND` |
| `status`, `introspect` | READ_ONLY | same fallback | unchanged: documented local default allowed |
Decided in `scripts/db-target.mjs` (pure) before any client exists; writing commands print `TARGET_DB` (password masked), `TARGET_HOST`, `TARGET_DATABASE`, `COMMAND_CLASS` first. The shared-DB acknowledgement is a per-invocation flag naming the database, not an environment variable (`ALLOW_SHARED_DB_RESET=1` is ignored): a variable can be exported once and silently apply to later commands.

## Test helpers
| Helper | Change |
|---|---|
| `pnpm test:db` | setup `src/lib/db/db-test-setup.ts`: refuses a missing `DATABASE_URL` and `hubnetwork_p0` before any test connects |
| Migration DB tests | unchanged: they derive their own `hubnetwork_p0_<task>_*` databases and pass `DATABASE_URL` explicitly to the runner |
| Visual suite | `visual.config.ts` refuses a missing `DATABASE_URL` (was: fallback to `hubnetwork_p0` for the server it starts) |

## Similar-risk audit
| Finding | Class |
|---|---|
| `scripts/db.mjs` fallback | FIXED_IN_THIS_TASK |
| `tests/visual/visual.config.ts` fallback (suite writes through the server) | FIXED_IN_THIS_TASK |
| `scripts/roster.mjs` fallback (writes membership_bootstrap) | FIXED_IN_THIS_TASK (`requireDatabaseUrl`) |
| `scripts/qa/wf04-*`, `wf05-*` (4 scripts) fallback; create and delete their own rows | FIXED_IN_THIS_TASK (`requireDatabaseUrl`) |
| `wf05-visual-compare` base side → `hubnetwork_p0_base` (not shared) | SAFE |
| `src/lib/db/client.ts` app pool | SAFE: throws when unset, no fallback |
| `scripts/admin/feedback-retention.mjs` | SAFE: requires `DATABASE_URL` |
| Migration DB tests `DROP DATABASE` | SAFE: only their own derived names; now also behind the test-suite guard |
| `child_process` wrappers | SAFE: every runner call passes `env` with an explicit `DATABASE_URL` |
| `.env.example`, `compose.yaml` name `hubnetwork_p0` | SAFE: documentation / container default, not a script fallback |
| `pnpm db:setup` / README | updated: export `DATABASE_URL` first |

## Automated tests
| Case | Test | Result |
|---|---|---|
| A — no `DATABASE_URL` → refused, nothing touched | `db-target.test.ts` (spawned runner, exit 2, no ECONNREFUSED), `db-safety.db-test.ts` (marker row survives) | PASS |
| B — `hubnetwork_p0` without / with wrong acknowledgement, env var ignored | `db-target.test.ts` | PASS |
| C — isolated DB with explicit URL allowed; full ledger after reset | both files | PASS |
| D — read-only `status` / `introspect` still resolve | both files | PASS |
| E — target printed before dropping | both files (line order checked) | PASS |
| DB suite guard | `db-target.test.ts`; live run against `…:1/hubnetwork_p0` → `SHARED_DB_TEST_RUN_REFUSED` | PASS |

## Related
- [DB-SAFETY-01-incident](DB-SAFETY-01-incident.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
