# Claude Session Handoff

Current phase: **M0 Foundation**, P0 scope (WF01/WF02/WF03 production)
Current completed task: **M0-T10 — Durable Idempotency Store Foundation**
Task status: **DONE**, all gates PASS, committed locally

Last M0-T10 commit: `aaa2c4de5c93407c261c7e77004fa290a9d47335`
Local HEAD: the handoff commit that adds this file, sitting directly on top of it
Remote HEAD: `2390ce2efe6c621ea654d57fef6bdc02641c7a51`
Working tree status: **clean**, 0 stashes

Local is **6 commits ahead** of the remote. This is intentional: LOCAL REVIEW MODE has been in force since DECISION-P0-01, so M0-T08, M0-T09 and M0-T10 are committed but deliberately unpushed. Pushing needs explicit authorization.

This file deliberately does not record its own commit hash, because writing it would go stale the moment the file is committed. Run `git rev-parse HEAD` for the live value.

## Completed foundation

| Task | Delivered |
|---|---|
| M-INIT | Readiness audit |
| M0-T01 | Repo bootstrap, quality gates |
| M0-T02 / T02b | Self-hosted fonts, design tokens, Playwright verification |
| M0-T03 | Shared web shell, frozen route groups |
| M0-T04 | Shared UI primitives |
| M0-T05 | API client, frozen error envelope, DTO conventions |
| M0-T06A / T06B | PostgreSQL foundation, compatibility audit, additive migration 002 |
| M0-T07 | Deterministic seed, 5 personas, fixed timestamps |
| M0-T08 | Magic-link auth, server-side sessions, HttpOnly cookie |
| M0-T09 | RBAC on the approved capability matrix |
| M0-T10 | Durable idempotency store, migration 003 |
| OPS-GH01 / OPS-LOCAL-02 | GitHub handoff, single-writer workspace rule |

Gate totals at handoff: 61 unit, 118 DB integration, 93 Playwright, build PASS.

## Open blockers

**None.** No task is currently blocked and no SOT conflict is unresolved.

## Approved decisions that materially affect next work

- **DECISION-P0-01** — data freeze outranks the API contract (B1); RoleAssignment anchors on `individual_profile_id` (B3).
- **DECISION-AUTHZ-01B** — 9 capabilities, `resource:action` naming, no wildcard and no inheritance. `PLATFORM_ADMIN` must not edit another user's canonical IndividualProfile. No impersonation.
- **M0-T10** — idempotency is available but not compelled; a request without the header is still processed.
- Migrations 001 and 002 are frozen and byte-verified on every run. Migration 003 is applied.

## Pre-UAT deferred decisions

| Item | Provisional value |
|---|---|
| CSRF mechanism | none implemented; SameSite=lax is the only mitigation |
| Session TTL | 30 days |
| Cookie SameSite | `lax` |
| Idempotency retention | 24 hours |
| Idempotency conflict code | `UNCONTRACTED_IDEMPOTENCY_CONFLICT` at 409 |
| Missing Idempotency-Key | lenient; request still processed |
| Gap P8 | visibility group codes and storage shape unfrozen |
| `role_code` / `scope_type` | still untyped `text` columns |
| `role_assignments.account_id` | transitional column and trigger now unused, droppable |

## Next authorized task

**None authorized yet.** M0-T11 (manifest-driven pixel QA foundation) is the *recommended* next task and the last M0 item, but it has not been authorized. Wait for an explicit authorization prompt.

## Files the next Claude session MUST read first

1. `CLAUDE.md`
2. `README.md`
3. `1HUB_IMPLEMENTATION_MASTER_SPEC_v1.3.md`
4. `docs/implementation/P0_STATUS.md`
5. `docs/implementation/CLAUDE_LATEST_REPORT.md`
6. `docs/implementation/reports/M0-T10_idempotency-store-foundation.md`
7. For M0-T11: `docs/qa/05_PIXEL_QA_ARCHITECTURE_v1.1.md`, `docs/design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md`, `design-reference/final/manifest.yaml`

## Environment notes

PostgreSQL 17.6 runs via docker compose on host port **55432**. `DATABASE_URL` must be exported before `pnpm test:db` or `pnpm visual`. Playwright is the only authoritative browser tool; the Chrome extension is not a valid test mechanism.

## Related

- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — M0-T10 report in full
- [p0-status.md](P0_STATUS.md) — overall P0 state
- [idempotency-store-p0.md](IDEMPOTENCY_STORE_P0.md) — provisional idempotency decisions
- [db-schema-gaps-p0.md](DB_SCHEMA_GAPS_P0.md) — remaining schema gaps
