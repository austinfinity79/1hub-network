import { notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { query, withTransaction, type Executor } from '@/lib/db/client'

/**
 * WF02-S07 — own sessions and the account-deletion request
 * (API 05 §5.5; DEC-WF02-H8, DEC-WF02-S07-G1..G6).
 *
 * Everything is scoped by the session's account id; no client identifier
 * selects the owner. Sessions come from `user_sessions` only; the DTO carries
 * the row id (never the token or its hash) and what is actually stored. The
 * deletion request is storage only: it never deletes, deactivates or logs out.
 */

export type SessionDTO = {
  id: string
  created_at: string
  expires_at: string
  current: boolean
}

/** Active sessions of the account, current first, then newest. */
export async function listOwnSessions(
  accountId: string,
  currentSessionId: string,
): Promise<SessionDTO[]> {
  const rows = await query<{ id: string; created_at: Date; expires_at: Date }>(
    `SELECT id::text, created_at, expires_at FROM user_sessions
      WHERE account_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY (id = $2::uuid) DESC, created_at DESC, id`,
    [accountId, currentSessionId],
  )
  return rows.map((r) => ({
    id: r.id,
    created_at: r.created_at.toISOString(),
    expires_at: r.expires_at.toISOString(),
    current: r.id === currentSessionId,
  }))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * DELETE /me/sessions/{id} (G6). A foreign, unknown or malformed id is the
 * same 404; an own session that is already revoked or expired is a no-op
 * success. Returns whether the revoked session is the caller's current one.
 */
export async function revokeOwnSession(
  accountId: string,
  sessionId: string,
  currentSessionId: string,
): Promise<{ current: boolean }> {
  if (!UUID.test(sessionId)) throw notFound()
  const [own] = await query<{ id: string }>(
    'SELECT id::text FROM user_sessions WHERE id = $1::uuid AND account_id = $2',
    [sessionId, accountId],
  )
  if (!own) throw notFound()
  await query(
    `UPDATE user_sessions SET revoked_at = now()
      WHERE id = $1::uuid AND account_id = $2 AND revoked_at IS NULL`,
    [sessionId, accountId],
  )
  return { current: own.id === currentSessionId }
}

/** DELETE /me/sessions (G5): every valid session of the account, in one statement. */
export async function revokeAllOwnSessions(accountId: string): Promise<number> {
  const rows = await query<{ id: string }>(
    `UPDATE user_sessions SET revoked_at = now()
      WHERE account_id = $1 AND revoked_at IS NULL
      RETURNING id::text`,
    [accountId],
  )
  return rows.length
}

export type DeletionRequestDTO = { id: string; requested_at: string }

type RequestRow = { id: string; requested_at: Date }
const toDTO = (r: RequestRow): DeletionRequestDTO => ({
  id: r.id,
  requested_at: r.requested_at.toISOString(),
})

export async function getDeletionRequest(
  accountId: string,
  exec: Executor = query,
): Promise<DeletionRequestDTO | null> {
  const [row] = await exec<RequestRow>(
    'SELECT id::text, requested_at FROM account_deletion_requests WHERE account_id = $1',
    [accountId],
  )
  return row ? toDTO(row) : null
}

/**
 * POST /me/account-deletion-request (G1/G2/G4). First request → 201 and one
 * ACCOUNT_DELETION_REQUESTED audit in the same transaction; any later or
 * concurrent request → 200 with the same row and no audit.
 */
export async function requestAccountDeletion(
  accountId: string,
  requestId: string,
): Promise<{ status: 200 | 201; body: DeletionRequestDTO }> {
  return withTransaction(async (exec) => {
    const [created] = await exec<RequestRow>(
      `INSERT INTO account_deletion_requests (account_id) VALUES ($1)
       ON CONFLICT (account_id) DO NOTHING
       RETURNING id::text, requested_at`,
      [accountId],
    )
    if (created) {
      await writeAudit(exec, {
        actorAccountId: accountId,
        action: 'ACCOUNT_DELETION_REQUESTED',
        resourceType: 'account_deletion_request',
        resourceId: created.id,
        after: { requested: true },
        requestId,
      })
      return { status: 201 as const, body: toDTO(created) }
    }
    const existing = await getDeletionRequest(accountId, exec)
    return { status: 200 as const, body: existing! }
  })
}
