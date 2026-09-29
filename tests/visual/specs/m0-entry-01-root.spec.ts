import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { STEP_ROUTES } from '../../../src/lib/onboarding/state'
import { closePool, query } from '../../../src/lib/db/client'

/**
 * M0-ENTRY-01, as amended by P0-LANDING (DEC-P0-LANDING-D1): `/` renders the
 * public homepage for everyone and no longer redirects. The entry decision it
 * used to make moved into the homepage's primary call to action: a guest is
 * sent to /auth, a signed-in account wherever the canonical onboarding
 * resolver sends it (DEC-L1R-D3). Each expected target is read back
 * from GET /api/v1/me/onboarding, the same resolver, so no step is hard-coded
 * twice. Protected routes keep their own guards (checked below).
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const COUNTRY = '21000000-0000-0000-0000-000000000001'

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
  // The root renders the homepage (200, no redirect); its primary CTA is the entry.
  const raw = await page.request.get('/', { maxRedirects: 0 })
  expect(raw.status()).toBe(200)
  const body = await raw.text()
  expect(body).toContain('data-screen="P0-LANDING"')
  expect(body).not.toContain('Foundation bootstrap')
  // A guest has no resolver state (401); a signed-in account's target is the resolver's.
  if (target !== '/auth') expect(await resolverTarget(page.request)).toBe(target)
  await page.goto('/')
  await expect(page).toHaveURL('/')
  const cta = page.locator('[data-cta="primary"]')
  await expect(cta).toHaveAttribute('href', target)
  await cta.click()
  await expect(page).toHaveURL(target)
}

test.describe('M0-ENTRY-01 root entry', () => {
  test('1. a guest sees the homepage and is sent to /auth; no placeholder', async ({ page }) => {
    await expectRoot(page, '/auth')
  })

  test('2–7. every onboarding state lands where the resolver says; refresh is stable', async ({
    page,
  }) => {
    const email = `root-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    await expectRoot(page, '/onboarding') // 2. INTRO (new account)

    const save = (data: Record<string, unknown>) =>
      page.request.patch('/api/v1/me/profile', { data })
    const pass = (completed: string) =>
      page.request.put('/api/v1/me/onboarding/stage', { data: { completed } })
    expect((await save({ full_name: 'Root Entry', display_name: 'Root' })).status()).toBe(200)
    await expectRoot(page, '/onboarding/profile') // 3. BASIC (a required field is missing)

    expect((await save({ country_id: COUNTRY, region_id: REGION })).status()).toBe(200)
    await expectRoot(page, '/onboarding/capability') // 4. CAPABILITY

    expect((await pass('CAPABILITY')).ok()).toBe(true)
    await expectRoot(page, '/onboarding/purpose') // 5. ROLE

    expect((await pass('ROLE')).ok()).toBe(true)
    await expectRoot(page, '/onboarding/privacy') // 5b. REVIEW

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
    // Acceptance alone completes nothing: the account stays at the review.
    await expectRoot(page, '/onboarding/privacy')

    expect((await page.request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
    await expectRoot(page, '/me') // 6. DONE

    await page.reload() // 7. refresh keeps the canonical destination
    await expect(page).toHaveURL('/me')
    await page.goto('/')
    await page.reload()
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute('href', '/me')
  })

  test('the seeded completed member goes to /me', async ({ page }) => {
    expect(
      (await page.request.post('/dev/login', { data: { email: 'member@example.test' } })).ok(),
    ).toBe(true)
    await expectRoot(page, '/me')
  })

  test('9. an invalid, revoked or expired session is a guest (CTA /auth)', async ({
    page,
    context,
  }) => {
    // Invalid token.
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: 'not-a-real-session',
        url: test.info().project.use.baseURL!,
      },
    ])
    await page.goto('/')
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute('data-entry', 'GUEST')

    // Revoked.
    await context.clearCookies()
    const email = `root-rev-${Date.now()}@example.test`
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    const [account] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [email],
    )
    await query('UPDATE user_sessions SET revoked_at = now() WHERE account_id = $1', [account!.id])
    await page.goto('/')
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute('data-entry', 'GUEST')

    // Expired.
    expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
    await query(
      `UPDATE user_sessions SET expires_at = now() - interval '1 second' WHERE account_id = $1 AND revoked_at IS NULL`,
      [account!.id],
    )
    await page.goto('/')
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute('data-entry', 'GUEST')
    await page.goto('/')
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute('href', '/auth')
    // Protected routes keep their own guard: /me still sends this visitor to /auth.
    await page.goto('/me')
    await expect(page).toHaveURL('/auth')
  })
})
