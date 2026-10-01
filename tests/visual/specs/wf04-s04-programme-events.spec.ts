import path from 'node:path'

import { expect, test } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  ADMIN,
  LEADER,
  SEED_CHALLENGE,
  SEED_EVENT,
  cleanupProgrammes,
  createProgramme,
  expectNoOverflow,
  login,
  routes,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S04 → WF04-PROD-04 — events of a programme, READ ONLY (PO decision 2,
 * DEC-W4P-D13; rewritten from the demo events spec, contract §17): the
 * canonical events linked through `programme_id`, as the API returns them; no
 * create, edit, remove or state control; the Event lifecycle stays WF03's and
 * viewing writes nothing.
 */

const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
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

const eventsSnapshot = () =>
  query<{ n: number; at: string | null }>(
    'SELECT count(*)::int AS n, max(updated_at)::text AS at FROM events',
  )

test.describe('WF04-S04 linked events, read only', () => {
  test('the linked canonical event is listed with its time and status; no write control exists', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const before = await eventsSnapshot()
    await page.goto(routes.setup(SEED_CHALLENGE, 'events'))
    const event = page.locator(`[data-event-id="${SEED_EVENT}"]`)
    await expect(event).toContainText('Demo Draft Event')
    await expect(event).toContainText('Đà Nẵng')
    await expect(event.locator('[data-status]')).toHaveText('Bản nháp')
    await expect(page.locator('[data-event-id]')).toHaveCount(1)
    for (const control of ['add-event', 'edit', 'remove', 'save-event'])
      await expect(page.locator(`[data-action="${control}"]`)).toHaveCount(0)
    await expect(
      page.locator('[data-programme-events] input, [data-programme-events] form'),
    ).toHaveCount(0)
    expect(await eventsSnapshot()).toEqual(before)
  })

  test('a new programme has no event yet: the empty state', async ({ page }) => {
    await login(page.request, ADMIN)
    const { programme } = await createProgramme(page.request)
    await page.goto(routes.setup(programme.id, 'events'))
    await expect(page.locator('[data-state="events-empty"]')).toBeVisible()
    await expect(page.locator('[data-action="add-event"]')).toHaveCount(0)
  })

  test('S03 → S04 → S05 navigation; 768 / 390 without overflow', async ({ page }) => {
    await login(page.request, LEADER)
    await page.goto(routes.setup(SEED_CHALLENGE, 'journey'))
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(SEED_CHALLENGE, 'events')}$`))
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(SEED_CHALLENGE, 'registration')}$`))
    await page.locator('[data-nav="registration-back"]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(SEED_CHALLENGE, 'events')}$`))
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(routes.setup(SEED_CHALLENGE, 'events'))
      await expectNoOverflow(page, `${width}px`)
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s04-${width}.png`), fullPage: true })
    }
  })
})
