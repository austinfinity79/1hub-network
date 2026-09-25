# Claude Task Report

## 1. Task
- Task ID / name: M0-T10 — Durable Idempotency Store Foundation
- Scope requested: Audit for an existing durable store, add one if none exists, and prove the five required behaviours.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed.

## 2. Pre-flight
- Single writer: **PASS**, only this session held the worktree throughout.
- Starting HEAD: `32f895c`, re-checked before commit, unchanged. No concurrent mutation.
- M0-T08 auth and M0-T09 authorization regression before any change: **PASS**, 94 of 94.
- Migrations 001 and 002: **unchanged**, verified by empty diff before and after.

## 3. Storage audit
All 28 tables were inspected. **No existing table can host idempotency**, so migration 003 was created under the authorization this task grants.

| Candidate | Why it cannot serve |
|---|---|
| `audit_events` | Append-only record of what happened. A claim is a lock that must be read back and mutated; writing locks into the audit trail would make the trail lie |
| `analytics_events` | Append-only measurement, no uniqueness, no response storage |
| `user_sessions` | One row per authenticated session, but the magic-link request is unauthenticated, so no session row can exist yet |
| `auth_magic_link_requests` | Keyed by token hash, with no operation column and no response storage. Overloading it would bind a cross-cutting API concern to one auth flow |

This was already a known gap: `002_p0_schema_alignment.sql:22` lists "idempotency key store" among deferred missing structures, and the gap register carried it as P10.

## 4. What was implemented
| Component | Purpose |
|---|---|
| `003_p0_idempotency_store.sql` | One table, one enum. Additive; 001 and 002 untouched |
| `idempotency/store.ts` | `runIdempotent`, fingerprinting, retention purge |
| `db/client.ts` | `withTransaction` and an `Executor` type, so guarded work joins the claim's transaction |
| `auth/magic-link/route.ts` | The first real integration |

The design choice that carries the most weight: **the claim, the work and the completion share one transaction**. The common alternative commits a PROCESSING row first, which strands the key if the process dies and then needs a lease, a clock and a reclamation sweep to recover. Sharing the transaction removes that failure mode instead of managing it.

## 5. Required behaviours, all proven against live PostgreSQL
| # | Behaviour | Evidence |
|---|---|---|
| A | First request executes and stores its outcome | COMPLETED row with status, body and the configured expiry; read back on a different pooled connection |
| B | Duplicate replays, no second side effect | Work ran once; a repeated magic-link request left exactly one row in `auth_magic_link_requests` |
| C | Same key, different content | 409 `UNCONTRACTED_IDEMPOTENCY_CONFLICT`; the conflicting work never ran and the stored record was untouched |
| D | Concurrent duplicates | Eight simultaneous attempts, one execution. Six concurrent magic-link retries produced one link |
| E | Failure does not poison the key | A throw left zero rows and the retry succeeded. The guarded side effect rolled back with it |

Extra properties proven: cross-actor isolation, anonymous records not claimable by an authenticated actor, key scoped per operation, payload-order independence, retention purge, and the state-shape constraint.

## 6. Security results
| Property | How proven |
|---|---|
| Not a process-local mutex | A raw duplicate INSERT that never touches the application is rejected by PostgreSQL. Source scan confirms no in-process lock or map |
| Actor A result unreachable by actor B | Actor is in both the unique constraint and the lookup predicate. B ran its own work and received its own result |
| No raw secret stored | The issued magic-link token appears in no column, asserted by a full-table scan |
| No raw payload stored | Only a sha256 fingerprint. A marker string placed in the request appears nowhere in the table |
| M0-T08 rules unchanged | A drift guard now asserts no migration after 002 alters `user_sessions` or `auth_magic_link_requests` |
| Half-written record impossible | A CHECK constraint rejects a COMPLETED row with no stored outcome |

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS, 0 errors 0 warnings |
| Unit tests | PASS — 61 of 61 |
| DB integration | PASS — 118 of 118 (24 new) |
| Build | PASS |
| Playwright full regression | PASS — 93 of 93 (7 new) |
| Migrations 001 / 002 unchanged | PASS — empty diff |
| SOT untouched | PASS — `docs/product`, `docs/workflows`, `docs/design`, `docs/architecture`, `design-reference/final` all unchanged |

Two failures occurred, both **my own test bugs**, fixed rather than worked around. A sweep assertion counted PROCESSING rows that the same file had hand-planted to prove a database constraint; it is now scoped to store-written rows and additionally names the fixture, so it narrows rather than hides. A Playwright case tried to send a control character that the HTTP client refuses to transmit, so it could never have reached the code it claimed to test; it now proves the over-length rejection, and the control-character path stays proven in the unit suite.

Four further failures were the **drift guards working correctly**, detecting migration 003. The guard that recorded `idempotency_keys` as absent was inverted rather than deleted, so the flip is itself the evidence the gap closed.

## 8. Contract gaps
No CONTRACT GAP stop was required. The frozen error envelope represents the conflict without a new field.

05:48-63 requires the header and specifies nothing else. Seven policies were therefore chosen and recorded as PROVISIONAL in `IDEMPOTENCY_STORE_P0.md`, none presented as approved:

| Item | Provisional value |
|---|---|
| Retention window | 24 hours |
| Conflict error code | `UNCONTRACTED_IDEMPOTENCY_CONFLICT` |
| Conflict HTTP status | 409, which *is* contracted at 05:104 |
| Missing header | request still processed |

**The one most likely to need revisiting is the last.** Idempotency is available but not compelled, so a client that omits the header silently gets the old behaviour. Rejecting would have required inventing a public error code for a missing key, which the contract names nowhere, and that is the harder thing to undo.

## 9. Pre-UAT security decisions, unchanged
CSRF mechanism (none implemented), session TTL (30 days) and SameSite (`lax`) are untouched by this task. None was promoted to final.

## 10. Git
- Branch: `main`
- Commits: `4461532` store foundation, `dec333c` endpoint integration, plus this documentation commit
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `2390ce2`, deliberately behind local
- Working tree: clean after commit
- Secrets: none committed; no credentialed remote URL recorded

## 11. Recommended next task
**M0-T11 — manifest-driven pixel QA foundation.** It is the last M0 item and carries no open decision. The six other idempotent operation classes inherit the store when their endpoints are built; they need no further foundation work.

## Related

- [idempotency-store-p0.md](IDEMPOTENCY_STORE_P0.md) — the provisional decisions in full
- [db-schema-gaps-p0.md](DB_SCHEMA_GAPS_P0.md) — gap P10, now closed
- [p0-status.md](P0_STATUS.md) — overall P0 state
