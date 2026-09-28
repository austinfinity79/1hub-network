import { trackEvent } from '@/lib/analytics/analytics'
import { ApiError } from '@/lib/api/errors'
import type { Executor } from '@/lib/db/client'
import { query, withTransaction } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'
import { reconcileRoster } from '@/lib/roster/reconcile'

import {
  AUTH_REQUEST_ID_PREFIX,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  MAGIC_LINK_RESEND_AFTER_SECONDS,
} from './config'
import { createSession } from './sessions'
import { generateToken, hashToken, isPlausibleEmail, maskEmail, normalizeEmail } from './tokens'

/**
 * M0-T08 — magic-link lifecycle, 05:157-232.
 *
 * The frozen design has no password (05:181). One flow serves both first-time
 * creation and returning login, and the response must not disclose whether an
 * account already exists, so every well-formed request returns 202 regardless.
 *
 * The raw token is returned to the CALLER, never stored and never logged. Only
 * its sha256 hash reaches the database. In production the caller is the mail
 * dispatcher; in tests it is the test itself.
 */

export type MagicLinkRequestResult = {
  /** Contract response shape, 05:168-176. */
  response: {
    request_id: string
    email_masked: string
    resend_after_seconds: number
    expires_in_seconds: number
  }
  /** Never serialised to the client. */
  token: string
  /** The normalised address the link belongs to; never serialised. */
  email: string
}

export type ConsumeResult = {
  response: {
    result: 'SUCCESS'
    account_created: boolean
    onboarding: { completed: boolean; next_step: string | null }
  }
  sessionToken: string
  sessionExpiresAt: Date
}

function toRequestId(uuid: string): string {
  return `${AUTH_REQUEST_ID_PREFIX}${uuid}`
}

function fromRequestId(requestId: string): string | null {
  if (!requestId.startsWith(AUTH_REQUEST_ID_PREFIX)) return null
  const uuid = requestId.slice(AUTH_REQUEST_ID_PREFIX.length)
  return /^[0-9a-f-]{36}$/i.test(uuid) ? uuid : null
}

/**
 * Issues a magic link.
 *
 * Deliberately does NOT look up whether the account exists. Creation happens at
 * consume time, so this path cannot leak account existence through behaviour or
 * timing differences.
 *
 * `exec` defaults to a pooled query. M0-T10 passes a transaction-bound executor
 * so the insert below commits or rolls back together with its idempotency
 * claim; nothing else about the flow changes, and the M0-T08 security rules are
 * untouched.
 */
export async function requestMagicLink(
  email: string,
  requestIp: string | null,
  exec: Executor = query,
): Promise<MagicLinkRequestResult> {
  if (!isPlausibleEmail(email)) {
    throw new ApiError('AUTH_EMAIL_INVALID', 400, 'A valid email address is required.')
  }

  const normalized = normalizeEmail(email)
  const token = generateToken()
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRES_IN_SECONDS * 1000)

  const rows = await exec<{ id: string }>(
    `INSERT INTO auth_magic_link_requests (email_normalized, token_hash, expires_at, request_ip)
     VALUES ($1, $2, $3, $4)
     RETURNING id::text`,
    [normalized, hashToken(token), expiresAt, requestIp],
  )

  return {
    response: {
      request_id: toRequestId(rows[0]!.id),
      email_masked: maskEmail(normalized),
      resend_after_seconds: MAGIC_LINK_RESEND_AFTER_SECONDS,
      expires_in_seconds: MAGIC_LINK_EXPIRES_IN_SECONDS,
    },
    token,
    email: normalized,
  }
}

/**
 * Re-issues a link for an existing request, 05:187-197.
 *
 * Issues a fresh token and invalidates the previous one by consuming it, so a
 * resend cannot leave two usable links outstanding.
 */
export async function resendMagicLink(
  authRequestId: string,
  /** Runs after validation, before anything changes (the caller's rate limit). */
  beforeIssue?: (emailNormalized: string) => Promise<void>,
): Promise<MagicLinkRequestResult> {
  const uuid = fromRequestId(authRequestId)
  if (!uuid) {
    throw new ApiError('AUTH_LINK_INVALID', 400, 'Unknown authentication request.')
  }

  const existing = await query<{ email_normalized: string; consumed_at: Date | null }>(
    `SELECT email_normalized, consumed_at FROM auth_magic_link_requests WHERE id = $1`,
    [uuid],
  )

  const row = existing[0]
  if (!row) {
    throw new ApiError('AUTH_LINK_INVALID', 400, 'Unknown authentication request.')
  }
  if (row.consumed_at) {
    throw new ApiError('AUTH_LINK_ALREADY_USED', 409, 'This link has already been used.')
  }

  await beforeIssue?.(row.email_normalized)

  // Retire the superseded request so only the newest link works.
  await query(`UPDATE auth_magic_link_requests SET consumed_at = now() WHERE id = $1`, [uuid])

  return requestMagicLink(row.email_normalized, null)
}

/** Retires an issued link whose e-mail could not be sent, so no undelivered token stays usable. */
export async function retireMagicLinkRequest(authRequestId: string): Promise<void> {
  const uuid = fromRequestId(authRequestId)
  if (!uuid) return
  await query(
    `UPDATE auth_magic_link_requests SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
    [uuid],
  )
}

/**
 * Consumes a token and establishes a session, 05:199-228.
 *
 * Single use is enforced in SQL: the UPDATE only matches a row that is still
 * unconsumed and unexpired, and the row is marked consumed in the same
 * statement. Two concurrent attempts cannot both win, because only one can see
 * `consumed_at IS NULL`.
 */
export async function consumeMagicLink(token: unknown): Promise<ConsumeResult> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 512) {
    throw new ApiError('AUTH_LINK_INVALID', 400, 'The link is not valid.')
  }

  const tokenHash = hashToken(token)

  const claimed = await query<{ id: string; email_normalized: string }>(
    `UPDATE auth_magic_link_requests
     SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
     RETURNING id::text, email_normalized`,
    [tokenHash],
  )

  if (!claimed[0]) {
    // Nothing was claimed. Distinguish the three contract error codes by
    // inspecting the row, which is safe because the caller already proved
    // knowledge of the token by presenting its hash-matching value.
    const existing = await query<{ consumed_at: Date | null; expired: boolean }>(
      `SELECT consumed_at, (expires_at <= now()) AS expired
       FROM auth_magic_link_requests WHERE token_hash = $1`,
      [tokenHash],
    )

    const row = existing[0]
    if (!row) throw new ApiError('AUTH_LINK_INVALID', 400, 'The link is not valid.')
    if (row.consumed_at) {
      throw new ApiError('AUTH_LINK_ALREADY_USED', 409, 'This link has already been used.')
    }
    throw new ApiError('AUTH_LINK_EXPIRED', 400, 'This link has expired.')
  }

  const email = claimed[0].email_normalized

  // One flow serves creation and login (05:180). Creation happens here, not at
  // request time, so the request endpoint leaks nothing about existence.
  // ON CONFLICT makes concurrent first sign-ins for one address converge on a
  // single account instead of failing on the UNIQUE email. account_created
  // (API 05 §10) is written in the SAME transaction as the insert, so it exists
  // exactly when a new account committed: never for a returning user, a retry
  // or a rolled-back insert (GAP-ANALYTICS-REG).
  const resolved = await withTransaction(async (exec) => {
    const [created] = await exec<{ id: string }>(
      `INSERT INTO user_accounts (email, email_normalized, status)
       VALUES ($1, $1, 'ACTIVE')
       ON CONFLICT (email_normalized) DO NOTHING
       RETURNING id::text`,
      [email],
    )
    if (created) {
      await trackEvent(exec, {
        name: 'account_created',
        accountId: created.id,
        profileId: null,
        workflow: 'WF01',
        screenId: 'WF01-S03',
      })
      return { id: created.id, status: 'ACTIVE', created: true }
    }
    const [existing] = await exec<{ id: string; status: string }>(
      `SELECT id::text, status::text FROM user_accounts WHERE email_normalized = $1`,
      [email],
    )
    return { id: existing!.id, status: existing!.status, created: false }
  })

  if (resolved.status === 'BLOCKED') {
    throw new ApiError('AUTH_ACCOUNT_BLOCKED', 403, 'This account cannot sign in.')
  }
  const accountId = resolved.id
  const accountCreated = resolved.created

  // Known launch-roster emails get their confirmed relationships (Freeze D2).
  // Runs on every sign-in, so a roster imported after the account existed is
  // picked up too; it is idempotent. A failure must not block sign-in: the
  // next sign-in (or `pnpm roster:import`) retries. Nothing personal is logged.
  try {
    await reconcileRoster(accountId)
  } catch (error) {
    console.error('roster reconciliation failed', (error as { code?: string }).code ?? 'unknown')
  }

  // A fresh session token every time: this is the session-fixation defence.
  const { token: sessionToken, expiresAt } = await createSession(accountId)

  // The one onboarding resolver decides where a returning user resumes
  // (DEC-WF01-RESUME-D1): the first incomplete step, or null when done.
  const onboarding = await getOnboardingState(accountId)

  return {
    response: {
      result: 'SUCCESS',
      account_created: accountCreated,
      onboarding: { completed: onboarding.completed, next_step: onboarding.current_step },
    },
    sessionToken,
    sessionExpiresAt: expiresAt,
  }
}
