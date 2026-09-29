import { expect, test } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { writeJsonReport } from '../pixel-qa/report'
import { applyVocabularyFixture, IDS, onboardThroughUi, signInFresh } from '../support/onboarding'

/**
 * WF01 four-stage onboarding — runtime health of the whole journey
 * (DEC-L1R). Nothing is tolerated here: no console error (a React hydration
 * error #418 included), no uncaught page error, no response of 400 or above,
 * no request that fails. A prefetch the browser aborts because the page moved
 * on is not a failure.
 */

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.afterAll(async () => {
  await closePool()
})

test('ACC-05 → ACC-10 → /me: console, responses and assets are clean', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const badResponses: string[] = []
  const failedRequests: string[] = []
  const assets = new Set<string>()
  let responses = 0

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('response', (r) => {
    responses++
    const path = new URL(r.url()).pathname
    if (/^\/(_next|fonts|media)\//.test(path)) assets.add(path)
    if (r.status() >= 400) badResponses.push(`${r.status()} ${r.request().method()} ${path}`)
  })
  page.on('requestfailed', (r) => {
    const reason = r.failure()?.errorText ?? ''
    if (!/ERR_ABORTED/.test(reason)) failedRequests.push(`${reason} ${r.url()}`)
  })

  await signInFresh(page.request, 'runtime')
  await page.goto('/onboarding', { waitUntil: 'networkidle' })
  await onboardThroughUi(page, 'Người Dùng Runtime')
  await page.waitForLoadState('networkidle')

  // A second pass over every stage as a server-rendered page load (refresh path).
  await page.context().clearCookies()
  await signInFresh(page.request, 'runtime-2')
  const save = await page.request.patch('/api/v1/me/profile', {
    data: {
      full_name: 'Người Dùng Runtime',
      display_name: 'Runtime',
      country_id: IDS.country,
      region_id: IDS.danang,
    },
  })
  expect(save.status()).toBe(200)
  for (const completed of ['CAPABILITY', 'ROLE']) {
    const stage = await page.request.put('/api/v1/me/onboarding/stage', { data: { completed } })
    expect(stage.status()).toBe(200)
  }
  const visited: string[] = []
  for (const route of [
    '/onboarding',
    '/onboarding/profile',
    '/onboarding/capability',
    '/onboarding/purpose',
    '/onboarding/privacy',
  ]) {
    const response = await page.goto(route, { waitUntil: 'networkidle' })
    expect(response?.status(), route).toBe(200)
    await expect(page).toHaveURL(route)
    await expect(page.locator('[data-shell="onboarding"]')).toBeVisible()
    visited.push(route)
  }

  const hydration = [...consoleErrors, ...pageErrors].filter((t) => /#418|hydrat/i.test(t))
  writeJsonReport('WF01-ONBOARDING.runtime.json', {
    routes: visited,
    responses,
    assets: assets.size,
    console_errors: consoleErrors,
    page_errors: pageErrors,
    hydration_418: hydration.length,
    responses_400_plus: badResponses,
    failed_requests: failedRequests,
  })
  expect(hydration, 'hydration errors').toEqual([])
  expect(consoleErrors, 'console errors').toEqual([])
  expect(pageErrors, 'page errors').toEqual([])
  expect(badResponses, 'responses of 400 or above').toEqual([])
  expect(failedRequests, 'failed requests').toEqual([])
  expect(assets.size).toBeGreaterThan(0)
})
