# WF05-PROD-02_persistence

**WF05-PROD-02 — close the remaining persistence gaps.** 2026-10-02, branch `feat/wf05-prod-hardening` on `b362527` (contract freeze). Scope = handoff P2-1 … P2-4 of the [implementation handoff](WF05-PROD-01_implementation-handoff.md) only; no API semantics, lifecycle, role, route or UI change. Evidence: [WF05-PROD-02_evidence.md](WF05-PROD-02_evidence.md).

## Preflight
| Check | Result |
|---|---|
| branch, HEAD | `feat/wf05-prod-hardening`, `b362527` (PROD-01 contract) |
| WF04 candidate | `f40f70c` in HEAD; `feat/wf04-prod-hardening` unchanged |
| tree, writer | clean except `AGENTS.md`; no other writer; `fix/member-shell-mobile`, `docs/ai-ingestion-contract` not in HEAD |
| baselines | `origin/main` / production `78f21f2` |
| migrations | 001–015 present and applied locally before the task |

## Sources used
[Production contract](WF05-PROD-01_production-contract.md), [domain and lifecycle](WF05-PROD-01_domain-lifecycle.md), [DB contract](WF05-PROD-01_db-contract.md) (D1–D10), [handoff](WF05-PROD-01_implementation-handoff.md) (P2-1 … P2-4), [PROD-00 gap matrix](WF05-PROD-00_gap-matrix.md) (G15, G16, G17, G19, G20), DEC-W5P-D04 / D06.

## Migration 016 (`db/migrations/016_p0_application_integrity.sql`)
| Statement | Why | Current failure mode | Contract requirement | Effect |
|---|---|---|---|---|
| A. data check (snapshot shape) | carry only valid rows | — | DB contract D3, "STOP on violation" | STOPS, changing nothing, on a snapshot that is not an object |
| B. `trg_applications_identity_fixed` (BEFORE UPDATE) | applicant identity fixed at create | only the service refuses a change of venture, programme, applicant type or creator | D2; DEC-W5P-D04 / D06 | any change of the four columns is refused (`23514`) on every row; DRAFT answers stay editable |
| C1. `trg_applications_submitted_kept` (BEFORE DELETE) | submitted applications are permanent | 013 refuses UPDATE only; a DELETE drops a submitted record without audit | D1; DEC-W5P-D06 | DELETE of a SUBMITTED row refused; DRAFT rows stay deletable |
| C2. `trg_applications_no_truncate` (BEFORE TRUNCATE) | same, statement level | TRUNCATE bypasses row triggers | D1 | refused while any SUBMITTED row exists |
| D. `ck_applications_snapshot_object` | snapshot shape (`schema_version` 1) | no shape check | D3 | a non-object snapshot is refused (`23514`) |
No table, column or index added; 013's guards, `uq_applications_active_pair` and every foreign key unchanged. One transaction; additive; documented lossless rollback; previous releases run unchanged on it (no release deletes an application or changes those columns). A superuser maintenance session can still remove rows with `session_replication_role = replica`; only local test cleanup does.

## Other persistence changes
| Item | Change | Files |
|---|---|---|
| P2-2 idempotency retention (G15) | before every claim: the expired record of the same scope is removed (a key reused after 24 h is a new request, never a stale replay), then up to `IDEMPOTENCY_SWEEP_LIMIT` (100) other expired records are swept (`FOR UPDATE SKIP LOCKED`), so stored responses — application answers included — do not outlive the window. Replay semantics inside the window unchanged | `src/lib/idempotency/store.ts`, `IDEMPOTENCY_STORE_P0.md` (I7) |
| P2-3 fixtures (G19) | deterministic WF05 fixture set built through the canonical tables and services: owner, ACTIVE EDIT / VIEW members, non-owner, second owner; PROJECT, STARTUP, ARCHIVED ventures; PUBLISHED programmes with TEAM + STARTUP / TEAM-only / STARTUP-only forms, one without a form, a CLOSED one; DRAFT and SUBMITTED applications on the open and the closed programme; fixed identities, self-cleaning. Placed next to `src/lib/venture/testing.ts` so DB suites and Playwright share it | `src/lib/application/testing.ts` |
| test cleanup under 016 | suites that create SUBMITTED applications remove them through `deleteApplicationsForTest` (maintenance transaction) | `application.db-test.ts`, `wf05-s02-project-detail.spec.ts`, `wf05-uat-journey.spec.ts` |
| P2-4a seed (G20) | the seed's form upsert never rewrites a form that already has applications | `db/seed/seed_p0_deterministic.sql` |
| migration-chain tests | WF04 015 tests made independent of the newest file (015 checked by name and checksum; runner and ledger counts relative); 016 added to the schema list | `programme-persistence.db-test.ts`, `schema.db-test.ts` |
| new suites | `application-integrity.db-test.ts` (FRESH, UPGRADE, RECOVERY, negative, FIXTURE); 3 retention cases in `idempotency.db-test.ts`; local `scripts/qa/wf05-restart-check.mjs` | — |

## Bugs and classification
| Finding | Class | Action |
|---|---|---|
| an idempotency key reused after expiry replayed the stale stored outcome forever (no sweep ever ran) | PERSISTENCE_BUG | fixed (P2-2) |
| SUBMITTED application deletable; DRAFT identity mutable; snapshot unchecked | PERSISTENCE_BUG (frozen gap) | fixed (016) |
| none found in API semantics during this task | — | — |

## Deferred
- P2-4b: the seeded venture stays ACTIVE + PRIVATE. The DB allows it (only DRAFT must be PRIVATE) and twelve WF02 / WF04 / WF05 / release specs read that row; changing it would repaint protected screens for dev-only data. Recorded, not changed.
- PROD-03 (unchanged, handoff P3-1 … P3-10): malformed venture id → 500 (G06), `/me/applications` envelope (G07), PATCH checks (G09), form share lock at create (G10), closed-programme draft read (G11), 5xx logging (G12), transaction connections (G13), demo-module coupling (G28), WF05 API / security spec, contract docs.

## Related
- [WF05-PROD-02_evidence.md](WF05-PROD-02_evidence.md) · [WF05-PROD-01_implementation-handoff.md](WF05-PROD-01_implementation-handoff.md) · [WF05-PROD-01_db-contract.md](WF05-PROD-01_db-contract.md)
