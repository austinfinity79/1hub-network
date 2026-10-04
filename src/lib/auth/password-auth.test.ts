import { afterEach, describe, expect, it, vi } from 'vitest'

import { afterSignIn } from './after-sign-in'
import { fetchGoogleProfile, startGoogleFlow, verifyGoogleState } from './google'
import { hashPassword, verifyPassword } from './password'
import { isValidPasswordFormat, passwordStrength } from './password-rules'
import { passwordResetUrl, renderPasswordResetEmail } from './password-reset-email'
import { isValidUsernameFormat, normalizeUsername, usernameSeedFromEmail } from './username'

/** S1-UAT-01 — the hermetic part of the auth replacement (no database). */

afterEach(() => {
  vi.restoreAllMocks()
})

describe('username rule (Appendix B "Tên tài khoản")', () => {
  it.each([
    ['chi.nguyen', true],
    ['Chi.Nguyen2026', true],
    ['abcd', true],
    ['a'.repeat(30), true],
    ['abc', false],
    ['a'.repeat(31), false],
    ['chí.nguyễn', false],
    ['chi nguyen', false],
    ['chi_nguyen', false],
    ['chi-nguyen', false],
    ['chi@nguyen', false],
  ])('%j valid = %s', (value, ok) => {
    expect(isValidUsernameFormat(value)).toBe(ok)
  })

  it('normalises case deterministically, so equivalent forms are one identity', () => {
    expect(normalizeUsername('  Chi.Nguyen ')).toBe('chi.nguyen')
    expect(normalizeUsername('CHI.NGUYEN')).toBe(normalizeUsername('chi.nguyen'))
  })

  it('derives a valid seed from any Google e-mail', () => {
    for (const email of ['chi.nguyen@gmail.com', 'a+b@x.io', 'ng_uyễn@x.vn', '.@x.io', 'ab@x.io']) {
      expect(isValidUsernameFormat(usernameSeedFromEmail(email)), email).toBe(true)
    }
  })
})

describe('password rule (Appendix B "Mật khẩu")', () => {
  it.each([
    ['abcdefgh', false],
    ['12345678', false],
    ['abc1234', false],
    ['abcd1234', true],
    ['Mật khẩu 2026', true],
  ])('%j valid = %s', (value, ok) => {
    expect(isValidPasswordFormat(value)).toBe(ok)
  })

  it('meter never rates a rule-breaking password above weak', () => {
    expect(passwordStrength('abcdefgh').level).toBe(1)
    expect(passwordStrength('abcd1234').level).toBe(2)
    expect(passwordStrength('Abcd1234!xyz').level).toBe(4)
  })
})

describe('password storage', () => {
  it('stores a salted scrypt hash, never the plaintext, and verifies it', async () => {
    const hash = await hashPassword('abcd1234')
    expect(hash).toMatch(/^scrypt:16384:8:1:[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(hash).not.toContain('abcd1234')
    expect(await verifyPassword('abcd1234', hash)).toBe(true)
    expect(await verifyPassword('ABCD1234', hash)).toBe(false)
    expect(await hashPassword('abcd1234')).not.toBe(hash)
  })

  it('fails closed on a malformed or foreign hash', async () => {
    for (const bad of [
      '',
      'abcd1234',
      'bcrypt:$2b$10$x',
      'scrypt:x:8:1:aa:bb',
      'scrypt:16384:8:1::',
    ]) {
      expect(await verifyPassword('abcd1234', bad), bad).toBe(false)
    }
  })
})

describe('decoy lockout (enumeration)', () => {
  it('locks an identifier with no account after 5 failures, for 15 minutes', async () => {
    const { assertDecoyNotLocked, recordDecoyFailure } = await import('./lockout')
    const key = `ghost-${Math.random()}`
    const t0 = 1_000_000
    for (let i = 0; i < 4; i++) recordDecoyFailure(key, t0)
    expect(() => assertDecoyNotLocked(key, t0)).not.toThrow()
    recordDecoyFailure(key, t0)
    expect(() => assertDecoyNotLocked(key, t0)).toThrow(
      expect.objectContaining({ code: 'AUTH_PASSWORD_LOGIN_LOCKED', status: 429 }),
    )
    expect(() => assertDecoyNotLocked(key, t0 + 15 * 60 * 1000 + 1)).not.toThrow()
  })
})

describe('reset e-mail', () => {
  it('puts the token in the fragment only, never in a query string', () => {
    const link = passwordResetUrl('tok_en', 'https://1hubnetwork.io.vn')
    expect(link).toBe('https://1hubnetwork.io.vn/auth/reset-password#token=tok_en')
    expect(new URL(link).search).toBe('')
    const mail = renderPasswordResetEmail('a@b.vn', link)
    expect(mail.text).toContain('15 phút')
    expect(mail.text).toContain('một lần')
  })
})

describe('Google OAuth state and exchange', () => {
  const config = { clientId: 'cid', clientSecret: 'secret' }

  it('starts with PKCE S256 and a state bound to the cookie', () => {
    const { url, cookieValue } = startGoogleFlow(config, 'https://1hubnetwork.io.vn')
    const params = new URL(url).searchParams
    expect(params.get('redirect_uri')).toBe('https://1hubnetwork.io.vn/auth/callback')
    expect(params.get('code_challenge_method')).toBe('S256')
    expect(params.get('scope')).toBe('openid email profile')
    expect(url).not.toContain('secret')
    const [state, verifier] = cookieValue.split('.')
    expect(params.get('state')).toBe(state)
    expect(verifyGoogleState(cookieValue, state)).toBe(verifier)
  })

  it('refuses a missing, forged or replayed (cookie gone) state', () => {
    const { cookieValue } = startGoogleFlow(config, 'https://x.vn')
    expect(() => verifyGoogleState(cookieValue, 'forged')).toThrow(
      expect.objectContaining({ code: 'AUTH_GOOGLE_STATE_MISMATCH', status: 400 }),
    )
    expect(() => verifyGoogleState(undefined, cookieValue.split('.')[0])).toThrow(
      expect.objectContaining({ code: 'AUTH_GOOGLE_STATE_MISMATCH' }),
    )
    expect(() => verifyGoogleState(cookieValue, undefined)).toThrow()
  })

  it('exchanges the code server-side and reads the verified profile', async () => {
    const calls: { url: string; body?: string }[] = []
    const fake = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body as string | undefined })
      return String(url).includes('token')
        ? Response.json({ access_token: 'at' })
        : Response.json({ sub: '42', email: 'Chi@Gmail.com', email_verified: true, name: 'Chi' })
    })
    const profile = await fetchGoogleProfile(
      config,
      'https://x.vn',
      'code1',
      'ver',
      fake as typeof fetch,
    )
    expect(profile).toEqual({ sub: '42', email: 'Chi@Gmail.com', emailVerified: true, name: 'Chi' })
    expect(calls[0]!.body).toContain('code_verifier=ver')
    expect(calls[0]!.body).toContain('client_secret=secret')
  })

  it('maps every provider failure to AUTH_GOOGLE_FAILED', async () => {
    const denied = vi.fn(async () => Response.json({ error: 'invalid_grant' }, { status: 400 }))
    await expect(
      fetchGoogleProfile(config, 'https://x.vn', 'c', 'v', denied as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'AUTH_GOOGLE_FAILED', status: 400 })
    const down = vi.fn(async () => {
      throw new TypeError('network')
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await expect(
      fetchGoogleProfile(config, 'https://x.vn', 'c', 'v', down as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'AUTH_GOOGLE_FAILED' })
    await expect(fetchGoogleProfile(config, 'https://x.vn', '', 'v')).rejects.toMatchObject({
      code: 'AUTH_GOOGLE_FAILED',
    })
  })
})

describe('destination after sign-in (US-01.03 step 5)', () => {
  const memory = () => {
    const map = new Map<string, string>()
    return {
      map,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    }
  }
  const result = (completed: boolean, step: string | null) => ({
    result: 'SUCCESS' as const,
    account_created: !completed,
    onboarding: { completed, next_step: step },
  })

  it('a new account goes to onboarding and keeps the return path for later', () => {
    const tab = memory()
    expect(afterSignIn(result(false, 'INTRO'), '/projects/new', tab)).toEqual({
      path: '/onboarding',
      destination: 'onboarding',
    })
    expect(tab.map.size).toBe(1)
  })

  it('a returning account resumes its step, or goes to the redirect / me', () => {
    expect(afterSignIn(result(false, 'CAPABILITY'), null, memory()).path).toBe(
      '/onboarding/capability',
    )
    expect(afterSignIn(result(true, null), '/projects/new', memory()).path).toBe('/projects/new')
    expect(afterSignIn(result(true, null), null, memory()).path).toBe('/me')
  })
})
