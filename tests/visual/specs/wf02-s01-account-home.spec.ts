import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { resetSeed, runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { FIXTURES, qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S01 — Account Home (/me). Production.
 * Decisions DEC-WF02-H3/H9/H10/H13, DEC-WF02-T00-D1, DEC-WF02-S01-D1..D6.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const COUNTRY = '21000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SKILL = '20000000-0000-0000-0000-000000000021'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 500 answers are the scenario under test.
    if (m.type() === 'error' && !/status of 500/.test(m.text())) consoleErrors.push(m.text())
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

type Member = { email: string; accountId: string; profileId: string }

async function signIn(request: APIRequestContext, label: string): Promise<string> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  return email
}

/** A member who finished WF01 through the real APIs: 60% (name, headline, region, bio, domain, skill). */
async function completedMember(request: APIRequestContext, label = 's01'): Promise<Member> {
  const email = await signIn(request, label)
  const patch = await request.patch('/api/v1/me/profile', {
    data: {
      full_name: 'Đặng Kim Chi',
      display_name: 'Đặng Kim Chi',
      country_id: COUNTRY,
      headline: 'Đồng sáng lập',
      region_id: REGION,
      bio: 'Giới thiệu ngắn.',
      domain_ids: [DOMAIN],
      skill_ids: [SKILL],
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
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
      WHERE a.email_normalized = $1`,
    [email],
  )
  return { email, accountId: row!.account_id, profileId: row!.profile_id }
}

async function addMembership(profileId: string, org: string, state: string) {
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
     VALUES ($1, $2, $3, $4, now())`,
    [profileId, org, state, state === 'ACTIVE' ? 'ORGANIZATION_VERIFIED' : 'SELF_DECLARED'],
  )
}

async function addVenture(profileId: string, name: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO projects (type, owner_profile_id, slug, name, summary, status, metadata)
     VALUES ('STARTUP', $1, $2, $3, 'Tóm tắt', 'DRAFT', '{"secret":"do-not-render"}') RETURNING id::text`,
    [profileId, `s01-${Date.now()}-${Math.random().toString(36).slice(2)}`, name],
  )
  return row!.id
}

const orgCard = (page: Page) => page.locator('section:has(h2:text-is("TỔ CHỨC CỦA TÔI"))')
const completionText = (page: Page) => page.locator('[data-completion]')

async function openHome(page: Page) {
  await page.goto('/me', { waitUntil: 'networkidle' })
  await expect(completionText(page)).not.toBeEmpty()
}

test.describe('WF02-S01 guards', () => {
  test('1. guest → /auth', async ({ page }) => {
    await page.goto('/me')
    await expect(page).toHaveURL('/auth')
  })

  test('2. an account that has not finished onboarding → its resolver step', async ({ page }) => {
    await signIn(page.request, 's01-new')
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding')
  })

  test('3. a completed member stays on /me inside the member shell', async ({ page }) => {
    await completedMember(page.request)
    await openHome(page)
    await expect(page).toHaveURL('/me')
    await expect(page.locator('[data-shell="member"]')).toBeVisible()
    await expect(page.locator('[aria-current="page"]')).toHaveText('Tổng quan')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tài khoản của tôi')
  })
})

test.describe('WF02-S01 functional', () => {
  test('A/C/H. partial profile, no organisation, no venture: real empty states', async ({
    page,
  }) => {
    const member = await completedMember(page.request)
    await openHome(page)

    await expect(page.getByRole('heading', { level: 2, name: 'Đặng Kim Chi' })).toBeVisible()
    await expect(page.getByText(`${member.email} · đăng nhập bằng email`)).toBeVisible()
    await expect(completionText(page)).toHaveText(
      'Hồ sơ hoàn thiện 60% · còn thiếu ảnh đại diện, kinh nghiệm, mục tiêu phát triển và nhu cầu hiện tại',
    )
    // The bar shows the server's percent.
    const server = await (await page.request.get('/api/v1/me/profile/completion')).json()
    await expect(page.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      String(server.percent),
    )
    await expect(page.getByRole('link', { name: 'Điền nốt' })).toHaveAttribute(
      'href',
      '/me/profile/edit',
    )
    await expect(orgCard(page).locator('[data-state="network-empty"]')).toHaveText(
      'Bạn chưa thuộc tổ chức hay dự án nào.',
    )
    // No fabricated pending block, public-profile button or future claims.
    const body = await page.locator('main').innerText()
    for (const banned of [
      'Đang chờ bạn',
      'ĐANG CHỜ BẠN',
      'Xem hồ sơ công khai',
      'học vấn',
      'sự kiện',
      'giải pháp',
      'ai đã xem',
      'thông báo',
      'Đổi email',
    ]) {
      expect(body, banned).not.toContain(banned)
    }
  })

  test('B. a 100% profile shows no missing list and no "Điền nốt"', async ({ page }) => {
    const member = await completedMember(page.request)
    const upload = await page.request.post('/api/v1/me/profile/avatar', {
      multipart: { file: { name: 'me.png', mimeType: 'image/png', buffer: PNG_1X1 } },
    })
    expect(upload.ok()).toBe(true)
    // Groups 8-10 have no approved input yet (DEC-WF02-H1 lands with S02): test data only.
    await query(
      `UPDATE individual_profiles SET no_experience_yet = true, development_goal = 'Mục tiêu', current_need = 'Nhu cầu' WHERE id = $1`,
      [member.profileId],
    )
    await openHome(page)
    await expect(completionText(page)).toHaveText('Hồ sơ hoàn thiện 100%')
    await expect(page.getByRole('link', { name: 'Điền nốt' })).toHaveCount(0)
    await expect(page.locator('main img')).toHaveAttribute('src', /^\/media\/assets\/asset_/)
  })

  test('D/E/F/G. ACTIVE and PENDING memberships, leadership and an owned venture', async ({
    page,
  }) => {
    const member = await completedMember(page.request)
    const venture = await addVenture(member.profileId, 'Tracely Test')
    await addMembership(member.profileId, FIXTURES.chapter01Id, 'ACTIVE')
    await addMembership(member.profileId, CHAPTER_02, 'PENDING_APPROVAL')
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Chapter Leader', 'ACTIVE')`,
      [member.profileId, FIXTURES.chapter01Id],
    )
    await openHome(page)
    // The P0-SHELL create link (DEC-P0-SHELL-D6) sits in the card head, not among the rows.
    await expect(orgCard(page).locator('[data-nav="create-project"]')).toHaveAttribute(
      'href',
      '/projects/new',
    )
    const rows = orgCard(page)
      .getByRole('link')
      .and(page.locator(':not([data-nav="create-project"])'))
    await expect(rows).toHaveCount(4)
    expect(
      await rows.evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute('href')])),
    ).toEqual([
      ['Tracely TestChủ sở hữu · startup', `/projects/${venture}/edit`],
      ['Chapter 01Thành viên · chapter', '/me/roles'],
      ['Chapter 02Đang chờ duyệt', '/me/roles'],
      ['Chapter 01Chapter Leader · chapter', '/me/roles'],
    ])
    // Membership/leadership never become a capability.
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.capabilities).toEqual([])
    expect(await page.locator('main').innerText()).not.toContain('do-not-render')
  })

  test('navigation cards link to the frozen member routes only', async ({ page }) => {
    await completedMember(page.request)
    await openHome(page)
    const cards = page.getByRole('navigation', { name: 'Tài khoản', exact: true }).getByRole('link')
    expect(
      await cards.evaluateAll((els) => els.map((el) => [el.textContent, el.getAttribute('href')])),
    ).toEqual([
      ['Sửa hồ sơ ', '/me/profile/edit'],
      ['Mở ', '/me/privacy'],
      ['Mở ', '/me/settings'],
    ])
  })

  test('I/J. refresh and logout/login keep the same canonical view', async ({ page }) => {
    const member = await completedMember(page.request)
    await addMembership(member.profileId, FIXTURES.chapter01Id, 'ACTIVE')
    await openHome(page)
    const before = await page.locator('main').innerText()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(completionText(page)).not.toBeEmpty()
    expect(await page.locator('main').innerText()).toBe(before)

    expect((await page.request.post('/api/v1/auth/logout')).ok()).toBe(true)
    await page.goto('/me')
    await expect(page).toHaveURL('/auth')
    expect((await page.request.post('/dev/login', { data: { email: member.email } })).ok()).toBe(
      true,
    )
    await openHome(page)
    expect(await page.locator('main').innerText()).toBe(before)
  })

  test('L. network API failure shows an error with retry; retry recovers', async ({ page }) => {
    const member = await completedMember(page.request)
    await addMembership(member.profileId, FIXTURES.chapter01Id, 'ACTIVE')
    await page.route('**/api/v1/me/network', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"INTERNAL_ERROR","message":"x","request_id":"r"}}',
      }),
    )
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(orgCard(page).locator('[data-state="network-failed"]')).toBeVisible()
    // The profile part is unaffected.
    await expect(completionText(page)).not.toBeEmpty()
    await page.unroute('**/api/v1/me/network')
    await orgCard(page).getByRole('button', { name: 'Thử lại' }).click()
    await expect(orgCard(page).getByRole('link')).toHaveCount(1)
  })

  test('M. profile API failure shows an error with retry; retry recovers', async ({ page }) => {
    await completedMember(page.request)
    await page.route('**/api/v1/me/profile', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"code":"INTERNAL_ERROR","message":"x","request_id":"r"}}',
      }),
    )
    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="profile-failed"]')).toBeVisible()
    await expect(orgCard(page).locator('[data-state="network-empty"]')).toBeVisible()
    await page.unroute('**/api/v1/me/profile')
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(completionText(page)).toHaveText(/^Hồ sơ hoàn thiện 60%/)
  })
})

test.describe('WF02-S01 security', () => {
  test('4/5/8. no client id controls the page; only own relations; no other member data', async ({
    playwright,
    page,
  }) => {
    const other = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL })
    const b = await completedMember(other, 's01-other')
    await addMembership(b.profileId, CHAPTER_02, 'ACTIVE')
    await addVenture(b.profileId, 'Other Venture')
    const a = await completedMember(page.request, 's01-self')

    await page.goto(`/me?profile_id=${b.profileId}&account_id=${b.accountId}`, {
      waitUntil: 'networkidle',
    })
    await expect(page.getByText(`${a.email} · đăng nhập bằng email`)).toBeVisible()
    const text = await page.locator('body').innerText()
    const html = await page.content()
    // The ids were supplied in the URL by the caller, so only rendered text is
    // checked for them; B's own data must appear nowhere.
    for (const id of [b.profileId, b.accountId]) expect(text, id).not.toContain(id)
    for (const secret of [b.email, 'Other Venture']) {
      expect(text, secret).not.toContain(secret)
      expect(html, secret).not.toContain(secret)
    }
    await expect(orgCard(page).locator('[data-state="network-empty"]')).toBeVisible()
    await other.dispose()
  })

  test('6/7/10. seeded member: no roster/bootstrap, metadata or raw rows reach the page', async ({
    page,
  }) => {
    resetSeed()
    const networkBody = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/network'))
    expect(
      (await page.request.post('/dev/login', { data: { email: 'member@example.test' } })).ok(),
    ).toBe(true)
    await page.goto('/me', { waitUntil: 'networkidle' })
    const dto = await (await networkBody).json()
    expect(Object.keys(dto).sort()).toEqual([
      'activity_summary',
      'leadership',
      'memberships',
      'roles',
    ])
    const html = await page.content()
    for (const leak of [
      'fixture-batch-01',
      'membership_bootstrap',
      'demo-startup',
      '"metadata"',
      'owner_profile_id',
      'consumed_by',
    ]) {
      expect(html, leak).not.toContain(leak)
    }
  })

  test('9. S01 is read-only: loading it writes no membership, analytics or audit rows', async ({
    page,
  }) => {
    const member = await completedMember(page.request)
    const count = async () =>
      (
        await query<{ m: number; a: number; e: number }>(
          `SELECT (SELECT count(*)::int FROM community_memberships WHERE profile_id = $1) AS m,
                  (SELECT count(*)::int FROM analytics_events WHERE account_id = $2) AS a,
                  (SELECT count(*)::int FROM audit_events WHERE actor_account_id = $2) AS e`,
          [member.profileId, member.accountId],
        )
      )[0]
    const before = await count()
    await openHome(page)
    await page.reload({ waitUntil: 'networkidle' })
    expect(await count()).toEqual(before)
  })
})

test.describe('WF02-S01 pixel QA', () => {
  test.afterAll(() => resetSeed())

  test('viewport and full-page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S01')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S01')!, {
      // Test-only state matching the reference: 60% (avatar, experience, goal
      // and need missing), one owned startup, one Chapter membership.
      beforeNavigate: async () => {
        await query(
          `UPDATE individual_profiles SET development_goal = NULL, current_need = NULL, no_experience_yet = false WHERE id = $1`,
          [FIXTURES.memberProfileId],
        )
        await query('DELETE FROM profile_experience WHERE profile_id = $1', [
          FIXTURES.memberProfileId,
        ])
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-completion]')).toHaveText(/^Hồ sơ hoàn thiện 60%/)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    expect(full.below_reference?.unexpected_pixels, 'UI below the reference height').toBe(0)

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
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
      for (const svg of document.querySelectorAll('main svg, header svg')) {
        const r = svg.getBoundingClientRect()
        rects.push({ x: r.x - 1, y: r.y - 1, width: r.width + 2, height: r.height + 2 })
      }
      return rects
    })
    // Reference text boxes (glyphs differ by font migration, fixture names and copy).
    const REF_TEXT: Rect[] = [
      { x: 60, y: 18, width: 400, height: 24 },
      { x: 1236, y: 18, width: 100, height: 24 },
      { x: 60, y: 88, width: 110, height: 18 },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 74, y: 128 + 44 * i, width: 180, height: 26 })),
      { x: 336, y: 94, width: 510, height: 66 }, // title + lede
      { x: 444, y: 212, width: 700, height: 50 }, // name + email
      { x: 362, y: 300, width: 990, height: 56 }, // completion + info line
      { x: 362, y: 422, width: 1000, height: 108 }, // nav card texts
    ]
    // INTENTIONAL-P0-SCOPE: "Xem hồ sơ công khai" (DEC-WF02-H3) and the bell.
    const OMITTED: Rect[] = [
      { x: 1160, y: 208, width: 196, height: 54 },
      { x: 1196, y: 16, width: 36, height: 28 },
    ]
    const orgTop = Math.round((await orgCard(page).boundingBox())!.y)
    const REF_ORG_TOP = 573
    const orgDy = orgTop - REF_ORG_TOP
    const REF_ORG_TEXT: Rect[] = [{ x: 888, y: 592, width: 470, height: 152 }].map((r) => ({
      ...r,
      x: r.x - 527,
      y: r.y + orgDy,
    }))

    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const segments = [
      { name: 'shell+upper', reference: { x: 0, y: 0, width: 1440, height: 562 }, dy: 0 },
      {
        name: 'org-card',
        reference: { x: 852, y: 562, width: 540, height: 238 },
        dy: orgDy,
        dx: -527,
      },
      { name: 'below', reference: { x: 0, y: 800, width: 1440, height: 100 }, dy: 0 },
    ]
    const diffPath = resolveOutputPath('diff', 'WF02-S01.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      segments,
      [...textMask, ...REF_TEXT, ...OMITTED, ...REF_ORG_TEXT],
      { diffPath },
    )
    writeJsonReport('WF02-S01.segments.json', {
      screen_id: 'WF02-S01',
      state: qaConfigFor('WF02-S01')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'TEMPORARY-PRODUCTION-DEPENDENCY',
          reference_region: { x: 340, y: 573, width: 509, height: 208 },
          reason:
            'DEC-WF02-H10: "Đang chờ bạn" omitted until canonical venture invitations exist (P12)',
        },
        {
          class: 'INTENTIONAL-COMPOSITION',
          reason:
            'DEC-WF02-S01-D1: "Tổ chức của tôi" takes the first slot of the lower row; compared with dx -527',
          vertical_effect_px: orgDy,
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: OMITTED[0],
          reason: 'DEC-WF02-H3: no public profile, button omitted',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: OMITTED[1],
          reason: 'DEC-WF02-H9/H10: bell counter omitted; SVG bell (ICON-RENDERING)',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason:
            'DEC-WF02-H13 / DEC-WF02-S01-D2: lede, completion summary, info line and card descriptions reworded; text boxes masked',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'text glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) {
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
    }
  })
})
