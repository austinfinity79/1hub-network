import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  ADMIN,
  CHAPTER_01,
  LEADER,
  MEMBER,
  SEED_CHALLENGE,
  SEED_PROGRAMME,
  cleanupProgrammes,
  createProgramme,
  login,
  person,
  routes,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-T00 → WF04-PROD-04 — the foundation of the production WF04 screens
 * (rewritten from the demo foundation spec, contract §15–§17): the area guard,
 * no demo frame, reset, session store or demo API, and zero runtime fixture
 * dependency. Routes stay `/demo/programmes/*` (contract Q6, DEC-W4P-D13).
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

test.describe('WF04 area guard (programme:read, server side)', () => {
  test('guest → /auth; member, PROGRAMME_ORGANIZER label and HUB_MEMBER → 404; leader and admin enter', async ({
    page,
  }) => {
    const response = await page.goto(routes.list)
    expect(new URL(page.url()).pathname).toBe('/auth')
    expect(response?.status()).toBeLessThan(400)

    const labelled = await person({
      code: 'PROGRAMME_ORGANIZER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_01,
    })
    for (const email of [MEMBER, labelled]) {
      await page.context().clearCookies()
      await login(page.request, email)
      for (const path of [routes.list, routes.create, routes.detail(SEED_PROGRAMME)]) {
        expect((await page.goto(path))?.status(), `${email} ${path}`).toBe(404)
      }
    }
    for (const email of [LEADER, ADMIN]) {
      await page.context().clearCookies()
      await login(page.request, email)
      expect((await page.goto(routes.list))?.status()).toBe(200)
      await expect(page.locator('[data-screen="WF04-S01"]')).toBeVisible()
    }
  })

  test('spoofed role headers and cookies grant nothing to a member', async ({ page }) => {
    await login(page.request, MEMBER)
    await page.context().addCookies([
      { name: 'role', value: 'PLATFORM_ADMIN', url: 'http://localhost:3972' },
      { name: 'capabilities', value: 'programme:manage', url: 'http://localhost:3972' },
    ])
    await page.setExtraHTTPHeaders({ 'x-role': 'PLATFORM_ADMIN', 'x-scope-type': 'PLATFORM' })
    expect((await page.goto(routes.list))?.status()).toBe(404)
    expect((await page.goto(routes.detail(SEED_CHALLENGE)))?.status()).toBe(404)
  })
})

test.describe('WF04 production frame (contract §16)', () => {
  test('no demo notice, reset or demo copy on any WF04 screen; nothing kept in browser storage', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const draft = await createProgramme(page.request, {
      type: 'CHALLENGE',
      name: 'Khung production',
    })
    const id = draft.programme.id
    const paths = [
      routes.list,
      routes.create,
      routes.detail(id),
      ...['basic', 'journey', 'events', 'registration', 'team', 'review'].map((s) =>
        routes.setup(id, s),
      ),
    ]
    for (const path of paths) {
      expect((await page.goto(path))?.status(), path).toBe(200)
      await expect(page.locator('[data-demo-page]').first(), path).toBeVisible()
      await expect(page.locator('[data-demo-notice]'), path).toHaveCount(0)
      await expect(page.locator('[data-demo-reset]'), path).toHaveCount(0)
      await expect(page.locator('main'), path).not.toContainText(
        /Dữ liệu demo|Đặt lại demo|bản demo/,
      )
    }
    const stored = await page.evaluate(() => ({
      session: Object.keys(sessionStorage),
      local: Object.keys(localStorage),
    }))
    expect(stored.session.filter((k) => /wf04|programme/i.test(k))).toEqual([])
    expect(stored.local.filter((k) => /wf04|programme/i.test(k))).toEqual([])
  })

  test('the OpsShell entry still leads to the list; the demo API no longer exists', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    await page.goto('/ops/network')
    await page.locator('[data-nav="programme-demo"]').click()
    await expect(page).toHaveURL(/\/demo\/programmes$/)
    for (const path of ['/api/v1/demo/programmes', `/api/v1/demo/programmes/${SEED_PROGRAMME}`]) {
      expect((await page.request.get(path)).status(), path).toBe(404)
    }
  })
})

test.describe('WF04 runtime fixture dependency = 0 (contract §15)', () => {
  test('no WF04 runtime file imports a fixture, the session store or the demo read model', () => {
    const roots = [
      'src/app/(demo)/demo/programmes',
      'src/components/programme-demo',
      'src/app/api/v1/programmes',
      'src/lib/programme',
    ]
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(ts|tsx)$/.test(name) && !/\.(test|db-test)\.ts$/.test(name)) files.push(full)
      }
    }
    for (const root of roots) walk(path.join(REPO_ROOT, root))
    expect(files.length).toBeGreaterThan(20)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(
        /programme-demo\/(fixtures|session-store|read-model|guard)['"]/,
      )
      expect(source, file).not.toMatch(/\bsessionStorage\b|\blocalStorage\b|DEMO_PROGRAMMES/)
      expect(source, file).not.toMatch(/\/api\/v1\/demo\/programmes|'\/demo\/programmes'\)/)
    }
  })
})
