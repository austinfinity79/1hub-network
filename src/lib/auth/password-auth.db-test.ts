import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { closePool, query } from '@/lib/db/client'
import { getCurrentDocuments } from '@/lib/legal/legal'

import {
  checkPasswordReset,
  completePasswordReset,
  loginWithPassword,
  registerWithPassword,
  requestPasswordReset,
  resendPasswordReset,
} from './credentials'
import { resolveGoogleAccount, signInWithGoogle, type GoogleProfile } from './google'
import { createSession, resolveSession } from './sessions'
import { hashToken } from './tokens'

/**
 * S1-UAT-01 — the Sprint1 auth matrix (task sections 20 and 21) against live
 * PostgreSQL, migration 018 included. Nothing is mocked except Google's HTTPS
 * endpoints, which resolveGoogleAccount / signInWithGoogle never call.
 */

const RID = 'req_s1_uat_01_test'
const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const mail = (tag: string) => `s1-${tag}-${stamp}@example.test`
const uname = (tag: string) => `s1.${tag}.${stamp}`.slice(0, 30)
const created: string[] = []
let legal: Record<string, string>

beforeAll(async () => {
  legal = Object.fromEntries((await getCurrentDocuments()).map((d) => [d.type, d.version]))
  expect(Object.keys(legal)).toHaveLength(2)
})

afterAll(async () => {
  const ids = `SELECT id FROM user_accounts WHERE email_normalized LIKE $1`
  const like = [`s1-%-${stamp}@example.test`]
  // Audit, analytics and consent rows reference the account without cascade.
  await query(`DELETE FROM audit_events WHERE actor_account_id IN (${ids})`, like)
  await query(`DELETE FROM analytics_events WHERE account_id IN (${ids})`, like)
  await query(`DELETE FROM consent_records WHERE account_id IN (${ids})`, like)
  await query(`DELETE FROM user_accounts WHERE email_normalized LIKE $1`, like)
  await closePool()
})

async function register(tag: string, overrides: Record<string, unknown> = {}) {
  const email = mail(tag)
  created.push(email)
  const result = await registerWithPassword(
    {
      full_name: 'Nguyễn Văn Chi',
      email,
      username: uname(tag),
      password: 'abcd1234',
      password_confirm: 'abcd1234',
      legal_versions: legal,
      ...overrides,
    },
    RID,
  )
  return { email, username: uname(tag), ...result }
}

const account = async (email: string) =>
  (
    await query<{
      id: string
      password_hash: string | null
      username: string | null
      failed_password_attempts: number
      password_locked_until: Date | null
      signup_full_name: string | null
    }>(
      `SELECT id::text, password_hash, username, failed_password_attempts, password_locked_until,
              signup_full_name FROM user_accounts WHERE email_normalized = $1`,
      [email.toLowerCase()],
    )
  )[0]

const liveSessions = async (accountId: string) =>
  (
    await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM user_sessions
        WHERE account_id = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [accountId],
    )
  )[0]!.n

describe('create account (US-01.02)', () => {
  it('creates one account with a hashed password, Legal v1.0 consents and a fresh session', async () => {
    const { email, response, sessionToken } = await register('reg')
    expect(response).toEqual({
      result: 'SUCCESS',
      account_created: true,
      onboarding: { completed: false, next_step: 'INTRO' },
    })
    const row = (await account(email))!
    expect(row.password_hash).toMatch(/^scrypt:/)
    expect(row.password_hash).not.toContain('abcd1234')
    expect(row.signup_full_name).toBe('Nguyễn Văn Chi')
    expect((await resolveSession(sessionToken))?.accountId).toBe(row.id)

    const consents = await query<{ type: string; version: string }>(
      `SELECT c.consent_type::text AS type, d.version FROM consent_records c
         JOIN legal_documents d ON d.id = c.legal_document_id WHERE c.account_id = $1 ORDER BY 1`,
      [row.id],
    )
    expect(consents).toEqual([
      { type: 'PRIVACY_DATA_PROCESSING', version: legal.PRIVACY_DATA_PROCESSING },
      { type: 'TERMS_ACCEPTANCE', version: legal.TERMS_ACCEPTANCE },
    ])
    const events = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE actor_account_id = $1 ORDER BY action`,
      [row.id],
    )
    expect(events.map((e) => e.action)).toEqual(['CONSENT_ACCEPTED', 'CONSENT_ACCEPTED'])
    // No profile yet: onboarding must still open on the ACC-05 intro.
    const profiles = await query(`SELECT 1 FROM individual_profiles WHERE account_id = $1`, [
      row.id,
    ])
    expect(profiles).toHaveLength(0)
  })

  it('treats Chi@Mail and chi@mail as one e-mail, and usernames case-insensitively', async () => {
    const { email, username } = await register('dup')
    await expect(
      registerWithPassword(
        {
          full_name: 'X',
          email: email.toUpperCase(),
          username: uname('dupother'),
          password: 'abcd1234',
          password_confirm: 'abcd1234',
          legal_versions: legal,
        },
        RID,
      ),
    ).rejects.toMatchObject({
      code: 'AUTH_REGISTRATION_REJECTED',
      status: 409,
      message: 'Không thể tạo tài khoản với thông tin này.',
    })
    // The answer is neutral; the exact reason is kept internally only.
    const owner = (await account(email))!.id
    const audit = await query<{ after_data: unknown; actor: string | null }>(
      `SELECT after_data, actor_account_id::text AS actor FROM audit_events
        WHERE resource_id = $1 AND action = 'AUTH_REGISTRATION_CONFLICT'`,
      [owner],
    )
    expect(audit).toEqual([{ after_data: { reason: 'email_in_use' }, actor: null }])
    await expect(
      registerWithPassword(
        {
          full_name: 'X',
          email: mail('dupname'),
          username: username.toUpperCase(),
          password: 'abcd1234',
          password_confirm: 'abcd1234',
          legal_versions: legal,
        },
        RID,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_USERNAME_TAKEN', status: 409 })
  })

  it('a double-click (two concurrent submits) creates exactly one account', async () => {
    const email = mail('race')
    created.push(email)
    const body = {
      full_name: 'Race',
      email,
      username: uname('race'),
      password: 'abcd1234',
      password_confirm: 'abcd1234',
      legal_versions: legal,
    }
    const results = await Promise.allSettled([
      registerWithPassword(body, RID),
      registerWithPassword(body, RID),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM user_accounts WHERE email_normalized = $1`,
      [email],
    )
    expect(n!.n).toBe(1)
  })

  it.each([
    [{ username: 'chí.nguyễn' }, 'username', 'invalid'],
    [{ username: 'ab' }, 'username', 'invalid'],
    [{ password: 'abcdefgh', password_confirm: 'abcdefgh' }, 'password', 'weak'],
    [{ password: 'abc123', password_confirm: 'abc123' }, 'password', 'weak'],
    [{ password_confirm: 'abcd12345' }, 'password_confirm', 'mismatch'],
    [{ email: 'not-an-email' }, 'email', 'invalid'],
    [{ legal_versions: {} }, 'legal', 'required'],
    [{ full_name: '  ' }, 'full_name', 'required'],
  ])('refuses %j (422 %s)', async (override, field, reason) => {
    await expect(
      register(`bad${Math.random().toString(36).slice(2, 6)}`, override),
    ).rejects.toMatchObject({
      code: 'AUTH_VALIDATION_FAILED',
      status: 422,
      fields: expect.objectContaining({ [field]: reason }),
    })
  })

  it('refuses a stale legal version through the existing consent writer, creating nothing', async () => {
    const email = mail('stale')
    await expect(
      register('stale', {
        legal_versions: { TERMS_ACCEPTANCE: 'v0.9', PRIVACY_DATA_PROCESSING: 'v0.9' },
      }),
    ).rejects.toMatchObject({ code: 'LEGAL_DOCUMENT_VERSION_STALE', status: 409 })
    expect(await account(email)).toBeUndefined()
  })
})

describe('password sign-in (US-01.03) and lockout (task section 6)', () => {
  it('signs in by e-mail and by username, case-insensitively, with a new token each time', async () => {
    const { email, username, sessionToken: first } = await register('login')
    const byEmail = await loginWithPassword(
      { identifier: email.toUpperCase(), password: 'abcd1234' },
      RID,
    )
    const byName = await loginWithPassword(
      { identifier: ` ${username.toUpperCase()} `, password: 'abcd1234' },
      RID,
    )
    expect(byEmail.response.account_created).toBe(false)
    // Session fixation: every sign-in mints a token never seen before.
    expect(new Set([first, byEmail.sessionToken, byName.sessionToken]).size).toBe(3)
    expect(await resolveSession(byName.sessionToken)).not.toBeNull()
  })

  it('wrong password and unknown account give the same answer; the password is case-sensitive', async () => {
    const { email } = await register('wrong')
    const wrong = loginWithPassword({ identifier: email, password: 'ABCD1234' }, RID)
    const unknown = loginWithPassword({ identifier: mail('nobody'), password: 'abcd1234' }, RID)
    const unknownName = loginWithPassword(
      { identifier: 'no.such.user.x', password: 'abcd1234' },
      RID,
    )
    for (const attempt of [wrong, unknown, unknownName]) {
      await expect(attempt).rejects.toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
        status: 401,
        message: 'Sai tên tài khoản hoặc mật khẩu.',
      })
    }
  })

  it('5 wrong passwords lock password sign-in for 15 minutes, server-side and audited', async () => {
    const { email } = await register('lock')
    const id = (await account(email))!.id
    for (let i = 1; i <= 4; i++) {
      await expect(
        loginWithPassword({ identifier: email, password: `wrong${i}xx` }, RID),
      ).rejects.toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
      })
    }
    const fifth = loginWithPassword({ identifier: email, password: 'wrong5xx' }, RID)
    await expect(fifth).rejects.toMatchObject({ code: 'AUTH_PASSWORD_LOGIN_LOCKED', status: 429 })

    const locked = (await account(email))!
    const minutes = (locked.password_locked_until!.getTime() - Date.now()) / 60000
    expect(minutes).toBeGreaterThan(14)
    expect(minutes).toBeLessThanOrEqual(15)
    // Even the right password is refused while locked: not a client timer.
    await expect(
      loginWithPassword({ identifier: email, password: 'abcd1234' }, RID),
    ).rejects.toMatchObject({
      code: 'AUTH_PASSWORD_LOGIN_LOCKED',
    })
    const audit = await query(
      `SELECT 1 FROM audit_events WHERE resource_id = $1 AND action = 'AUTH_PASSWORD_LOGIN_LOCKED'`,
      [id],
    )
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit)).not.toContain('abcd1234')

    // After the 15 minutes: the right password works and clears the state.
    await query(
      `UPDATE user_accounts SET password_locked_until = now() - interval '1 second' WHERE id = $1`,
      [id],
    )
    await loginWithPassword({ identifier: email, password: 'abcd1234' }, RID)
    const after = (await account(email))!
    expect(after.failed_password_attempts).toBe(0)
    expect(after.password_locked_until).toBeNull()
  })

  it('an unknown or password-less identifier locks the same way (no enumeration by lockout)', async () => {
    for (const who of [mail('ghost'), `ghost.${stamp}`.slice(0, 30)]) {
      for (let i = 1; i <= 4; i++) {
        await expect(
          loginWithPassword({ identifier: who, password: `wrong${i}xx` }, RID),
        ).rejects.toMatchObject({
          code: 'AUTH_INVALID_CREDENTIALS',
        })
      }
      await expect(
        loginWithPassword({ identifier: who, password: 'wrong5xx' }, RID),
      ).rejects.toMatchObject({
        code: 'AUTH_PASSWORD_LOGIN_LOCKED',
        status: 429,
      })
    }
  })

  it('an absurdly long password is refused without hashing it', async () => {
    const { email } = await register('long')
    const started = Date.now()
    await expect(
      loginWithPassword({ identifier: email, password: 'a1'.repeat(100_000) }, RID),
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    })
    expect(Date.now() - started).toBeLessThan(1000)
    await expect(
      register('long2', { password: 'a1'.repeat(200), password_confirm: 'a1'.repeat(200) }),
    ).rejects.toMatchObject({
      code: 'AUTH_VALIDATION_FAILED',
      fields: expect.objectContaining({ password: 'weak' }),
    })
  })

  it('a successful sign-in resets the count, so failures must be consecutive', async () => {
    const { email } = await register('consec')
    for (let i = 0; i < 4; i++) {
      await loginWithPassword({ identifier: email, password: 'nope1234' }, RID).catch(
        () => undefined,
      )
    }
    await loginWithPassword({ identifier: email, password: 'abcd1234' }, RID)
    await loginWithPassword({ identifier: email, password: 'nope1234' }, RID).catch(() => undefined)
    expect((await account(email))!.failed_password_attempts).toBe(1)
  })

  it('BLOCKED / DEACTIVATED never sign in, and only the credential holder learns it', async () => {
    for (const status of ['BLOCKED', 'DEACTIVATED']) {
      const { email } = await register(`st${status.slice(0, 3).toLowerCase()}`)
      await query(
        `UPDATE user_accounts SET status = $2::account_status WHERE email_normalized = $1`,
        [email, status],
      )
      await expect(
        loginWithPassword({ identifier: email, password: 'abcd1234' }, RID),
      ).rejects.toMatchObject({
        code: 'AUTH_ACCOUNT_BLOCKED',
        status: 403,
      })
      await expect(
        loginWithPassword({ identifier: email, password: 'wrong123' }, RID),
      ).rejects.toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
      })
    }
  })

  it('a session of a locked-out (BLOCKED) account no longer authenticates', async () => {
    const { email, sessionToken } = await register('blkses')
    await query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE email_normalized = $1`, [email])
    expect(await resolveSession(sessionToken)).toBeNull()
  })
})

describe('forgot / reset password (US-01.04)', () => {
  it('an unknown account answers the same shape and creates nothing', async () => {
    const known = await register('fknown')
    const a = await requestPasswordReset(known.email, null)
    const b = await requestPasswordReset(mail('funknown'), null)
    const c = await requestPasswordReset('no.such.user.y', null)
    for (const r of [a, b, c]) {
      expect(Object.keys(r.response).sort()).toEqual([
        'email_masked',
        'expires_in_seconds',
        'request_id',
        'resend_after_seconds',
      ])
      expect(r.response.resend_after_seconds).toBe(45)
      expect(r.response.expires_in_seconds).toBe(900)
      expect(r.response.request_id).toMatch(/^authreq_reset_/)
    }
    expect(a.delivery).not.toBeNull()
    expect(b.delivery).toBeNull()
    expect(c.delivery).toBeNull()
    // A username identifier never echoes the address.
    expect(c.response.email_masked).toBe('')
    expect(JSON.stringify(a.response)).not.toContain(a.delivery!.token)
  })

  it('resend waits 45 s server-side and retires the earlier link', async () => {
    const { email } = await register('fresend')
    const first = await requestPasswordReset(email, null)
    await expect(resendPasswordReset(first.response.request_id)).rejects.toMatchObject({
      code: 'AUTH_RATE_LIMITED',
      status: 429,
    })
    const raw = first.response.request_id.replace('authreq_reset_', '')
    await query(
      `UPDATE password_reset_requests SET created_at = now() - interval '46 seconds' WHERE id = $1`,
      [raw],
    )
    const second = await resendPasswordReset(first.response.request_id)
    expect(second.delivery).not.toBeNull()
    await expect(
      completePasswordReset(
        { token: first.delivery!.token, password: 'newpass12', password_confirm: 'newpass12' },
        RID,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_LINK_EXPIRED' })
    // A forged / decoy request id sends nothing and says nothing.
    expect((await resendPasswordReset('authreq_reset_not-a-uuid')).delivery).toBeNull()
  })

  it('reset: new password works, old fails, other sessions are signed out, link is one-time', async () => {
    const { email, sessionToken: deviceA } = await register('freset')
    const id = (await account(email))!.id
    const deviceB = (await createSession(id)).token
    const { delivery } = await requestPasswordReset(email, null)

    await completePasswordReset(
      { token: delivery!.token, password: 'Moi2026pass', password_confirm: 'Moi2026pass' },
      RID,
    )

    expect(await resolveSession(deviceA)).toBeNull()
    expect(await resolveSession(deviceB)).toBeNull()
    expect(await liveSessions(id)).toBe(0)
    await expect(
      loginWithPassword({ identifier: email, password: 'abcd1234' }, RID),
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    })
    await loginWithPassword({ identifier: email, password: 'Moi2026pass' }, RID)

    // Replay of the same link.
    await expect(
      completePasswordReset(
        { token: delivery!.token, password: 'Khac2026x', password_confirm: 'Khac2026x' },
        RID,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_LINK_EXPIRED', status: 400 })
    const audit = await query(
      `SELECT after_data FROM audit_events WHERE resource_id = $1 AND action = 'AUTH_PASSWORD_RESET_COMPLETED'`,
      [id],
    )
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit)).not.toMatch(/Moi2026pass|scrypt|token/)
    // The raw token is never stored.
    const stored = await query(`SELECT 1 FROM password_reset_requests WHERE token_hash = $1`, [
      hashToken(delivery!.token),
    ])
    expect(stored).toHaveLength(1)
  })

  it('an expired (> 15 min) or forged link is refused; a weak password changes nothing', async () => {
    const { email } = await register('fexp')
    const { delivery } = await requestPasswordReset(email, null)
    await expect(
      completePasswordReset(
        { token: delivery!.token, password: 'abcdefgh', password_confirm: 'abcdefgh' },
        RID,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_VALIDATION_FAILED', status: 422 })
    await query(
      `UPDATE password_reset_requests SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashToken(delivery!.token)],
    )
    await expect(
      completePasswordReset(
        { token: delivery!.token, password: 'Moi2026pass', password_confirm: 'Moi2026pass' },
        RID,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_LINK_EXPIRED' })
    await expect(
      completePasswordReset(
        { token: 'forged-token', password: 'Moi2026pass', password_confirm: 'Moi2026pass' },
        RID,
      ),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_LINK_INVALID', status: 400 })
    await loginWithPassword({ identifier: email, password: 'abcd1234' }, RID)
  })

  it('the open-time check is read-only and agrees with completion', async () => {
    const { email } = await register('fcheck')
    const { delivery } = await requestPasswordReset(email, null)
    await checkPasswordReset(delivery!.token)
    await checkPasswordReset(delivery!.token)
    const [row] = await query<{ consumed: boolean }>(
      `SELECT consumed_at IS NOT NULL AS consumed FROM password_reset_requests WHERE token_hash = $1`,
      [hashToken(delivery!.token)],
    )
    expect(row!.consumed).toBe(false)
    await completePasswordReset(
      { token: delivery!.token, password: 'Moi2026pass', password_confirm: 'Moi2026pass' },
      RID,
    )
    await expect(checkPasswordReset(delivery!.token)).rejects.toMatchObject({
      code: 'AUTH_RESET_LINK_EXPIRED',
    })
    await expect(checkPasswordReset('forged')).rejects.toMatchObject({
      code: 'AUTH_RESET_LINK_INVALID',
    })
  })

  it('a reset also clears an active password lockout', async () => {
    const { email } = await register('flock')
    for (let i = 0; i < 5; i++) {
      await loginWithPassword({ identifier: email, password: 'nope1234' }, RID).catch(
        () => undefined,
      )
    }
    const { delivery } = await requestPasswordReset(email, null)
    await completePasswordReset(
      { token: delivery!.token, password: 'Moi2026pass', password_confirm: 'Moi2026pass' },
      RID,
    )
    await loginWithPassword({ identifier: email, password: 'Moi2026pass' }, RID)
  })

  it('a second forgot request inside 45 s sends nothing and says nothing (Sprint1 spacing)', async () => {
    const { email } = await register('fspace')
    const first = await requestPasswordReset(email, null)
    const second = await requestPasswordReset(email, null)
    expect(first.delivery).not.toBeNull()
    expect(second.delivery).toBeNull()
    expect(Object.keys(second.response).sort()).toEqual(Object.keys(first.response).sort())
    // The link already sent stays the usable one.
    await checkPasswordReset(first.delivery!.token)
    const raw = first.response.request_id.replace('authreq_reset_', '')
    await query(
      `UPDATE password_reset_requests SET created_at = now() - interval '46 seconds' WHERE id = $1`,
      [raw],
    )
    expect((await requestPasswordReset(email, null)).delivery).not.toBeNull()
  })
})

describe('Google (US-01.05, task section 9)', () => {
  const google = (tag: string, overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
    sub: `g-${tag}-${stamp}`,
    email: mail(tag),
    emailVerified: true,
    name: 'Google Chi',
    ...overrides,
  })

  it('a new Google account: username generated, no password, onboarding next, name kept for stage 1', async () => {
    const profile = google('gnew')
    created.push(profile.email)
    const { response, sessionToken } = await signInWithGoogle(profile, RID)
    expect(response).toMatchObject({
      account_created: true,
      onboarding: { completed: false, next_step: 'INTRO' },
    })
    const row = (await account(profile.email))!
    expect(row.password_hash).toBeNull()
    expect(row.username).toMatch(/^s1gnew/)
    expect(row.signup_full_name).toBe('Google Chi')
    expect((await resolveSession(sessionToken))?.accountId).toBe(row.id)
    // The same Google identity again: same account, no duplicate.
    const again = await signInWithGoogle(profile, RID)
    expect(again.response.account_created).toBe(false)
    // A Google-only account has no password to guess: same 401 as a wrong one.
    await expect(
      loginWithPassword({ identifier: profile.email, password: 'abcd1234' }, RID),
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    })
  })

  it('a Google e-mail matching a password account links the SAME account', async () => {
    const { email } = await register('glink')
    const before = (await account(email))!
    const { response } = await signInWithGoogle(
      google('glink', { email: email.toUpperCase() }),
      RID,
    )
    expect(response.account_created).toBe(false)
    const [counts] = await query<{ accounts: number; identities: number; profiles: number }>(
      `SELECT (SELECT count(*)::int FROM user_accounts WHERE email_normalized = $1) AS accounts,
              (SELECT count(*)::int FROM auth_identities WHERE account_id = $2) AS identities,
              (SELECT count(*)::int FROM individual_profiles WHERE account_id = $2) AS profiles`,
      [email, before.id],
    )
    expect(counts).toEqual({ accounts: 1, identities: 1, profiles: 0 })
    // The password still works after linking.
    await loginWithPassword({ identifier: email, password: 'abcd1234' }, RID)
    const audit = await query(
      `SELECT 1 FROM audit_events WHERE resource_id = $1 AND action = 'AUTH_GOOGLE_IDENTITY_LINKED'`,
      [before.id],
    )
    expect(audit).toHaveLength(1)
  })

  it('never links a second Google identity, nor an unverified e-mail', async () => {
    const { email } = await register('gtwo')
    await signInWithGoogle(google('gtwo-a', { email }), RID)
    await expect(signInWithGoogle(google('gtwo-b', { email }), RID)).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_FAILED',
    })
    await expect(
      signInWithGoogle(google('gunv', { emailVerified: false }), RID),
    ).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_FAILED',
    })
    expect(await account(mail('gunv'))).toBeUndefined()
  })

  it('BLOCKED / DEACTIVATED accounts are refused by Google and never linked', async () => {
    const { email } = await register('gblk')
    const id = (await account(email))!.id
    await query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE id = $1`, [id])
    await expect(signInWithGoogle(google('gblk', { email }), RID)).rejects.toMatchObject({
      code: 'AUTH_ACCOUNT_BLOCKED',
      status: 403,
    })
    const identities = await query(`SELECT 1 FROM auth_identities WHERE account_id = $1`, [id])
    expect(identities).toHaveLength(0)
    // Already linked, then deactivated: still refused.
    const linked = await register('gdea')
    await signInWithGoogle(google('gdea', { email: linked.email }), RID)
    await query(`UPDATE user_accounts SET status = 'DEACTIVATED' WHERE email_normalized = $1`, [
      linked.email,
    ])
    await expect(
      signInWithGoogle(google('gdea', { email: linked.email }), RID),
    ).rejects.toMatchObject({
      code: 'AUTH_ACCOUNT_BLOCKED',
    })
  })

  it('the password lockout does not block Google (US-01.03), and Google does not clear it', async () => {
    const { email } = await register('glock')
    for (let i = 0; i < 5; i++) {
      await loginWithPassword({ identifier: email, password: 'nope1234' }, RID).catch(
        () => undefined,
      )
    }
    const { sessionToken } = await signInWithGoogle(google('glock', { email }), RID)
    expect(await resolveSession(sessionToken)).not.toBeNull()
    expect((await account(email))!.password_locked_until).not.toBeNull()
  })

  it('two concurrent first Google sign-ins for one new address converge on one account', async () => {
    const profile = google('grace')
    created.push(profile.email)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const results = await Promise.allSettled([
      resolveGoogleAccount(profile, RID),
      resolveGoogleAccount(profile, RID).catch(() => resolveGoogleAccount(profile, RID)),
    ])
    const ids = new Set(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.id] : [])))
    expect(ids.size).toBe(1)
  })
})
