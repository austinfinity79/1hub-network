import path from 'node:path'

import { expect, test, type APIRequestContext } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng, writeBuffer } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-T00 — member foundation / network read model.
 *
 * GET /me/network (05 §5.1) over HTTP, the member page guard, the shell's
 * navigation classification (DEC-WF02-H9) and a SHELL-ONLY harness comparison
 * against the WF02-S03/S04/S07 references. No screen Pixel PASS is claimed.
 *
 * DEC-L2R-D1: /me is FP1-OWN in the workspace profile shell (WF02-S01 spec)
 * and /projects is ME7 (WF02-S08 spec); both keep the member page guard. The
 * member shell stays on /me/privacy, /me/roles and /me/settings, where "Hồ sơ
 * của tôi" leads to /me and "Lời mời" to /projects.
 */

const NETWORK_API = '/api/v1/me/network'
const REGION = '20000000-0000-0000-0000-000000000002'
const COUNTRY = '21000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const SHELL_ROUTES = [
  { path: '/me/privacy', active: 'Quyền riêng tư & hiển thị', ref: 'WF02-S03__privacy-visibility' },
  { path: '/me/roles', active: 'Vai trò & liên kết', ref: 'WF02-S04__roles-network-links' },
  { path: '/me/settings', active: 'Cài đặt tài khoản', ref: 'WF02-S07__account-settings' },
] as const
/** Every member page, member shell or not, guards the same way. */
const GUARDED_ROUTES = ['/me', '/projects', ...SHELL_ROUTES.map((route) => route.path)]

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 401/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

async function signIn(request: APIRequestContext, label = 't00'): Promise<string> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  return email
}

/** A member who finished WF01 through the real APIs. */
async function completedMember(request: APIRequestContext, label = 't00'): Promise<string> {
  const email = await signIn(request, label)
  const patch = await request.patch('/api/v1/me/profile', {
    data: {
      full_name: 'Đặng Kim Chi',
      display_name: 'Đặng Kim Chi',
      country_id: COUNTRY,
      headline: 'QA',
      region_id: REGION,
      domain_ids: [DOMAIN],
    },
  })
  expect(patch.status()).toBe(200)
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    const r = await request.post('/api/v1/me/consents/accept', {
      data: { consent_type: doc.type, policy_version: doc.version },
    })
    expect(r.ok()).toBe(true)
  }
  for (const completed of ['CAPABILITY', 'ROLE']) {
    const stage = await request.put('/api/v1/me/onboarding/stage', { data: { completed } })
    expect(stage.ok()).toBe(true)
  }
  expect((await request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
  return email
}

async function profileIdOf(email: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    `SELECT p.id::text FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
      WHERE a.email_normalized = $1`,
    [email],
  )
  return row!.id
}

test.describe('WF02-T00 GET /me/network', () => {
  test('1. a guest is denied with the frozen error envelope', async ({ request }) => {
    const response = await request.get(NETWORK_API)
    expect(response.status()).toBe(401)
    const body = await response.json()
    // Same envelope as every other owner endpoint (e.g. /me/profile).
    const reference = await (await request.get('/api/v1/me/profile')).json()
    expect(body.error.code).toBe(reference.error.code)
    expect(JSON.stringify(body)).not.toMatch(/membership|leadership/)
  })

  test('2. a member with no relationships gets safe empty arrays', async ({ request }) => {
    await completedMember(request)
    const response = await request.get(NETWORK_API)
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({
      memberships: [],
      leadership: [],
      roles: [],
      activity_summary: [],
    })
  })

  test('3/10/11. own records only; profile_id cannot switch owner; no private fields', async ({
    playwright,
  }) => {
    const a = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    const b = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    const emailA = await completedMember(a, 'own')
    const emailB = await completedMember(b, 'oth')
    const profileB = await profileIdOf(emailB)
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
       VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED', now())`,
      [profileB, CHAPTER_01],
    )

    // A's session asking for B's profile still gets A's (empty) network.
    for (const url of [
      `${NETWORK_API}?profile_id=${profileB}`,
      `${NETWORK_API}?view=${profileB}`,
    ]) {
      const body = await (await a.get(url)).json()
      expect(body.memberships).toEqual([])
    }
    const own = await (await b.get(NETWORK_API)).json()
    expect(own.memberships).toHaveLength(1)
    expect(own.memberships[0]).toMatchObject({
      organization: { id: CHAPTER_01, type: 'CHAPTER' },
      status: 'ACTIVE',
      source_type: 'ORGANIZATION_VERIFIED',
    })
    const json = JSON.stringify(own)
    for (const secret of [emailA, emailB, profileB]) expect(json).not.toContain(secret)
    expect(json).not.toMatch(/"(email|phone|metadata|slug|account_id|profile_id)"/)
    await a.dispose()
    await b.dispose()
  })

  test('6/7. membership and leadership do not reach the session capabilities', async ({
    request,
  }) => {
    const email = await completedMember(request)
    const profileId = await profileIdOf(email)
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED');
       `,
      [profileId, CHAPTER_01],
    )
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Chapter Leader', 'ACTIVE')`,
      [profileId, CHAPTER_01],
    )
    const network = await (await request.get(NETWORK_API)).json()
    expect(network.leadership).toHaveLength(1)
    const session = await (await request.get('/api/v1/session')).json()
    expect(session.capabilities).toEqual([])
    expect(session.managed_scopes).toEqual([])
  })
})

test.describe('WF02-T00 member page guard', () => {
  for (const route of GUARDED_ROUTES) {
    test(`${route}: guest → /auth`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL('/auth')
    })
  }

  test('an account that has not finished onboarding goes to its resolver step', async ({
    page,
  }) => {
    await signIn(page.request)
    for (const route of GUARDED_ROUTES) {
      await page.goto(route)
      await expect(page).toHaveURL('/onboarding')
    }
  })
})

test.describe('WF02-T00 member shell', () => {
  test('navigation: frozen routes are links, the rest inert, no counters', async ({ page }) => {
    await completedMember(page.request)
    await page.goto('/me/settings')

    const shell = page.locator('[data-shell="member"]')
    await expect(shell).toBeVisible()
    // Every member-shell route now has its screen; no placeholder remains.
    await expect(page.locator('[data-route-placeholder]')).toHaveCount(0)

    const sidebar = shell.getByRole('navigation', { name: 'Tài khoản của tôi' })
    const links = await sidebar
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute('href')]))
    expect(links).toEqual([
      ['Hồ sơ của tôi', '/me'],
      ['Hồ sơ cá nhân', '/me/profile/edit'],
      ['Quyền riêng tư & hiển thị', '/me/privacy'],
      ['Cài đặt tài khoản', '/me/settings'],
      ['Lời mời', '/projects'],
      ['Vai trò & liên kết', '/me/roles'],
      // PO decision (Alpha interaction gap fix): the organisations are WF02-S04's.
      ['Tổ chức của tôi', '/me/roles'],
    ])
    // PO decision: "Thư viện" in the header opens the public Library.
    await expect(
      shell.locator('header').getByRole('link', { name: 'Thư viện', exact: true }),
    ).toHaveAttribute('href', '/library')
    const inert = await shell
      .locator('[data-nav-kind="INERT"]')
      .evaluateAll((els) =>
        els.map((el) => [el.textContent, el.tagName, el.getAttribute('aria-disabled')]),
      )
    expect(inert).toEqual([
      ['Challenge', 'SPAN', 'true'],
      ['Sự kiện', 'SPAN', 'true'],
      ['', 'SPAN', 'true'],
    ])
    // No fabricated counter anywhere in the header.
    expect(await shell.locator('header').innerText()).not.toMatch(/\d/)
    await expect(shell.locator('header')).toContainText('Đặng Kim Chi')

    for (const route of SHELL_ROUTES) {
      await page.goto(route.path)
      const current = page.locator('[aria-current="page"]')
      await expect(current).toHaveCount(1)
      await expect(current).toHaveText(route.active)
    }
    // /me is no longer a member-shell screen; the sidebar leads to both workspace entries.
    for (const [name, href] of [
      ['Hồ sơ của tôi', '/me'],
      ['Lời mời', '/projects'],
    ] as const) {
      await page.goto('/me/settings')
      await sidebar.getByRole('link', { name, exact: true }).click()
      await expect(page).toHaveURL(href)
      await expect(page.locator('[data-shell="workspace"]')).toBeVisible()
      await expect(page.locator('[data-shell="member"]')).toHaveCount(0)
    }
  })

  test('shell harness QA against the WF02 references (shell regions only)', async ({ page }) => {
    await completedMember(page.request)
    const rows = []
    for (const route of SHELL_ROUTES) {
      await page.goto(route.path)
      await page.waitForFunction(() => document.fonts.status === 'loaded')
      const buffer = await page.screenshot({ animations: 'disabled' })
      const actualPath = resolveOutputPath(
        'actual',
        `WF02-T00-shell${route.path.replace(/\//g, '_')}.png`,
      )
      writeBuffer(actualPath, buffer)
      const actual = decodePng(buffer)

      const textMask: Rect[] = await page.evaluate(() => {
        const rects: { x: number; y: number; width: number; height: number }[] = []
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent!.trim()) continue
          const range = document.createRange()
          range.selectNodeContents(walker.currentNode)
          for (const r of range.getClientRects())
            rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
        }
        return rects
      })
      // Reference text boxes: glyphs differ by font migration and by the member name.
      const referenceText: Rect[] = [
        { x: 60, y: 18, width: 400, height: 24 }, // wordmark + product nav
        { x: 1236, y: 18, width: 100, height: 24 }, // member name
        { x: 60, y: 88, width: 110, height: 18 }, // eyebrow
        ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 74, y: 128 + 44 * i, width: 180, height: 26 })),
      ]
      // INTENTIONAL-P0-SCOPE: the bell's OS emoji and fabricated "2" (DEC-WF02-H9/H10).
      const bell: Rect = { x: 1196, y: 16, width: 36, height: 28 }

      const reference = readPng(
        path.join(REPO_ROOT, 'design-reference/final/WF02', `${route.ref}__1440x900.png`),
      )
      const diffPath = resolveOutputPath(
        'diff',
        `WF02-T00-shell${route.path.replace(/\//g, '_')}.diff.png`,
      )
      const results = compareSegments(
        reference,
        actual,
        [
          { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 60 }, dy: 0 },
          { name: 'sidebar', reference: { x: 0, y: 60, width: 330, height: 380 }, dy: 0 },
        ],
        [...textMask, ...referenceText, bell],
        { diffPath },
      )
      rows.push({ route: route.path, reference: route.ref, segments: results })
      for (const r of results) {
        expect(r.outside_ratio, `${route.path} ${r.name} drift`).toBeLessThan(0.002)
      }
    }
    writeJsonReport('WF02-T00.shell.json', {
      task: 'WF02-T00',
      scope: 'member shell header + sidebar only (/me/privacy, /me/roles, /me/settings)',
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          region: 'bell counter "2"',
          reason: 'DEC-WF02-H9/H10: no fabricated counter',
        },
        {
          class: 'INTENTIONAL-ICON-RENDERING',
          region: 'bell glyph',
          reason: 'deterministic SVG instead of an OS emoji',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'text glyphs masked; Be Vietnam Pro contract',
        },
        {
          class: 'INTENTIONAL-NAVIGATION',
          region: 'sidebar',
          reason:
            'DEC-L2R-D1/D8: the first item reads "Hồ sơ của tôi" and "Lời mời" is a link to /projects (text masked); /me left the member shell for FP1-OWN',
        },
      ],
      results: rows,
      product_pixel_pass_claimed: false,
    })
  })
})
