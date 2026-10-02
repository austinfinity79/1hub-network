import { createHash } from 'node:crypto'

import { ApiError } from '@/lib/api/errors'
import type { IdempotentOperation } from '@/lib/api/idempotency'
import type { Executor } from '@/lib/db/client'
import { query, withTransaction } from '@/lib/db/client'

/**
 * M0-T10 — durable idempotency store.
 *
 * WHAT THE FROZEN CONTRACT SPECIFIES: that the client sends an
 * `Idempotency-Key` header on seven operation classes (05:48-63). That is all.
 * It defines no storage, no retention, no replay rule and no conflict code.
 * Every policy in this module is therefore PROVISIONAL TECHNICAL CONFIGURATION,
 * documented in docs/implementation/IDEMPOTENCY_STORE_P0.md. Nothing here is
 * presented as an approved contract value.
 *
 * WHY THE CLAIM AND THE WORK SHARE ONE TRANSACTION:
 *
 * The obvious design writes a PROCESSING row, commits, does the work, then
 * writes COMPLETED. It has a failure mode: if the process dies between the two
 * commits the key is claimed forever, and recovering needs a lease, a clock and
 * a reclamation sweep — three things that can themselves be wrong.
 *
 * Putting the claim, the work and the completion in one transaction removes the
 * failure mode instead of managing it. A crash or a thrown error rolls back the
 * claim along with the work, so the key is immediately free and the caller may
 * simply retry. This is behaviour E, and it is a property of the transaction
 * rather than of any code that has to run afterwards.
 *
 * WHY IT IS NOT A PROCESS-LOCAL MUTEX:
 *
 * Mutual exclusion comes from the unique index `idempotency_keys_scope_uniq`.
 * When two requests race, the second `INSERT ... ON CONFLICT DO NOTHING` blocks
 * on the first transaction's uncommitted row and resolves only once that
 * transaction ends. PostgreSQL arbitrates, so the guarantee holds across
 * processes, across workers and across machines.
 */

/** PROVISIONAL. The contract states no retention window. */
export const IDEMPOTENCY_RETENTION_SECONDS = 24 * 60 * 60

/** Expired records swept per guarded request (WF05-PROD-02); bounded so a write never pays for a backlog. */
export const IDEMPOTENCY_SWEEP_LIMIT = 100

export type IdempotentResult<T> = {
  status: number
  body: T
}

export type IdempotentOutcome<T> = IdempotentResult<T> & {
  /** True when the outcome came from storage rather than from fresh work. */
  replayed: boolean
}

type StoredRow = {
  id: string
  state: 'PROCESSING' | 'COMPLETED'
  request_fingerprint: string
  response_status: number | null
  response_body: unknown
}

/**
 * Canonicalises request input into a stable sha256.
 *
 * Object keys are sorted so that two semantically identical bodies that differ
 * only in key order produce the same fingerprint, and a genuinely different
 * payload produces a different one. The input is hashed, never stored, so the
 * store never becomes a second copy of personal data.
 */
export function fingerprintRequest(input: unknown): string {
  return createHash('sha256').update(canonicalise(input)).digest('hex')
}

function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`)

  return `{${entries.join(',')}}`
}

export type RunIdempotentOptions<T> = {
  /** The opaque client key, already validated by `readIdempotencyKey`. */
  key: string
  operation: IdempotentOperation
  /** The authenticated actor, or null for an unauthenticated operation. */
  actorAccountId: string | null
  /** Hash of the request input, from `fingerprintRequest`. */
  fingerprint: string
  /** The guarded work. Must use the supplied executor so it shares the claim's transaction. */
  run: (exec: Executor) => Promise<IdempotentResult<T>>
}

/**
 * Executes `run` at most once per (key, operation, actor).
 *
 * A repeat of the same request replays the stored outcome without re-running
 * the work. A repeat with different content is rejected, because silently
 * returning the first response for a second, different request would be a
 * correctness bug disguised as a feature.
 */
export async function runIdempotent<T>(
  options: RunIdempotentOptions<T>,
): Promise<IdempotentOutcome<T>> {
  const { key, operation, actorAccountId, fingerprint, run } = options

  return withTransaction(async (exec) => {
    // Retention (WF05-PROD-02). An expired record of this exact scope goes first,
    // so a key reused after its window is a new request, never a stale replay.
    // Then a bounded sweep removes other expired records: a stored response may
    // hold personal data (application answers) that must not outlive the window.
    await exec(
      `DELETE FROM idempotency_keys
        WHERE idempotency_key = $1
          AND operation = $2
          AND actor_account_id IS NOT DISTINCT FROM $3
          AND expires_at <= now()`,
      [key, operation, actorAccountId],
    )
    await purgeExpiredIdempotencyKeys(exec, IDEMPOTENCY_SWEEP_LIMIT)

    // The atomic claim. DO NOTHING rather than DO UPDATE: a losing request must
    // not be able to overwrite the winner's record.
    const claimed = await exec<{ id: string }>(
      `INSERT INTO idempotency_keys
         (idempotency_key, operation, actor_account_id, request_fingerprint, state, expires_at)
       VALUES ($1, $2, $3, $4, 'PROCESSING', now() + make_interval(secs => $5))
       ON CONFLICT ON CONSTRAINT idempotency_keys_scope_uniq DO NOTHING
       RETURNING id::text`,
      [key, operation, actorAccountId, fingerprint, IDEMPOTENCY_RETENTION_SECONDS],
    )

    const claim = claimed[0]

    if (!claim) {
      return replayExisting<T>(exec, key, operation, actorAccountId, fingerprint)
    }

    const result = await run(exec)

    await exec(
      `UPDATE idempotency_keys
          SET state = 'COMPLETED',
              response_status = $2,
              response_body = $3::jsonb,
              completed_at = now()
        WHERE id = $1`,
      [claim.id, result.status, JSON.stringify(result.body)],
    )

    return { ...result, replayed: false }
  })
}

async function replayExisting<T>(
  exec: Executor,
  key: string,
  operation: IdempotentOperation,
  actorAccountId: string | null,
  fingerprint: string,
): Promise<IdempotentOutcome<T>> {
  // IS NOT DISTINCT FROM, not `=`: a NULL actor must match the NULL actor row,
  // which plain equality would never do. This mirrors NULLS NOT DISTINCT on the
  // unique constraint, so the lookup and the claim agree on what a duplicate is.
  const existing = await exec<StoredRow>(
    `SELECT id::text, state::text AS state, request_fingerprint, response_status, response_body
       FROM idempotency_keys
      WHERE idempotency_key = $1
        AND operation = $2
        AND actor_account_id IS NOT DISTINCT FROM $3`,
    [key, operation, actorAccountId],
  )

  const row = existing[0]

  if (!row) {
    // The conflicting row was removed between the claim and this read, which
    // only a concurrent retention sweep can cause. Refusing is correct: the
    // request may safely be retried, and guessing an outcome would not be.
    throw new ApiError(
      'UNCONTRACTED_IDEMPOTENCY_CONFLICT',
      409,
      'This request could not be completed. Retry with the same Idempotency-Key.',
    )
  }

  if (row.request_fingerprint !== fingerprint) {
    throw new ApiError(
      'UNCONTRACTED_IDEMPOTENCY_CONFLICT',
      409,
      'This Idempotency-Key was already used for a different request.',
    )
  }

  if (row.state !== 'COMPLETED' || row.response_status === null) {
    // Reachable only if a prior attempt is still in flight in another
    // transaction. Returning "in progress" is honest; inventing a result is not.
    throw new ApiError(
      'UNCONTRACTED_IDEMPOTENCY_CONFLICT',
      409,
      'A request with this Idempotency-Key is still being processed.',
    )
  }

  return {
    status: row.response_status,
    body: row.response_body as T,
    replayed: true,
  }
}

/**
 * Deletes expired records, all of them or the oldest `limit` (rows another
 * transaction holds are skipped, never waited for).
 *
 * `runIdempotent` calls it with a limit before every claim, so expired records
 * and the responses they store do not outlive the retention window. Returns
 * the count so a caller or a test can assert on it.
 */
export async function purgeExpiredIdempotencyKeys(
  exec: Executor = query,
  limit?: number,
): Promise<number> {
  const rows =
    limit === undefined
      ? await exec<{ id: string }>(
          `DELETE FROM idempotency_keys WHERE expires_at <= now() RETURNING id::text`,
        )
      : await exec<{ id: string }>(
          `DELETE FROM idempotency_keys
            WHERE id IN (SELECT id FROM idempotency_keys
                          WHERE expires_at <= now()
                          ORDER BY expires_at
                          LIMIT $1
                          FOR UPDATE SKIP LOCKED)
            RETURNING id::text`,
          [limit],
        )
  return rows.length
}
