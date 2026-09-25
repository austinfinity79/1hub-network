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
| M0-T08 | Auth/session foundation: magic link, server-side sessions, HTTP-only cookie |
| DECISION-AUTHZ-01/01B | P0 role to capability matrix, human approved |
| M0-T09 | RBAC authorization foundation: actor, scope, lifecycle, session capabilities |
| M0-T10 | Durable idempotency store (migration 003), idempotent magic-link requests |
| M0-T11 | Manifest-driven Pixel QA foundation: manifest audit, QA mapping, capture, diff, report, dry run |

## Not yet built (M0)

Nothing from the M0 item list. M0 is ready for its completion audit.

`GET /api/v1/session` resolves a real session and derives `capabilities` and `managed_scopes` server-side from the approved authorization matrix.

The transitional `role_assignments.account_id` column and its trigger, kept by 002 so the old seed still applied, are now unused: the deterministic seed writes the profile anchor only. They can be dropped by a later migration.

## Pixel QA readiness (M0-T11 dry run)

13 of 24 production screens are `READY_FOR_SCREEN_IMPLEMENTATION`. 11 are `REFERENCE_CONFIGURATION_GAP`, awaiting a design/QA decision:

| Gap | Screens |
|---|---|
| `state-board` reference with no per-state region definition | WF01-S03, WF01-S04 |
| `__full.png` shorter than the 900px viewport; a full-page capture is never below 900px | WF02-S01, S02, S05, S06; WF03-S01, S02, S03, S05, S08 |

No product pixel pass has been claimed for any screen.

## Open decisions / known gaps

| Item | Where |
|---|---|
| Schema vs SOT compatibility gaps | [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) |
| Provisional idempotency policy, incl. lenient missing header | [IDEMPOTENCY_STORE_P0.md](IDEMPOTENCY_STORE_P0.md) |
| Classification of blocking gaps B1–B5 | [P0_DECISIONS_REQUIRED.md](P0_DECISIONS_REQUIRED.md) |
| Pixel QA reference configuration gaps (11 screens) | [M0-T11 report](reports/M0-T11_manifest-pixel-qa-foundation.md) |

## Next task

M0 Foundation Completion Audit (recommended). Waiting for review and authorization.

## Related

- [IDEMPOTENCY_STORE_P0.md](IDEMPOTENCY_STORE_P0.md) — idempotency store and its provisional decisions
- [CLAUDE_LATEST_REPORT.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [reports/](reports/) — archived task reports
- [README](../../README.md) — project entry point
