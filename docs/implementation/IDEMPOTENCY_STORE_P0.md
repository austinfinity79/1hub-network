# Idempotency Store P0

Durable idempotency for the seven operation classes at `05_API_CONTRACT_P0_v1.0.md:56-63`. Built by M0-T10 on migration `003_p0_idempotency_store.sql`.

## What the frozen contract specifies

Exactly one thing: that the client sends an `Idempotency-Key` header on those seven operations (05:48-63). It defines no storage, no retention window, no replay rule, no conflict code and no behaviour when the header is missing.

Everything in the next section is therefore **PROVISIONAL TECHNICAL CONFIGURATION**, chosen as the smallest safe implementation. None of it is an approved contract value, and none of it should harden into one without a contract amendment.

## Provisional decisions

| # | Decision | Value | Why this rather than something else |
|---|---|---|---|
| I1 | Retention window | 24 hours | The contract states none. Long enough to cover any realistic client retry, short enough that the table does not grow without bound |
| I2 | Uniqueness scope | `(key, operation, actor)` | Scoping by operation stops a key spent on one operation suppressing another; scoping by actor is what makes cross-actor replay impossible |
| I3 | Conflict error code | `UNCONTRACTED_IDEMPOTENCY_CONFLICT` | The contract names no code. The `UNCONTRACTED_` prefix follows the M0-T05 precedent so it is obvious on the wire and cannot be mistaken for a frozen code |
| I4 | Conflict HTTP status | 409 | Contracted, even though the code is not: 05:104 maps 409 to "lifecycle/state conflict / duplicate relation" |
| I5 | Missing header | request is still processed | Rejecting would require an error code for a missing key, and none exists. Being lenient is the smaller and more reversible choice than minting a public error code |
| I6 | Request identity | sha256 of the canonicalised input | A hash is sufficient to detect a key reused with different content, and avoids the store becoming a second copy of personal data |
| I7 | Expired but unswept record | still replays | Fails in the conservative direction. Retention is a sweep concern, not a correctness one |

I5 is the one most likely to need revisiting. It means idempotency is available but not compelled, so a client that omits the header gets the old behaviour silently.

## How the guarantees are produced

The claim, the guarded work and the completion share **one transaction**.

| Guarantee | Mechanism |
|---|---|
| Runs at most once | `INSERT … ON CONFLICT DO NOTHING` against `idempotency_keys_scope_uniq` |
| Concurrent duplicates | PostgreSQL blocks the second insert on the first transaction's uncommitted row, so arbitration is in the database, not the process |
| Failure does not poison the key | The claim rolls back with the work, so the key is immediately free. No lease, no reclamation timer, no `FAILED` state |
| Side effect is atomic with the claim | The guarded work runs on the transaction's executor, so a completed claim and its effect cannot disagree |
| Cross-actor isolation | Actor is part of both the unique constraint and the lookup predicate |

`UNIQUE NULLS NOT DISTINCT` is load-bearing. Under the PostgreSQL default, every unauthenticated request carries a `NULL` actor, every `NULL` counts as distinct, and the constraint would never fire on the magic-link request, which is the one unauthenticated operation the contract requires a key for.

## What is deliberately not stored

No raw secret and no raw payload. The stored response body is only what already went on the wire, and the magic-link response carries no token by construction. Tests assert the issued token appears in no column of the table, and that a marker string placed in the request appears nowhere either.

## Wired in

`POST /api/v1/auth/magic-link` only. The other six operation classes have no endpoint yet; they inherit the store when they are built, by calling `runIdempotent` the same way.

## Related

- [db-schema-gaps-p0.md](DB_SCHEMA_GAPS_P0.md) — gap P10, closed by this work
- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [p0-status.md](P0_STATUS.md) — overall P0 state
