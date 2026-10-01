import { expect, test } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import {
  LEADER,
  MEMBER,
  SEED_VENTURE,
  auditActions,
  cleanupProgrammes,
  login,
  programmeRow,
  routes,
  track,
  watchConsole,
} from '../support/programmes'

/**
 * WF04 UAT → WF04-PROD-04 — the operator journey end to end on the canonical
 * API and database (rewritten from the demo UAT journey, contract §17): a
 * leader creates a Challenge, sets its journey, problem and registration,
 * publishes it; a member reaches it through the existing WF05 apply flow; the
 * form locks once an application exists; the leader closes the Challenge and
 * it no longer accepts applications. Every step survives a refresh.
 */

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = watchConsole(page)
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await cleanupProgrammes()
  await closePool()
})

test('UAT-WF04: create → configure → publish → WF05 apply → form locked → close', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const name = `Thử thách UAT ${Date.now()}`

  // 1. The leader creates a Challenge.
  await login(page.request, LEADER)
  await page.goto(routes.list)
  await page.locator('[data-nav="programme-create"]').click()
  await page.getByRole('radio', { name: 'Challenge', exact: true }).check()
  await page.getByLabel('Tên', { exact: true }).fill(name)
  await page.getByLabel('Ngày bắt đầu').fill('2026-11-01')
  await page.getByLabel('Ngày kết thúc').fill('2026-12-15')
  await page.locator('[data-demo-save]').click()
  await expect(page).toHaveURL(/\/setup\/journey$/)
  const id = new URL(page.url()).pathname.split('/')[3]!
  track(id)

  // 2. Journey and problem statement.
  await page.locator('[data-action="add-stage"]').click()
  await page.locator('#st-name-new').fill('Ươm tạo')
  await page.locator('[data-action="save-stage"]').click()
  await expect(page.locator('[data-stage-id]')).toHaveCount(1)
  await page.locator('[data-action="add-problem"]').click()
  await page.locator('#pr-title-new').fill('Giảm hao hụt chặng cuối')
  await page.locator('[data-action="save-problem"]').click()
  await expect(page.locator('[data-problem-id]')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('[data-stage-id]')).toHaveCount(1)

  // 3. Events are read only; registration accepts STARTUP.
  await page.locator('[data-setup-next]').click()
  await expect(page.locator('[data-state="events-empty"]')).toBeVisible()
  await page.locator('[data-setup-next]').click()
  await page.locator('[data-action="configure-registration"]').click()
  await page.locator('input[name="applicant-type"][value="STARTUP"]').check()
  await page.locator('[data-action="save-registration"]').click()
  await expect(page.locator('[data-state="registration-saved"]')).toBeVisible()

  // 4. Team (empty, Q4) → review → publish.
  await page.locator('[data-setup-next]').click()
  await expect(page.locator('[data-state="team-empty"]')).toBeVisible()
  await page.locator('[data-setup-next]').click()
  await page.locator('[data-action="publish"]').click()
  await expect(page).toHaveURL(new RegExp(`${routes.detail(id)}$`))
  await expect(page.locator('[data-detail-status]')).toHaveAttribute(
    'data-detail-status',
    'PUBLISHED',
  )
  expect((await programmeRow(id))!.status).toBe('PUBLISHED')

  // 5. A member reaches it through the existing WF05 apply flow.
  await page.context().clearCookies()
  await login(page.request, MEMBER)
  const apply = await page.goto(`/programmes/${id}/apply`)
  expect(apply?.status()).toBe(200)
  await expect(page.locator('[data-screen^="L5-"]')).toBeVisible()
  const created = await page.request.post('/api/v1/applications', {
    data: { venture_id: SEED_VENTURE, programme_id: id },
  })
  expect([201, 409]).toContain(created.status())
  const [application] = await query<{ status: string }>(
    'SELECT status::text FROM applications WHERE programme_id = $1 AND venture_id = $2',
    [id, SEED_VENTURE],
  )
  expect(application!.status).toBe('DRAFT')

  // 6. The leader finds the form locked, then closes the Challenge.
  await page.context().clearCookies()
  await login(page.request, LEADER)
  await page.goto(routes.setup(id, 'registration'))
  await expect(page.locator('[data-state="registration-locked"]')).toBeVisible()
  await page.goto(routes.detail(id))
  await page.locator('[data-action="close-programme"]').click()
  await page.locator('[data-confirm="yes"]').click()
  await expect(page.locator('[data-detail-status]')).toHaveAttribute('data-detail-status', 'CLOSED')
  await page.reload()
  await expect(page.locator('[data-detail-status]')).toHaveAttribute('data-detail-status', 'CLOSED')

  // 7. Closed: no new application; the existing draft is kept, unchanged.
  await page.context().clearCookies()
  await login(page.request, MEMBER)
  expect((await page.goto(`/programmes/${id}/apply`))?.status()).toBe(404)
  const [kept] = await query<{ status: string }>(
    'SELECT status::text FROM applications WHERE programme_id = $1',
    [id],
  )
  expect(kept!.status).toBe('DRAFT')

  expect(await auditActions(id)).toEqual([
    'PROGRAMME_CREATED',
    'PROGRAMME_UPDATED',
    'PROGRAMME_UPDATED',
    'PROGRAMME_REGISTRATION_UPDATED',
    'PROGRAMME_PUBLISHED',
    'PROGRAMME_CLOSED',
  ])
})
