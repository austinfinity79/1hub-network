import path from 'node:path'

import { expect, test } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  LEADER,
  SEED_PROGRAMME,
  cleanupProgrammes,
  createProgramme,
  expectNoOverflow,
  login,
  routes,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-S06 → WF04-PROD-04 — operating team, DISPLAY ONLY (rewritten from the
 * demo team spec, contract §17). The canonical model has no programme team
 * source in v1 (contract Q4, deferred by DEC-W4P-D13): the screen shows its
 * empty state, offers no invite / role / remove control and changes no
 * RoleAssignment.
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

test.describe('WF04-S06 operating team (Q4 deferred)', () => {
  test('empty state, no control, no RoleAssignment change; back and next work', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const { programme } = await createProgramme(page.request)
    const [roles] = await query<{ n: number }>('SELECT count(*)::int AS n FROM role_assignments')
    await page.goto(routes.setup(programme.id, 'team'))
    await expect(page.locator('[data-operating-team]')).toBeVisible()
    await expect(page.locator('[data-state="team-empty"]')).toBeVisible()
    await expect(page.locator('[data-team-member]')).toHaveCount(0)
    await expect(
      page.locator('[data-operating-team] button, [data-operating-team] input'),
    ).toHaveCount(0)
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(programme.id, 'review')}$`))
    await page.goto(routes.setup(programme.id, 'team'))
    await page.locator('[data-nav="team-back"]').click()
    await expect(page).toHaveURL(new RegExp(`${routes.setup(programme.id, 'registration')}$`))
    const [after] = await query<{ n: number }>('SELECT count(*)::int AS n FROM role_assignments')
    expect(after).toEqual(roles)
  })

  test('a PUBLISHED programme shows the same empty state; 768 / 390 without overflow', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(routes.setup(SEED_PROGRAMME, 'team'))
      await expect(page.locator('[data-state="team-empty"]')).toBeVisible()
      await expectNoOverflow(page, `${width}px`)
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s06-${width}.png`), fullPage: true })
    }
  })
})
