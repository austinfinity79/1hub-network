import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S05 — Project / Startup (/projects/new, /projects/:id/edit).
 * Decisions DEC-WF02-H6/H7, DEC-WF02-S05-G1..G5, DEC-WF02-S05-D1..D3.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const REGION_2 = '20000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SKILL = '20000000-0000-0000-0000-000000000021'
const VENTURES = '/api/v1/ventures'

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
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

type Member = { email: string; accountId: string; profileId: string }

async function completedMember(request: APIRequestContext, label = 's05'): Promise<Member> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  expect(
    (await request.put('/api/v1/me/onboarding/intent', { data: { action: 'SKIP' } })).ok(),
  ).toBe(true)
  expect(
    (
      await request.patch('/api/v1/me/profile', {
        data: { display_name: 'Chi', headline: 'QA', region_id: REGION, domain_ids: [DOMAIN] },
      })
    ).status(),
  ).toBe(200)
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    expect(
      (
        await request.post('/api/v1/me/consents/accept', {
          data: { consent_type: doc.type, policy_version: doc.version },
        })
      ).ok(),
    ).toBe(true)
  }
  expect((await request.post('/api/v1/me/onboarding/complete')).ok()).toBe(true)
  const [row] = await query<{ account_id: string; profile_id: string }>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id WHERE a.email_normalized = $1`,
    [email],
  )
  return { email, accountId: row!.account_id, profileId: row!.profile_id }
}

const editor = (page: Page) => page.locator('[data-venture-editor]')
const save = (page: Page) => page.getByRole('button', { name: 'Lưu', exact: true })

test.describe('WF02-S05 guards', () => {
  test('guest → /auth on both routes; API 401', async ({ page, request }) => {
    for (const route of ['/projects/new', '/projects/00000000-0000-0000-0000-000000000000/edit']) {
      await page.goto(route)
      await expect(page).toHaveURL('/auth')
    }
    expect((await request.post(VENTURES, { data: { type: 'PROJECT', name: 'x' } })).status()).toBe(
      401,
    )
    expect((await request.get(`${VENTURES}/00000000-0000-0000-0000-000000000000`)).status()).toBe(
      401,
    )
    expect(
      (
        await request.patch(`${VENTURES}/00000000-0000-0000-0000-000000000000`, { data: {} })
      ).status(),
    ).toBe(401)
  })

  test('G2: onboarding not DONE → resolver step on the page, 403 on create', async ({ page }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: `s05-new-${Date.now()}@example.test` },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/projects/new')
    await expect(page).toHaveURL('/onboarding/purpose')
    const r = await page.request.post(VENTURES, { data: { type: 'PROJECT', name: 'x' } })
    expect(r.status()).toBe(403)
    expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
  })
})

test.describe('WF02-S05 create and edit', () => {
  test('1/3/4/13/23. create a PROJECT through the form, then edit and refresh', async ({
    page,
  }) => {
    const m = await completedMember(page.request)
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await expect(editor(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gửi HUB duyệt' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Xem bản public' })).toHaveCount(0)
    const text = await page.locator('body').innerText()
    for (const banned of ['Data room', 'gọi vốn', 'bắt buộc chưa điền', 'Hoàn thiện'])
      expect(text, banned).not.toContain(banned)

    // Required fields are checked before any request.
    await save(page).click()
    await expect(page.getByText('Trường này là bắt buộc.').first()).toBeVisible()

    await page.getByLabel('Dự án').check()
    await page.getByLabel('Tên').fill('Tracely QA')
    await page.getByLabel('Tóm tắt').fill('Theo dõi bưu kiện.')
    const created = page.waitForResponse(
      (r) => r.url().endsWith(VENTURES) && r.request().method() === 'POST',
    )
    await save(page).click()
    const res = await created
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      type: 'PROJECT',
      status: 'DRAFT',
      name: 'Tracely QA',
      relation: 'OWNER',
    })
    await expect(page).toHaveURL(`/projects/${body.id}/edit`)
    const [row] = await query<{ owner: string }>(
      'SELECT owner_profile_id::text AS owner FROM projects WHERE id = $1',
      [body.id],
    )
    expect(row!.owner).toBe(m.profileId)
    expect(
      await query('SELECT 1 FROM project_members WHERE project_id = $1', [body.id]),
    ).toHaveLength(0)

    // The type is fixed once created.
    await expect(page.getByLabel('Dự án')).toBeDisabled()
    await page.getByLabel('Tên').fill('Tracely QA 2')
    await save(page).click()
    await expect(page.locator('[data-status]')).toContainText('Bản nháp · đã lưu lúc')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByLabel('Tên')).toHaveValue('Tracely QA 2')
  })

  test('2/5/6/7/14/15/16. STARTUP with region and domains; replace and clear', async ({ page }) => {
    await completedMember(page.request)
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.getByLabel('Startup').check()
    await page.getByLabel('Tên').fill('Startup QA')
    await page.getByLabel('Tỉnh / Thành phố').selectOption(REGION)
    await page.getByRole('button', { name: 'Lĩnh vực' }).click()
    await page.getByRole('list', { name: 'Lĩnh vực' }).getByRole('button').first().click()
    const created = page.waitForResponse(
      (r) => r.url().endsWith(VENTURES) && r.request().method() === 'POST',
    )
    await save(page).click()
    const body = await (await created).json()
    expect(body.type).toBe('STARTUP')
    expect(body.region.id).toBe(REGION)
    expect(body.domains).toHaveLength(1)
    await expect(page).toHaveURL(`/projects/${body.id}/edit`)

    await page.getByLabel('Tỉnh / Thành phố').selectOption(REGION_2)
    const patched = page.waitForResponse(
      (r) => r.url().endsWith(`${VENTURES}/${body.id}`) && r.request().method() === 'PATCH',
    )
    await save(page).click()
    expect((await (await patched).json()).region.id).toBe(REGION_2)

    await page.getByLabel('Tỉnh / Thành phố').selectOption('')
    await page.getByRole('button', { name: 'Lĩnh vực' }).click()
    await page.getByRole('list', { name: 'Lĩnh vực' }).locator('[aria-pressed="true"]').click()
    const cleared = page.waitForResponse(
      (r) => r.url().endsWith(`${VENTURES}/${body.id}`) && r.request().method() === 'PATCH',
    )
    await save(page).click()
    const after = await (await cleared).json()
    expect([after.region, after.domains]).toEqual([null, []])
  })

  test('8–12/17/18. invalid taxonomy, type change and owner spoof are refused', async ({
    page,
    playwright,
  }) => {
    const otherCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const other = await completedMember(otherCtx, 's05-other')
    await completedMember(page.request)
    for (const [data, code] of [
      [
        { type: 'PROJECT', name: 'x', region_id: '00000000-0000-0000-0000-000000000000' },
        'PROFILE_VALIDATION_FAILED',
      ],
      [{ type: 'PROJECT', name: 'x', region_id: DOMAIN }, 'PROFILE_VALIDATION_FAILED'],
      [
        { type: 'PROJECT', name: 'x', domain_ids: ['00000000-0000-0000-0000-000000000000'] },
        'PROFILE_VALIDATION_FAILED',
      ],
      [{ type: 'PROJECT', name: 'x', domain_ids: [SKILL] }, 'PROFILE_VALIDATION_FAILED'],
      [
        { type: 'PROJECT', name: 'x', owner_profile_id: other.profileId },
        'PROFILE_VALIDATION_FAILED',
      ],
      [{ type: 'PROJECT', name: 'x', status: 'ACTIVE' }, 'PROFILE_VALIDATION_FAILED'],
    ] as const) {
      const r = await page.request.post(VENTURES, { data })
      expect(r.status(), JSON.stringify(data)).toBe(422)
      expect((await r.json()).error.code).toBe(code)
    }
    const v = await (
      await page.request.post(VENTURES, { data: { type: 'STARTUP', name: 'Own' } })
    ).json()
    const typeChange = await page.request.patch(`${VENTURES}/${v.id}`, {
      data: { type: 'PROJECT' },
    })
    expect(typeChange.status()).toBe(422)
    expect((await typeChange.json()).error.fields).toEqual({ type: 'immutable' })
    expect(
      await query('SELECT 1 FROM projects WHERE owner_profile_id = $1', [other.profileId]),
    ).toHaveLength(0)
    await otherCtx.dispose()
  })

  test('19/20/22. members read-only, strangers 404, ACTIVE editable, ARCHIVED read-only', async ({
    page,
    playwright,
  }) => {
    const owner = await completedMember(page.request, 's05-owner')
    const v = await (
      await page.request.post(VENTURES, { data: { type: 'STARTUP', name: 'Shared' } })
    ).json()
    const memberCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const teammate = await completedMember(memberCtx, 's05-mate')
    const strangerCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(strangerCtx, 's05-stranger')
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state) VALUES ($1, $2, 'Owner', 'ACTIVE')`,
      [v.id, teammate.profileId],
    )

    const seen = await (await memberCtx.get(`${VENTURES}/${v.id}`)).json()
    expect([seen.relation, seen.can_edit]).toEqual(['MEMBER', false])
    const denied = await memberCtx.patch(`${VENTURES}/${v.id}`, { data: { name: 'Hijack' } })
    expect(denied.status()).toBe(403)
    expect((await denied.json()).error.code).toBe('SCOPE_FORBIDDEN')
    for (const r of [
      await strangerCtx.get(`${VENTURES}/${v.id}`),
      await strangerCtx.patch(`${VENTURES}/${v.id}`, { data: { name: 'x' } }),
    ]) {
      expect(r.status()).toBe(404)
    }

    await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [v.id])
    expect(
      (await page.request.patch(`${VENTURES}/${v.id}`, { data: { name: 'Active edit' } })).status(),
    ).toBe(200)
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    const archived = await page.request.patch(`${VENTURES}/${v.id}`, { data: { name: 'No' } })
    expect(archived.status()).toBe(409)
    expect((await archived.json()).error.code).toBe('PROFILE_DEACTIVATED')

    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(page.locator('[data-state="read-only"]')).toContainText('lưu trữ')
    await expect(save(page)).toHaveCount(0)
    await expect(page.getByLabel('Tên')).toBeDisabled()
    await expect(page.locator('[data-status]')).toHaveText('Đã lưu trữ')
    void owner
    await memberCtx.dispose()
    await strangerCtx.dispose()
  })

  test('a stranger opening the edit page gets 404; no metadata or slug reaches the page', async ({
    page,
    playwright,
  }) => {
    const ownerCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    await completedMember(ownerCtx, 's05-o')
    const v = await (
      await ownerCtx.post(VENTURES, { data: { type: 'PROJECT', name: 'Private' } })
    ).json()
    await completedMember(page.request, 's05-s')
    const res = await page.goto(`/projects/${v.id}/edit`)
    expect(res?.status()).toBe(404)
    const [row] = await query<{ slug: string }>('SELECT slug FROM projects WHERE id = $1', [v.id])
    const own = await (await ownerCtx.get(`${VENTURES}/${v.id}`)).json()
    expect(JSON.stringify(own)).not.toContain(row!.slug)
    expect(Object.keys(own).sort()).toEqual([
      'can_edit',
      'domains',
      'id',
      'name',
      'region',
      'relation',
      'status',
      'summary',
      'type',
    ])
    await ownerCtx.dispose()
  })
})

test.describe('WF02-S05 pixel QA', () => {
  test('viewport + full page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S05')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S05')!, {
      afterLoad: async (p) => {
        await expect(p.locator('[data-venture-editor]')).toBeVisible()
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')
    expect(full.below_reference?.unexpected_pixels, 'UI below the reference height').toBe(0)

    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const TEXT: Rect[] = [{ x: 60, y: 20, width: 300, height: 46 }]
    // INTENTIONAL-P0-SCOPE: "Xem bản public" + "Gửi HUB duyệt"; INTENTIONAL-CONTRACT: "Lưu".
    const ACTIONS: Rect = { x: 1068, y: 14, width: 314, height: 56 }
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const diffPath = resolveOutputPath('diff', 'WF02-S05.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      [{ name: 'editor-header', reference: { x: 0, y: 0, width: 1440, height: 90 }, dy: 0 }],
      [...TEXT, ACTIONS],
      { diffPath },
    )
    writeJsonReport('WF02-S05.segments.json', {
      screen_id: 'WF02-S05',
      state: qaConfigFor('WF02-S05')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: ACTIONS,
          reason:
            'DEC-WF02-H3/H6: "Xem bản public" and "Gửi HUB duyệt" not rendered; "Lưu" in their place (G1)',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 64, y: 113, width: 1312, height: 72 },
          reason: 'DEC-WF02-H6: required-field progress card not rendered',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 64, y: 200, width: 1312, height: 630 },
          reason:
            'DEC-WF02-H6: A–J navigator, section C (C1–C5, image upload) and editorial rules not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-S05-G1: canonical form (Loại, Tên, Tóm tắt, Lĩnh vực, Tỉnh / Thành phố) in S02 field language; not compared',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason: 'header status shows the lifecycle label instead of the unsupported completion %',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'title/status glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
