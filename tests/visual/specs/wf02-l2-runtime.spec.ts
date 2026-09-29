import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { writeJsonReport } from '../pixel-qa/report'
import { applyVocabularyFixture, completedAccount } from '../support/onboarding'

/**
 * WF02 L2 member workspace — runtime health of the owner's and the invitee's
 * journeys (DEC-L2R). Nothing is tolerated: no console error (a React
 * hydration error #418 included), no uncaught page error, no response of 400
 * or above, no request that fails. A prefetch the browser aborts because the
 * page moved on is not a failure.
 */

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.afterAll(async () => {
  await closePool()
})

type Health = {
  consoleErrors: string[]
  pageErrors: string[]
  badResponses: string[]
  failedRequests: string[]
  assets: Set<string>
  responses: number
}

function watch(page: Page, health: Health) {
  page.on('console', (m) => {
    if (m.type() === 'error') health.consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => health.pageErrors.push(e.message))
  page.on('response', (r) => {
    health.responses++
    const path = new URL(r.url()).pathname
    if (/^\/(_next|fonts|media)\//.test(path)) health.assets.add(path)
    if (r.status() >= 400) health.badResponses.push(`${r.status()} ${r.request().method()} ${path}`)
  })
  page.on('requestfailed', (r) => {
    const reason = r.failure()?.errorText ?? ''
    if (!/ERR_ABORTED/.test(reason)) health.failedRequests.push(`${reason} ${r.url()}`)
  })
}

async function visit(page: Page, route: string, visited: string[]) {
  const response = await page.goto(route, { waitUntil: 'networkidle' })
  expect(response?.status(), route).toBe(200)
  visited.push(route)
}

test('FP1-OWN → ME7 → PRJ1–PRJ3 → editor, team, settings → invitee accepts: clean', async ({
  page,
  browser,
}) => {
  const health: Health = {
    consoleErrors: [],
    pageErrors: [],
    badResponses: [],
    failedRequests: [],
    assets: new Set(),
    responses: 0,
  }
  watch(page, health)
  const visited: string[] = []

  // The invitee exists first, so the owner can invite its address.
  const other = await browser.newContext()
  const invitee = await completedAccount(other.request, 'l2-runtime-invitee', {
    display_name: 'Người Được Mời',
  })
  await other.close()

  await completedAccount(page.request, 'l2-runtime-owner', { display_name: 'Chủ Dự Án' })
  await visit(page, '/me', visited)
  await page.getByRole('button', { name: 'Sửa thông tin cơ bản' }).click()
  await expect(page.locator('dialog[open]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await visit(page, '/projects', visited)
  await expect(page.locator('[data-venture]')).toHaveCount(0)

  // PRJ1 → PRJ2 → PRJ3 through the screens.
  await visit(page, '/projects/new', visited)
  await page.getByRole('radio', { name: /Dự án \/ ý tưởng/ }).check({ force: true })
  await page.locator('#ve-name').fill('Runtime kho lạnh')
  const picker = page.locator('[aria-controls="ve-domain-list"]')
  await picker.click()
  await page.getByRole('button', { name: 'Logistics', exact: true }).click()
  await picker.click()
  await page.locator('#ve-summary').fill('Chia sẻ kho lạnh theo giờ')
  await page.getByRole('radio', { name: 'Ý tưởng', exact: true }).check({ force: true })
  await page.getByRole('button', { name: 'Tiếp tục · Mời đội ngũ' }).click()
  await expect(page).toHaveURL(/step=team/)
  const ventureId = new URL(page.url()).searchParams.get('venture')!
  await page.locator('#team-invite-email').fill(invitee.email)
  await page.getByRole('button', { name: 'Gửi lời mời' }).click()
  await expect(page.locator('[data-row-kind="PENDING_INVITATION"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Hoàn tất' }).click()
  await expect(page).toHaveURL(/step=done/)
  await page.waitForLoadState('networkidle')

  // The same screens as server-rendered loads (refresh path).
  for (const route of [
    '/projects',
    `/projects/new?venture=${ventureId}&step=team`,
    `/projects/new?venture=${ventureId}&step=done`,
    `/projects/${ventureId}/edit`,
    `/projects/${ventureId}/team`,
    '/me/settings',
    '/me',
  ])
    await visit(page, route, visited)
  await page.goto('/projects', { waitUntil: 'networkidle' })
  await expect(page.locator(`[data-venture="${ventureId}"]`)).toHaveAttribute(
    'data-status',
    'DRAFT',
  )

  // The invitee sees the invitation on ME7 and accepts it there.
  await page.context().clearCookies()
  expect((await page.request.post('/dev/login', { data: { email: invitee.email } })).ok()).toBe(
    true,
  )
  await visit(page, '/projects', visited)
  const banner = page.locator('[data-invitation]')
  await expect(banner).toHaveCount(1)
  await banner.getByRole('button', { name: 'Chấp nhận' }).click()
  await expect(page.locator(`[data-venture="${ventureId}"]`)).toBeVisible()
  await expect(page.locator('[data-invitation]')).toHaveCount(0)
  await visit(page, `/projects/${ventureId}/edit`, visited)
  await page.waitForLoadState('networkidle')

  const hydration = [...health.consoleErrors, ...health.pageErrors].filter((t) =>
    /#418|hydrat/i.test(t),
  )
  writeJsonReport('WF02-L2.runtime.json', {
    routes: visited,
    responses: health.responses,
    assets: health.assets.size,
    console_errors: health.consoleErrors,
    page_errors: health.pageErrors,
    hydration_418: hydration.length,
    responses_400_plus: health.badResponses,
    failed_requests: health.failedRequests,
  })
  expect(hydration, 'hydration errors').toEqual([])
  expect(health.consoleErrors, 'console errors').toEqual([])
  expect(health.pageErrors, 'page errors').toEqual([])
  expect(health.badResponses, 'responses of 400 or above').toEqual([])
  expect(health.failedRequests, 'failed requests').toEqual([])
  expect(health.assets.size).toBeGreaterThan(0)
})
