import { createHash } from 'node:crypto'
import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { DEMO_PROGRAMMES } from '../../../src/lib/programme-demo/fixtures'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF04-S06 — operating team, DISPLAY ONLY (DEC-WF04-S06-D1..D3): the
 * programme's fixture team rows, no mutation control, labels grant nothing,
 * read error + "Thử lại", S05 → S06 → (S07 not yet), IDOR / privacy, and no
 * RoleAssignment / membership / leadership / profile / project-team change.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const url = (id: string) => `/demo/programmes/${id}/setup/team`

const people: string[] = []
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
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    people,
  ])
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function person(role: { code: string; scopeType: string; scopeId: string | null }) {
  const email = `wf04-s06-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S06', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  people.push(p!.id)
  await query(
    `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [p!.id, role.code, role.scopeType, role.scopeId],
  )
  return { email, account: a!.id }
}

const storeKey = (account: string) =>
  `hub.wf04-demo.v1.${createHash('sha256').update(`wf04-demo:${account}`).digest('hex').slice(0, 16)}`

/** Row-exact fingerprints of the canonical records S06 must never touch. */
async function snapshot() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string>>(
    `SELECT ${table('role_assignments')} AS roles,
            ${table('community_memberships')} AS memberships,
            ${table('leadership_records')} AS leadership,
            ${table('project_members')} AS project_team,
            ${table('individual_profiles')} AS profiles,
            ${table('programmes')} AS programmes,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics`,
  )
  return row
}

const members = (page: Page) =>
  page
    .locator('[data-team-member]')
    .evaluateAll((els) =>
      els.map((el) => [
        el.querySelector('p')?.textContent,
        el.querySelector('[data-role]')?.textContent,
      ]),
    )

async function open(page: Page, id: string) {
  await page.goto(url(id), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
}

test.describe('WF04-S06 operating team', () => {
  test('1-4/9-13. both teams, deterministic rows, display only; S05 → S06 → back; next safe', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    await page.goto(`/demo/programmes/${PROGRAMME}/setup/registration`, {
      waitUntil: 'networkidle',
    })
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(url(PROGRAMME))
    await expect(page.locator('[data-screen="WF04-S06"]')).toBeVisible()
    await expect(page.locator('[data-setup-stepper] [aria-current="step"]')).toContainText(
      'Đội vận hành',
    )
    expect(await members(page)).toEqual([
      ['Người vận hành A (demo)', 'Người tổ chức chương trình'],
      ['Người vận hành B (demo)', 'Người tổ chức chương trình'],
    ])
    await expect(page.locator('[data-team-count]')).toHaveText('2 thành viên')
    // Display only: no control that could change a team, a role or a permission.
    const card = page.locator('[data-operating-team]')
    await expect(card.locator('button, a, input, select, textarea, form')).toHaveCount(0)
    expect(await page.locator('main').innerText()).not.toMatch(
      /mời|thêm thành viên|xoá|gỡ|phân quyền|quyền hạn|phạm vi quản lý|đăng nhập lần cuối|email|chuyển giao/i,
    )
    const next = page.locator('[data-setup-next]')
    await expect(next).toBeDisabled()
    await expect(next).toHaveAttribute('title', 'Chưa có trong phiên bản này')
    await expect(page.locator('a[href*="/setup/review"]')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    expect(await members(page)).toHaveLength(2)
    await page.locator('[data-nav="team-back"]').click()
    await expect(page).toHaveURL(`/demo/programmes/${PROGRAMME}/setup/registration`)

    await open(page, CHALLENGE)
    expect(await members(page)).toEqual([['Người vận hành C (demo)', 'Người tổ chức chương trình']])
    await expect(page.locator('[data-team-count]')).toHaveText('1 thành viên')
    expect(DEMO_PROGRAMMES.flatMap((d) => d.team)).toHaveLength(3)
    expect(await snapshot()).toEqual(before)
  })

  test('5/7/8. empty for a new draft; refresh; reset restores the fixture team', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Challenge' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Challenge chưa có đội')
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await page.goto(page.url().replace('/setup/journey', '/setup/team'), {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('[data-state="team-empty"]')).toHaveText(
      'Chưa có thành viên trong đội vận hành.',
    )
    await expect(page.locator('[data-team-count]')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="team-empty"]')).toBeVisible()

    // A session copy of the fixture with a changed team row (client state) is shown as the
    // actor's own demo data; reset restores the fixture team.
    const copy = {
      ...structuredClone(DEMO_PROGRAMMES[0]!),
      organization: { id: CHAPTER_01, slug: 'chapter-01', name: 'Chapter 01', type: 'CHAPTER' },
      demo: true,
    }
    copy.team = [copy.team[0]!]
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(LEADER_ACCOUNT),
        JSON.stringify({ version: 1, programmes: { [PROGRAMME]: copy }, created: [] }),
      ],
    )
    await open(page, PROGRAMME)
    expect(await members(page)).toHaveLength(1)
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    expect(await members(page)).toHaveLength(2)
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
  })

  test('6. error + retry: an unreadable session store shows "Thử lại"; nothing is written meanwhile', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.getItem
      Storage.prototype.getItem = function (key: string) {
        if (!(window as unknown as { __allowRead?: boolean }).__allowRead)
          throw new DOMException('denied', 'SecurityError')
        return original.call(this, key)
      }
    })
    await login(page.request, 'leader@example.test')
    await page.goto(url(PROGRAMME), { waitUntil: 'networkidle' })
    const failed = page.locator('[data-state="setup-read-failed"]')
    await expect(failed).toContainText('Trình duyệt chưa cho đọc dữ liệu demo của phiên này.')
    expect(await page.locator('main').innerText()).not.toMatch(
      /SecurityError|DOMException|sessionStorage/i,
    )
    await expect(page.locator('[data-team-member]')).toHaveCount(0)
    await page.evaluate(() => {
      ;(window as unknown as { __allowRead?: boolean }).__allowRead = true
    })
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    expect(await members(page)).toHaveLength(2)
  })
})

test.describe('WF04-S06 authorization, IDOR and privacy', () => {
  test('admin in scope; malformed / unknown 404; random ids reveal nothing', async ({ page }) => {
    await login(page.request, 'ops@example.test')
    for (const id of [PROGRAMME, CHALLENGE]) {
      expect((await page.goto(`${url(id)}?orgId=${CHAPTER_02}`))?.status()).toBe(200)
      await expect(page.locator('[data-team-member]').first()).toBeVisible()
    }
    for (const id of ['abc', 'd4000000-0000-0000-0000-000000000099'])
      expect((await page.goto(url(id)))?.status(), id).toBe(404)
    expect((await page.goto(url('7c9e6679-7425-40de-944b-e07fc1f90ae7')))?.status()).toBe(200)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    await expect(page.locator('[data-team-member]')).toHaveCount(0)
  })

  test('foreign organization, member, guest, labels and header spoofing are refused; labels grant nothing', async ({
    page,
  }) => {
    await page.goto(url(PROGRAMME))
    await expect(page).toHaveURL('/auth')
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign.email)
    for (const id of [PROGRAMME, CHALLENGE])
      expect((await page.goto(`${url(id)}?orgId=${CHAPTER_01}`))?.status(), id).toBe(404)
    for (const who of [
      'member@example.test',
      (await person({ code: 'PROGRAMME_ORGANIZER', scopeType: 'PROGRAMME', scopeId: PROGRAMME }))
        .email,
      (
        await person({
          code: 'PROGRAMME_ORGANIZER',
          scopeType: 'ORGANIZATION',
          scopeId: CHAPTER_01,
        })
      ).email,
    ]) {
      await page.context().clearCookies()
      await login(page.request, who)
      await page.setExtraHTTPHeaders({
        'x-role': 'PLATFORM_ADMIN',
        'x-organization-id': CHAPTER_01,
      })
      expect((await page.goto(url(PROGRAMME)))?.status(), who).toBe(404)
      const session = await (await page.request.get('/api/v1/session')).json()
      expect(session.capabilities, who).toEqual([])
    }
  })

  test('privacy: only the fixture team, no directory, contact or session data', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    const text = await page.locator('main').innerText()
    const directory = await query<{ display_name: string }>(
      `SELECT display_name FROM individual_profiles WHERE id IN (
         '40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003')`,
    )
    expect(directory.length).toBe(3)
    for (const { display_name } of directory) expect(text).not.toContain(display_name)
    const html = await (await page.request.get(url(PROGRAMME))).text()
    expect(html).not.toMatch(/@example\.test|30000000-|40000000-|\+84|token|password/i)
    expect(text).not.toMatch(/@|\b0\d{9}\b/)
  })
})

test.describe('WF04-S06 responsive basics', () => {
  test('768 / 390: no page overflow; rows, back and next reachable; a long role label wraps', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    // A very long display name / label in the actor's own session copy must not break the layout.
    await open(page, PROGRAMME)
    const copy = {
      ...structuredClone(DEMO_PROGRAMMES[0]!),
      organization: { id: CHAPTER_01, slug: 'chapter-01', name: 'Chapter 01', type: 'CHAPTER' },
      demo: true,
    }
    copy.team[0]!.display_name = 'Người vận hành có tên rất dài để kiểm tra bố cục hiển thị (demo)'
    ;(copy.team[1] as { role_label: string }).role_label =
      'PROGRAMME_ORGANIZER_WITH_A_VERY_LONG_LABEL_VALUE'
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(LEADER_ACCOUNT),
        JSON.stringify({ version: 1, programmes: { [PROGRAMME]: copy }, created: [] }),
      ],
    )
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page, PROGRAMME)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px page overflow`).toBe(0)
      for (const locator of [
        page.locator('[data-nav="team-back"]'),
        page.locator('[data-setup-next]'),
        page.locator('[data-team-member]').last(),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s06-${width}.png`), fullPage: true })
    }
  })
})

async function textRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
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
}

test.describe('WF04-S06 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900 populated and empty: typography; header, card, pill primitives', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const adm5 = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    await open(page, PROGRAMME)
    await settle(page)
    const typography = await assertTypography(page)
    expect(typography.violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s06-populated-1440x900.png') })
    const actual = decodePng(await page.screenshot())
    const card = (await page.locator('[data-operating-team]').boundingBox())!
    const first = (await page.locator('[data-team-member]').first().boundingBox())!
    const role = (await page.locator('[data-role]').first().boundingBox())!
    const px = Math.round(role.x)
    const py = Math.round(role.y)
    const results = compareSegments(
      adm5,
      actual,
      [
        { name: 'header-band', reference: { x: 500, y: 4, width: 600, height: 66 }, dy: 0 },
        { name: 'header-rule', reference: { x: 500, y: 72, width: 600, height: 6 }, dy: 0 },
        {
          name: 'card-top',
          reference: { x: 300, y: 95, width: 800, height: 8 },
          dx: Math.round(card.x) - 248,
          dy: Math.round(card.y) - 99,
        },
        {
          name: 'card-left',
          reference: { x: 244, y: 140, width: 10, height: 40 },
          dx: Math.round(card.x) - 248,
          dy: Math.round(first.y) + 4 - 140,
        },
        // Neutral ADM5 pill (1311 × 198) for the role label.
        {
          name: 'role-pill-cap',
          reference: { x: 1308, y: 195, width: 12, height: 28 },
          dx: px - 1311,
          dy: py - 198,
        },
      ],
      [
        ...(await textRects(page)),
        // RASTER-NOISE: ADM5 pill corners sit on half pixels (as S01).
        { x: px, y: py, width: 9, height: 7 },
        { x: px, y: py + 14, width: 9, height: 8 },
      ],
      { diffPath: resolveOutputPath('diff', 'WF04-S06.primitives.diff.png') },
    )

    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Chương trình' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Chương trình chưa có đội')
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await page.goto(page.url().replace('/setup/journey', '/setup/team'), {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('[data-state="team-empty"]')).toBeVisible()
    await settle(page)
    expect((await assertTypography(page)).violations).toEqual([])
    await page.screenshot({ path: path.join(ACTUAL, 'wf04-s06-empty-1440x900.png') })

    writeJsonReport('WF04-S06.primitives.json', {
      screen_id: 'WF04-S06',
      references: ['WF03-S05 ADM5 full (header, card, neutral pill)'],
      approved_wf04_bitmap: null,
      typography_checked: typography.checked,
      raster: 'ADM5 pill corners on half pixels (masked; straight edge and fill compared)',
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S06-D1: S03 card chrome with the WF02-S06 member row (avatar disc, name) and the neutral ADM5 pill; no WF04 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
