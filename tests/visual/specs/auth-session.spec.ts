import { expect, test } from '@playwright/test'

/**
 * M0-T08 — auth/session smoke through a real browser.
 *
 * Proves the cookie round-trip that unit tests cannot: that the browser stores
 * the session cookie, sends it back, and that logout genuinely de-authenticates.
 *
 * Login goes through /dev/login, which is dev-gated and drives the REAL
 * magic-link flow end to end rather than minting a session directly, so this
 * exercises the production token lifecycle and cookie attributes.
 */

const SESSION = '/api/v1/session'
const SEEDED_MEMBER = 'member@example.test'

test.describe('M0-T08 unauthenticated browser state', () => {
  test('a fresh context is unauthenticated', async ({ page }) => {
    const response = await page.goto(SESSION)

    expect(response?.status()).toBe(200)
    expect(await response!.json()).toEqual({ authenticated: false })
  })

  test('no session cookie exists before login', async ({ context, page }) => {
    await page.goto(SESSION)
    const cookies = await context.cookies()

    expect(cookies.find((c) => c.name === '1hub_session')).toBeUndefined()
  })
})

test.describe('M0-T08 authenticated browser state', () => {
  test('login sets an HttpOnly session cookie the browser sends back', async ({ context }) => {
    // context.request shares the browser's cookie jar; the standalone `request`
    // fixture has its own isolated one, so cookies set there never appear here.
    const login = await context.request.post('/dev/login', { data: { email: SEEDED_MEMBER } })
    expect(login.status()).toBe(200)

    const cookies = await context.cookies()
    const session = cookies.find((c) => c.name === '1hub_session')

    expect(session, 'session cookie missing').toBeDefined()
    expect(session!.httpOnly, 'cookie must be HttpOnly').toBe(true)
    expect(session!.sameSite).toBe('Lax')
    expect(session!.path).toBe('/')
    // Not a session cookie: it carries an explicit expiry.
    expect(session!.expires).toBeGreaterThan(0)
  })

  test('the session survives a normal request cycle', async ({ request }) => {
    await request.post('/dev/login', { data: { email: SEEDED_MEMBER } })

    const response = await request.get(SESSION)
    const body = (await response.json()) as Record<string, unknown>

    expect(body.authenticated).toBe(true)
    expect((body.account as Record<string, string>).email).toBe(SEEDED_MEMBER)
  })

  test('returns only contract-approved fields, with no invented ones', async ({ request }) => {
    await request.post('/dev/login', { data: { email: SEEDED_MEMBER } })

    const body = (await (await request.get(SESSION)).json()) as Record<string, unknown>

    expect(Object.keys(body).sort()).toEqual([
      'account',
      'authenticated',
      'capabilities',
      'managed_scopes',
      'profile',
    ])
    expect(Object.keys(body.account as object).sort()).toEqual([
      'email',
      'email_verified',
      'id',
      'status',
    ])
    expect(Object.keys(body.profile as object).sort()).toEqual([
      'completion_percent',
      'id',
      'onboarding_completed',
      'status',
    ])

    // Authorization output belongs to M0-T09; the shape is present, the content
    // is deliberately empty rather than guessed.
    expect(body.capabilities).toEqual([])
    expect(body.managed_scopes).toEqual([])
  })

  test('the token is never exposed to page JavaScript', async ({ page, request }) => {
    await request.post('/dev/login', { data: { email: SEEDED_MEMBER } })
    await page.goto(SESSION)

    const visible = await page.evaluate(() => document.cookie)
    expect(visible).not.toContain('1hub_session')
  })
})

test.describe('M0-T08 logout', () => {
  test('logout returns 204 and de-authenticates', async ({ request }) => {
    await request.post('/dev/login', { data: { email: SEEDED_MEMBER } })
    expect(
      ((await (await request.get(SESSION)).json()) as { authenticated: boolean }).authenticated,
    ).toBe(true)

    const logout = await request.post('/api/v1/auth/logout')
    expect(logout.status()).toBe(204)

    const after = (await (await request.get(SESSION)).json()) as { authenticated: boolean }
    expect(after.authenticated).toBe(false)
  })

  test('logout is idempotent', async ({ request }) => {
    await request.post('/dev/login', { data: { email: SEEDED_MEMBER } })
    await request.post('/api/v1/auth/logout')

    const second = await request.post('/api/v1/auth/logout')
    expect(second.status()).toBe(204)
  })
})

test.describe('M0-T08 auth endpoints over HTTP', () => {
  test('magic-link request returns 202 with the frozen shape and no token', async ({ request }) => {
    const response = await request.post('/api/v1/auth/magic-link', {
      data: { email: SEEDED_MEMBER },
    })

    // 05:168 specifies 202, not 200.
    expect(response.status()).toBe(202)
    const body = (await response.json()) as Record<string, unknown>

    expect(Object.keys(body).sort()).toEqual([
      'email_masked',
      'expires_in_seconds',
      'request_id',
      'resend_after_seconds',
    ])
    expect(body.email_masked).toBe('m***@example.test')
    // The raw token must never cross the wire.
    expect(JSON.stringify(body)).not.toMatch(/token/i)
  })

  test('does not disclose whether an account exists', async ({ request }) => {
    const known = await request.post('/api/v1/auth/magic-link', { data: { email: SEEDED_MEMBER } })
    const unknown = await request.post('/api/v1/auth/magic-link', {
      data: { email: 'nobody-here@example.test' },
    })

    expect(known.status()).toBe(unknown.status())

    const a = Object.keys((await known.json()) as object).sort()
    const b = Object.keys((await unknown.json()) as object).sort()
    expect(a).toEqual(b)
  })

  test('rejects a malformed address with the contract code', async ({ request }) => {
    const response = await request.post('/api/v1/auth/magic-link', { data: { email: 'nope' } })

    expect(response.status()).toBe(400)
    const body = (await response.json()) as { error: { code: string; request_id: string } }
    expect(body.error.code).toBe('AUTH_EMAIL_INVALID')
    expect(body.error.request_id).toBeTruthy()
  })

  test('consume rejects an invalid token with the contract code', async ({ request }) => {
    const response = await request.post('/api/v1/auth/magic-link/consume', {
      data: { token: 'not-a-real-token' },
    })

    expect(response.status()).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('AUTH_LINK_INVALID')
  })

  test('providers returns an empty list, as P0 requires', async ({ request }) => {
    const response = await request.get('/api/v1/auth/providers')

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ providers: [] })
  })
})
