import { query } from '@/lib/db/client'

import { SESSION_TTL_SECONDS } from './config'
import { generateToken, hashToken } from './tokens'

/**
 * M0-T08 — server-side session persistence.
 *
 * Uses user_sessions from migration 001 unchanged. The browser holds only an
 * opaque token; every authority decision reads this table. Nothing about roles
 * or scopes is stored in or read from the client (CLAUDE.md section 4).
 */

export type AuthenticatedSession = {
  sessionId: string
  accountId: string
  expiresAt: Date
}

/**
 * Mints a brand-new session. Callers must always create rather than reuse, which
 * is what prevents session fixation: a token that existed before authentication
 * can never become an authenticated one.
 */
export async function createSession(
  accountId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  await query(
    `INSERT INTO user_sessions (account_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [accountId, hashToken(token), expiresAt],
  )

  return { token, expiresAt }
}

/**
 * Resolves a token to a live session, or null.
 *
 * Expiry and revocation are filtered in SQL, so a revoked or stale row can never
 * authenticate even if the token is still held. Returns null for every failure
 * mode rather than distinguishing them, so the endpoint cannot be used to
 * enumerate which tokens once existed.
 */
export async function resolveSession(
  token: string | undefined,
): Promise<AuthenticatedSession | null> {
  if (!token) return null

  const rows = await query<{ id: string; account_id: string; expires_at: Date }>(
    `SELECT id::text, account_id::text, expires_at
     FROM user_sessions
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [hashToken(token)],
  )

  const row = rows[0]
  if (!row) return null

  return { sessionId: row.id, accountId: row.account_id, expiresAt: row.expires_at }
}

/** Idempotent: revoking an already-revoked or unknown token is a no-op. */
export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return

  await query(
    `UPDATE user_sessions SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  )
}

/** Used when a security-relevant change should end every session for an account. */
export async function revokeAllSessionsForAccount(accountId: string): Promise<void> {
  await query(
    `UPDATE user_sessions SET revoked_at = now()
     WHERE account_id = $1 AND revoked_at IS NULL`,
    [accountId],
  )
}
