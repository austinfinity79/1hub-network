import { trackEvent } from '@/lib/analytics/analytics'
import { ApiError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import type { Executor } from '@/lib/db/client'
import { query, withTransaction } from '@/lib/db/client'
import { acceptConsent, LEGAL_TYPES, type LegalType } from '@/lib/legal/legal'

import {
  AUTH_REQUEST_ID_PREFIX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RESET_EXPIRES_IN_SECONDS,
  PASSWORD_RESET_RESEND_AFTER_SECONDS,
} from './config'
import { isPlausibleEmail, normalizeEmail } from './email'
import {
  assertDecoyNotLocked,
  assertPasswordLoginNotLocked,
  clearFailedPasswordAttempts,
  recordDecoyFailure,
  recordFailedPasswordAttempt,
} from './lockout'
import { hashPassword, isValidPasswordFormat, verifyPassword } from './password'
import { completeSignIn, type SignInResponse } from './sign-in'
import { generateToken, hashToken, maskEmail } from './tokens'
import { isValidUsernameFormat, normalizeUsername } from './username'

/**
 * S1-UAT-01 — username/email + password accounts (Sprint1 UAT pack US-01.02,
 * US-01.03, US-01.04; Appendix B). The primary sign-in path from this task on;
 * magic link stays compatibility-only (magic-link.ts, DEC-S1A-D7).
 *
 * Every response is a DTO: never a hash, a token, a raw e-mail or a statement
 * of which part of a credential was wrong.
 */

const FULL_NAME_MAX = 200

type SignedIn = { response: SignInResponse; sessionToken: string }

const BLOCKED = () => new ApiError('AUTH_ACCOUNT_BLOCKED', 403, 'This account cannot sign in.')
const INVALID_CREDENTIALS = () =>
  new ApiError('AUTH_INVALID_CREDENTIALS', 401, 'Sai tên tài khoản hoặc mật khẩu.')

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * Same verify cost whether or not the account exists, so response time does
 * not tell an attacker which usernames/e-mails are registered (task section
 * 14: username / email enumeration). The hash is of a random value nobody knows.
 */
let decoyHash: Promise<string> | undefined
const decoy = () => (decoyHash ??= hashPassword(generateToken()))

// ---------------------------------------------------------------------------
// Registration (US-01.02)
// ---------------------------------------------------------------------------

export type RegisterBody = {
  full_name?: unknown
  email?: unknown
  username?: unknown
  password?: unknown
  password_confirm?: unknown
  /** Versions the form showed, e.g. { TERMS_ACCEPTANCE: 'v1.0', ... }; stale → 409. */
  legal_versions?: unknown
}

export async function registerWithPassword(
  body: RegisterBody,
  requestId: string,
): Promise<SignedIn> {
  const fullName = text(body.full_name).trim()
  const email = text(body.email)
  const username = text(body.username).trim()
  const password = text(body.password)
  const confirm = text(body.password_confirm)
  const versions = (
    typeof body.legal_versions === 'object' && body.legal_versions !== null
      ? body.legal_versions
      : {}
  ) as Record<string, unknown>

  const fields: Record<string, string> = {}
  if (!fullName) fields.full_name = 'required'
  else if (fullName.length > FULL_NAME_MAX) fields.full_name = 'too_long'
  if (!email.trim()) fields.email = 'required'
  else if (!isPlausibleEmail(email)) fields.email = 'invalid'
  if (!username) fields.username = 'required'
  else if (!isValidUsernameFormat(username)) fields.username = 'invalid'
  if (!password) fields.password = 'required'
  else if (!isValidPasswordFormat(password)) fields.password = 'weak'
  if (password !== confirm) fields.password_confirm = 'mismatch'
  if (!LEGAL_TYPES.every((type) => typeof versions[type] === 'string')) fields.legal = 'required'
  if (Object.keys(fields).length > 0) {
    throw new ApiError('AUTH_VALIDATION_FAILED', 422, 'Some fields are invalid.', fields)
  }

  const emailNormalized = normalizeEmail(email)
  const usernameNormalized = normalizeUsername(username)
  const passwordHash = await hashPassword(password)

  /** Which identity value is already in use; the e-mail is checked first. */
  const conflict = async (exec: Executor): Promise<'email' | 'username' | null> => {
    const [row] = await exec<{ email_owner: string | null; username: boolean }>(
      `SELECT (SELECT id::text FROM user_accounts WHERE email_normalized = $1) AS email_owner,
              EXISTS (SELECT 1 FROM user_accounts WHERE username_normalized = $2) AS username`,
      [emailNormalized, usernameNormalized],
    )
    if (row?.email_owner) {
      // The exact reason stays internal (DEC-S1A-D11): audited on the existing
      // account, never in the answer, which reads the same neutral refusal.
      await query(
        `INSERT INTO audit_events (actor_account_id, action, resource_type, resource_id, after_data, request_id)
         VALUES (NULL, 'AUTH_REGISTRATION_CONFLICT', 'user_account', $1, '{"reason":"email_in_use"}'::jsonb, $2)`,
        [row.email_owner, requestId],
      )
      return 'email'
    }
    return row?.username ? 'username' : null
  }
  const refuse = (kind: 'email' | 'username'): never => {
    if (kind === 'username') {
      throw new ApiError('AUTH_USERNAME_TAKEN', 409, 'Tên tài khoản đã có người dùng.')
    }
    // Neutral on purpose: never says the e-mail has an account (PO decision 3).
    throw new ApiError(
      'AUTH_REGISTRATION_REJECTED',
      409,
      'Không thể tạo tài khoản với thông tin này.',
    )
  }

  // Pre-check outside the transaction so the internal audit survives the refusal.
  const before = await conflict(query)
  if (before) refuse(before)

  let lost: 'email' | 'username' | null = null
  const accountId = await withTransaction(async (exec) => {
    // The UNIQUE indexes are the real guard: a double-click or a race
    // converges on one account (US-01.02).
    const [created] = await exec<{ id: string }>(
      `INSERT INTO user_accounts
         (email, email_normalized, status, username, username_normalized, password_hash, signup_full_name)
       VALUES ($1, $2, 'ACTIVE', $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING id::text`,
      [email.trim(), emailNormalized, username, usernameNormalized, passwordHash, fullName],
    )
    if (!created) {
      lost = 'email'
      return null
    }

    // Legal v1.0 through the ONE existing writer (task section 12): same
    // ConsentRecord types, same version check (409 LEGAL_DOCUMENT_VERSION_STALE),
    // same CONSENT_ACCEPTED audit. Onboarding stage 4 still checks both.
    for (const type of LEGAL_TYPES) {
      await acceptConsent(
        exec,
        created.id,
        { consent_type: type, policy_version: versions[type as LegalType] },
        requestId,
      )
    }

    await trackEvent(exec, {
      name: 'account_created',
      accountId: created.id,
      profileId: null,
      workflow: 'WF01',
      screenId: 'WF01-S01',
    })
    return created.id
  })
  if (!accountId) {
    // Lost a race to a concurrent sign-up: name the same reason a pre-check would.
    refuse((await conflict(query)) ?? lost ?? 'email')
  }

  const { response, sessionToken } = await completeSignIn(accountId!, true)
  return { response, sessionToken }
}

/** Suggests a free username close to `username` for the AUTH4 "gợi ý tên khác" line. */
export async function suggestUsername(username: string): Promise<string | null> {
  const base = normalizeUsername(username)
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 26)
  if (base.length < 1) return null
  for (let n = 1; n <= 20; n++) {
    const candidate = `${base}${n}`
    if (!isValidUsernameFormat(candidate)) continue
    const [row] = await query(`SELECT 1 FROM user_accounts WHERE username_normalized = $1`, [
      candidate,
    ])
    if (!row) return candidate
  }
  return null
}

// ---------------------------------------------------------------------------
// Password sign-in (US-01.03)
// ---------------------------------------------------------------------------

type AccountRow = { id: string; status: string; password_hash: string | null }

/** Username OR e-mail: an "@" means e-mail. Both case-insensitive (US-01.03). */
async function findByIdentifier(
  identifier: string,
  exec: Executor = query,
): Promise<AccountRow | null> {
  const value = identifier.trim()
  if (!value) return null
  const [row] = value.includes('@')
    ? await exec<AccountRow>(
        `SELECT id::text, status::text, password_hash FROM user_accounts WHERE email_normalized = $1`,
        [normalizeEmail(value)],
      )
    : await exec<AccountRow>(
        `SELECT id::text, status::text, password_hash FROM user_accounts WHERE username_normalized = $1`,
        [normalizeUsername(value)],
      )
  return row ?? null
}

export async function loginWithPassword(
  body: { identifier?: unknown; password?: unknown },
  requestId: string,
): Promise<SignedIn> {
  const identifier = text(body.identifier).slice(0, 320)
  const password = text(body.password)
  if (password.length > PASSWORD_MAX_LENGTH) throw INVALID_CREDENTIALS()
  if (!identifier.trim() || !password) {
    const fields: Record<string, string> = {}
    if (!identifier.trim()) fields.identifier = 'required'
    if (!password) fields.password = 'required'
    throw new ApiError('AUTH_VALIDATION_FAILED', 422, 'Some fields are invalid.', fields)
  }

  const account = await findByIdentifier(identifier)
  if (!account || !account.password_hash) {
    // Unknown identifier, or a Google-only account without a password: same
    // answer, same cost and the same lock as a wrong password on a real one.
    const key = identifier.includes('@')
      ? normalizeEmail(identifier)
      : normalizeUsername(identifier)
    assertDecoyNotLocked(key)
    await verifyPassword(password, await decoy())
    recordDecoyFailure(key)
    assertDecoyNotLocked(key)
    throw INVALID_CREDENTIALS()
  }

  // A running lock answers before the password is even checked, so a locked
  // account cannot be used as a guessing oracle (task section 6).
  await assertPasswordLoginNotLocked(account.id)

  if (!(await verifyPassword(password, account.password_hash))) {
    await withTransaction((exec) => recordFailedPasswordAttempt(exec, account.id, requestId))
    // The 5th wrong attempt answers with the lock itself, as US-01.03 shows it.
    await assertPasswordLoginNotLocked(account.id)
    throw INVALID_CREDENTIALS()
  }

  // ADMIN-PROD-05 (PD-7): BLOCKED / DEACTIVATED never sign in. Checked after
  // the password so the status is only revealed to the credential holder.
  if (account.status !== 'ACTIVE') throw BLOCKED()

  await clearFailedPasswordAttempts(query, account.id)
  const { response, sessionToken } = await completeSignIn(account.id, false)
  return { response, sessionToken }
}

// ---------------------------------------------------------------------------
// Forgot / reset password (US-01.04)
// ---------------------------------------------------------------------------

export type ResetRequestAccepted = {
  request_id: string
  email_masked: string
  resend_after_seconds: number
  expires_in_seconds: number
}

const RESET_PREFIX = `${AUTH_REQUEST_ID_PREFIX}reset_`

/**
 * The request id names the issued row when one exists, and is a random decoy
 * otherwise: the 202 body is identical in
 * shape and timing either way, so it never says whether the account exists.
 */
function decoyAccepted(): ResetRequestAccepted {
  return {
    request_id: `${RESET_PREFIX}${generateToken()}`,
    email_masked: '',
    resend_after_seconds: PASSWORD_RESET_RESEND_AFTER_SECONDS,
    expires_in_seconds: PASSWORD_RESET_EXPIRES_IN_SECONDS,
  }
}

export type IssuedReset = {
  response: ResetRequestAccepted
  /** Present only when an e-mail must be sent; never serialised. */
  delivery: { email: string; token: string } | null
}

/** Masks the typed identifier for display only when it is an e-mail; a username is not echoed. */
export function maskIdentifier(identifier: string): string {
  return identifier.includes('@') ? maskEmail(normalizeEmail(identifier)) : ''
}

/**
 * Issues a reset link for the account behind `identifier`, if any. Every
 * earlier unused link of that account is retired, so only the newest works
 * (US-01.04 "gửi lại → link cũ mất hiệu lực"). Google-only accounts may reset:
 * that is how they set a first password (US-01.05).
 */
export async function requestPasswordReset(
  identifier: string,
  requestIp: string | null,
  exec: Executor = query,
): Promise<IssuedReset> {
  const masked = maskIdentifier(identifier)
  const account = await findByIdentifier(identifier, exec)
  const rows = account
    ? await exec<{ email: string; status: string }>(
        `SELECT email_normalized AS email, status::text FROM user_accounts WHERE id = $1`,
        [account.id],
      )
    : []
  const target = rows[0]
  // Unknown or not ACTIVE: same screen, no e-mail (US-01.04 case 1).
  if (!account || !target || target.status !== 'ACTIVE') {
    return { response: { ...decoyAccepted(), email_masked: masked }, delivery: null }
  }
  // Sprint1 "gửi lại sau 45 giây" holds per account for a new request too, so
  // the forgot form cannot mail-bomb an inbox. Silent: the same screen, no new
  // e-mail, and the link already sent stays valid.
  const [recent] = await exec<{ n: number }>(
    `SELECT count(*)::int AS n FROM password_reset_requests
      WHERE account_id = $1 AND created_at > now() - make_interval(secs => $2)`,
    [account.id, PASSWORD_RESET_RESEND_AFTER_SECONDS],
  )
  if ((recent?.n ?? 0) > 0) {
    return { response: { ...decoyAccepted(), email_masked: masked }, delivery: null }
  }

  await exec(
    `UPDATE password_reset_requests SET consumed_at = now()
      WHERE account_id = $1 AND consumed_at IS NULL`,
    [account.id],
  )
  const token = generateToken()
  const [row] = await exec<{ id: string }>(
    `INSERT INTO password_reset_requests (account_id, token_hash, expires_at, request_ip)
     VALUES ($1, $2, now() + make_interval(secs => $3), $4)
     RETURNING id::text`,
    [account.id, hashToken(token), PASSWORD_RESET_EXPIRES_IN_SECONDS, requestIp],
  )
  return {
    response: {
      request_id: `${RESET_PREFIX}${row!.id}`,
      email_masked: masked,
      resend_after_seconds: PASSWORD_RESET_RESEND_AFTER_SECONDS,
      expires_in_seconds: PASSWORD_RESET_EXPIRES_IN_SECONDS,
    },
    delivery: { email: target.email, token },
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resend for an earlier request id. Server-enforced 45-second spacing
 * (AUTH_RATE_LIMITED before it). A decoy or unknown id answers like a real one
 * and sends nothing, so resend cannot be used to probe either.
 */
export async function resendPasswordReset(requestId: unknown): Promise<IssuedReset> {
  const raw =
    typeof requestId === 'string' && requestId.startsWith(RESET_PREFIX)
      ? requestId.slice(RESET_PREFIX.length)
      : ''
  if (!UUID.test(raw)) return { response: decoyAccepted(), delivery: null }

  const [row] = await query<{ account_id: string; age_seconds: number; email: string }>(
    `SELECT r.account_id::text, extract(epoch FROM now() - r.created_at)::float AS age_seconds,
            a.email_normalized AS email
       FROM password_reset_requests r JOIN user_accounts a ON a.id = r.account_id
      WHERE r.id = $1`,
    [raw],
  )
  if (!row) return { response: decoyAccepted(), delivery: null }
  if (row.age_seconds < PASSWORD_RESET_RESEND_AFTER_SECONDS) {
    throw new ApiError('AUTH_RATE_LIMITED', 429, 'Please wait before requesting another link.')
  }
  return withTransaction((exec) => requestPasswordReset(row.email, null, exec))
}

/** Retires an issued link whose e-mail could not be sent. */
export async function retirePasswordReset(requestIdValue: string): Promise<void> {
  const raw = requestIdValue.startsWith(RESET_PREFIX)
    ? requestIdValue.slice(RESET_PREFIX.length)
    : ''
  if (!UUID.test(raw)) return
  await query(
    `UPDATE password_reset_requests SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`,
    [raw],
  )
}

/**
 * Says whether a reset link can still be used, changing nothing (US-01.04:
 * an expired or used link reads "đã hết hạn" as soon as it is opened). Only a
 * holder of the token can ask, and the answer names no account.
 */
export async function checkPasswordReset(token: unknown): Promise<void> {
  const value = text(token)
  if (!value || value.length > 512) {
    throw new ApiError('AUTH_RESET_LINK_INVALID', 400, 'The reset link is not valid.')
  }
  const [row] = await query<{ usable: boolean }>(
    `SELECT (r.consumed_at IS NULL AND r.expires_at > now() AND a.status = 'ACTIVE') AS usable
       FROM password_reset_requests r JOIN user_accounts a ON a.id = r.account_id
      WHERE r.token_hash = $1`,
    [hashToken(value)],
  )
  if (!row) throw new ApiError('AUTH_RESET_LINK_INVALID', 400, 'The reset link is not valid.')
  if (!row.usable) throw new ApiError('AUTH_RESET_LINK_EXPIRED', 400, 'The reset link has expired.')
}

/**
 * Completes a reset: single use enforced in SQL (the UPDATE only claims an
 * unconsumed, unexpired row, in the same statement), then the new hash, the
 * lock cleared, and EVERY session of the account revoked (US-01.04 "đăng xuất
 * mọi phiên trên thiết bị khác"). No session is created here: the user signs in
 * again with the new password (US-01.04 step 5), so no pre-reset token can ever
 * become a post-reset session (no fixation).
 */
export async function completePasswordReset(
  body: { token?: unknown; password?: unknown; password_confirm?: unknown },
  requestId: string,
): Promise<void> {
  const token = text(body.token)
  const password = text(body.password)
  const confirm = text(body.password_confirm)
  if (!token || token.length > 512) {
    throw new ApiError('AUTH_RESET_LINK_INVALID', 400, 'The reset link is not valid.')
  }
  const fields: Record<string, string> = {}
  if (!password) fields.password = 'required'
  else if (!isValidPasswordFormat(password)) fields.password = 'weak'
  if (password !== confirm) fields.password_confirm = 'mismatch'
  if (Object.keys(fields).length > 0) {
    throw new ApiError('AUTH_VALIDATION_FAILED', 422, 'Some fields are invalid.', fields)
  }

  const passwordHash = await hashPassword(password)
  const tokenHash = hashToken(token)

  await withTransaction(async (exec) => {
    const [claimed] = await exec<{ account_id: string }>(
      `UPDATE password_reset_requests SET consumed_at = now()
        WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
        RETURNING account_id::text`,
      [tokenHash],
    )
    if (!claimed) {
      const [known] = await exec(`SELECT 1 FROM password_reset_requests WHERE token_hash = $1`, [
        tokenHash,
      ])
      // Expired, used and superseded all read "đã hết hạn" (US-01.04).
      throw known
        ? new ApiError('AUTH_RESET_LINK_EXPIRED', 400, 'The reset link has expired.')
        : new ApiError('AUTH_RESET_LINK_INVALID', 400, 'The reset link is not valid.')
    }
    const [account] = await exec<{ status: string }>(
      `UPDATE user_accounts SET password_hash = $2, updated_at = now() WHERE id = $1
       RETURNING status::text`,
      [claimed.account_id, passwordHash],
    )
    if (account?.status !== 'ACTIVE') throw BLOCKED()
    await clearFailedPasswordAttempts(exec, claimed.account_id)
    // Same transaction as the new hash: a password change can never commit
    // while an older session survives it.
    await exec(
      `UPDATE user_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL`,
      [claimed.account_id],
    )
    await writeAudit(exec, {
      actorAccountId: claimed.account_id,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      resourceType: 'user_account',
      resourceId: claimed.account_id,
      after: { sessions_revoked: true },
      requestId,
    })
  })
}
