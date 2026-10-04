import { ApiError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import type { Executor } from '@/lib/db/client'
import { query } from '@/lib/db/client'

import { PASSWORD_FAILED_ATTEMPTS_LIMIT, PASSWORD_LOCKOUT_SECONDS } from './config'

/**
 * S1-UAT-01 — server-enforced password-login lockout (task section 6; Sprint1
 * UAT pack US-01.03 "Sai 5 lần liên tiếp").
 *
 * Lives on `user_accounts` (failed_password_attempts, password_locked_until):
 * account-level sign-in state, read and written only by the password-login
 * path. It is NOT a client timer: every check re-reads these two columns from
 * PostgreSQL, so a second tab, a new device or a restarted browser all see the
 * same lock. It is NOT account status (BLOCKED/DEACTIVATED, ADMIN-PROD-05):
 * only PASSWORD sign-in is suspended — Google and the forgot-password flow
 * stay reachable while locked (US-01.03, US-01.04), exactly as the account
 * status check in magic-link.ts/google.ts is untouched by this module.
 */

function lockoutAudit(
  exec: Executor,
  accountId: string,
  requestId: string,
  lockedUntil: Date,
): Promise<void> {
  return writeAudit(exec, {
    actorAccountId: accountId,
    action: 'AUTH_PASSWORD_LOGIN_LOCKED',
    resourceType: 'user_account',
    resourceId: accountId,
    after: { locked_until: lockedUntil.toISOString() },
    requestId,
  })
}

/** Throws AUTH_PASSWORD_LOGIN_LOCKED while a previously-triggered lock has not yet expired. */
export async function assertPasswordLoginNotLocked(accountId: string): Promise<void> {
  const [row] = await query<{ password_locked_until: Date | null }>(
    `SELECT password_locked_until FROM user_accounts WHERE id = $1`,
    [accountId],
  )
  if (row?.password_locked_until && row.password_locked_until > new Date()) {
    throw new ApiError(
      'AUTH_PASSWORD_LOGIN_LOCKED',
      429,
      'Bạn đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau.',
      { locked_until: row.password_locked_until.toISOString() },
    )
  }
}

/**
 * Counts one wrong password. On the Nth attempt (PASSWORD_FAILED_ATTEMPTS_LIMIT)
 * it starts the 15-minute lock and writes the audit event (task section 6:
 * "auditable/security event"). Runs in the caller's transaction so the count
 * and the lock start together with nothing else about the failed attempt.
 */
export async function recordFailedPasswordAttempt(
  exec: Executor,
  accountId: string,
  requestId: string,
): Promise<void> {
  const [row] = await exec<{ failed_password_attempts: number }>(
    `UPDATE user_accounts
        SET failed_password_attempts = failed_password_attempts + 1
      WHERE id = $1
      RETURNING failed_password_attempts`,
    [accountId],
  )
  const attempts = row?.failed_password_attempts ?? 0
  if (attempts >= PASSWORD_FAILED_ATTEMPTS_LIMIT) {
    const lockedUntil = new Date(Date.now() + PASSWORD_LOCKOUT_SECONDS * 1000)
    await exec(`UPDATE user_accounts SET password_locked_until = $2 WHERE id = $1`, [
      accountId,
      lockedUntil,
    ])
    await lockoutAudit(exec, accountId, requestId, lockedUntil)
  }
}

/**
 * Clears the counter and any active lock. Called after a successful password
 * sign-in (task section 6: "successful login clears relevant failed-attempt
 * state") and after a successful password reset, which is itself strong proof
 * of ownership (an e-mailed, single-use token) and should not leave the account
 * locked out of the password it just set.
 */
export async function clearFailedPasswordAttempts(
  exec: Executor,
  accountId: string,
): Promise<void> {
  await exec(
    `UPDATE user_accounts
        SET failed_password_attempts = 0, password_locked_until = NULL
      WHERE id = $1 AND (failed_password_attempts != 0 OR password_locked_until IS NOT NULL)`,
    [accountId],
  )
}

/**
 * The same lockout for identifiers with NO password account (unknown, or a
 * Google-only account): five wrong attempts answer the lock for 15 minutes,
 * exactly as a real account would. Otherwise "5 tries → locked?" would tell an
 * attacker which identifiers exist (task section 14). Process memory, keyed by
 * the normalised identifier; like the per-IP limits it is per container.
 */
declare global {
  var __hubDecoyLockout: Map<string, { failures: number; lockedUntil: number }> | undefined
}

const decoys = () => (globalThis.__hubDecoyLockout ??= new Map())

export function assertDecoyNotLocked(key: string, now = Date.now()): void {
  const entry = decoys().get(key)
  if (entry && entry.lockedUntil > now) {
    throw new ApiError(
      'AUTH_PASSWORD_LOGIN_LOCKED',
      429,
      'Bạn đã nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau.',
      { locked_until: new Date(entry.lockedUntil).toISOString() },
    )
  }
  if (entry && entry.lockedUntil !== 0 && entry.lockedUntil <= now) decoys().delete(key)
}

export function recordDecoyFailure(key: string, now = Date.now()): void {
  const entry = decoys().get(key) ?? { failures: 0, lockedUntil: 0 }
  entry.failures += 1
  if (entry.failures >= PASSWORD_FAILED_ATTEMPTS_LIMIT) {
    entry.lockedUntil = now + PASSWORD_LOCKOUT_SECONDS * 1000
    entry.failures = 0
  }
  decoys().set(key, entry)
  // Bounded: an attacker cycling identifiers cannot grow this without limit.
  if (decoys().size > 50_000) decoys().delete(decoys().keys().next().value!)
}
