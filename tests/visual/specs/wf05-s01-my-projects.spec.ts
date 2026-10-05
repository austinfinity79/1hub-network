import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { seedVenture } from '../../../src/lib/venture/testing'
import { assertTypography, settle } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type SegmentResult } from '../pixel-qa/segments'

/**
 * WF05-S01 — my Projects / Startups + open programmes (DEC-WF05-G1..G3,
 * DEC-WF05-T00-D1..D3): the canonical WF02 ventures the member owns or is an
 * ACTIVE member of, the PUBLISHED programmes with their L5 entry (TASK 24.4),
 * states, the MemberShell entry, no application created by viewing, the
 * server application status, reset leaving it, IDOR / spoofing, no writes,
 * responsive and primitives.
 */

const URL_ = '/demo/projects'
const API = '/api/v1/demo/projects'
const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const ACTUAL = path.join(REPO_ROOT, 'tests/visual/actual')

type Person = { accountId: string; profileId: string; email: string }
const accounts: string[] = []
let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await query(
    `DELETE FROM applications WHERE venture_id IN
       (SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
         WHERE i.account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await query(
    `DELETE FROM project_members WHERE project_id IN
       (SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
         WHERE i.account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await query(
    `DELETE FROM projects WHERE owner_profile_id IN
       (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

async function person(name = 'WF05 Founder'): Promise<Person> {
  const email = `wf05-s01-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, name],
  )
  accounts.push(a!.id)
  return { accountId: a!.id, profileId: p!.id, email }
}

/** Owner: a STARTUP (ACTIVE member + pending invitee), a PROJECT and an ARCHIVED STARTUP. */
async function world() {
  const owner = await person()
  const teammate = await person('WF05 Teammate')
  const invitee = await person('WF05 Invitee')
  const stranger = await person('WF05 Stranger')
  const startup = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Startup S01' })
  const project = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'Dự án S01' })
  const archived = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Cũ S01' })
  const foreign = await seedVenture(stranger.accountId, {
    type: 'PROJECT',
    name: 'Của người khác',
  })
  await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [archived.id])
  await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [startup.id])
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
     VALUES ($1, $2, 'Kỹ thuật', 'ACTIVE', now())`,
    [startup.id, teammate.profileId],
  )
  await query(
    `INSERT INTO project_members (project_id, invite_email_normalized, role_label, state, invited_at, invited_by_profile_id, joined_at, invite_expires_at)
     VALUES ($1, $2, 'Cố vấn', 'PENDING_CONFIRMATION', now(), $3, NULL, now() + interval '7 days')`,
    [startup.id, invitee.email, owner.profileId],
  )
  return { owner, teammate, invitee, stranger, startup, project, archived, foreign }
}

/** A fresh member with exactly one STARTUP (deterministic counts). */
async function soloOwner(): Promise<Person & { ventureId: string }> {
  const owner = await person('WF05 Solo')
  const venture = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Startup riêng' })
  return { ...owner, ventureId: venture.id }
}

async function fingerprint() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string | null>>(
    `SELECT ${table('projects')} AS projects, ${table('project_members')} AS members,
            ${table('project_domains')} AS domains, ${table('programmes')} AS programmes,
            ${table('events')} AS events, ${table('role_assignments')} AS roles,
            ${table('individual_profiles')} AS profiles, ${table('audit_events')} AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            ${table('applications')} AS applications`,
  )
  return row!
}

async function open(page: Page) {
  await page.goto(URL_, { waitUntil: 'networkidle' })
  await expect(page.locator('[data-state="projects-loading"]')).toHaveCount(0)
}

const ventureRow = (page: Page, id: string) => page.locator(`[data-venture="${id}"]`)
const ventureIds = (page: Page) =>
  page
    .locator('[data-venture]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-venture')))
const programmeIds = (page: Page) =>
  page
    .locator('[data-programme]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-programme')))

test.describe('WF05-S01 my projects / startups', () => {
  test('1/2/7. owner: PROJECT, STARTUP and ARCHIVED ventures with canonical type, relation and status', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page)
    await expect(page.locator('[data-screen="WF05-S01"]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dự án & Startup')
    // WF05-PROD-04: real data, no demo notice or reset (WF05-PROD-01 demo artifact disposition).
    await expect(page.locator('[data-demo-notice], [data-demo-reset]')).toHaveCount(0)
    expect(await ventureIds(page)).toEqual([w.archived.id, w.project.id, w.startup.id])
    await expect(ventureRow(page, w.project.id)).toContainText('Dự án S01')
    await expect(ventureRow(page, w.project.id).locator('[data-venture-meta]')).toHaveText(
      'Dự án · Chủ sở hữu',
    )
    await expect(ventureRow(page, w.project.id).locator('[data-venture-status]')).toHaveText(
      'Bản nháp',
    )
    await expect(ventureRow(page, w.startup.id).locator('[data-venture-meta]')).toHaveText(
      'Startup · Chủ sở hữu',
    )
    await expect(ventureRow(page, w.startup.id).locator('[data-venture-status]')).toHaveText(
      'Đang hoạt động',
    )
    // Archived: shown as the canonical read gives it, with no action at all.
    await expect(ventureRow(page, w.archived.id).locator('[data-venture-status]')).toHaveText(
      'Đã lưu trữ',
    )
    // Each row's only control is its link to the detail (S02); no button.
    await expect(page.locator('[data-venture] button')).toHaveCount(0)
    for (const id of [w.archived.id, w.project.id, w.startup.id])
      await expect(ventureRow(page, id).locator('a')).toHaveAttribute(
        'href',
        `/demo/projects/${id}`,
      )
    // No enum names, applicant types or internal terms on the page.
    const text = await page.locator('[data-screen="WF05-S01"]').innerText()
    expect(text).not.toMatch(
      /\bPROJECT\b|\bSTARTUP\b|\bTEAM\b|ARCHIVED|fixture|mock|sessionStorage|DTO|canonical|read model|@example/,
    )
  })

  test('3. a WF02 edit shows on S01 immediately: the same record, no copy', async ({ page }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    await open(page)
    await expect(ventureRow(page, w.startup.id)).toContainText('Startup S01')
    expect(
      (
        await page.request.patch(`/api/v1/ventures/${w.startup.id}`, {
          data: { name: 'Startup S01 đổi tên' },
        })
      ).status(),
    ).toBe(200)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(ventureRow(page, w.startup.id).locator('p').first()).toHaveText(
      'Startup S01 đổi tên',
    )
    // Viewing creates no application (§2.4 list envelope, API amendment A6).
    expect(await (await page.request.get('/api/v1/me/applications')).json()).toEqual({ items: [] })
  })

  test('4/5/6. ACTIVE member sees the venture as a member; unrelated and pending-invite ventures never appear', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.teammate.email)
    await open(page)
    expect(await ventureIds(page)).toEqual([w.startup.id])
    await expect(ventureRow(page, w.startup.id).locator('[data-venture-meta]')).toHaveText(
      'Startup · Kỹ thuật',
    )
    await expect(ventureRow(page, w.startup.id)).toHaveAttribute('data-relation', 'MEMBER')
    for (const who of [w.invitee.email, 'ops@example.test', 'leader@example.test']) {
      await page.context().clearCookies()
      await login(page.request, who)
      await open(page)
      const ids = await ventureIds(page)
      for (const id of [w.startup.id, w.project.id, w.archived.id, w.foreign.id])
        expect(ids, `${who} ${id}`).not.toContain(id)
    }
    // The stranger sees only their own venture.
    await page.context().clearCookies()
    await login(page.request, w.stranger.email)
    await open(page)
    expect(await ventureIds(page)).toEqual([w.foreign.id])
  })

  test('12. no venture: the empty state and the create entry (WF02)', async ({ page }) => {
    const lone = await person('WF05 Lone')
    await login(page.request, lone.email)
    await open(page)
    await expect(page.locator('[data-state="ventures-empty"]')).toHaveText(
      'Bạn chưa có dự án hay startup nào.',
    )
    await expect(page.locator('[data-programme]')).toHaveCount(1)
    await page.locator('[data-nav="create-project"]').click()
    await expect(page).toHaveURL('/projects/new')
  })
})

test.describe('WF05-S01 open programmes', () => {
  test('8/9/10/11. only PUBLISHED programmes with a form, read only; an operator DRAFT never appears', async ({
    page,
    browser,
    baseURL,
  }) => {
    // WF04-PROD-04: an operator's DRAFT Challenge with a registration form is a
    // canonical row now (it was a browser-session draft); unpublished, WF05
    // never lists it.
    const ops = await browser.newContext({ baseURL })
    await login(ops.request, 'leader@example.test')
    const draft = await ops.request.post('/api/v1/programmes', {
      data: { type: 'CHALLENGE', organization_id: CHAPTER_01, name: 'Thử thách đổi mới (nháp)' },
    })
    expect(draft.status()).toBe(201)
    const draftId = ((await draft.json()) as { programme: { id: string } }).programme.id
    const form = await ops.request.put(`/api/v1/programmes/${draftId}/registration`, {
      data: {
        applicant_types: ['STARTUP'],
        questions: [{ id: 'q-a', prompt: 'Câu hỏi', required: true, step: 1 }],
      },
    })
    expect(form.status()).toBe(200)
    await ops.close()
    const before = await fingerprint()

    await login(page.request, 'member@example.test')
    await open(page)
    expect(await programmeIds(page)).toEqual([PROGRAMME])
    const row = page.locator(`[data-programme="${PROGRAMME}"]`)
    await expect(row.locator('[data-programme-kind]')).toHaveText('Chương trình · Chapter 01')
    await expect(row).toContainText('Chương trình ươm tạo (demo)')
    await expect(row.locator('[data-programme-meta]')).toHaveText(
      '01/09/2026 – 15/12/2026 · Dành cho: Đội, Startup',
    )
    await expect(row.locator('[data-status]')).toHaveText('Đang công khai')
    // One action only: the L5 entry (TASK 24.4); no programme management, nothing about ops.
    await expect(page.locator('[data-programme] button')).toHaveCount(0)
    expect(
      await page
        .locator('[data-programme] a')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href'))),
    ).toEqual([`/programmes/${PROGRAMME}/apply`])
    const text = await page.locator('[data-section="programmes"]').innerText()
    expect(text).not.toMatch(
      /Người vận hành|Thử thách đổi mới|Bản nháp|Đã nộp|Đang xem xét|Cần bổ sung/,
    )
    const api = await (await page.request.get(API)).json()
    expect(api.programmes.map((p: { id: string; status: string }) => [p.id, p.status])).toEqual([
      [PROGRAMME, 'PUBLISHED'],
    ])
    expect(await fingerprint()).toEqual(before)
    await query('DELETE FROM programme_application_forms WHERE programme_id = $1', [draftId])
    await query('DELETE FROM audit_events WHERE resource_id = $1', [draftId])
    await query('DELETE FROM programmes WHERE id = $1', [draftId])
  })

  test('9. a PUBLISHED Challenge renders as a Challenge (response shaped by the API)', async ({
    page,
  }) => {
    await login(page.request, 'member@example.test')
    await page.route(`**${API}`, async (route) => {
      const body = await (await route.fetch()).json()
      body.programmes.push({
        ...body.programmes[0],
        id: 'd4000000-0000-0000-0000-000000000009',
        type: 'CHALLENGE',
        name: 'Thử thách công khai (demo)',
        applicant_types: ['STARTUP'],
      })
      await route.fulfill({ json: body })
    })
    await open(page)
    const row = page.locator('[data-programme="d4000000-0000-0000-0000-000000000009"]')
    await expect(row.locator('[data-programme-kind]')).toHaveText('Challenge · Chapter 01')
    await expect(row.locator('[data-programme-meta]')).toContainText('Dành cho: Startup')
  })

  test('13. no open programme: the empty state; the venture section is unaffected', async ({
    page,
  }) => {
    const solo = await soloOwner()
    await login(page.request, solo.email)
    await page.route(`**${API}`, async (route) => {
      const body = await (await route.fetch()).json()
      await route.fulfill({ json: { ...body, programmes: [] } })
    })
    await open(page)
    await expect(page.locator('[data-state="programmes-empty"]')).toHaveText(
      'Hiện chưa có chương trình nào đang mở.',
    )
    await expect(page.locator('[data-venture]')).toHaveCount(1)
    // Both empty.
    await page.unroute(`**${API}`)
    await page.route(`**${API}`, (route) =>
      route.fulfill({ json: { ventures: [], programmes: [] } }),
    )
    await open(page)
    await expect(page.locator('[data-state="ventures-empty"]')).toBeVisible()
    await expect(page.locator('[data-state="programmes-empty"]')).toBeVisible()
  })
})

test.describe('WF05-S01 states, entry and boundaries', () => {
  test('14. loading, then an error with a safe message; "Thử lại" recovers (never a fake empty list)', async ({
    page,
  }) => {
    const solo = await soloOwner()
    await login(page.request, solo.email)
    let release!: () => void
    const gate = new Promise<void>((done) => (release = done))
    let fail = true
    await page.route(`**${API}`, async (route) => {
      await gate
      if (fail)
        return route.fulfill({
          status: 500,
          json: { error: { code: 'INTERNAL', message: 'boom' } },
        })
      return route.continue()
    })
    await page.goto(URL_)
    await expect(page.locator('[data-state="projects-loading"]')).toBeVisible()
    await expect(page.locator('[data-section="ventures"]')).toHaveAttribute('aria-busy', 'true')
    release()
    const failed = page.locator('[data-state="projects-failed"]')
    await expect(failed).toHaveText(/Chưa tải được dữ liệu\. Vui lòng thử lại\./)
    await expect(
      page.locator('[data-state="ventures-empty"], [data-state="programmes-empty"]'),
    ).toHaveCount(0)
    expect(await failed.innerText()).not.toMatch(/boom|INTERNAL|\b500\b|code/)
    fail = false
    await failed.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.locator('[data-venture]')).toHaveCount(1)
    await expect(page.locator('[data-programme]')).toHaveCount(1)
  })

  test('15/16/17/18. direct URL, refresh, the MemberShell entry (current here, not on WF02 pages); no S02 link', async ({
    page,
  }) => {
    const solo = await soloOwner()
    await login(page.request, solo.email)
    // DEC-L2R-D1: /me is FP1-OWN without a sidebar; the MemberShell pages keep the entry.
    await page.goto('/me/settings', { waitUntil: 'networkidle' })
    const entry = page.locator('[data-nav="project-demo"]')
    await expect(entry).toHaveText('Dự án & Startup')
    await expect(entry).toHaveAttribute('href', '/demo/projects')
    await expect(entry).not.toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[aria-current="page"]')).toHaveText('Cài đặt tài khoản')
    await entry.click()
    await expect(page).toHaveURL(URL_)
    await expect(page.locator('[data-nav="project-demo"]')).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-venture]')).toHaveCount(1)
    // WF02 creation, the row's detail and the programme's L5 entry (TASK 24.4); nothing else.
    const links = await page
      .locator('[data-screen="WF05-S01"] a')
      .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(links).toEqual([
      '/projects/new',
      `/demo/projects/${solo.ventureId}`,
      `/programmes/${PROGRAMME}/apply`,
    ])
    await page.locator('[data-nav="venture-detail"]').click()
    await expect(page).toHaveURL(`/demo/projects/${solo.ventureId}`)
    expect(
      (await page.request.get('/demo/projects/50000000-0000-0000-0000-000000000001')).status(),
    ).toBe(404)
    expect(
      (
        await page.request.get(`/demo/projects/${solo.ventureId}/applications/${PROGRAMME}/unknown`)
      ).status(),
    ).toBe(404)
  })

  test('19/20. viewing creates no application; a server application shows (HD-A10)', async ({
    page,
  }) => {
    const w = await world()
    const before = await fingerprint()
    await login(page.request, w.owner.email)
    await open(page)
    await page.reload({ waitUntil: 'networkidle' })
    expect(await fingerprint()).toEqual(before)
    await expect(page.locator('[data-venture-applications]')).toHaveCount(0)
    const created = await page.request.post('/api/v1/applications', {
      data: { venture_id: w.startup.id, programme_id: PROGRAMME },
    })
    expect(created.status()).toBe(201)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(ventureRow(page, w.startup.id).locator('[data-venture-applications]')).toHaveText(
      'Đơn đăng ký: Chương trình ươm tạo (demo) · Bản nháp',
    )
    await expect(ventureRow(page, w.project.id).locator('[data-venture-applications]')).toHaveCount(
      0,
    )
    // The application lives on the server (WF05-PROD-04: no demo reset any more).
    await page.reload({ waitUntil: 'networkidle' })
    await expect(ventureRow(page, w.startup.id).locator('[data-venture-applications]')).toHaveCount(
      1,
    )
    await expect(page.locator('[data-venture]')).toHaveCount(3)
  })
})

test.describe('WF05-S01 authorization, IDOR and privacy', () => {
  test('guest → /auth; onboarding incomplete → resolver; spoofed identity or scope changes nothing', async ({
    page,
  }) => {
    await page.goto(URL_)
    await expect(page).toHaveURL(`/auth?redirect=${encodeURIComponent(URL_)}`)
    await login(page.request, 'newcomer@example.test')
    await page.goto(URL_)
    await expect(page).toHaveURL(/\/onboarding(\/|$)/)

    const w = await world()
    const before = await fingerprint()
    await page.context().clearCookies()
    await login(page.request, w.stranger.email)
    await page.setExtraHTTPHeaders({
      'x-role': 'PLATFORM_ADMIN',
      'x-organization-id': '10000000-0000-0000-0000-000000000101',
      'x-profile-id': w.owner.profileId,
      'x-account-id': w.owner.accountId,
    })
    await page.goto(
      `${URL_}?profile_id=${w.owner.profileId}&account_id=${w.owner.accountId}&owner_profile_id=${w.owner.profileId}&orgId=10000000-0000-0000-0000-000000000101`,
      { waitUntil: 'networkidle' },
    )
    expect(await ventureIds(page)).toEqual([w.foreign.id])
    const api = await (
      await page.request.get(
        `${API}?profile_id=${w.owner.profileId}&account_id=${w.owner.accountId}`,
      )
    ).json()
    expect(api.ventures.map((v: { id: string }) => v.id)).toEqual([w.foreign.id])
    // No contact, account or session data in the page, the API or the store.
    const html = await (await page.request.get(URL_)).text()
    expect(html).not.toMatch(/@example\.test|30000000-|40000000-|hub_session/)
    expect(JSON.stringify(api)).not.toMatch(/@|email|profile_id|account|slug|metadata/i)
    expect(await fingerprint()).toEqual(before)
  })
})

test.describe('WF05-S01 responsive basics', () => {
  test('768 / 390: no page overflow; sections, entry and create link reachable', async ({
    page,
  }) => {
    const w = await world()
    await login(page.request, w.owner.email)
    for (const [width, height] of [
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await open(page)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        `${width}px overflow`,
      ).toBe(0)
      for (const locator of [
        page.locator('[data-nav="project-demo"]'),
        page.locator('[data-nav="create-project"]'),
        ventureRow(page, w.startup.id),
        page.locator(`[data-programme="${PROGRAMME}"]`),
      ]) {
        await locator.scrollIntoViewIfNeeded()
        await expect(locator).toBeInViewport()
      }
      // A status pill never overlaps its text.
      const row = ventureRow(page, w.startup.id)
      const pillBox = (await row.locator('[data-venture-status]').boundingBox())!
      const nameBox = (await row.locator('p').first().boundingBox())!
      expect(
        pillBox.y >= nameBox.y + nameBox.height - 1 || pillBox.x >= nameBox.x + nameBox.width - 1,
      ).toBe(true)
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s01-${width}.png`), fullPage: true })
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

test.describe('WF05-S01 visual QA (approved primitives; no WF05 bitmap)', () => {
  test('1440×900 populated, no ventures, no programmes, error: typography; shell vs WF02-S01; card chrome vs ADM5', async ({
    page,
  }) => {
    const w = await world()
    const shellRef = readPng(
      path.join(REPO_ROOT, 'design-reference/final/WF02/WF02-S01__account-home__1440x900.png'),
    )
    const adm5 = readPng(
      path.join(REPO_ROOT, findScreen(loadManifest().screens, 'WF03-S05').full_page_baseline!),
    )
    const results: SegmentResult[] = []
    let checked = 0
    // Reference text boxes (as WF02-T00), the bell, and the reference's current "Tổng quan"
    // item: here the demo entry is the current one (DEC-WF05-G2).
    const referenceText: Rect[] = [
      { x: 60, y: 18, width: 400, height: 24 },
      { x: 1236, y: 18, width: 100, height: 24 },
      { x: 60, y: 88, width: 110, height: 18 },
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 74, y: 128 + 44 * i, width: 180, height: 26 })),
      { x: 1196, y: 16, width: 36, height: 28 },
      { x: 60, y: 118, width: 262, height: 48 },
    ]
    const capture = async (name: string, withCards: boolean) => {
      await page.evaluate(() => window.scrollTo(0, 0))
      await settle(page)
      const typography = await assertTypography(page)
      expect(typography.violations, name).toEqual([])
      checked += typography.checked
      await page.screenshot({ path: path.join(ACTUAL, `wf05-s01-${name}-1440x900.png`) })
      await page.screenshot({
        path: path.join(ACTUAL, `wf05-s01-${name}-full.png`),
        fullPage: true,
      })
      const actual = decodePng(await page.screenshot())
      const masks = [...(await textRects(page)), ...referenceText]
      results.push(
        ...compareSegments(
          shellRef,
          actual,
          [
            {
              name: `${name}-shell-header`,
              reference: { x: 0, y: 0, width: 1440, height: 60 },
              dy: 0,
            },
            {
              name: `${name}-shell-sidebar`,
              reference: { x: 0, y: 60, width: 330, height: 380 },
              dy: 0,
            },
          ],
          masks,
          { diffPath: resolveOutputPath('diff', `WF05-S01.${name}.shell.diff.png`) },
        ),
      )
      const rule = (await page.locator('[data-demo-page] > header').boundingBox())!
      const segments: { name: string; reference: Rect; dx?: number; dy: number }[] = [
        {
          name: `${name}-header-rule`,
          reference: { x: 500, y: 72, width: 600, height: 6 },
          dy: Math.round(rule.y + rule.height) - 76,
        },
      ]
      if (withCards) {
        const card = (await page.locator('[data-section="ventures"]').boundingBox())!
        segments.push({
          name: `${name}-card-top`,
          reference: { x: 300, y: 95, width: 800, height: 8 },
          dx: Math.round(card.x) - 248,
          dy: Math.round(card.y) - 99,
        })
      }
      results.push(
        ...compareSegments(adm5, actual, segments, masks, {
          diffPath: resolveOutputPath('diff', `WF05-S01.${name}.primitives.diff.png`),
        }),
      )
    }

    await login(page.request, w.owner.email)
    await open(page)
    await capture('populated', true)

    await page.context().clearCookies()
    const lone = await person('WF05 Lone')
    await login(page.request, lone.email)
    await open(page)
    await capture('no-ventures', true)

    await page.route(`**${API}`, async (route) => {
      const body = await (await route.fetch()).json()
      await route.fulfill({ json: { ...body, programmes: [] } })
    })
    await open(page)
    await capture('no-programmes', true)

    await page.unroute(`**${API}`)
    await page.route(`**${API}`, (route) => route.fulfill({ status: 500, json: {} }))
    await page.goto(URL_, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="projects-failed"]')).toBeVisible()
    await capture('error', false)

    writeJsonReport('WF05-S01.primitives.json', {
      screen_id: 'WF05-S01',
      references: [
        'WF02-S01 ME0 (member shell header + sidebar)',
        'WF03-S05 ADM5 (header rule, card)',
      ],
      approved_wf05_bitmap: null,
      typography_checked: checked,
      intentional: [
        {
          class: 'INTENTIONAL-DEMO',
          reason:
            'DEC-WF05-G1: WF04 demo frame and card chrome inside MemberShell, WF02 venture wording; the demo entry is the current sidebar item (DEC-WF05-G2); no WF05 pixel parity claimed',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
