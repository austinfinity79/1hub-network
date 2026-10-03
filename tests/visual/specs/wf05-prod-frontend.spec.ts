import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import {
  buildWf05Fixture,
  removeWf05Fixture,
  WF05_FIXTURE_EMAILS,
  type Wf05Fixture,
} from '../../../src/lib/application/testing'
import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'
import { LEADER, login, watchConsole } from '../support/programmes'

/**
 * WF05-PROD-04 — the WF05 frontend on the canonical backend (WF05 production
 * contract: RBAC / API / frontend, frontend rows; demo artifact disposition).
 * Real server, real sessions, live PostgreSQL, the deterministic WF05 fixture
 * only (no seed programme): S01 / S02 without demo artifacts, every own
 * application in every programme state, read-only closed drafts, save / reload
 * / page hide / retry, submit once, expired session and guest return paths,
 * back targets and step numbers, QuickTeam reasons, WF02 ↔ WF05 and
 * WF04 ↔ WF05 canonical identity. No 5xx, no console or hydration error.
 */

const OWNER = WF05_FIXTURE_EMAILS.owner
const EDITOR = WF05_FIXTURE_EMAILS.editor
const OTHER = WF05_FIXTURE_EMAILS.other
const SECOND_OWNER = WF05_FIXTURE_EMAILS.secondOwner
const name = (slug: string) => `WF05 fixture ${slug}`
const OPEN = name('wf05-fx-open')
const CLOSED = name('wf05-fx-closed')
const STARTUP_ONLY = name('wf05-fx-startup-only')

let fx: Wf05Fixture
let consoleErrors: string[] = []
let statuses: { url: string; status: number }[] = []
/** Responses a test fakes on purpose (a 503 to show the error state). */
const faked = new Set<string>()
/** Evidence screenshots at 1440×900 (not baselines; full pixel audit is PROD-06). */
const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(REPO_ROOT, 'tests/visual/actual/wf05-prod-04', `${name}.png`) })

test.beforeAll(async () => {
  fx = await buildWf05Fixture()
})

test.afterAll(async () => {
  await removeWf05Fixture()
  await closePool()
})

test.beforeEach(async ({ page }) => {
  consoleErrors = watchConsole(page)
  statuses = []
  faked.clear()
  page.on('response', (r) => statuses.push({ url: r.url(), status: r.status() }))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(
    consoleErrors.filter((e) => !(faked.size > 0 && /status of 503/.test(e))),
    'browser console / hydration errors',
  ).toEqual([])
  expect(
    statuses.filter((s) => s.status >= 500 && !faked.has(s.url)),
    'no 5xx',
  ).toEqual([])
})

const s01 = '/demo/projects'
const s02 = (venture: string) => `/demo/projects/${venture}`
const form = (venture: string, programme: string) =>
  `/projects/${venture}/applications/${programme}`

/** Fails the next matching request once with a 503 in the frozen envelope. */
async function failOnce(page: Page, pattern: string, method?: string) {
  let done = false
  await page.route(pattern, async (route) => {
    if (done || (method && route.request().method() !== method)) return route.fallback()
    done = true
    faked.add(route.request().url())
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'Unavailable.', request_id: 'req-fake' },
      }),
    })
  })
}

async function application(ventureId: string, programmeId: string) {
  return query<{ id: string; status: string; answers: { question_id: string; value: string }[] }>(
    `SELECT id::text, status::text, answers FROM applications
      WHERE venture_id = $1 AND programme_id = $2`,
    [ventureId, programmeId],
  )
}

const answerOf = (rows: Awaited<ReturnType<typeof application>>, question = 'q-problem') =>
  rows[0]?.answers.find((a) => a.question_id === question)?.value ?? null

const DEMO_WORDING = /Dữ liệu demo|Đặt lại demo|trong bản demo|Internal Alpha|· Demo/i

/** The page's own wording: the frame and copy, without the data rows (seed names are data). */
async function frameText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[data-programme], [data-venture]').forEach((n) => n.remove())
    return clone.textContent ?? ''
  })
}

async function revokeSessions(email: string) {
  await query(
    `UPDATE user_sessions SET revoked_at = now()
      WHERE revoked_at IS NULL
        AND account_id = (SELECT id FROM user_accounts WHERE email = $1)`,
    [email],
  )
}

test.describe('WF05-PROD-04 S01 / S02 on the real API', () => {
  test('no demo notice, reset, demo copy or demo label; the entry reads "Dự án & Startup"', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    await page.goto(s01)
    const list = page.locator('[data-screen="WF05-S01"]')
    await expect(list.locator(`[data-venture="${fx.ventures.project}"]`)).toBeVisible()
    await expect(page.locator('[data-demo-notice], [data-demo-reset]')).toHaveCount(0)
    expect(await frameText(page)).not.toMatch(DEMO_WORDING)
    const entry = page.locator('[data-nav="project-demo"]')
    await expect(entry).toHaveText('Dự án & Startup')
    await expect(entry).toHaveAttribute('aria-current', 'page')
    await shot(page, 's01-1440x900')
    await expect(list.locator('[data-section="programmes"]')).toContainText(
      'Chương trình và challenge đang nhận đơn.',
    )

    await page.goto(s02(fx.ventures.project))
    await expect(page.locator('[data-screen="WF05-S02"]')).toBeVisible()
    await expect(page.locator('[data-demo-notice], [data-demo-reset]')).toHaveCount(0)
    expect(await frameText(page)).not.toMatch(DEMO_WORDING)
  })

  test('every own application, in every programme state, with one status wording', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    await page.goto(s01)
    const line = (venture: string) =>
      page.locator(`[data-venture="${venture}"] [data-venture-applications]`)
    await expect(line(fx.ventures.project)).toContainText(`${OPEN} · Bản nháp`)
    await expect(line(fx.ventures.project)).toContainText(`${CLOSED} · Bản nháp (đã đóng)`)
    await expect(line(fx.ventures.startup)).toContainText(`${OPEN} · Đã nộp`)
    await expect(line(fx.ventures.startup)).toContainText(`${CLOSED} · Đã nộp (đã đóng)`)

    await page.goto(s02(fx.ventures.startup))
    const closed = page.locator(`[data-programme="${fx.programmes.closed}"]`)
    await expect(closed).toHaveAttribute('data-programme-status', 'CLOSED')
    await expect(closed.locator('[data-programme-closed]')).toHaveText(
      'Chương trình đã đóng nhận đơn · đơn chỉ xem được',
    )
    await expect(closed.locator('[data-application]')).toHaveText('Đã nộp')
    await closed.locator('[data-nav="application-view"]').click()
    await expect(page).toHaveURL(`${form(fx.ventures.startup, fx.programmes.closed)}/submitted`)
    await expect(page.locator('[data-screen="L5-SUB3"]')).toContainText(
      'Giảm thời gian giao hàng chặng cuối.',
    )
  })

  test('loading, then an error with a safe message and "Thử lại"; then the data', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    await failOnce(page, '**/api/v1/me/applications')
    await page.goto(s01)
    const failed = page.locator('[data-state="projects-failed"]')
    await expect(failed).toHaveText(/Chưa tải được dữ liệu\. Vui lòng thử lại\./)
    await expect(failed).not.toContainText(/INTERNAL|req-|503|\{/)
    await failed.locator('[data-action="retry"]').click()
    await expect(page.locator(`[data-venture="${fx.ventures.project}"]`)).toBeVisible()

    await failOnce(page, `**/api/v1/demo/projects/${fx.ventures.project}`)
    await page.goto(s02(fx.ventures.project))
    await expect(page.locator('[data-state="venture-failed"]')).toBeVisible()
    await expect(page.locator('h1')).toHaveText('Dự án & Startup')
    await page.locator('[data-action="retry"]').click()
    await expect(page.locator('[data-detail="overview"]')).toBeVisible()
  })

  test('an EDIT member sees the venture, no application and no application action', async ({
    page,
  }) => {
    await login(page.request, EDITOR)
    await page.goto(s01)
    const row = page.locator(`[data-venture="${fx.ventures.project}"]`)
    await expect(row).toBeVisible()
    await expect(row.locator('[data-venture-applications]')).toHaveCount(0)
    await page.goto(s02(fx.ventures.project))
    const open = page.locator(`[data-programme="${fx.programmes.open}"]`)
    await expect(open.locator('[data-ineligible="NOT_OWNER"]')).toBeVisible()
    await expect(
      page.locator(
        '[data-action="apply"], [data-nav="application-resume"], [data-nav="application-view"]',
      ),
    ).toHaveCount(0)
    const response = await page.goto(form(fx.ventures.project, fx.programmes.open))
    expect(response?.status()).toBe(404)
  })
})

test.describe('WF05-PROD-04 session and guest return', () => {
  test('a guest deep link signs in, then returns to that page', async ({ page }) => {
    const paths = [
      s01,
      s02(fx.ventures.project),
      `/programmes/${fx.programmes.open}/apply`,
      form(fx.ventures.project, fx.programmes.open),
      `${form(fx.ventures.project, fx.programmes.open)}/review`,
      `${form(fx.ventures.startup, fx.programmes.open)}/submitted`,
    ]
    for (const path of paths) {
      await page.goto(path)
      await expect(page, path).toHaveURL(`/auth?redirect=${encodeURIComponent(path)}`)
    }
    // The redirect target opens once signed in (the WF01 return-path rule reads it).
    await login(page.request, OWNER)
    await page.goto(paths[3]!)
    await expect(page.locator('[data-screen="L5-SUB1"]')).toBeVisible()
  })

  test('an expired session on S01 or on a save goes through /auth and back', async ({ page }) => {
    await login(page.request, OWNER)
    // The page renders, then its API read finds the session gone.
    await page.route('**/api/v1/demo/projects', async (route) => {
      await revokeSessions(OWNER)
      await route.fallback()
    })
    await page.goto(s01)
    await expect(page).toHaveURL(`/auth?redirect=${encodeURIComponent(s01)}`)
    await page.unrouteAll()

    await login(page.request, OWNER)
    const path = form(fx.ventures.project, fx.programmes.open)
    await page.goto(path)
    const before = answerOf(await application(fx.ventures.project, fx.programmes.open))
    await revokeSessions(OWNER)
    await page.locator('#q-q-problem').fill('Sau khi phiên hết hạn')
    await page.locator('#q-q-problem').blur()
    await expect(page).toHaveURL(new RegExp(`/auth\\?redirect=${encodeURIComponent(path)}`))
    expect(answerOf(await application(fx.ventures.project, fx.programmes.open))).toBe(before)
  })
})

test.describe('WF05-PROD-04 draft, retry, page hide and duplicates', () => {
  test('a saved draft survives reload; a failed save offers "Thử lại"; page hide flushes typing', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const path = form(fx.ventures.project, fx.programmes.open)
    await page.goto(path)
    const field = page.locator('#q-q-problem')
    const save = page.locator('[data-save-state]')

    await field.fill('Bản nháp lưu được')
    await field.blur()
    await expect(save).toHaveAttribute('data-save-state', 'idle')
    await expect(save).toContainText('Đã lưu lúc')
    await page.reload()
    await expect(field).toHaveValue('Bản nháp lưu được')

    await failOnce(page, '**/api/v1/applications/*', 'PATCH')
    await field.fill('Lưu lại sau lỗi')
    await field.blur()
    await expect(save).toHaveAttribute('data-save-state', 'failed')
    await expect(save).toHaveText('Chưa lưu được. Thử lại')
    await shot(page, 'sub1-save-failed-1440x900')
    expect(answerOf(await application(fx.ventures.project, fx.programmes.open))).toBe(
      'Bản nháp lưu được',
    )
    await save.locator('[data-action="save-retry"]').click()
    await expect(save).toHaveAttribute('data-save-state', 'idle')
    expect(answerOf(await application(fx.ventures.project, fx.programmes.open))).toBe(
      'Lưu lại sau lỗi',
    )

    // Typing never left the field, then the page goes away: flushed on page hide.
    await field.fill('Gõ rồi rời trang')
    await page.goto(s01)
    await expect
      .poll(async () => answerOf(await application(fx.ventures.project, fx.programmes.open)))
      .toBe('Gõ rồi rời trang')
    const rows = await application(fx.ventures.project, fx.programmes.open)
    expect(rows.map((r) => r.status)).toEqual(['DRAFT'])
  })

  test('the first words create the draft; another tab created it first: still one application', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    await page.goto(s02(fx.ventures.project))
    await page.locator(`[data-programme="${fx.programmes.teamOnly}"] [data-action="apply"]`).click()
    await expect(page).toHaveURL(form(fx.ventures.project, fx.programmes.teamOnly))
    expect(await application(fx.ventures.project, fx.programmes.teamOnly)).toHaveLength(0)

    // Another tab of the same owner creates the application first.
    const other = await page.request.post('/api/v1/applications', {
      data: { venture_id: fx.ventures.project, programme_id: fx.programmes.teamOnly },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    expect(other.status()).toBe(201)

    // The first character starts the first save: the existing application is adopted.
    await page.locator('#q-q-problem').pressSequentially('Từ', { delay: 30 })
    await expect
      .poll(async () => (await application(fx.ventures.project, fx.programmes.teamOnly)).length)
      .toBe(1)
    await page.locator('#q-q-problem').blur()
    await expect
      .poll(async () => answerOf(await application(fx.ventures.project, fx.programmes.teamOnly)))
      .toBe('Từ')
    const rows = await application(fx.ventures.project, fx.programmes.teamOnly)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe(((await other.json()) as { id: string }).id)
  })
})

test.describe('WF05-PROD-04 submit and read only', () => {
  test('submit once (double click), then read only from the snapshot everywhere', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const path = form(fx.ventures.project, fx.programmes.teamOnly)
    await page.goto(path)
    await page.locator('#q-q-problem').fill('Nộp một lần')
    await page.locator('#q-q-problem').blur()
    await expect(page.locator('[data-save-state]')).toHaveAttribute('data-save-state', 'idle')
    await page.goto(`${path}/review`)
    await page.locator('[data-action="submit"]').dblclick()
    await expect(page).toHaveURL(`${path}/submitted`)

    const rows = await application(fx.ventures.project, fx.programmes.teamOnly)
    expect(rows.map((r) => r.status)).toEqual(['SUBMITTED'])
    const audits = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events
        WHERE action = 'APPLICATION_SUBMITTED' AND resource_id = $1`,
      [rows[0]!.id],
    )
    expect(audits[0]!.n).toBe(1)
    await expect(page.locator('[data-screen="L5-SUB3"]')).toContainText('Nộp một lần')
    await expect(page.getByRole('link', { name: 'Về Dự án & startup của tôi' })).toHaveAttribute(
      'href',
      s01,
    )

    for (const again of [path, `${path}/review`]) {
      await page.goto(again)
      await expect(page).toHaveURL(`${path}/submitted`)
    }
    await page.goto(s02(fx.ventures.project))
    const row = page.locator(`[data-programme="${fx.programmes.teamOnly}"]`)
    await expect(row.locator('[data-application]')).toHaveText('Đã nộp')
    await expect(row.locator('[data-nav="application-view"]')).toHaveAttribute(
      'href',
      `${path}/submitted`,
    )
  })

  test('a CLOSED programme: the draft opens read only with its reason; no enabled submit', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const path = form(fx.ventures.project, fx.programmes.closed)
    const [before] = await query<{ updated_at: string }>(
      'SELECT updated_at::text FROM applications WHERE id = $1',
      [fx.applications.closedDraft],
    )
    await page.goto(s02(fx.ventures.project))
    const row = page.locator(`[data-programme="${fx.programmes.closed}"]`)
    await expect(row.locator('[data-application]')).toHaveText('Bản nháp')
    await row.scrollIntoViewIfNeeded()
    await shot(page, 's02-closed-row-1440x900')
    await row.locator('[data-nav="application-view"]').click()
    await expect(page).toHaveURL(path)

    const sub1 = page.locator('[data-screen="L5-SUB1"]')
    await expect(sub1.locator('[data-ineligible="NOT_PUBLISHED"]')).toHaveText(
      'Chương trình đã đóng nhận hồ sơ. Bản nháp chỉ xem được, không nộp được.',
    )
    await expect(page.locator('#q-q-problem')).toBeDisabled()
    await expect(page.locator('#q-q-problem')).toHaveValue('Giảm thời gian giao hàng chặng cuối.')
    await expect(sub1.locator('[data-anchor="remaining"]')).toHaveText('Chỉ xem')
    await expect(sub1.locator('[data-anchor="autosave"]')).toHaveCount(0)
    await page.locator('[data-action="next"]').click()
    await page.locator('[data-action="next"]').click()
    await expect(page.locator('[data-action="to-review"]')).toBeDisabled()
    await expect(page.locator('[data-action="save-retry"]')).toHaveCount(0)
    await shot(page, 'sub1-closed-read-only-1440x900')

    await page.goto(`${path}/review`)
    await expect(page).toHaveURL(path)
    await expect(page.locator('[data-action="submit"]')).toHaveCount(0)
    const [after] = await query<{ updated_at: string }>(
      'SELECT updated_at::text FROM applications WHERE id = $1',
      [fx.applications.closedDraft],
    )
    expect(after!.updated_at).toBe(before!.updated_at)

    // No application of this venture to the closed programme: nothing to open.
    const response = await page.goto(form(fx.ventures.archived, fx.programmes.closed))
    expect(response?.status()).toBe(404)
  })
})

test.describe('WF05-PROD-04 navigation and QuickTeam', () => {
  test('back returns where the journey started; step numbers follow the drawn order', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    await page.goto(s02(fx.ventures.project))
    await page
      .locator(`[data-programme="${fx.programmes.open}"] [data-nav="application-resume"]`)
      .click()
    await expect(page.locator('[data-nav="application-back"]')).toHaveAttribute(
      'href',
      s02(fx.ventures.project),
    )

    // The apply entry with two ventures: the choice; back returns to it.
    await page.goto(`/programmes/${fx.programmes.open}/apply`)
    await expect(page.locator('[data-screen="L5-CHOOSE"]')).toBeVisible()
    await page.locator(`[data-venture="${fx.ventures.project}"] a`).click()
    await expect(page).toHaveURL(`${form(fx.ventures.project, fx.programmes.open)}?tu=chon`)
    await expect(page.locator('[data-nav="application-back"]')).toHaveAttribute(
      'href',
      `/programmes/${fx.programmes.open}/apply`,
    )

    // One venture: the entry goes straight to the form; back returns to S01.
    await login(page.request, SECOND_OWNER)
    await page.goto(`/programmes/${fx.programmes.open}/apply`)
    await expect(page).toHaveURL(`${form(fx.ventures.secondOwner, fx.programmes.open)}?tu=ds`)
    await expect(page.locator('[data-nav="application-back"]')).toHaveAttribute('href', s01)
    // Steps 1, 3, 4 are drawn (step 2 has no question): ordinals 01, 02, 03.
    await page.locator('[data-action="next"]').click()
    await expect(page).toHaveURL(
      `${form(fx.ventures.secondOwner, fx.programmes.open)}?buoc=3&tu=ds`,
    )
    await page.locator('[data-action="next"]').click()
    await expect(page.locator('[data-action="prev"]')).toHaveText('Quay lại bước 02')
    await expect(page.locator('[data-anchor="progress"] li').nth(1)).toContainText(
      '02 · Đội & kế hoạch',
    )
    await page.locator('[data-action="prev"]').click()
    await page.locator('[data-action="prev"]').click()
    await expect(page.locator('[data-nav="application-back"]')).toHaveAttribute('href', s01)
  })

  test('QuickTeam shows the server reason of a refused field, not a blanket "Bắt buộc"', async ({
    page,
  }) => {
    await login(page.request, OTHER)
    await page.goto(`/programmes/${fx.programmes.open}/apply`)
    await expect(page.locator('[data-screen="L5-SUB0"]')).toBeVisible()
    await page.locator('#quick-name').fill('Đội thử lỗi')
    await page.locator('input[name="quick-type"]').first().check()
    await page.locator('[data-action="domain-picker"]').click()
    await page.locator('#quick-domain-list button').first().click()
    await page.locator('#quick-stage').selectOption({ index: 1 })
    await page.locator('#quick-summary').fill('Một dòng.')
    await page.route('**/api/v1/ventures', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'PROFILE_VALIDATION_FAILED',
            message: 'Venture validation failed.',
            request_id: 'req-fake',
            fields: { name: 'too_long', domain_ids: 'too_many', stage_id: 'invalid' },
          },
        }),
      }),
    )
    await page.locator('[data-action="quick-go"]').click()
    await expect(page.getByRole('alert').filter({ hasText: 'Quá dài.' })).toHaveCount(1)
    await expect(page.getByRole('alert').filter({ hasText: 'Chọn quá nhiều.' })).toHaveCount(1)
    await expect(page.getByRole('alert').filter({ hasText: 'Giá trị không hợp lệ.' })).toHaveCount(
      1,
    )
    await expect(page.getByRole('alert').filter({ hasText: 'Bắt buộc.' })).toHaveCount(0)
    await expect(
      page.getByText('Chưa tạo được hồ sơ đội. Kiểm tra các trường rồi thử lại.'),
    ).toBeVisible()
    expect(await query('SELECT 1 FROM projects WHERE name = $1', ['Đội thử lỗi'])).toHaveLength(0)
  })
})

test.describe('WF05-PROD-04 cross-workflow identity', () => {
  test('WF02 ↔ WF05: profile → Dự án & Startup → detail → WF02 edit → back; the same venture everywhere, no copy', async ({
    page,
  }) => {
    await login(page.request, OWNER)
    const renamed = 'WF05 Fixture Project (đổi tên)'
    const [members] = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM project_members WHERE project_id = $1',
      [fx.ventures.project],
    )
    try {
      await page.goto('/me/settings')
      await expect(page.locator('[data-nav="project-demo"]')).toHaveText('Dự án & Startup')
      await shot(page, 'wf02-settings-shell-1440x900')
      await page.locator('[data-nav="project-demo"]').click()
      await expect(page).toHaveURL(s01)
      await page
        .locator(`[data-venture="${fx.ventures.project}"] [data-nav="venture-detail"]`)
        .click()
      await expect(page).toHaveURL(s02(fx.ventures.project))
      await page.locator('[data-nav="venture-edit"]').click()
      await expect(page).toHaveURL(`/projects/${fx.ventures.project}/edit`)
      await page.locator('#ve-name').fill(renamed)
      await page.locator('button[type="submit"]').click()
      await expect
        .poll(
          async () =>
            (
              await query<{ name: string }>('SELECT name FROM projects WHERE id = $1', [
                fx.ventures.project,
              ])
            )[0]!.name,
        )
        .toBe(renamed)
      await page.goBack()
      await expect(page).toHaveURL(s02(fx.ventures.project))
      await expect(page.locator('h1')).toHaveText(renamed)
      await page.goto(s01)
      await expect(page.locator(`[data-venture="${fx.ventures.project}"]`)).toContainText(renamed)
      await page.goto('/me')
      expect(new URL(page.url()).pathname).toBe('/me')
      await page.goto(`${form(fx.ventures.project, fx.programmes.open)}/review`)
      await expect(page.locator('[data-screen="L5-SUB2"]')).toContainText(renamed)
      const projects = await query<{ id: string }>(
        `SELECT id::text FROM projects WHERE owner_profile_id = $1 AND name = $2`,
        [fx.owner.profileId, renamed],
      )
      expect(projects.map((p) => p.id)).toEqual([fx.ventures.project])
      const [draft] = await query<{ venture_id: string }>(
        'SELECT venture_id::text FROM applications WHERE id = $1',
        [fx.applications.draft],
      )
      expect(draft!.venture_id).toBe(fx.ventures.project)
      // Owner and team relations unchanged by the edit.
      const [after] = await query<{ n: number; owner: string }>(
        `SELECT (SELECT count(*)::int FROM project_members WHERE project_id = $1) AS n,
                owner_profile_id::text AS owner FROM projects WHERE id = $1`,
        [fx.ventures.project],
      )
      expect(after).toEqual({ n: members!.n, owner: fx.owner.profileId })
    } finally {
      await query('UPDATE projects SET name = $2 WHERE id = $1', [
        fx.ventures.project,
        'WF05 Fixture Project',
      ])
    }
  })

  test('WF04 ↔ WF05: the operator closes a programme; the open form turns read only, the application stays listed', async ({
    page,
    playwright,
  }) => {
    await login(page.request, OWNER)
    const path = form(fx.ventures.startup, fx.programmes.startupOnly)
    await page.goto(s02(fx.ventures.startup))
    await page
      .locator(`[data-programme="${fx.programmes.startupOnly}"] [data-action="apply"]`)
      .click()
    await expect(page).toHaveURL(path)
    const field = page.locator('#q-q-problem')
    await field.fill('Trước khi đóng')
    await field.blur()
    await expect(page.locator('[data-save-state]')).toHaveAttribute('data-save-state', 'idle')

    const operator = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    try {
      await login(operator, LEADER)
      const closed = await operator.post(`/api/v1/programmes/${fx.programmes.startupOnly}/close`)
      expect(closed.status(), await closed.text()).toBe(200)
      // The same programme, one state on both sides: WF04 reads CLOSED, WF05 lists it CLOSED.
      const wf04 = (await (
        await operator.get(`/api/v1/programmes/${fx.programmes.startupOnly}`)
      ).json()) as { programme: { status: string } }
      expect(wf04.programme.status).toBe('CLOSED')
    } finally {
      await operator.dispose()
    }
    const mine = (await (await page.request.get('/api/v1/me/applications')).json()) as {
      items: { id: string; programme: { id: string; status: string } }[]
    }
    const [draft] = await application(fx.ventures.startup, fx.programmes.startupOnly)
    expect(mine.items.find((a) => a.id === draft!.id)?.programme).toMatchObject({
      id: fx.programmes.startupOnly,
      status: 'CLOSED',
    })
    // The same form: the application holds the form version the programme carries.
    const [ref] = await query<{ same: boolean }>(
      `SELECT a.question_set_version = f.version AS same
         FROM applications a JOIN programme_application_forms f ON f.programme_id = a.programme_id
        WHERE a.id = $1`,
      [draft!.id],
    )
    expect(ref!.same).toBe(true)

    await field.fill('Sau khi đóng')
    await field.blur()
    await expect(page.locator('[data-ineligible="NOT_PUBLISHED"]')).toBeVisible()
    await expect(field).toBeDisabled()
    await expect(field).toHaveValue('Trước khi đóng')
    expect(answerOf(await application(fx.ventures.startup, fx.programmes.startupOnly))).toBe(
      'Trước khi đóng',
    )

    await page.goto(s01)
    await expect(
      page.locator(`[data-venture="${fx.ventures.startup}"] [data-venture-applications]`),
    ).toContainText(`${STARTUP_ONLY} · Bản nháp (đã đóng)`)
    await page.goto(s02(fx.ventures.startup))
    const row = page.locator(`[data-programme="${fx.programmes.startupOnly}"]`)
    await expect(row).toHaveAttribute('data-programme-status', 'CLOSED')
    await expect(row.locator('[data-nav="application-view"]')).toHaveAttribute('href', path)
    await expect(row.locator('[data-action="apply"]')).toHaveCount(0)
  })
})
