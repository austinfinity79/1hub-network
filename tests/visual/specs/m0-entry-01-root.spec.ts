import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { STEP_ROUTES } from '../../../src/lib/onboarding/state'
import { closePool, query } from '../../../src/lib/db/client'

/**
 * M0-ENTRY-01 — `/` redirects server-side: guest → /auth, otherwise wherever
 * the canonical onboarding resolver sends the account (DEC-WF01-RESUME-D1).
 * Each expected target is read back from GET /api/v1/me/onboarding, the same
 * resolver, so no step is hard-coded twice.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const DOMAIN = '20000000-0000-0000-0000-000000000011'

test.beforeEach(async ({ page }) => {
  await page.context().clearCookies()
})

test.afterAll(async () => {
  await closePool()
})

async function resolverTarget(request: APIRequestContext): Promise<string> {
  const state = await (await request.get('/api/v1/me/onboarding')).json()
  return state.completed ? '/me' : STEP_ROUTES[state.current_step as keyof typeof STEP_ROUTES]
}

async function expectRoot(page: Page, target: string) {
  // Server-side redirect: the root answers 307 with no page body of its own.
  const raw = await page.request.get('/', { maxRedirects: 0 })
  expect(raw.status()).toBe(307)
  expect(raw.headers()['location']).toBe(target)
  expect(await raw.text()).not.toContain('Foundation bootstrap')
  expect(await resolverTarget(page.request).catch(() => '/auth')).toBe(
    target === '/auth' ? '/auth' : target,
  )
  await page.goto('/')
  await expect(page).toHaveURL(target)
}

test.describe('M0-ENTRY-01 root entry', () => {
  test('1. a guest goes to /auth; no placeholder, no session data', async ({ page }) => {
    const raw = await page.request.get('/', { maxRedirects: 0 })
    expect(raw.status()).toBe(307)
    expect(raw.headers()['location']).toBe('/auth')
    const body = await raw.text()
    expect(body).not.toContain('Foundation bootstrap')
    expect(body).not.toMatch(/profile|onboarding|session/i)
    await page.goto('/')
    await expect(page).toHaveURL('/auth')
  })

  test('2–7. every onboarding state lands where the resolver says; refresh is stable', async ({
    page,
  }) => {
    const email = `root-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    await expectRoot(page, '/onboarding/purpose') // 2. PURPOSE (new account)

    expect(
      (await page.request.put('/api/v1/me/onboarding/intent', { data: { action: 'SKIP' } })).ok(),
    ).toBe(true)
    await expectRoot(page, '/onboarding/profile') // 3. PROFILE

    expect(
      (
        await page.request.patch('/api/v1/me/profile', {
          data: { display_name: 'Root', headline: 'QA', region_id: REGION, domain_ids: [DOMAIN] },
        })
      ).status(),
    ).toBe(200)
    await expectRoot(page, '/onboarding/privacy') // 4. PRIVACY

    const { documents } = await (await page.request.get('/api/v1/legal/current')).json()
    for (const doc of documents) {
      expect(
        (
          await page.request.post('/api/v1/me/consents/accept', {
            data: { consent_type: doc.type, policy_version: doc.version },
          })
        ).ok(),
      ).toBe(true)
    }
    await expectRoot(page, '/onboarding/complete') // 5. COMPLETE

    expect((await page.request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
    await expectRoot(page, '/me') // 6. DONE

    await page.reload() // 7. refresh keeps the canonical destination
    await expect(page).toHaveURL('/me')
    await page.goto('/')
    await expect(page).toHaveURL('/me')
  })

  test('the seeded completed member goes to /me', async ({ page }) => {
    expect(
      (await page.request.post('/dev/login', { data: { email: 'member@example.test' } })).ok(),
    ).toBe(true)
    await expectRoot(page, '/me')
  })

  test('9. an invalid, revoked or expired session goes to /auth', async ({ page, context }) => {
    // Invalid token.
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: 'not-a-real-session',
        url: test.info().project.use.baseURL!,
      },
    ])
    let raw = await page.request.get('/', { maxRedirects: 0 })
    expect(raw.headers()['location']).toBe('/auth')

    // Revoked.
    await context.clearCookies()
    const email = `root-rev-${Date.now()}@example.test`
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    const [account] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [email],
    )
    await query('UPDATE user_sessions SET revoked_at = now() WHERE account_id = $1', [account!.id])
    raw = await page.request.get('/', { maxRedirects: 0 })
    expect(raw.headers()['location']).toBe('/auth')

    // Expired.
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    await query(
      `UPDATE user_sessions SET expires_at = now() - interval '1 second' WHERE account_id = $1 AND revoked_at IS NULL`,
      [account!.id],
    )
    raw = await page.request.get('/', { maxRedirects: 0 })
    expect(raw.headers()['location']).toBe('/auth')
    await page.goto('/')
    await expect(page).toHaveURL('/auth')
  })
})
