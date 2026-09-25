# P0 Status

Current implementation state of 1hub.network Phase 0. This file changes with task progress;
`README.md` does not. Update it when a task changes the state below.

## Current phase

**M0 — Foundation.** No WF01–WF03 screen is implemented yet; route pages are placeholders bound
to the frozen route manifest.

## Completed (committed)

| Task | Scope |
|---|---|
| M0-T01 | Repository bootstrap and quality gates |
| M0-T02 / T02b | Self-hosted fonts, design tokens, Playwright typography verification |
| M0-T03 | Shared shell and frozen route groups |
| M0-T04 | Shared UI primitives |
| M0-T05 | API client, error envelope, DTO conventions |
| M0-T06A | PostgreSQL foundation and frozen-schema compatibility audit |
| M0-T06B | Additive migration 002: RoleAssignment anchor and per-entity lifecycle states |
| OPS-GH01 | GitHub handoff setup |
| DECISION-P0-01 | Classification of M0-T06A blocking gaps |
| DOC-README-01 | Project README |
| OPS single-writer | CLAUDE.md §13 local workspace single-writer rule |
| DOC-README-02 | README simplified into a stable entry point; this status file created |
| M0-T07 | Deterministic, idempotent seed fixture system |

## Not yet built (M0)

Auth/session, RBAC, idempotency store, manifest-driven pixel harness.

The transitional `role_assignments.account_id` column and its trigger, kept by 002 so the old seed still applied, are now unused: the deterministic seed writes the profile anchor only. They can be dropped by a later migration.
`GET /api/v1/session` returns the contract shape only (`{authenticated:false}`).

## Open decisions / known gaps

| Item | Where |
|---|---|
| Schema vs SOT compatibility gaps | [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) |
| Classification of blocking gaps B1–B5 | [P0_DECISIONS_REQUIRED.md](P0_DECISIONS_REQUIRED.md) |

## Next task

Waiting for review and authorization.

## Related

- [CLAUDE_LATEST_REPORT.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [reports/](reports/) — archived task reports
- [README](../../README.md) — project entry point
