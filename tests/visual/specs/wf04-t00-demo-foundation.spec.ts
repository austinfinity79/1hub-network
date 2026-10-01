import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import {
  ADMIN,
  CHAPTER_01,
  CHAPTER_02,
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

test.describe('WF04 route boundaries and the OpsShell entry (restored by WF04-PROD-04-FIX)', () => {
  test('unbuilt WF04 routes and any public programme page are the ordinary 404', async ({
    page,
  }) => {
    for (const email of [null, LEADER]) {
      await page.context().clearCookies()
      if (email) await login(page.request, email)
      for (const path of ['/programmes', `/programmes/${SEED_PROGRAMME}`]) {
        expect((await page.goto(path))?.status(), `${email ?? 'guest'} ${path}`).toBe(404)
      }
    }
    for (const path of [
      routes.setup(SEED_CHALLENGE, 'unknown'),
      `${routes.detail(SEED_CHALLENGE)}/edit`,
      `${routes.detail(SEED_CHALLENGE)}/applications`,
      '/demo/programmes/new/setup/basic',
    ]) {
      expect((await page.goto(path))?.status(), path).toBe(404)
    }
  })

  test('the entry shows in every OpsShell context, is current on WF04 pages, and never for members', async ({
    page,
  }) => {
    await login(page.request, LEADER)
    const entry = page.locator('[data-nav="programme-demo"]')
    for (const path of ['/ops/network', `/ops/org/${CHAPTER_01}`]) {
      await page.goto(path)
      await expect(entry, path).toBeVisible()
      await expect(entry, path).not.toHaveAttribute('aria-current', 'page')
    }
    for (const path of [
      routes.list,
      routes.detail(SEED_CHALLENGE),
      routes.setup(SEED_CHALLENGE, 'journey'),
    ]) {
      await page.goto(path)
      await expect(entry, path).toHaveAttribute('aria-current', 'page')
    }
    await page.context().clearCookies()
    await login(page.request, MEMBER)
    await page.goto('/me')
    await expect(entry).toHaveCount(0)
  })
})

test.describe('WF04 route × actor matrix (restored SEC-WF04-01)', () => {
  test('6 actors × every WF04 route, plain and with spoofed headers: server scope only', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const steps = ['basic', 'journey', 'events', 'registration', 'team', 'review']
    const scoped = [
      routes.detail(SEED_CHALLENGE),
      ...steps.map((s) => routes.setup(SEED_CHALLENGE, s)),
    ]
    const all = [routes.list, routes.create, ...scoped]
    const organizer = await person({
      code: 'PROGRAMME_ORGANIZER',
      scopeType: 'PLATFORM',
      scopeId: null,
    })
    const otherLeader = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    const expected: [string | null, (path: string) => number | 'auth'][] = [
      [null, () => 'auth'],
      [MEMBER, () => 404],
      [organizer, () => 404],
      [otherLeader, (path) => (scoped.includes(path) ? 404 : 200)],
      [LEADER, () => 200],
      [ADMIN, () => 200],
    ]
    for (const spoofed of [false, true]) {
      await page.setExtraHTTPHeaders(
        spoofed
          ? {
              'x-role': 'PLATFORM_ADMIN',
              'x-scope-type': 'PLATFORM',
              'x-organization-id': CHAPTER_01,
            }
          : {},
      )
      for (const [email, expect200] of expected) {
        await page.context().clearCookies()
        if (email) await login(page.request, email)
        for (const path of all) {
          const response = await page.goto(path)
          const want = expect200(path)
          const label = `${email ?? 'guest'}${spoofed ? ' (spoofed)' : ''} ${path}`
          if (want === 'auth') expect(new URL(page.url()).pathname, label).toBe('/auth')
          else expect(response?.status(), label).toBe(want)
        }
      }
    }
  })
})
