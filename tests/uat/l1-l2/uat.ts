import { createHash } from 'node:crypto'

import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { applyVocabularyFixture } from '../../visual/support/onboarding'

/**
 * Shared ground for the L1 + L2 business UAT. Each journey checks three
 * layers where they apply: the screen, the API answer and the stored state.
 *
 * Every page a test opens is watched: a React hydration error (#418), any
 * response of 500 or above, an uncaught page error or a console error that is
 * not the browser's own report of an expected 4xx fails the test.
 *
 * A requirement of the UAT document that the product does not have is not
 * hidden: `gap()` records it on the test as PRODUCT GAP or DEFERRED, and the
 * test asserts what the product does instead.
 */

export type Health = {
  hydration: string[]
  serverErrors: string[]
  pageErrors: string[]
  consoleErrors: string[]
}

export const test = base.extend<{ health: Health }>({
  health: [
    async ({ page }, use) => {
      const health: Health = { hydration: [], serverErrors: [], pageErrors: [], consoleErrors: [] }
      page.on('console', (m) => {
        if (m.type() !== 'error') return
        const text = m.text()
        if (/#418|hydrat/i.test(text)) health.hydration.push(text)
        else if (!/status of 4\d\d/.test(text)) health.consoleErrors.push(text)
      })
      page.on('pageerror', (e) => health.pageErrors.push(e.message))
      page.on('response', (r) => {
        if (r.status() >= 500)
          health.serverErrors.push(`${r.status()} ${new URL(r.url()).pathname}`)
      })
      await use(health)
      expect(health, 'runtime health of the pages this journey opened').toEqual({
        hydration: [],
        serverErrors: [],
        pageErrors: [],
        consoleErrors: [],
      })
    },
    { auto: true },
  ],
})

export { expect }

/** Each spec file calls this once: the QA vocabulary before, the pool closed after. */
export function uatHooks(): void {
  test.beforeAll(async () => {
    await applyVocabularyFixture()
  })
  test.afterAll(async () => {
    await closePool()
  })
}

/** Records a UAT requirement the product does not meet as built; never a silent pass. */
export function gap(kind: 'PRODUCT GAP' | 'DEFERRED' | 'NOT APPLICABLE', text: string): void {
  test.info().annotations.push({ type: kind, description: text })
}

export const unique = (label: string) =>
  `uat-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`

/** The real sign-in: /auth → the e-mail the dev outbox holds → the one-time link. */
export async function requestLink(page: Page, email: string): Promise<string> {
  await page.goto('/auth', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click()
  await expect(page).toHaveURL('/auth/check-email')
  const res = await page.request.get(`/dev/outbox?email=${encodeURIComponent(email)}`)
  expect(res.status(), `an e-mail for ${email}`).toBe(200)
  return ((await res.json()) as { link: string }).link
}

export const tokenHash = (link: string) =>
  createHash('sha256').update(new URL(link).searchParams.get('token')!, 'utf8').digest('hex')

/** Accounts and profiles stored for one address. */
export async function identity(email: string) {
  const [row] = await query<{ accounts: number; profiles: number; account_id: string | null }>(
    `SELECT (SELECT count(*)::int FROM user_accounts WHERE email_normalized = $1) AS accounts,
            (SELECT count(*)::int FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
              WHERE a.email_normalized = $1) AS profiles,
            (SELECT id::text FROM user_accounts WHERE email_normalized = $1) AS account_id`,
    [email.toLowerCase()],
  )
  return row!
}

/** Anything above an ordinary user: roles, leadership, capabilities, managed scopes. */
export async function privilege(request: APIRequestContext, accountId: string) {
  const [row] = await query<{ roles: number; leadership: number }>(
    `SELECT (SELECT count(*)::int FROM role_assignments r JOIN individual_profiles p
               ON p.id = r.individual_profile_id
              WHERE p.account_id = $1 AND r.role_code <> 'INDIVIDUAL_USER') AS roles,
            (SELECT count(*)::int FROM leadership_records l JOIN individual_profiles p
               ON p.id = l.profile_id WHERE p.account_id = $1) AS leadership`,
    [accountId],
  )
  const session = (await (await request.get('/api/v1/session')).json()) as {
    capabilities?: unknown[]
    managed_scopes?: unknown[]
  }
  return {
    roles: row!.roles,
    leadership: row!.leadership,
    capabilities: session.capabilities ?? [],
    managed_scopes: session.managed_scopes ?? [],
    ops: (await request.get('/ops/network')).status(),
  }
}

export const NO_PRIVILEGE = {
  roles: 0,
  leadership: 0,
  capabilities: [],
  managed_scopes: [],
  ops: 404,
}
