import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, query } from '@/lib/db/client'

import {
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  UNSTATED_AUTH_VALUES,
} from './config'
import { consumeMagicLink, requestMagicLink, resendMagicLink } from './magic-link'
import { readSessionToken, sessionClearCookie, sessionSetCookie } from './session-cookie'
import { createSession, resolveSession, revokeSession } from './sessions'
import { hashToken, maskEmail } from './tokens'

/**
 * M0-T08 — auth/session foundation, against live PostgreSQL.
 *
 * Uses the deterministic M0-T07 fixtures. Every assertion exercises the real
 * tables from migration 001; nothing is mocked.
 */
const ROOT = process.cwd()
const SEEDED_MEMBER = 'member@example.test'

beforeAll(() => {
  execFileSync('node', [join(ROOT, 'scripts', 'db.mjs'), 'reset'], { stdio: 'pipe' })
}, 60_000)

afterAll(async () => {
  await closePool()
})

describe('M0-T08 unstated contract values are declared, not chosen silently', () => {
  it('names every value no frozen source defines', () => {
    const names = UNSTATED_AUTH_VALUES.map((v) => v.name)

    expect(names).toEqual(['SESSION_TTL_SECONDS', 'SESSION_COOKIE_SAMESITE', 'CSRF_MECHANISM'])
    for (const value of UNSTATED_AUTH_VALUES) {
      expect(value.reason.length).toBeGreaterThan(0)
      expect(value.wouldBeSettledBy.length).toBeGreaterThan(0)
    }
  })

  it('uses the cookie name the contract froze', () => {
    const yaml = readFileSync(
      join(ROOT, 'docs', 'architecture', '05_API_CONTRACT_P0_v1.0.yaml'),
      'utf8',
    )

    expect(yaml).toContain(SESSION_COOKIE_NAME)
  })

  it('uses the magic-link timings the contract froze', () => {
    expect(MAGIC_LINK_EXPIRES_IN_SECONDS).toBe(900)
  })
})

describe('M0-T08 session lifecycle', () => {
  it('returns null for an absent, unknown or malformed token', async () => {
    expect(await resolveSession(undefined)).toBeNull()
    expect(await resolveSession('')).toBeNull()
    expect(await resolveSession('not-a-real-token')).toBeNull()
    expect(await resolveSession('\u0000\u0001')).toBeNull()
  })

  it('authenticates a freshly created session', async () => {
    const [account] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [SEEDED_MEMBER],
    )
    const { token } = await createSession(account!.id)

    const session = await resolveSession(token)
    expect(session).not.toBeNull()
    expect(session!.accountId).toBe(account!.id)
  })

  it('stops authenticating after logout, even with the same token', async () => {
    const [account] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [SEEDED_MEMBER],
    )
    const { token } = await createSession(account!.id)

    expect(await resolveSession(token)).not.toBeNull()
    await revokeSession(token)
    expect(await resolveSession(token)).toBeNull()

    // Revoking twice is a no-op, not an error.
    await revokeSession(token)
    expect(await resolveSession(token)).toBeNull()
  })

  it('refuses an expired session', async () => {
    const [account] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [SEEDED_MEMBER],
    )
    const { token } = await createSession(account!.id)

    await query(
      `UPDATE user_sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashToken(token)],
    )

    expect(await resolveSession(token)).toBeNull()
  })

  it('never stores the raw session token', async () => {
    const [account] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [SEEDED_MEMBER],
    )
    const { token } = await createSession(account!.id)

    const rows = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM user_sessions WHERE token_hash = $1',
      [token],
    )
    // The raw token matches nothing; only its hash is stored.
    expect(rows[0]!.n).toBe(0)

    const hashed = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM user_sessions WHERE token_hash = $1',
      [hashToken(token)],
    )
    expect(hashed[0]!.n).toBe(1)
  })

  it('gives every session a distinct token, so sessions cannot be enumerated', async () => {
    const [account] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [SEEDED_MEMBER],
    )

    const tokens = new Set<string>()
    for (let i = 0; i < 5; i += 1) {
      const { token } = await createSession(account!.id)
      tokens.add(token)
    }

    expect(tokens.size).toBe(5)
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(43)
  })
})

describe('M0-T08 magic link', () => {
  it('issues a link and returns the frozen response shape', async () => {
    const { response, token } = await requestMagicLink(SEEDED_MEMBER, null)

    expect(Object.keys(response).sort()).toEqual([
      'email_masked',
      'expires_in_seconds',
      'request_id',
      'resend_after_seconds',
    ])
    expect(response.request_id).toMatch(/^authreq_/)
    expect(response.expires_in_seconds).toBe(900)
    expect(response.resend_after_seconds).toBe(60)
    // The address is masked, and the raw token is never in the response.
    expect(response.email_masked).toBe('m***@example.test')
    expect(JSON.stringify(response)).not.toContain(token)
  })

  it('rejects a malformed address', async () => {
    for (const bad of ['', 'nope', 'a@b', 'x y@z.com']) {
      await expect(requestMagicLink(bad, null)).rejects.toMatchObject({
        code: 'AUTH_EMAIL_INVALID',
      })
    }
  })

  it('stores only the hash of the link token', async () => {
    const { token } = await requestMagicLink(SEEDED_MEMBER, null)

    const raw = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM auth_magic_link_requests WHERE token_hash = $1',
      [token],
    )
    expect(raw[0]!.n).toBe(0)

    const hashed = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM auth_magic_link_requests WHERE token_hash = $1',
      [hashToken(token)],
    )
    expect(hashed[0]!.n).toBe(1)
  })

  it('consumes a valid token and establishes a session', async () => {
    const { token } = await requestMagicLink(SEEDED_MEMBER, null)
    const result = await consumeMagicLink(token)

    expect(result.response.result).toBe('SUCCESS')
    // The account was already seeded, so this is a login, not a creation.
    expect(result.response.account_created).toBe(false)
    expect(result.response.onboarding.completed).toBe(true)

    const session = await resolveSession(result.sessionToken)
    expect(session).not.toBeNull()
  })

  it('rejects the second use of a token', async () => {
    const { token } = await requestMagicLink(SEEDED_MEMBER, null)
    await consumeMagicLink(token)

    await expect(consumeMagicLink(token)).rejects.toMatchObject({
      code: 'AUTH_LINK_ALREADY_USED',
    })
  })

  it('rejects an expired token', async () => {
    const { token } = await requestMagicLink(SEEDED_MEMBER, null)
    await query(
      `UPDATE auth_magic_link_requests SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashToken(token)],
    )

    await expect(consumeMagicLink(token)).rejects.toMatchObject({ code: 'AUTH_LINK_EXPIRED' })
  })

  it('rejects an unknown or malformed token', async () => {
    for (const bad of ['unknown-token', '', 'x'.repeat(600)]) {
      await expect(consumeMagicLink(bad)).rejects.toMatchObject({ code: 'AUTH_LINK_INVALID' })
    }
    await expect(consumeMagicLink(null)).rejects.toMatchObject({ code: 'AUTH_LINK_INVALID' })
  })

  it('refuses a blocked account', async () => {
    await query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE email_normalized = $1`, [
      'ops@example.test',
    ])
    const { token } = await requestMagicLink('ops@example.test', null)

    await expect(consumeMagicLink(token)).rejects.toMatchObject({
      code: 'AUTH_ACCOUNT_BLOCKED',
    })

    await query(`UPDATE user_accounts SET status = 'ACTIVE' WHERE email_normalized = $1`, [
      'ops@example.test',
    ])
  })

  it('creates an account for an unknown address, one flow for signup and login', async () => {
    const fresh = `new-${Date.now()}@example.test`
    const { token } = await requestMagicLink(fresh, null)
    const result = await consumeMagicLink(token)

    expect(result.response.account_created).toBe(true)
    // No profile yet, so onboarding is not complete.
    expect(result.response.onboarding.completed).toBe(false)
    expect(result.response.onboarding.next_step).toBe('INTRO')
  })

  it('open sign-up: an address on no roster gets an account only by using its link', async () => {
    const fresh = `open-${Date.now()}@not-provisioned.example.test`
    const accounts = () =>
      query<{ id: string; status: string }>(
        'SELECT id::text, status::text AS status FROM user_accounts WHERE email_normalized = $1',
        [fresh],
      )
    const roster = await query('SELECT 1 FROM membership_bootstrap WHERE email_normalized = $1', [
      fresh,
    ])
    expect(roster).toHaveLength(0)

    // Requesting a link, even repeatedly, creates nothing.
    const first = await requestMagicLink(fresh, null)
    const second = await requestMagicLink(fresh.toUpperCase(), null)
    expect(await accounts()).toHaveLength(0)

    // The verified link creates the one account; a later sign-in reuses it.
    expect((await consumeMagicLink(first.token)).response.account_created).toBe(true)
    expect((await consumeMagicLink(second.token)).response.account_created).toBe(false)
    const rows = await accounts()
    expect(rows).toMatchObject([{ status: 'ACTIVE' }])
    const profiles = await query('SELECT 1 FROM individual_profiles WHERE account_id = $1', [
      rows[0]!.id,
    ])
    expect(profiles).toHaveLength(0)
  })

  it('retires the previous link when one is resent', async () => {
    const first = await requestMagicLink(SEEDED_MEMBER, null)
    const second = await resendMagicLink(first.response.request_id)

    // Only the newest link works.
    await expect(consumeMagicLink(first.token)).rejects.toMatchObject({
      code: 'AUTH_LINK_ALREADY_USED',
    })
    await expect(consumeMagicLink(second.token)).resolves.toMatchObject({
      response: { result: 'SUCCESS' },
    })
  })

  it('mints a new session token on each consume, defeating fixation', async () => {
    const a = await requestMagicLink(SEEDED_MEMBER, null)
    const first = await consumeMagicLink(a.token)
    const b = await requestMagicLink(SEEDED_MEMBER, null)
    const second = await consumeMagicLink(b.token)

    expect(second.sessionToken).not.toBe(first.sessionToken)
  })

  // M0 completion audit: single use must hold under concurrency, not only in
  // sequence. The claim is one conditional UPDATE, so PostgreSQL row locking
  // must let exactly one consumer through.
  it('lets exactly one of several concurrent consumes succeed', async () => {
    const { token } = await requestMagicLink(SEEDED_MEMBER, null)
    const sessionsBefore = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM user_sessions',
    )

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => consumeMagicLink(token)),
    )

    const ok = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(7)
    for (const f of failed) expect(f.reason).toMatchObject({ code: 'AUTH_LINK_ALREADY_USED' })

    const sessionsAfter = await query<{ n: number }>('SELECT count(*)::int AS n FROM user_sessions')
    expect(sessionsAfter[0]!.n - sessionsBefore[0]!.n).toBe(1)
  })
})

describe('M0-T08 cookie semantics', () => {
  it('sets HttpOnly, SameSite, path and max-age', () => {
    const cookie = sessionSetCookie('token-value', SESSION_TTL_SECONDS)

    expect(cookie.name).toBe(SESSION_COOKIE_NAME)
    expect(cookie.options.httpOnly).toBe(true)
    expect(cookie.options.sameSite).toBe('lax')
    expect(cookie.options.path).toBe('/')
    expect(cookie.options.maxAge).toBe(SESSION_TTL_SECONDS)
  })

  it('expires the cookie on clear', () => {
    const cookie = sessionClearCookie()

    expect(cookie.value).toBe('')
    expect(cookie.options.maxAge).toBe(0)
    expect(cookie.options.httpOnly).toBe(true)
  })

  it('reads its own cookie and ignores others', () => {
    const headers = new Headers({
      cookie: `other=1; ${SESSION_COOKIE_NAME}=abc123; another=2`,
    })

    expect(readSessionToken(headers)).toBe('abc123')
    expect(readSessionToken(new Headers())).toBeUndefined()
    expect(readSessionToken(new Headers({ cookie: 'other=1' }))).toBeUndefined()
  })
})

describe('M0-T08 boundaries and fixtures', () => {
  it('keeps account, profile and verification separate', async () => {
    // One account maps to one root profile; the session carries account identity
    // and profile status, and nothing merges the two entities.
    const rows = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM individual_profiles GROUP BY account_id HAVING count(*) > 1`,
    )

    expect(rows).toHaveLength(0)
  })

  it('leaves the seeded account/profile relationship valid', async () => {
    const rows = await query<{ email: string; profile: string | null }>(
      `SELECT a.email, p.id::text AS profile
       FROM user_accounts a LEFT JOIN individual_profiles p ON p.account_id = a.id
       WHERE a.email_normalized = $1`,
      [SEEDED_MEMBER],
    )

    expect(rows[0]!.profile).toBe('40000000-0000-0000-0000-000000000001')
  })

  it('masks addresses without leaking the local part', () => {
    expect(maskEmail('member@example.test')).toBe('m***@example.test')
    expect(maskEmail('a@b.test')).toBe('a***@b.test')
    expect(maskEmail('broken')).toBe('***')
  })

  it('required no schema change, and no later migration touches the auth tables', () => {
    const one = readFileSync(join(ROOT, 'db', 'migrations', '001_p0_init.sql'), 'utf8')
    expect(one).toContain('CREATE TABLE user_sessions')
    expect(one).toContain('CREATE TABLE auth_magic_link_requests')

    const migrations = readdirSync(join(ROOT, 'db', 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    // M0-T08 itself added none: the auth tables were already in 001.
    expect(migrations.slice(0, 2)).toEqual(['001_p0_init.sql', '002_p0_schema_alignment.sql'])

    // Stronger than counting files, and the assertion that actually matters:
    // no migration after 002 may alter the auth tables. M0-T10 added 003 and is
    // forbidden from changing the magic-link security rules, so this is the
    // mechanical check of that constraint.
    for (const filename of migrations.slice(2)) {
      const sql = readFileSync(join(ROOT, 'db', 'migrations', filename), 'utf8')
      const statements = sql.replace(/--[^\n]*/g, '')
      expect(statements, `${filename} must not alter user_sessions`).not.toMatch(
        /ALTER\s+TABLE\s+user_sessions/i,
      )
      expect(statements, `${filename} must not alter auth_magic_link_requests`).not.toMatch(
        /ALTER\s+TABLE\s+auth_magic_link_requests/i,
      )
      expect(statements, `${filename} must not drop an auth table`).not.toMatch(
        /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?(user_sessions|auth_magic_link_requests)/i,
      )
    }
  })
})
