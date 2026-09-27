import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * P0-SHELL — integrated navigation contract (DEC-P0-SHELL-D1..D6).
 *
 * For five deterministic personas, every visible link on every reachable
 * product page is recorded (SOURCE, LABEL, TARGET, PERSONA) and requested with
 * that persona's session. The test fails on `#` / empty targets, external or
 * unknown routes, 4xx/5xx, a placeholder screen, or a protected link that
 * bounces an authorized persona to /auth. Inert shell items must be disabled
 * with a stated reason. Journeys, logout, 404s and authorization are checked
 * separately below.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const DEMO_PENDING = '40000000-0000-0000-0000-000000000005'
const ZERO = '00000000-0000-0000-0000-000000000000'

type Persona = 'guest' | 'incomplete' | 'member' | 'operator' | 'admin'
type Row = {
  persona: Persona
  source: string
  label: string
  target: string
  status: number
  final: string
  result: 'WORKING' | 'IN_PAGE' | 'DISABLED'
  reason?: string
}

const matrix: Row[] = []
let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await query(`DELETE FROM projects WHERE name LIKE 'SHELL %'`)
  if (matrix.length) writeJsonReport('P0-SHELL.navigation-matrix.json', { rows: matrix })
  await closePool()
})

async function login(page: Page, email: string) {
  expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** An owned venture of the signed-in member (created once for the crawl). */
async function ownedVenture(request: APIRequestContext) {
  const r = await request.post('/api/v1/ventures', {
    data: { type: 'PROJECT', name: `SHELL Dự án ${Date.now()}` },
  })
  expect(r.status()).toBe(201)
  return ((await r.json()) as { id: string }).id
}

/** Visits `source`, records every visible link and inert item, and checks each target. */
async function crawl(page: Page, persona: Persona, source: string) {
  const res = await page.goto(source, { waitUntil: 'networkidle' })
  expect(res?.status(), `${persona} ${source}`).toBeLessThan(400)
  await expect(page.locator('[data-route-placeholder]'), `${source} placeholder`).toHaveCount(0)
  const links = await page.locator('a[href]').evaluateAll((els) =>
    els
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      })
      .map((el) => ({
        label: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        href: el.getAttribute('href') ?? '',
      })),
  )
  for (const { label, href } of links) {
    expect(href, `${source} → "${label}" has a target`).not.toBe('')
    expect(href, `${source} → "${label}" is not a placeholder`).not.toBe('#')
    if (href.startsWith('#')) {
      await expect(page.locator(href), `${source} ${href}`).toHaveCount(1)
      matrix.push({
        persona,
        source,
        label,
        target: href,
        status: 200,
        final: href,
        result: 'IN_PAGE',
      })
      continue
    }
    expect(href.startsWith('/'), `${source} → "${label}" (${href}) is internal`).toBe(true)
    const r = await page.request.get(href)
    const body = await r.text()
    const final = new URL(r.url()).pathname
    expect(r.status(), `${persona} ${source} → ${href}`).toBeLessThan(400)
    expect(body, `${href} is not a placeholder`).not.toContain('data-route-placeholder')
    if (persona !== 'guest' && href !== '/auth')
      expect(final, `${persona}: ${href} must not bounce to /auth`).not.toBe('/auth')
    matrix.push({
      persona,
      source,
      label,
      target: href,
      status: r.status(),
      final,
      result: 'WORKING',
    })
  }
  const inert = await page.locator('[data-nav-kind="INERT"]').evaluateAll((els) =>
    els.map((el) => ({
      label: (el.textContent ?? '').trim() || (el as HTMLElement).title,
      tag: el.tagName,
      disabled: el.getAttribute('aria-disabled'),
      reason: el.getAttribute('title') ?? '',
      tabindex: el.getAttribute('tabindex'),
    })),
  )
  for (const item of inert) {
    expect(item.tag, `${source} inert "${item.label}" is not a link`).not.toBe('A')
    expect(item.disabled).toBe('true')
    expect(item.reason.length, `${source} inert "${item.label}" states a reason`).toBeGreaterThan(5)
    expect(item.tabindex).toBeNull()
    matrix.push({
      persona,
      source,
      label: item.label,
      target: '',
      status: 0,
      final: '',
      result: 'DISABLED',
      reason: item.reason,
    })
  }
}

test.describe('P0-SHELL navigation matrix', () => {
  test('guest: landing, auth and public organization pages', async ({ page }) => {
    for (const source of ['/', '/auth', '/organizations/chapter-01', '/organizations/hub-network'])
      await crawl(page, 'guest', source)
  })

  test('incomplete account: landing and its resolver step', async ({ page }) => {
    await login(page, `shell-incomplete-${Date.now()}@example.test`)
    for (const source of ['/', '/onboarding/purpose']) await crawl(page, 'incomplete', source)
  })

  test('completed member: landing, member area, project and team', async ({ page }) => {
    await login(page, 'member@example.test')
    const venture = await ownedVenture(page.request)
    for (const source of [
      '/',
      '/me',
      '/me/profile/edit',
      '/me/privacy',
      '/me/roles',
      '/me/settings',
      '/projects/new',
      `/projects/${venture}/edit`,
      `/projects/${venture}/team`,
      // WF05 (DEC-WF05-G2): the Project / Startup demo list.
      '/demo/projects',
    ])
      await crawl(page, 'member', source)
  })

  test('community operator: member area, ops for Chapter 01, public page', async ({ page }) => {
    await login(page, 'leader@example.test')
    for (const source of [
      '/me',
      '/ops/network',
      `/ops/org/${CHAPTER_01}`,
      `/ops/org/${CHAPTER_01}/members`,
      `/ops/org/${CHAPTER_01}/members/${DEMO_PENDING}`,
      `/ops/org/${CHAPTER_01}/profile`,
      `/ops/org/${CHAPTER_01}/events`,
      `/ops/org/${CHAPTER_01}/settings`,
      // WF04 (DEC-WF04-H2): the Programme demo list and its create form.
      '/demo/programmes',
      '/demo/programmes/new',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/basic',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/basic',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/journey',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/journey',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/events',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/events',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/registration',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/registration',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/team',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/team',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/review',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/review',
    ])
      await crawl(page, 'operator', source)
  })

  test('platform admin: network and HUB context', async ({ page }) => {
    await login(page, 'ops@example.test')
    for (const source of [
      '/ops/network',
      `/ops/org/${HUB}`,
      `/ops/org/${HUB}/settings`,
      '/demo/programmes',
      '/demo/programmes/new',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/basic',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/basic',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/journey',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/journey',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/events',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/events',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/registration',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/registration',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/team',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/team',
      '/demo/programmes/d4000000-0000-0000-0000-000000000001/setup/review',
      '/demo/programmes/d4000000-0000-0000-0000-000000000002/setup/review',
    ])
      await crawl(page, 'admin', source)
  })
})

test.describe('P0-SHELL journeys', () => {
  test('landing → auth → magic link → onboarding → complete → project; wordmarks lead home', async ({
    page,
  }) => {
    const email = `shell-journey-${Date.now()}@example.test`
    await page.goto('/')
    await page.locator('[data-cta="primary"]').click()
    await expect(page).toHaveURL('/auth')
    await page.locator('[data-nav="home"]').click()
    await expect(page).toHaveURL('/')
    await page.goto('/auth')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Gửi link đăng nhập' }).click()
    await expect(page).toHaveURL('/auth/check-email')
    const { token } = await requestMagicLink(email, null)
    await page.goto(`/auth/callback?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL('/onboarding/purpose')
    // The landing sends an incomplete account back through the canonical resolver.
    await page.locator('[data-nav="home"]').click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-cta="primary"]')).toHaveAttribute(
      'href',
      '/onboarding/purpose',
    )
    // Complete onboarding through the API, then S08 offers the project card.
    await page.request.put('/api/v1/me/onboarding/intent', { data: { action: 'SKIP' } })
    const region = '20000000-0000-0000-0000-000000000002'
    const domain = '20000000-0000-0000-0000-000000000011'
    expect(
      (
        await page.request.patch('/api/v1/me/profile', {
          data: {
            display_name: 'Shell Journey',
            headline: 'QA',
            region_id: region,
            domain_ids: [domain],
          },
        })
      ).status(),
    ).toBe(200)
    const { documents } = await (await page.request.get('/api/v1/legal/current')).json()
    for (const doc of documents)
      await page.request.post('/api/v1/me/consents/accept', {
        data: { consent_type: doc.type, policy_version: doc.version },
      })
    await page.goto('/onboarding/complete')
    await expect(page.locator('[data-action-card="project"]')).toBeVisible()
    await page.locator('[data-nav="create-project"]').click()
    await expect(page).toHaveURL('/projects/new')
    await page.locator('[data-nav="editor-back"]').click()
    await expect(page).toHaveURL('/me')
    await expect(page.locator('[data-nav="create-project"]')).toHaveAttribute(
      'href',
      '/projects/new',
    )
  })

  test('venture: create → editor ↔ team; editors return to /me; ownership guard', async ({
    page,
    browser,
  }) => {
    await login(page, 'member@example.test')
    const venture = await ownedVenture(page.request)
    await page.goto(`/projects/${venture}/edit`)
    await page.locator('[data-nav="venture-team"]').click()
    await expect(page).toHaveURL(`/projects/${venture}/team`)
    await page.reload()
    await page.locator('[data-nav="venture-profile"]').click()
    await expect(page).toHaveURL(`/projects/${venture}/edit`)
    await page.locator('[data-nav="editor-back"]').click()
    await expect(page).toHaveURL('/me')
    await page.goto('/me/profile/edit')
    await page.locator('[data-nav="editor-back"]').click()
    await expect(page).toHaveURL('/me')
    // Another member cannot open this venture's pages.
    const other = await browser.newContext()
    const p2 = await other.newPage()
    await login(p2, 'leader@example.test')
    for (const path of [`/projects/${venture}/edit`, `/projects/${venture}/team`])
      expect((await p2.goto(path))?.status(), path).toBe(404)
    await other.close()
  })

  test('member ↔ ops: entry only with an ops scope; ops shell leads back to /me and home', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    await page.goto('/me')
    await expect(page.locator('[data-nav="ops-entry"]')).toHaveCount(0)
    expect((await page.goto('/ops/network'))?.status()).toBe(404)

    await page.context().clearCookies()
    await login(page, 'leader@example.test')
    await page.goto('/me')
    await page.locator('[data-nav="ops-entry"]').click()
    await expect(page).toHaveURL('/ops/network')
    await page.locator(`[data-org-row="${CHAPTER_01}"] a`).first().click()
    await expect(page).toHaveURL(`/ops/org/${CHAPTER_01}`)
    for (const [key, path] of [
      ['members', '/members'],
      ['profile', '/profile'],
      ['events', '/events'],
      ['relationships', '/settings'],
      ['overview', ''],
    ] as const) {
      await page.locator(`[data-nav-key="${key}"]`).click()
      await expect(page).toHaveURL(`/ops/org/${CHAPTER_01}${path}`)
      await expect(page.locator(`[data-nav-key="${key}"]`)).toHaveAttribute('aria-current', 'page')
      await page.reload()
      await expect(page.locator(`[data-org-context="${CHAPTER_01}"]`)).toBeVisible()
    }
    // WF03-S05 unit programmes (FUTURE) are not an ops menu item; the only programmes
    // link is the WF04 demo entry (DEC-WF04-H2).
    await expect(
      page.locator('[data-shell="ops"] a[href$="/programmes"]:not([href="/demo/programmes"])'),
    ).toHaveCount(0)
    await expect(page.locator('[data-nav="programme-demo"]')).toHaveAttribute(
      'href',
      '/demo/programmes',
    )
    await page.locator('nav[aria-label="Breadcrumb"] a').click()
    await expect(page).toHaveURL('/ops/network')
    await page.locator('[data-nav="account-entry"]').click()
    await expect(page).toHaveURL('/me')
    await page.goto('/ops/network')
    await page.locator('[data-nav="home"]').click()
    await expect(page).toHaveURL('/')
  })

  test('admin switches organization context (HUB → Chapter 01)', async ({ page }) => {
    await login(page, 'ops@example.test')
    await page.goto(`/ops/org/${HUB}`)
    await expect(page.locator(`[data-org-context="${HUB}"]`)).toBeVisible()
    await page.locator('nav[aria-label="Breadcrumb"] a').click()
    await page.locator(`[data-org-row="${CHAPTER_01}"] a`).first().click()
    await expect(page).toHaveURL(`/ops/org/${CHAPTER_01}`)
    await expect(page.locator(`[data-org-context="${CHAPTER_01}"]`)).toContainText('Chapter 01')
  })
})

test.describe('P0-SHELL session, errors and authorization', () => {
  test('logout from settings clears the session; protected pages and back reject', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    await page.goto('/me')
    await page.goto('/me/settings')
    // The approved settings screen signs this browser out through "every device";
    // the current session row carries a pill, not a button.
    await page.getByRole('button', { name: 'Đăng xuất khỏi mọi thiết bị' }).click()
    await expect(page).toHaveURL(/\/auth$|\/$/)
    // The session endpoint answers a guest with 200 + authenticated=false (frozen contract).
    expect(await (await page.request.get('/api/v1/session')).json()).toMatchObject({
      authenticated: false,
    })
    for (const route of ['/me', '/me/settings', '/ops/network', '/projects/new']) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/auth')
    }
    await page.goBack()
    await page.reload()
    await expect(page.locator('[data-shell="member"]')).toHaveCount(0)
  })

  test('revoked session: protected pages go to /auth; landing treats it as a guest', async ({
    page,
  }) => {
    const email = `shell-revoke-${Date.now()}@example.test`
    await login(page, email)
    await query(
      `UPDATE user_sessions SET revoked_at = now() WHERE account_id = (SELECT id FROM user_accounts WHERE email_normalized = $1)`,
      [email],
    )
    await page.goto('/me')
    await expect(page).toHaveURL('/auth')
    await page.goto('/')
    await expect(page.locator('[data-screen="P0-LANDING"]')).toHaveAttribute('data-entry', 'GUEST')
  })

  test('404s render the shell not-found, never a raw error envelope', async ({ page }) => {
    await login(page, 'ops@example.test')
    for (const path of [
      '/does-not-exist',
      '/organizations/does-not-exist',
      `/ops/org/${ZERO}`,
      `/ops/org/${ZERO}/members`,
      `/ops/org/${CHAPTER_01}/members/${ZERO}`,
      `/projects/${ZERO}/edit`,
      `/projects/${ZERO}/team`,
    ]) {
      expect((await page.goto(path))?.status(), path).toBe(404)
      await expect(page.locator('[data-shell="not-found"]'), path).toBeVisible()
      const text = await page.locator('body').innerText()
      expect(text, path).not.toMatch(/"error"|request_id|UNCONTRACTED|SCOPE_FORBIDDEN/)
    }
  })

  test('shell navigation is not a security boundary: direct URLs are re-authorized', async ({
    page,
  }) => {
    for (const path of ['/me', '/me/roles', '/ops/network', `/ops/org/${CHAPTER_01}`])
      expect(await page.goto(path).then(() => new URL(page.url()).pathname), path).toBe('/auth')
    await login(page, 'member@example.test')
    for (const path of ['/ops/network', `/ops/org/${CHAPTER_01}`, `/ops/org/${CHAPTER_01}/events`])
      expect((await page.goto(path))?.status(), path).toBe(404)
    await page.context().clearCookies()
    await login(page, 'leader@example.test')
    for (const path of [
      `/ops/org/${CHAPTER_02}`,
      `/ops/org/${CHAPTER_02}/settings`,
      `/ops/org/${HUB}?orgId=${CHAPTER_01}`,
    ])
      expect((await page.goto(path))?.status(), path).toBe(404)
  })
})

test.describe('P0-SHELL responsive basics', () => {
  test('landing and auth entry: no overflow and reachable CTA at 768 / 390', async ({ page }) => {
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const path of ['/', '/auth']) {
        await page.goto(path)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(overflow, `${path} at ${width}px`).toBe(0)
      }
      await page.goto('/')
      await expect(page.locator('[data-cta="primary-bar"]')).toBeInViewport()
    }
  })
})
