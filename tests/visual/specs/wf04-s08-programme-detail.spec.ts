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
 * WF04-S08 — programme detail / manage (DEC-WF04-S08-D1..D3): one page for
 * PROGRAMME and CHALLENGE, DRAFT and PUBLISHED, from the same session store;
 * summaries of the setup, manage links to built steps only, the basic
 * information edit (type and owner locked), S01 row → S08, S07 publish → S08,
 * refresh / reset, IDOR / auth, no public exposure, no database or audit
 * write, responsive and primitives.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const LEADER_ACCOUNT = '30000000-0000-0000-0000-000000000002'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')
const url = (id: string) => `/demo/programmes/${id}`
const basicUrl = (id: string) => `/demo/programmes/${id}/setup/basic`
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
  const email = `wf04-s08-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 S08', 'ACTIVE', now(), now()) RETURNING id::text`,
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

type StoredProgramme = {
  programme: {
    name: string
    summary: string | null
    status: string
    type: string
    organization_id: string
    starts_at: string | null
    ends_at: string | null
  }
}

async function stored(page: Page, account = LEADER_ACCOUNT) {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), storeKey(account))
  return raw
    ? (JSON.parse(raw) as { programmes: Record<string, StoredProgramme>; created: string[] })
    : null
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
            ${table('user_accounts')} AS accounts,
            ${table('project_members')} AS project_team,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics`,
  )
  return row
}

async function open(page: Page, id: string) {
  await page.goto(url(id), { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
}

async function reset(page: Page) {
  await page.locator('[data-demo-reset="start"]').click()
  await page.locator('[data-demo-reset="confirm"]').click()
}

const card = (page: Page, name: string) => page.locator(`[data-detail="${name}"]`)
const overview = (page: Page, key: string) =>
  page.locator(`[data-overview="${key}"] p:last-of-type`)
const items = (page: Page, name: string) => card(page, name).locator('li').allInnerTexts()
const bodyLinks = (page: Page) =>
  page
    .locator('[data-screen="WF04-S08"] a')
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

/** Every visible, enabled action inside the page body (the OpsShell is covered by P0-SHELL). */
const bodyActions = (page: Page) =>
  page.locator('[data-screen="WF04-S08"]').evaluate((root) =>
    [...root.querySelectorAll('a, button')].map((el) => ({
      tag: el.tagName,
      href: el.getAttribute('href'),
      text: (el.textContent ?? '').trim(),
      inert: el.getAttribute('data-nav-kind') === 'INERT' || (el as HTMLButtonElement).disabled,
    })),
  )

test.describe('WF04-S08 detail', () => {
  test('1/4-8. PUBLISHED Programme: identity, status, overview and every summary', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    // The server render is the loading state (the session is read after hydration).
    expect(await (await page.request.get(url(PROGRAMME))).text()).toContain(
      'data-state="setup-loading"',
    )
    await open(page, PROGRAMME)
    await expect(page.locator('[data-screen="WF04-S08"]')).toBeVisible()
    await expect(page.locator('[data-setup-stepper]')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chương trình ươm tạo (demo)')
    await expect(page.locator('[data-demo-meta]')).toHaveText(
      'Chương trình · Đang công khai · Chapter 01',
    )
    await expect(page.locator('[data-demo-notice]')).toBeVisible()
    const status = page.locator('[data-detail-status]')
    await expect(status).toHaveAttribute('data-detail-status', 'PUBLISHED')
    await expect(status).toContainText('Đang công khai')
    await expect(status).toContainText('Đang công khai trong bản demo.')
    await expect(overview(page, 'type')).toHaveText('Chương trình')
    await expect(overview(page, 'owner')).toHaveText('Chapter 01')
    await expect(overview(page, 'time')).toHaveText('01/09/2026 – 15/12/2026')
    await expect(overview(page, 'summary')).toHaveText(
      'Chương trình mẫu cho Internal Alpha: đồng hành cùng các đội dự án qua ba giai đoạn.',
    )
    // 5. Journey: the stored order, with dates.
    await expect(card(page, 'journey')).toContainText('3 giai đoạn')
    expect(await items(page, 'journey')).toEqual([
      'Mở đăng ký · 01/09/2026 – 30/09/2026',
      'Ươm tạo · 01/10/2026 – 30/11/2026',
      'Ngày trình diễn · 01/12/2026 – 15/12/2026',
    ])
    // 6. Events linked to this programme only, with time and status.
    await expect(card(page, 'events')).toContainText('2 sự kiện')
    const events = await items(page, 'events')
    expect(events).toHaveLength(2)
    expect(events.join('\n')).toContain('Buổi định hướng (demo) · 03/10/2026 · 09:00–11:00')
    expect(events.join('\n')).toContain('Ngày trình diễn (demo) · 12/12/2026 · 14:00–17:00')
    expect(events.join('\n')).not.toContain('Giới thiệu bài toán')
    // 7. Registration: applicant types and question count; no application count or funnel.
    await expect(card(page, 'registration')).toContainText('Đội · Startup · 2 câu hỏi riêng')
    // 8. Team: display name and label only.
    await expect(card(page, 'team')).toContainText('2 thành viên')
    expect(await items(page, 'team')).toEqual([
      'Người vận hành A (demo) · Người tổ chức chương trình',
      'Người vận hành B (demo) · Người tổ chức chương trình',
    ])
    await expect(card(page, 'problems')).toHaveCount(0)
    const text = await page.locator('[data-screen="WF04-S08"]').innerText()
    expect(text).not.toMatch(
      /fixture|DTO|sessionStorage|mock|\bAPI\b|canonical|aggregate|Hồ sơ|đã nộp|chuyển đổi|lượt xem|điểm|Gỡ công khai|Đóng chương trình|Lưu trữ|Mở lại/i,
    )
    // PUBLISHED: review is secondary, no publish / unpublish / close / archive, no public link.
    await expect(page.locator('[data-nav="detail-review"]')).toHaveText('Rà soát')
    await expect(page.locator('[data-screen="WF04-S08"] button')).toHaveCount(1) // reset only
    expect((await bodyLinks(page)).filter((h) => !h?.startsWith('/demo/programmes'))).toEqual([])
  })

  test('2/3/9. DRAFT Challenge: status, Bài toán and a review-and-publish action', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await expect(page.locator('[data-programme-type]')).toHaveAttribute(
      'data-programme-type',
      'CHALLENGE',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thử thách đổi mới (demo)')
    await expect(page.locator('[data-demo-meta]')).toHaveText('Challenge · Bản nháp · Chapter 01')
    const status = page.locator('[data-detail-status]')
    await expect(status).toHaveAttribute('data-detail-status', 'DRAFT')
    await expect(status).toContainText('Bản nháp')
    await expect(status).toContainText('Chưa công khai. Rà soát rồi xuất bản khi đã sẵn sàng.')
    await expect(status).not.toContainText('Đang công khai')
    await expect(overview(page, 'type')).toHaveText('Challenge')
    await expect(overview(page, 'time')).toHaveText('01/11/2026 – 31/01/2027')
    await expect(card(page, 'journey')).toContainText('2 giai đoạn')
    // 9. Bài toán, in stored order.
    await expect(card(page, 'problems')).toContainText('2 bài toán')
    expect(await items(page, 'problems')).toEqual([
      'Bài toán mẫu 1: tối ưu giao hàng chặng cuối',
      'Bài toán mẫu 2: số hoá hồ sơ khách hàng',
    ])
    await expect(card(page, 'problems').locator('[data-manage]')).toHaveAttribute(
      'href',
      `/demo/programmes/${CHALLENGE}/setup/journey`,
    )
    await expect(card(page, 'events')).toContainText('1 sự kiện')
    await expect(card(page, 'events')).toContainText('Giới thiệu bài toán (demo)')
    await expect(card(page, 'events')).toContainText('Bản nháp')
    await expect(card(page, 'registration')).toContainText('Đội · Startup · 0 câu hỏi riêng')
    await expect(card(page, 'team')).toContainText('1 thành viên')
    const review = page.locator('[data-nav="detail-review"]')
    await expect(review).toHaveText('Rà soát & xuất bản')
    await expect(review).toHaveAttribute('href', `/demo/programmes/${CHALLENGE}/setup/review`)
    // No publish from here: publishing stays on S07.
    await expect(page.locator('[data-action="publish"]')).toHaveCount(0)
  })

  test('10. S01 rows → S08 for the Programme and the Challenge', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    for (const [id, name] of [
      [PROGRAMME, 'Chương trình ươm tạo (demo)'],
      [CHALLENGE, 'Thử thách đổi mới (demo)'],
    ] as const) {
      await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
      await page.locator(`[data-programme-row="${id}"]`).click()
      await expect(page).toHaveURL(url(id))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
      await page.locator('[data-nav="detail-back"]').click()
      await expect(page).toHaveURL('/demo/programmes')
    }
    // Keyboard: the row link is focusable and opens the detail.
    await page.locator(`[data-programme-row="${CHALLENGE}"] a`).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(url(CHALLENGE))
  })

  test('11/13/14. S07 publish → S08 with a one-off confirmation; refresh keeps it; reset restores', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await page.locator('[data-nav="detail-review"]').click()
    await expect(page).toHaveURL(`/demo/programmes/${CHALLENGE}/setup/review`)
    await page.locator('[data-action="publish"]').click()
    await expect(page).toHaveURL(url(CHALLENGE))
    await expect(page.locator('[data-state="flash"]')).toHaveText(
      'Đã xuất bản “Thử thách đổi mới (demo)”.',
    )
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await expect(page.locator('[data-nav="detail-review"]')).toHaveText('Rà soát')
    // Setup data is kept as it was.
    await expect(card(page, 'problems')).toContainText('2 bài toán')
    // 13. Refresh: still PUBLISHED; the confirmation is gone.
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await expect(page.locator('[data-state="flash"]')).toHaveCount(0)
    // 14. Reset on the detail page: the Challenge is DRAFT again, the Programme PUBLISHED.
    await reset(page)
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'DRAFT',
    )
    expect(await stored(page)).toBeNull()
    await open(page, PROGRAMME)
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
  })

  test('12/16. every action is real: manage links open their built step; no dead or inert control', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const id of [PROGRAMME, CHALLENGE]) {
      await open(page, id)
      const actions = await bodyActions(page)
      expect(
        actions.filter((a) => a.inert),
        'inert controls',
      ).toEqual([])
      expect(actions.filter((a) => a.tag === 'A' && (!a.href || a.href === '#'))).toEqual([])
      expect(actions.filter((a) => a.tag === 'BUTTON').map((a) => a.text)).toEqual(['Đặt lại demo'])
      const hrefs = await bodyLinks(page)
      expect(new Set(hrefs)).toEqual(
        new Set([
          '/demo/programmes',
          ...['review', 'basic', 'journey', 'events', 'registration', 'team'].map(
            (step) => `/demo/programmes/${id}/setup/${step}`,
          ),
        ]),
      )
      for (const href of hrefs) expect((await page.request.get(href!)).status(), href!).toBe(200)
    }
    // Each manage link lands on its screen; back / "Tiếp theo" chains stay inside built routes.
    const screens: Record<string, string> = {
      basic: 'WF04-S08-BASIC',
      journey: 'WF04-S03',
      events: 'WF04-S04',
      registration: 'WF04-S05',
      team: 'WF04-S06',
    }
    for (const [step, screen] of Object.entries(screens)) {
      await open(page, PROGRAMME)
      await page.locator(`[data-manage="${step}"]`).first().click()
      await expect(page).toHaveURL(`/demo/programmes/${PROGRAMME}/setup/${step}`)
      await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible()
    }
    await open(page, PROGRAMME)
    await page.locator('[data-nav="detail-review"]').click()
    await expect(page.locator('[data-screen="WF04-S07"]')).toBeVisible()
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(url(PROGRAMME))
  })

  test('15. direct refresh on the detail and the basic edit', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    for (const target of [url(PROGRAMME), url(CHALLENGE), basicUrl(CHALLENGE)]) {
      expect((await page.goto(target, { waitUntil: 'networkidle' }))?.status(), target).toBe(200)
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.locator('[data-state="setup-loading"]')).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Đang tải…')
    }
  })

  test('17. no public exposure: no /programmes page; guests are sent to sign in', async ({
    page,
  }) => {
    for (const target of [
      '/programmes',
      '/programmes/chuong-trinh-uom-tao-demo',
      `/programmes/${PROGRAMME}`,
      '/programmes/thu-thach-doi-moi-demo',
    ])
      expect((await page.request.get(target)).status(), target).toBe(404)
    for (const target of [url(PROGRAMME), url(CHALLENGE), basicUrl(PROGRAMME)]) {
      await page.goto(target)
      await expect(page).toHaveURL('/auth')
    }
    // The public landing links to no demo page.
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('a[href^="/demo"], a[href^="/programmes"]')).toHaveCount(0)
    // The published detail carries no public URL.
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    expect(await page.locator('[data-screen="WF04-S08"]').innerText()).not.toMatch(
      /https?:\/\/|\/programmes\/[a-z]/,
    )
  })
})

test.describe('WF04-S08 mutations from S02–S05 and S07 appear on the detail', () => {
  test('a new draft: S02 create → S03 stage → S04 event → S05 registration → S08', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes/new', { waitUntil: 'networkidle' })
    await page.getByRole('radio', { name: 'Chương trình' }).check()
    await page.getByLabel('Tên', { exact: true }).fill('Chương trình chi tiết (demo)')
    await page.getByLabel('Ngày bắt đầu').fill('2026-10-01')
    await page.getByLabel('Ngày kết thúc').fill('2026-10-31')
    await page.locator('[data-demo-save]').click()
    await expect(page).toHaveURL(/\/demo\/programmes\/[0-9a-f-]{36}\/setup\/journey$/)
    const id = page.url().split('/').at(-3)!
    await page.locator('[data-action="add-stage"]').click()
    await page.getByLabel('Tên giai đoạn').fill('Khởi động')
    await page.locator('[data-action="save-stage"]').click()
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(`/demo/programmes/${id}/setup/events`)
    await page.locator('[data-action="add-event"]').click()
    await page.getByLabel('Tên sự kiện').fill('Buổi gặp mặt (demo)')
    await page.getByLabel('Bắt đầu').fill('2026-10-10T09:00')
    await page.getByLabel('Kết thúc').fill('2026-10-10T11:00')
    await page.locator('[data-action="save-event"]').click()
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(`/demo/programmes/${id}/setup/registration`)
    await page.locator('[data-action="configure-registration"]').click()
    await page.getByLabel('Cá nhân').check()
    await page.locator('[data-action="save-registration"]').click()
    await expect(page.locator('[data-state="registration-saved"]')).toBeVisible()

    await open(page, id)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chương trình chi tiết (demo)')
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'DRAFT',
    )
    await expect(overview(page, 'time')).toHaveText('01/10/2026 – 31/10/2026')
    await expect(overview(page, 'summary')).toHaveText('—')
    expect(await items(page, 'journey')).toEqual(['Khởi động · —'])
    expect(await items(page, 'events')).toEqual([
      'Buổi gặp mặt (demo) · 10/10/2026 · 09:00–11:00 Bản nháp',
    ])
    await expect(card(page, 'registration')).toContainText('Cá nhân · 0 câu hỏi riêng')
    await expect(card(page, 'team')).toContainText('0 thành viên')
    // S07 → S08 for a created draft, then refresh, then reset removes it.
    await page.locator('[data-nav="detail-review"]').click()
    await page.locator('[data-action="publish"]').click()
    await expect(page).toHaveURL(url(id))
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await reset(page)
    await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
    await expect(page.locator('[data-detail-status]')).toHaveCount(0)
  })
})

test.describe('WF04-S08 basic information (DEC-WF04-S08-D2)', () => {
  test('type and owner are read-only; name and dates are validated; a save shows on the detail', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await page.locator('[data-manage="basic"]').click()
    await expect(page).toHaveURL(basicUrl(CHALLENGE))
    await expect(page.locator('[data-screen="WF04-S08-BASIC"]')).toBeVisible()
    await expect(page.locator('[data-setup-stepper] [aria-current="step"]')).toContainText(
      'Thông tin cơ bản',
    )
    await expect(page.locator('[data-readonly="type"]')).toHaveText('Challenge')
    await expect(page.locator('[data-readonly="owner"]')).toHaveText('Chapter 01')
    const editor = page.locator('[data-basic-editor]')
    await expect(editor.locator('input[type="radio"], select')).toHaveCount(0)
    await expect(page.getByLabel('Tên', { exact: true })).toHaveValue('Thử thách đổi mới (demo)')
    await expect(page.getByLabel('Ngày bắt đầu')).toHaveValue('2026-11-01')
    await expect(page.getByLabel('Ngày kết thúc')).toHaveValue('2027-01-31')

    // Invalid: empty name, then an end before the start; nothing is stored.
    await page.getByLabel('Tên', { exact: true }).fill('   ')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-error="name"]')).toHaveText('Trường này là bắt buộc.')
    expect(await stored(page)).toBeNull()
    await page.getByLabel('Tên', { exact: true }).fill('Thử thách đổi mới 2 (demo)')
    await page.getByLabel('Ngày kết thúc').fill('2026-10-01')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-error="dates"]')).toHaveText(
      'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
    )
    expect(await stored(page)).toBeNull()

    // A planted type / organization field in the form changes nothing.
    await page.evaluate(
      ([org]) => {
        const form = document.querySelector('[data-basic-editor]')!
        for (const [name, value] of [
          ['type', 'PROGRAMME'],
          ['organization_id', org!],
          ['status', 'PUBLISHED'],
        ]) {
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = name!
          input.value = value!
          form.append(input)
        }
      },
      [CHAPTER_02],
    )
    await page.getByLabel('Ngày kết thúc').fill('2027-02-28')
    await page.getByLabel('Tóm tắt').fill('  Bản sửa của Challenge mẫu.  ')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="basic-saved"]')).toHaveText('Đã lưu thông tin cơ bản.')
    const copy = (await stored(page))!.programmes[CHALLENGE]!.programme
    expect(copy).toMatchObject({
      name: 'Thử thách đổi mới 2 (demo)',
      type: 'CHALLENGE',
      status: 'DRAFT',
      organization_id: CHAPTER_01,
    })
    expect(copy.summary).toBe('Bản sửa của Challenge mẫu.')

    await page.locator('[data-nav="basic-back"]').click()
    await expect(page).toHaveURL(url(CHALLENGE))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thử thách đổi mới 2 (demo)')
    await expect(overview(page, 'time')).toHaveText('01/11/2026 – 28/02/2027')
    await expect(overview(page, 'summary')).toHaveText('Bản sửa của Challenge mẫu.')
    await expect(overview(page, 'type')).toHaveText('Challenge')
    // Other setup data is untouched.
    await expect(card(page, 'problems')).toContainText('2 bài toán')
    // S01 and S07 see the same copy.
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    await expect(page.locator(`[data-programme-row="${CHALLENGE}"]`)).toContainText(
      'Thử thách đổi mới 2 (demo)',
    )
    await page.goto(`/demo/programmes/${CHALLENGE}/setup/review`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-review="basic"]')).toContainText('Thử thách đổi mới 2 (demo)')
    // "Tiếp theo" on the basic step opens the journey.
    await page.goto(basicUrl(CHALLENGE), { waitUntil: 'networkidle' })
    await page.locator('[data-setup-next]').click()
    await expect(page).toHaveURL(`/demo/programmes/${CHALLENGE}/setup/journey`)
  })

  test('S07 "Sửa" on a missing date item opens the basic step, which fixes it', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/demo/programmes', { waitUntil: 'networkidle' })
    const broken = structuredClone(DEMO_PROGRAMMES[0]!) as unknown as {
      programme: { status: string; starts_at: string; ends_at: string }
    }
    broken.programme = {
      ...broken.programme,
      status: 'DRAFT',
      starts_at: '2026-12-15T02:00:00.000Z',
      ends_at: '2026-09-01T02:00:00.000Z',
    }
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(LEADER_ACCOUNT),
        JSON.stringify({
          version: 1,
          programmes: { [PROGRAMME]: { ...broken, organization: ORG01, demo: true } },
          created: [],
        }),
      ],
    )
    await page.goto(`/demo/programmes/${PROGRAMME}/setup/review`, { waitUntil: 'networkidle' })
    await page.locator('[data-fix="dates"]').click()
    await expect(page).toHaveURL(basicUrl(PROGRAMME))
    await page.getByLabel('Ngày kết thúc').fill('2026-12-31')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="basic-saved"]')).toBeVisible()
    await page.goto(`/demo/programmes/${PROGRAMME}/setup/review`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-readiness]')).toHaveText('Sẵn sàng xuất bản')
  })

  test('save error: "Thử lại" stores the edit once', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    await page.goto(basicUrl(PROGRAMME), { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      ;(window as unknown as { __restore: () => void }).__restore = () => {
        Storage.prototype.setItem = original
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError')
      }
    })
    await page.getByLabel('Tên', { exact: true }).fill('Chương trình ươm tạo 2 (demo)')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toContainText(
      'Chưa lưu được thay đổi.',
    )
    expect(await stored(page)).toBeNull()
    await page.evaluate(() => (window as unknown as { __restore: () => void }).__restore())
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-state="save-failed"]')).toHaveCount(0)
    expect((await stored(page))!.programmes[PROGRAMME]!.programme.name).toBe(
      'Chương trình ươm tạo 2 (demo)',
    )
  })
})

test.describe('WF04-S08 states', () => {
  test('error + retry: an unreadable session store shows "Thử lại"; no raw error', async ({
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
    await expect(page.locator('[data-detail-status]')).toHaveCount(0)
    await page.evaluate(() => {
      ;(window as unknown as { __allowRead?: boolean }).__allowRead = true
    })
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
  })

  test('not found: random id shows the missing state; malformed and unknown fixture ids 404', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const id of ['abc', 'd4000000-0000-0000-0000-000000000099', '../new'])
      expect((await page.request.get(url(id))).status(), id).toBe(404)
    for (const target of [
      url('7c9e6679-7425-40de-944b-e07fc1f90ae7'),
      basicUrl('7c9e6679-7425-40de-944b-e07fc1f90ae7'),
    ]) {
      expect((await page.goto(target, { waitUntil: 'networkidle' }))?.status()).toBe(200)
      await expect(page.locator('[data-state="setup-missing"]')).toContainText(
        'Không tìm thấy chương trình này trong bản demo của bạn.',
      )
      await expect(page.locator('[data-detail], [data-basic-editor]')).toHaveCount(0)
    }
  })
})

test.describe('WF04-S08 authorization and IDOR', () => {
  test('admin and leader in scope; orgId spoof is ignored', async ({ page }) => {
    for (const who of ['ops@example.test', 'leader@example.test']) {
      await page.context().clearCookies()
      await login(page.request, who)
      for (const id of [PROGRAMME, CHALLENGE]) {
        for (const target of [url(id), basicUrl(id)])
          expect((await page.goto(`${target}?orgId=${CHAPTER_02}`))?.status(), who).toBe(200)
        await open(page, id)
        await expect(overview(page, 'owner')).toHaveText('Chapter 01')
      }
    }
  })

  test('foreign organization, foreign programme, member, guest, labels and header spoofing are refused', async ({
    page,
  }) => {
    for (const target of [url(CHALLENGE), basicUrl(CHALLENGE)]) {
      await page.goto(target)
      await expect(page).toHaveURL('/auth')
    }
    const foreign = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    await login(page.request, foreign.email)
    for (const id of [PROGRAMME, CHALLENGE])
      for (const target of [url(id), basicUrl(id)])
        expect((await page.goto(`${target}?orgId=${CHAPTER_01}`))?.status(), target).toBe(404)
    // A Chapter 01 draft planted in the foreign leader's own store is not shown or editable.
    const planted = { ...structuredClone(DEMO_PROGRAMMES[1]!), organization: ORG01, demo: true }
    planted.programme = { ...planted.programme, id: 'b1f0a9c2-0000-4000-8000-000000000802' }
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
    for (const target of [url(planted.programme.id), basicUrl(planted.programme.id)]) {
      await page.goto(target, { waitUntil: 'networkidle' })
      await expect(page.locator('[data-state="setup-missing"]')).toBeVisible()
      await expect(page.locator('[data-detail], [data-basic-editor]')).toHaveCount(0)
    }
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
      for (const target of [url(CHALLENGE), basicUrl(CHALLENGE)])
        expect((await page.goto(target))?.status(), `${who} ${target}`).toBe(404)
    }
  })

  test('another account does not see the leader session copy', async ({ page, browser }) => {
    await login(page.request, 'leader@example.test')
    await open(page, CHALLENGE)
    await page.locator('[data-manage="basic"]').click()
    await page.getByLabel('Tên', { exact: true }).fill('Bản sửa riêng (demo)')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="basic-saved"]')).toBeVisible()
    const other = await browser.newContext({ baseURL: new URL(page.url()).origin })
    const admin = await other.newPage()
    await login(admin.request, 'ops@example.test')
    await admin.goto(url(CHALLENGE), { waitUntil: 'networkidle' })
    await expect(admin.getByRole('heading', { level: 1 })).toHaveText('Thử thách đổi mới (demo)')
    await other.close()
  })
})

test.describe('WF04-S08 data safety', () => {
  test('viewing, editing, publishing and resetting write nothing to the database or audit', async ({
    page,
  }) => {
    const before = await snapshot()
    expect(before!.applications_table).toBeNull()
    await login(page.request, 'leader@example.test')
    await open(page, PROGRAMME)
    await open(page, CHALLENGE)
    await page.locator('[data-manage="basic"]').click()
    await page.getByLabel('Tên', { exact: true }).fill('Thử thách an toàn (demo)')
    await page.locator('[data-action="save-basic"]').click()
    await expect(page.locator('[data-state="basic-saved"]')).toBeVisible()
    await page.goto(`/demo/programmes/${CHALLENGE}/setup/review`, { waitUntil: 'networkidle' })
    await page.locator('[data-action="publish"]').click()
    await expect(page).toHaveURL(url(CHALLENGE))
    await reset(page)
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'DRAFT',
    )
    expect(await snapshot()).toEqual(before)
  })

  test('no contact, token or session data in the page or the store', async ({ page }) => {
    await login(page.request, 'leader@example.test')
    for (const target of [url(PROGRAMME), url(CHALLENGE), basicUrl(CHALLENGE)]) {
      const html = await (await page.request.get(target)).text()
      expect(html, target).not.toMatch(/@example\.test|30000000-|40000000-|hub_session|token/)
    }
    await open(page, CHALLENGE)
    await page.locator('[data-manage="basic"]').click()
    await page.locator('[data-action="save-basic"]').click()
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/@example\.test|30000000-/)
    expect(JSON.stringify(await stored(page))).not.toMatch(/@|token|cookie|30000000-/)
  })
})

test.describe('WF04-S08 responsive basics', () => {
  test('768 / 390: cards stack, no page overflow, actions and status reachable', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const id of [PROGRAMME, CHALLENGE]) {
        await open(page, id)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(overflow, `${width}px page overflow`).toBe(0)
        // One column: every card spans the same left edge.
        const lefts = await page
          .locator('[data-detail]')
          .evaluateAll((els) => [
            ...new Set(els.map((e) => Math.round(e.getBoundingClientRect().x))),
          ])
        expect(lefts, `${width}px stacked cards`).toHaveLength(1)
        for (const locator of [
          page.locator('[data-nav="detail-back"]'),
          page.locator('[data-nav="detail-review"]'),
          page.locator('[data-detail-status]'),
          page.locator('[data-manage="team"]'),
        ]) {
          await locator.scrollIntoViewIfNeeded()
          await expect(locator).toBeInViewport()
        }
      }
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s08-${width}.png`), fullPage: true })
      await page.goto(basicUrl(CHALLENGE), { waitUntil: 'networkidle' })
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        `${width}px basic overflow`,
      ).toBe(0)
      await page.locator('[data-action="save-basic"]').scrollIntoViewIfNeeded()
      await expect(page.locator('[data-action="save-basic"]')).toBeInViewport()
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

test.describe('WF04-S08 visual QA (approved primitives; no WF04 bitmap)', () => {
  test('1440×900 Programme DRAFT / PUBLISHED and Challenge DRAFT / PUBLISHED: typography; header and card primitives', async ({
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
      await page.screenshot({ path: path.join(ACTUAL, `wf04-s08-${name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf04-s08-${name}-full.png`),
        fullPage: true,
      })
      const actual = decodePng(await page.screenshot())
      const box = (await card(page, 'overview').boundingBox())!
      const first = (await page.locator('[data-overview="type"]').boundingBox())!
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
              dx: Math.round(box.x) - 248,
              dy: Math.round(box.y) - 99,
            },
            {
              name: `${name}-card-left`,
              reference: { x: 244, y: 140, width: 10, height: 40 },
              dx: Math.round(box.x) - 248,
              dy: Math.round(first.y) + 4 - 140,
            },
          ],
          await textRects(page),
          { diffPath: resolveOutputPath('diff', `WF04-S08.${name}.diff.png`) },
        ),
      )
    }

    // Programme PUBLISHED: the fixture.
    await open(page, PROGRAMME)
    await capture('programme-published')

    // Programme DRAFT: the fixture's session copy set back to a draft.
    const draft = structuredClone(DEMO_PROGRAMMES[0]!) as unknown as {
      programme: { status: string }
    }
    draft.programme = { ...draft.programme, status: 'DRAFT' }
    await page.evaluate(
      ([k, v]) => sessionStorage.setItem(k!, v!),
      [
        storeKey(LEADER_ACCOUNT),
        JSON.stringify({
          version: 1,
          programmes: { [PROGRAMME]: { ...draft, organization: ORG01, demo: true } },
          created: [],
        }),
      ],
    )
    await open(page, PROGRAMME)
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'DRAFT',
    )
    await capture('programme-draft')
    await reset(page)

    // Challenge DRAFT, then PUBLISHED through S07.
    await open(page, CHALLENGE)
    await capture('challenge-draft')
    await page.goto(`/demo/programmes/${CHALLENGE}/setup/review`, { waitUntil: 'networkidle' })
    await page.locator('[data-action="publish"]').click()
    await expect(page).toHaveURL(url(CHALLENGE))
    await open(page, CHALLENGE)
    await expect(page.locator('[data-detail-status]')).toHaveAttribute(
      'data-detail-status',
      'PUBLISHED',
    )
    await capture('challenge-published')

    writeJsonReport('WF04-S08.primitives.json', {
      screen_id: 'WF04-S08',
      references: ['WF03-S05 ADM5 full (header, card)'],
      approved_wf04_bitmap: null,
      typography_checked: checked,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF04-H1 / S08-D1: ADM5 header and card chrome, S07 summary rows, ADM5 status pills, WF03 text actions; a two-column card grid (one column below 1024 px); no WF04 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
