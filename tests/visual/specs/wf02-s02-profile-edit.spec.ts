import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { FIXTURES, qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF02-S02 — Profile Edit (/me/profile/edit). Production.
 * Decisions DEC-WF02-H1/H2/H3, DEC-WF02-S02-D1..D7.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const REGION_2 = '20000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SKILL = '20000000-0000-0000-0000-000000000021'
const PROFILE_API = '/api/v1/me/profile'
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

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

/** Completed WF01 member at 50%: name, headline, region, domain, skill. */
async function completedMember(request: APIRequestContext, label = 's02'): Promise<Member> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  expect(
    (await request.put('/api/v1/me/onboarding/intent', { data: { action: 'SKIP' } })).ok(),
  ).toBe(true)
  expect(
    (
      await request.patch(PROFILE_API, {
        data: {
          display_name: 'Đặng Kim Chi',
          headline: 'QA',
          region_id: REGION,
          domain_ids: [DOMAIN],
          skill_ids: [SKILL],
        },
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
    `SELECT a.id::text AS account_id, p.id::text AS profile_id
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id WHERE a.email_normalized = $1`,
    [email],
  )
  return { email, accountId: row!.account_id, profileId: row!.profile_id }
}

const completion = async (request: APIRequestContext) =>
  (await (await request.get('/api/v1/me/profile/completion')).json()).percent as number

async function openEditor(page: Page) {
  await page.goto('/me/profile/edit', { waitUntil: 'networkidle' })
  await expect(page.locator('[data-editor]')).toBeVisible()
}

async function save(page: Page) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith(PROFILE_API) && r.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  return response
}

test.describe('WF02-S02 guards', () => {
  test('guest → /auth; PATCH 401', async ({ page, request }) => {
    await page.goto('/me/profile/edit')
    await expect(page).toHaveURL('/auth')
    expect((await request.patch(PROFILE_API, { data: { headline: 'x' } })).status()).toBe(401)
  })

  test('an account that has not finished onboarding → its resolver step', async ({ page }) => {
    expect(
      (
        await page.request.post('/dev/login', {
          data: { email: `s02-new-${Date.now()}@example.test` },
        })
      ).ok(),
    ).toBe(true)
    await page.goto('/me/profile/edit')
    await expect(page).toHaveURL('/onboarding/purpose')
  })
})

test.describe('WF02-S02 functional', () => {
  test('1/10/12/13/15. H1 groups through the UI raise completion to 80% and beyond; S01 follows', async ({
    page,
  }) => {
    await completedMember(page.request)
    expect(await completion(page.request)).toBe(50)
    await openEditor(page)
    await expect(page.getByLabel('Chức danh')).toHaveValue('QA')
    await expect(page.getByLabel('Họ và tên')).toHaveValue('Đặng Kim Chi')
    await expect(page.getByLabel('Tỉnh / thành phố')).toHaveValue(REGION)
    await expect(page.getByText('Hiển thị trong mạng lưới')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Xem bản public' })).toHaveCount(0)
    await expect(page.getByText('ẨN MỤC TRONG TIẾN TRÌNH')).toHaveCount(0)

    await page.getByLabel('Giới thiệu').fill('Tám năm làm vận hành chuỗi cung ứng.')
    await page.getByRole('button', { name: '+ Thêm kinh nghiệm' }).click()
    await page.getByLabel('Vị trí 1').fill('Product Manager')
    await page.getByLabel('Tổ chức 1').fill('Tracely')
    await page.getByLabel('Mục tiêu phát triển').fill('Xây sản phẩm khu vực công')
    const res = await save(page)
    expect(res.status()).toBe(200)
    // Only changed fields are sent (partial PATCH).
    expect(Object.keys(res.request().postDataJSON()).sort()).toEqual([
      'bio',
      'development_goal',
      'experience',
    ])
    expect(await completion(page.request)).toBe(80)
    await expect(page.locator('[data-status]')).toContainText('đã lưu lúc')

    await page.getByLabel('Nhu cầu hiện tại').fill('Tìm cố vấn sản phẩm')
    await save(page)
    expect(await completion(page.request)).toBe(90)

    await page.goto('/me', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-completion]')).toHaveText(
      'Hồ sơ hoàn thiện 90% · còn thiếu ảnh đại diện',
    )
  })

  test('11/16. NO_EXPERIENCE_YET completes group 8; clearing lowers completion', async ({
    page,
  }) => {
    await completedMember(page.request)
    await openEditor(page)
    await page.getByLabel('Tôi chưa có kinh nghiệm làm việc').check()
    await save(page)
    expect(await completion(page.request)).toBe(60)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByLabel('Tôi chưa có kinh nghiệm làm việc')).toBeChecked()
    await page.getByLabel('Tôi chưa có kinh nghiệm làm việc').uncheck()
    await save(page)
    expect(await completion(page.request)).toBe(50)
  })

  test('2/3/4/5/6. scalars, region and expertise edits persist', async ({ page }) => {
    await completedMember(page.request)
    await openEditor(page)
    await page.getByLabel('Chức danh').fill('Đồng sáng lập · CEO')
    await page.getByLabel('Tỉnh / thành phố').selectOption(REGION_2)
    await page.getByRole('button', { name: 'Nhóm chuyên môn' }).click()
    const chips = page.getByRole('list', { name: 'Nhóm chuyên môn' }).getByRole('button')
    // Deselect the current two, pick one other.
    for (const chip of await chips.all()) {
      if ((await chip.getAttribute('aria-pressed')) === 'true') await chip.click()
    }
    await chips.nth(2).click()
    await page.getByRole('textbox', { name: 'Liên kết ngoài' }).first().fill('linkedin.com/in/chi')
    expect((await save(page)).status()).toBe(200)
    const dto = await (await page.request.get(PROFILE_API)).json()
    expect(dto.headline).toBe('Đồng sáng lập · CEO')
    expect(dto.region.id).toBe(REGION_2)
    expect(dto.domains.length + dto.skills.length).toBe(1)
    expect(dto.links.map((l: { url: string }) => l.url)).toEqual(['https://linkedin.com/in/chi'])
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByLabel('Chức danh')).toHaveValue('Đồng sáng lập · CEO')
  })

  test('17. an unchanged save sends an empty PATCH and emits no analytics', async ({ page }) => {
    const m = await completedMember(page.request)
    const events = async () =>
      (
        await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM analytics_events WHERE account_id = $1`,
          [m.accountId],
        )
      )[0]!.n
    const before = await events()
    await openEditor(page)
    const res = await save(page)
    expect(res.request().postDataJSON()).toEqual({})
    expect(res.status()).toBe(200)
    expect(await events()).toBe(before)
  })

  test('14. avatar upload uses the media pipeline and counts once stored', async ({ page }) => {
    await completedMember(page.request)
    await openEditor(page)
    const upload = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/profile/avatar'))
    await page
      .getByLabel('Ảnh đại diện', { exact: true })
      .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG_1X1 })
    expect((await upload).ok()).toBe(true)
    await expect(page.getByRole('img', { name: 'Ảnh đại diện hiện tại' })).toBeVisible()
    expect(await completion(page.request)).toBe(60)
    // 25. a refused file shows an error and changes nothing.
    const refused = page.waitForResponse((r) => r.url().endsWith('/api/v1/me/profile/avatar'))
    await page
      .getByLabel('Ảnh đại diện', { exact: true })
      .setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') })
    expect((await refused).status()).toBe(422)
    await expect(page.getByText('Chỉ nhận ảnh PNG, JPEG hoặc WebP.')).toBeVisible()
    expect(await completion(page.request)).toBe(60)
  })

  test('8/9/18. archived or wrong-type vocabulary and invalid links fail atomically', async ({
    page,
  }) => {
    await completedMember(page.request)
    const [archived] = await query<{ id: string }>(
      `INSERT INTO vocabulary_items (type_code, slug, label, status) VALUES ('DOMAIN', $1, 'Archived QA', 'ARCHIVED') RETURNING id::text`,
      [`archived-s02-${Date.now()}`],
    )
    try {
      const archivedNew = await page.request.patch(PROFILE_API, {
        data: { development_goal: 'X', domain_ids: [archived!.id] },
      })
      expect(archivedNew.status()).toBe(422)
      const wrongType = await page.request.patch(PROFILE_API, {
        data: { current_need: 'X', domain_ids: [SKILL] },
      })
      expect(wrongType.status()).toBe(422)
      const badLink = await page.request.patch(PROFILE_API, {
        data: { bio: 'X', links: [{ url: 'javascript:alert(1)' }] },
      })
      expect((await badLink.json()).error.fields).toEqual({ links: 'invalid_url' })
      const dto = await (await page.request.get(PROFILE_API)).json()
      expect([dto.development_goal, dto.current_need, dto.bio]).toEqual([null, null, null])
      // 7. an archived item already linked stays readable and retainable.
      await query('UPDATE vocabulary_items SET status = $2 WHERE id = $1', [DOMAIN, 'ARCHIVED'])
      try {
        const keep = await page.request.patch(PROFILE_API, {
          data: { domain_ids: [DOMAIN], bio: 'Kept' },
        })
        expect(keep.status()).toBe(200)
        expect(
          (await keep.json()).domains.map((d: { id: string; status: string }) => [d.id, d.status]),
        ).toEqual([[DOMAIN, 'ARCHIVED']])
      } finally {
        await query('UPDATE vocabulary_items SET status = $2 WHERE id = $1', [DOMAIN, 'ACTIVE'])
      }
    } finally {
      await query('DELETE FROM vocabulary_items WHERE id = $1', [archived!.id])
    }
  })

  test('23. a failing save shows an error and keeps the typed values', async ({ page }) => {
    await completedMember(page.request)
    await openEditor(page)
    await page.route('**/api/v1/me/profile', (r) =>
      r.request().method() === 'PATCH'
        ? r.fulfill({
            status: 500,
            contentType: 'application/json',
            body: '{"error":{"code":"INTERNAL_ERROR","message":"x","request_id":"r"}}',
          })
        : r.continue(),
    )
    await page.getByLabel('Mục tiêu phát triển').fill('Giữ lại')
    await save(page)
    await expect(page.getByText('Chưa lưu được thay đổi. Vui lòng thử lại.')).toBeVisible()
    await expect(page.getByLabel('Mục tiêu phát triển')).toHaveValue('Giữ lại')
    await page.unroute('**/api/v1/me/profile')
    expect((await save(page)).status()).toBe(200)
    expect(await completion(page.request)).toBe(60)
  })

  test('20. logout/login keeps the saved profile', async ({ page }) => {
    const m = await completedMember(page.request)
    await openEditor(page)
    await page.getByLabel('Mục tiêu phát triển').fill('Bền vững')
    await save(page)
    expect((await page.request.post('/api/v1/auth/logout')).ok()).toBe(true)
    await page.goto('/me/profile/edit')
    await expect(page).toHaveURL('/auth')
    expect((await page.request.post('/dev/login', { data: { email: m.email } })).ok()).toBe(true)
    await openEditor(page)
    await expect(page.getByLabel('Mục tiêu phát triển')).toHaveValue('Bền vững')
  })
})

test.describe('WF02-S02 security', () => {
  test('owner-only: foreign ids, server fields and a foreign asset are refused; no side effects', async ({
    page,
    playwright,
  }) => {
    const otherCtx = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
    })
    const other = await completedMember(otherCtx, 's02-other')
    const upload = await otherCtx.post('/api/v1/me/profile/avatar', {
      multipart: { file: { name: 'o.png', mimeType: 'image/png', buffer: PNG_1X1 } },
    })
    const foreignAsset = (await upload.json()).asset_id
    const self = await completedMember(page.request, 's02-self')
    for (const data of [
      { headline: 'x', profile_id: other.profileId },
      { headline: 'x', account_id: other.accountId },
      { headline: 'x', completion_percent: 100 },
      { headline: 'x', status: 'DEACTIVATED' },
      { headline: 'x', avatar_asset_id: foreignAsset },
      { headline: 'x', onboarding_completed_at: null },
    ]) {
      const r = await page.request.patch(PROFILE_API, { data })
      expect(r.status(), JSON.stringify(data)).toBe(422)
      expect((await r.json()).error.code).toBe('PROFILE_VALIDATION_FAILED')
    }
    // ACTIVE profile keeps its activation minimum.
    expect((await page.request.patch(PROFILE_API, { data: { display_name: '  ' } })).status()).toBe(
      422,
    )
    const mine = await (await page.request.get(PROFILE_API)).json()
    const theirs = await (await otherCtx.get(PROFILE_API)).json()
    expect(mine.headline).toBe('QA')
    expect(mine.avatar).toBeNull()
    expect(theirs.headline).toBe('QA')
    expect(JSON.stringify(mine)).not.toMatch(
      /email|account_id|token|onboarding_completed_at|"metadata"/,
    )

    // Visibility, membership and leadership are untouched by an edit.
    const snap = () =>
      query(
        `SELECT (SELECT group_overrides::text FROM profile_visibility_settings WHERE profile_id = $1) AS v,
                (SELECT count(*)::int FROM community_memberships WHERE profile_id = $1) AS m,
                (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS l`,
        [self.profileId],
      )
    const before = await snap()
    await page.request.patch(PROFILE_API, {
      data: { headline: 'Mới', region_id: REGION_2, bio: 'B' },
    })
    expect(await snap()).toEqual(before)
    await otherCtx.dispose()
  })
})

test.describe('WF02-S02 pixel QA', () => {
  test('viewport + full page (DEC-WF02-H12) against the approved reference', async ({ page }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF02-S02')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF02-S02')!, {
      afterLoad: async (p) => {
        await expect(p.locator('[data-editor]')).toBeVisible()
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    const full = reports.find((r) => r.capture === 'full_page')!
    expect(viewport.typography?.violations).toEqual([])
    expect(full.full_page_rule).toBe('CROP_TO_REFERENCE_HEIGHT')

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
      for (const input of document.querySelectorAll('input[type="text"], input:not([type])')) {
        // Input values are text too: mask the text line inside each box.
        const r = input.getBoundingClientRect()
        rects.push({ x: r.x + 12, y: r.y + 12, width: r.width - 24, height: r.height - 24 })
      }
      return rects
    })
    const REF_TEXT: Rect[] = [
      { x: 60, y: 20, width: 260, height: 46 }, // name + status
      { x: 60, y: 112, width: 300, height: 20 },
      { x: 60, y: 208, width: 300, height: 48 },
      { x: 60, y: 334, width: 340, height: 46 },
      { x: 60, y: 456, width: 300, height: 48 },
      ...[140, 264, 388, 512].map((y) => ({ x: 76, y: y + 12, width: 836, height: 28 })),
      { x: 1300, y: 26, width: 82, height: 32 }, // "Lưu"
    ]
    // INTENTIONAL-P0-SCOPE: "Xem bản public" (DEC-WF02-H3).
    const PUBLIC_BUTTON: Rect = { x: 1140, y: 14, width: 162, height: 56 }
    const noteTop = Math.round((await page.locator('aside section').nth(1).boundingBox())!.y)
    const noteDy = noteTop - 421
    const reference = readPng(path.join(REPO_ROOT, screen.viewport_baseline))
    const diffPath = resolveOutputPath('diff', 'WF02-S02.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 86 }, dy: 0 },
        { name: 'approved-fields', reference: { x: 0, y: 86, width: 940, height: 490 }, dy: 0 },
        { name: 'note-card', reference: { x: 944, y: 415, width: 444, height: 116 }, dy: noteDy },
      ],
      [
        ...textMask,
        ...REF_TEXT,
        PUBLIC_BUTTON,
        { x: 970, y: 434 + noteDy, width: 395, height: 76 }, // note text (reworded)
      ],
      { diffPath },
    )
    writeJsonReport('WF02-S02.segments.json', {
      screen_id: 'WF02-S02',
      state: qaConfigFor('WF02-S02')!.state,
      full_page: { rule: full.full_page_rule, below_reference: full.below_reference },
      intentional: [
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: PUBLIC_BUTTON,
          reason: 'DEC-WF02-H3: "Xem bản public" omitted; "Hồ sơ đang public" → network wording',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reference_region: { x: 956, y: 113, width: 420, height: 292 },
          reason: 'DEC-WF02-H2: "Ẩn mục trong tiến trình" activity panel not rendered',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-S02-D5: basic-info card (name, avatar, region) in the freed side slot; note card shifts by noteDy',
          vertical_effect_px: noteDy,
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF02-H1: experience, development goal and current need below the approved fields (also the only content below the 620px full-page reference height)',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason: 'DEC-WF02-S02-D6: note body reworded (no consent-by-purpose contact claim)',
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
    // Whatever lies below the reference height belongs to the H1 addendum only.
    const h1Top = Math.round((await page.locator('[data-h1="experience"]').boundingBox())!.y)
    const bbox = full.below_reference?.unexpected_bbox
    if (bbox) {
      // Only the H1 sections, inside the 860px form column (x 64..924).
      expect(h1Top).toBeLessThanOrEqual(620)
      expect(bbox.x).toBeGreaterThanOrEqual(64)
      expect(bbox.x + bbox.width).toBeLessThanOrEqual(924)
    }
  })
})
