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
import { compareSegments, type Rect, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF04-S07 — review + publish (DEC-WF04-H5, DEC-WF04-S07-D1..D3): read-only
 * summary, the exact H5 checklist, DRAFT → PUBLISHED only in the session
 * store (atomic, idempotent), no unpublish, S06 → S07, no S08 exposure,
 * IDOR / auth, no database or audit write, responsive and primitives.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const url = (id: string) => `/demo/programmes/${id}/setup/review`
const ORG01 = { id: CHAPTER_01, slug: 'chapter-01', name: 'Chapter 01', type: 'CHAPTER' }

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
  const email = `wf04-s07-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S07', 'ACTIVE', now(), now()) RETURNING id::text`,
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

async function stored(page: Page, account = LEADER_ACCOUNT) {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), storeKey(account))
  return raw
    ? (JSON.parse(raw) as { programmes: Record<string, { programme: { status: string } }> })
    : null
}

async function inject(page: Page, programmes: Record<string, unknown>, created: string[] = []) {
  await page.evaluate(
    ([k, v]) => sessionStorage.setItem(k!, v!),
    [storeKey(LEADER_ACCOUNT), JSON.stringify({ version: 1, programmes, created })],
  )
}

async function snapshot() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string | null>>(
    `SELECT ${table('programmes')} AS programmes,
            ${table('events')} AS events,
            to_regclass('public.applications')::text AS applications_table,
            ${table('role_assignments')} AS roles,
            ${table('community_memberships')} AS memberships,
            ${table('leadership_records')} AS leadership,
            ${table('individual_profiles')} AS profiles,
            ${table('project_members')} AS project_team,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics`,
  )
  return row
}

const checks = (page: Page) =>
  page
    .locator('[data-check]')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-check'), el.getAttribute('data-ok')]),
    )
const publishButton = (page: Page) => page.locator('[data-action="publish"]')

async function open(page: Page, id: string) {
  await page.goto(url(id), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
}

test.describe('WF04-S07 review + publish', () => {
  test('1/11-15. PUBLISHED Programme: summary, complete checklist, no publish / unpublish; S06 → S07 → back', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(`/demo/programmes/${PROGRAMME}/setup/team`, { waitUntil: 'networkidle' })
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(url(PROGRAMME))
    await expect(page.locator('[data-screen="WF04-S07"]')).toBeVisible()
    await expect(page.locator('[data-setup-stepper] [aria-current="step"]')).toContainText(
      'Rà soát',
    )
    const summary = page.locator('[data-review-summary]')
    await expect(summary.locator('[data-review="basic"]')).toContainText(
      'Chương trình · Chương trình ươm tạo (demo)',
    )
    await expect(summary.locator('[data-review="basic"]')).toContainText(
      'Chapter 01 · 01/09/2026 – 15/12/2026',
    )
    await expect(summary.locator('[data-review="journey"]')).toContainText('3 giai đoạn')
    await expect(summary.locator('[data-review="events"]')).toContainText('2 sự kiện')
    await expect(summary.locator('[data-review="registration"]')).toContainText(
      'Đội · Startup · 2 câu hỏi riêng',
    )
    await expect(summary.locator('[data-review="team"]')).toContainText('2 thành viên')
    await expect(summary.locator('[data-review="problems"]')).toHaveCount(0)
    // Edit links only to built steps; no basic-info link (S08), no S08 route.
    expect(
      await page
        .locator('[data-edit]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
    ).toEqual([
      `/demo/programmes/${PROGRAMME}/setup/journey`,
      `/demo/programmes/${PROGRAMME}/setup/events`,
      `/demo/programmes/${PROGRAMME}/setup/registration`,
      `/demo/programmes/${PROGRAMME}/setup/team`,
    ])
    await expect(
      page.locator(`a[href="/demo/programmes/${PROGRAMME}"], a[href*="/setup/basic"]`),
    ).toHaveCount(0)
    expect(await checks(page)).toEqual([
      ['name', 'true'],
      ['type', 'true'],
      ['owner', 'true'],
      ['dates', 'true'],
    ])
    await expect(page.locator('[data-readiness]')).toHaveText('Sẵn sàng xuất bản')
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    await expect(publishButton(page)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /huỷ xuất bản|chuyển về nháp|đóng|lưu trữ/i }),
    ).toHaveCount(0)
    await expect(page.locator('[data-setup-next]')).toBeDisabled()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    await page.locator('[data-nav="review-back"]').click()
    await expect(page).toHaveURL(`/demo/programmes/${PROGRAMME}/setup/team`)
  })

  test('3/5-10. Challenge: ready → publish once; double click safe; refresh keeps PUBLISHED; reset restores DRAFT', async ({
    page,
  }) => {
    const before = await snapshot()
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await expect(page.locator('[data-review="problems"]')).toContainText('2 bài toán')
    expect(await checks(page)).toEqual([
      ['name', 'true'],
      ['type', 'true'],
      ['owner', 'true'],
      ['dates', 'true'],
      ['problems', 'true'],
    ])
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'ready',
    )
    await expect(publishButton(page)).toBeEnabled()
    await publishButton(page).dblclick()
    await expect(page.locator('[data-state="published-now"]')).toHaveText(
      'Đã xuất bản. Chương trình đang công khai trong bản demo.',
    )
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    await expect(page.locator('[data-demo-meta]')).toContainText('Đang công khai')
    const state = (await stored(page))!
    expect(Object.keys(state.programmes)).toEqual([CHALLENGE])
    const copy = state.programmes[CHALLENGE] as unknown as Record<string, unknown>
    expect((copy.programme as { status: string }).status).toBe('PUBLISHED')
    // Everything else is the setup as it was.
    const fixture = structuredClone(DEMO_PROGRAMMES[1]!) as unknown as Record<string, unknown>
    for (const key of [
      'stages',
      'problem_statements',
      'events',
      'team',
      'registration',
      'application_counts',
    ])
      expect(copy[key], key).toEqual(fixture[key])
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    await expect(publishButton(page)).toHaveCount(0)
    // S01 shows it published; the list is the post-publish destination (S08 not built).
    await page.locator('[data-nav="review-list"]').click()
    await expect(page).toHaveURL('/demo/programmes')
    await expect(page.locator(`[data-programme-row="${CHALLENGE}"] [data-status]`)).toHaveText(
      'Đang công khai',
    )
    // Reset: the Challenge is DRAFT again, the Programme stays PUBLISHED.
    await page.locator('[data-demo-reset="start"]').click()
    await page.locator('[data-demo-reset="confirm"]').click()
    await expect(page.locator(`[data-programme-row="${CHALLENGE}"] [data-status]`)).toHaveText(
      'Bản nháp',
    )
    await expect(page.locator(`[data-programme-row="${PROGRAMME}"] [data-status]`)).toHaveText(
      'Đang công khai',
    )
    expect((await (await page.request.get('/api/v1/session')).json()).authenticated).toBe(true)
    expect(await snapshot()).toEqual(before)
  })

  test('2/4/5. incomplete: a new Challenge without Bài toán, and a Programme with reversed dates, cannot publish', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Challenge' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Challenge cần bài toán')
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await page.goto(page.url().replace('/setup/journey', '/setup/review'), {
      waitUntil: 'networkidle',
    })
    expect(await checks(page)).toEqual([
      ['name', 'true'],
      ['type', 'true'],
      ['owner', 'true'],
      ['dates', 'true'],
      ['problems', 'false'],
    ])
    await expect(page.locator('[data-readiness]')).toHaveText('Còn thiếu 1 mục')
    await expect(publishButton(page)).toBeDisabled()
    await expect(page.locator('[data-check="problems"]')).toContainText('✗ Còn thiếu')
    const draftId = page.url().split('/')[5]!
    const before = JSON.stringify(await stored(page))
    await publishButton(page).click({ force: true })
    expect(JSON.stringify(await stored(page))).toBe(before)
    // Fix it in S03, come back, publish.
    await page.locator('[data-fix="problems"]').click()
    await expect(page).toHaveURL(`/demo/programmes/${draftId}/setup/journey`)
    await page.locator('[data-action="add-problem"]').click()
    await page.getByLabel('Tên bài toán').fill('Bài toán đầu tiên')
    await page.locator('[data-action="save-problem"]').click()
    await page.goto(url(draftId), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-readiness]')).toHaveText('Sẵn sàng xuất bản')
    await publishButton(page).click()
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )

    // A Programme DRAFT with reversed dates (tampered session copy) is blocked on "dates".
    const programme = { ...structuredClone(DEMO_PROGRAMMES[0]!), organization: ORG01, demo: true }
    programme.programme = {
      ...programme.programme,
      id: 'b1f0a9c2-0000-4000-8000-000000000701',
      status: 'DRAFT',
      ends_at: '2026-01-01T00:00:00.000Z',
    }
    await inject(page, { [programme.programme.id]: programme }, [programme.programme.id])
    await open(page, programme.programme.id)
    expect(await checks(page)).toEqual([
      ['name', 'true'],
      ['type', 'true'],
      ['owner', 'true'],
      ['dates', 'false'],
    ])
    await expect(publishButton(page)).toBeDisabled()
    await expect(page.locator('[data-fix]')).toHaveCount(0)
    expect((await stored(page))!.programmes[programme.programme.id]!.programme.status).toBe('DRAFT')
  })

  test('error: a refused write keeps DRAFT; "Thử lại" publishes once', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await publishButton(page).click()
    await expect(page.locator('[data-state="save-failed"]')).toContainText(
      'Chưa lưu được thay đổi.',
    )
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'ready',
    )
    expect(await stored(page)).toBeNull()
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    expect((await stored(page))!.programmes[CHALLENGE]!.programme.status).toBe('PUBLISHED')
  })
})

test.describe('WF04-S07 authorization and IDOR', () => {
  test('admin publishes in scope; malformed / unknown 404; random ids reveal nothing', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    expect((await page.goto(`${url(CHALLENGE)}?orgId=${CHAPTER_02}`))?.status()).toBe(200)
    await publishButton(page).click()
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    for (const id of ['abc', 'd4000000-0000-0000-0000-000000000099'])
      expect((await page.goto(url(id)))?.status(), id).toBe(404)
    expect((await page.goto(url('7c9e6679-7425-40de-944b-e07fc1f90ae7')))?.status()).toBe(200)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    await expect(publishButton(page)).toHaveCount(0)
  })

  test('foreign organization, member, guest, labels and header spoofing cannot review or publish', async ({
    page,
  }) => {
    await page.goto(url(CHALLENGE))
    await expect(page).toHaveURL('/auth')
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign.email)
    for (const id of [PROGRAMME, CHALLENGE])
      expect((await page.goto(`${url(id)}?orgId=${CHAPTER_01}`))?.status(), id).toBe(404)
    // A Chapter 01 draft planted in the foreign leader's own store is not shown or publishable.
    const planted = { ...structuredClone(DEMO_PROGRAMMES[1]!), organization: ORG01, demo: true }
    planted.programme = { ...planted.programme, id: 'b1f0a9c2-0000-4000-8000-000000000702' }
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(foreign.account),
        JSON.stringify({
          version: 1,
          programmes: { [planted.programme.id]: planted },
          created: [planted.programme.id],
        }),
      ],
    )
    await open(page, planted.programme.id)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    await expect(publishButton(page)).toHaveCount(0)
    for (const who of [
      'member@example.test',
      (await person({ code: 'PROGRAMME_ORGANIZER', scopeType: 'PROGRAMME', scopeId: CHALLENGE }))
        .email,
    ]) {
      await page.context().clearCookies()
      await login(page.request, who)
      await page.setExtraHTTPHeaders({
        'x-role': 'PLATFORM_ADMIN',
        'x-organization-id': CHAPTER_01,
      })
      expect((await page.goto(url(CHALLENGE)))?.status(), who).toBe(404)
    }
  })

  test('no contact or session data in the page or the store', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await publishButton(page).click()
    const html = await (await page.request.get(url(CHALLENGE))).text()
    expect(html).not.toMatch(/@example\.test|30000000-|40000000-/)
    expect(JSON.stringify(await stored(page))).not.toMatch(/@|token|cookie|30000000-/)
  })
})

test.describe('WF04-S07 responsive basics', () => {
  test('768 / 390: no page overflow; checklist, publish, back reachable', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page, CHALLENGE)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${width}px page overflow`).toBe(0)
      for (const locator of [
        page.locator('[data-nav="review-back"]'),
        page.locator('[data-check="problems"]'),
        publishButton(page),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s07-${width}.png`), fullPage: true })
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

test.describe('WF04-S07 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900 incomplete, ready and published: typography; header and card primitives', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    const adm5 = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    const results: SegmentResult[] = []
    let checked = 0
    const capture = async (name: string) => {
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, name).toEqual([])
      checked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s07-${name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf04-s07-${name}-full.png`),
        fullPage: true,
      })
      const actual = decodePng(await page.screenshot())
      const card = (await page.locator('[data-review-summary]').boundingBox())!
      const first = (await page.locator('[data-review="basic"]').boundingBox())!
      results.push(
        ...compareSegments(
          adm5,
          actual,
          [
            {
              name: `${name}-header-band`,
              reference: { x: 500, y: 4, width: 600, height: 66 },
              dy: 0,
            },
            {
              name: `${name}-header-rule`,
              reference: { x: 500, y: 72, width: 600, height: 6 },
              dy: 0,
            },
            {
              name: `${name}-card-top`,
              reference: { x: 300, y: 95, width: 800, height: 8 },
              dx: Math.round(card.x) - 248,
              dy: Math.round(card.y) - 99,
            },
            {
              name: `${name}-card-left`,
              reference: { x: 244, y: 140, width: 10, height: 40 },
              dx: Math.round(card.x) - 248,
              dy: Math.round(first.y) + 4 - 140,
            },
          ],
          await textRects(page),
          { diffPath: resolveOutputPath('diff', `WF04-S07.${name}.diff.png`) },
        ),
      )
    }

    // Incomplete: a new Challenge without problem statements.
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Challenge' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Challenge chưa có bài toán')
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/setup\/journey$/)
    await page.goto(page.url().replace('/setup/journey', '/setup/review'), {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'incomplete',
    )
    await capture('incomplete')

    // Ready, then published: the fixture Challenge.
    await open(page, CHALLENGE)
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'ready',
    )
    await capture('ready')
    await publishButton(page).click()
    await expect(page.locator('[data-publish-state]')).toHaveAttribute(
      'data-publish-state',
      'published',
    )
    await capture('published')

    writeJsonReport('WF04-S07.primitives.json', {
      screen_id: 'WF04-S07',
      references: ['WF03-S05 ADM5 full (header, card)'],
      approved_wf04_bitmap: null,
      typography_checked: checked,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S07-D1: S03 card chrome, WF01-S03 success ink for passed items, ADM5 pills and header buttons; the screen stays on S07 after publishing (S08 not built); no WF04 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
