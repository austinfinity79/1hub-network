# Demo deploy and rollback checklist

DEMO-QA-PREP-B. **Checklist only: nothing here was run.** Tooling: `deploy/bin/*` on branch `deploy/vps-foundation` (`dc2ae21`, read-only reference): `deploy.sh <sha> [host]` ships `git archive <sha>` and runs `release.sh` (build, migrate, switch, health); `rollback.sh [sha]` switches to the previous image; `backup.sh` dumps the DB; `smoke.sh` probes `127.0.0.1:3100`.

## Gate 0 — decisions before any deploy (PO)
| # | Item | Status |
|---|---|---|
| 0.1 | Demo target: production `1hubnetwork.io.vn` or a separate demo environment | **OPEN** (see note) |
| 0.2 | Demo data on the target: DEMO_DATA_CONTRACT says demo rows "never run against a production database" and OUT_OF_SCOPE says demo data never ships to production; the journey needs them on the target | **OPEN**, must be decided with 0.1 |
| 0.3 | Candidate SHA accepted by ChatGPT / PO (DEMO-QA-01 PASS) | pending |
| 0.4 | Deploy window and who watches it | pending |

## Gate 1 — candidate
| # | Check | Command / evidence |
|---|---|---|
| 1.1 | Exact SHA, not a branch | `git rev-parse --verify <sha>^{commit}`; `deploy.sh` refuses a branch name |
| 1.2 | SHA is what DEMO-QA-01 tested | compare with the QA evidence |
| 1.3 | Migrations in the candidate vs the target ledger | `git diff --name-only <current-prod-sha> <sha> -- db/migrations` → list; none expected for the demo (DEMO-D3 "no migration") |
| 1.4 | Env on the target | `INVITE_LINK_SECRET` (S1-UAT-07), e-mail provider, no `ENABLE_DEV_ROUTES` |
| 1.5 | Local production build | `pnpm build` PASS on the SHA |

## Gate 2 — backup and record
| # | Check | Command / evidence |
|---|---|---|
| 2.1 | Current production SHA (= rollback target) | server `$ROOT/shared/state/current`; record it |
| 2.2 | Fresh DB backup, verified | server `bin/backup.sh`; note file name and size; restore test only into a new DB (`createdb restore_check`), never over live |
| 2.3 | Previous image present | `docker image inspect onehub-app:<current>` |

## Gate 3 — deploy
| # | Step | Command / evidence |
|---|---|---|
| 3.1 | Ship and release | `deploy/bin/deploy.sh <sha> <host>` (build, `db.mjs migrate`, switch, compose health wait) |
| 3.2 | Demo data (only if 0.2 approves) | on the target DB, named explicitly: `DATABASE_URL=… node scripts/db.mjs demo`; twice → no change |
| 3.3 | Health | release.sh health wait PASS; `bin/smoke.sh` (`/auth` 200, `/api/v1/auth/providers` 200, `/api/v1/session` 200, `/dev/typography` 404, vocabularies non-5xx) |
| 3.4 | Critical journey | `node scripts/qa/demo-0710-smoke.mjs https://<target> --sync`, then the manual [smoke §1–§4](DEMO_SMOKE_CHECKLIST.md) |
| 3.5 | Logs | app container logs since switch: 0 unexpected 5xx, 0 hydration, 0 stack trace, 0 secret |

## Rollback
| Trigger | Procedure |
|---|---|
| health fails during release | `release.sh` reverts the app to the previous SHA automatically (schema NOT reverted) |
| journey or smoke fails after switch | server `bin/rollback.sh` (default: `shared/state/previous`) → `ROLLED_BACK_TO=<sha>`; re-run `smoke.sh` and the journey smoke |
| schema changed by the release | `rollback.sh` is NOT safe if old code cannot run on the new schema; restore from 2.2 into a new DB and switch only with PO approval |
| demo rows to remove | delete the `de710000-` rows (as the spec `afterAll`), after PO approval, with a backup first |

## Gate 4 — sign-off
Post-deploy evidence (SHA live, smoke JSON, screenshots, log summary) → PO approval → demo. No push / merge / deploy without that approval.

Note: `node scripts/db.mjs demo` does not refuse `hubnetwork_p0` or a production database today (it is MUTATING only; the shared-DB refusal applies to DESTRUCTIVE commands), although DEMO_DATA_CONTRACT says it does. Recorded as QA-B-01 in the [prep report](../../implementation/reports/DEMO-QA-PREP-B.md).

## Related
- [DEMO_SMOKE_CHECKLIST](DEMO_SMOKE_CHECKLIST.md) · [DEMO_DATA_CONTRACT](../DEMO_DATA_CONTRACT.md) · [OUT_OF_SCOPE_POST_DEMO](../OUT_OF_SCOPE_POST_DEMO.md)
