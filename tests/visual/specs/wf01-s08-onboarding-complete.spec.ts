import path from 'node:path'

import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng, writeBuffer } from '../pixel-qa/png'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect, type Segment } from '../pixel-qa/segments'

/**
 * WF01-S08 — Onboarding Complete (/onboarding/complete). Production.
 * Decisions DEC-WF01-S08-D1..D8 (docs/decisions/DECISION_LOG.md).
 */

const COMPLETE_API = '/api/v1/me/onboarding/complete'
const REGION = '20000000-0000-0000-0000-000000000002'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    // Simulated 422/500 answers are the scenario under test.
    if (m.type() === 'error' && !/status of (422|500)/.test(m.text())) consoleErrors.push(m.text())
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

async function signInFresh(request: APIRequestContext): Promise<string> {
  const email = `s08-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const response = await request.post('/dev/login', { data: { email } })
  expect(response.ok()).toBe(true)
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return row!.id
}

/** Satisfies exactly the activation minimum: name, region, both current documents. */
async function makeReady(request: APIRequestContext, legal = true) {
  const patch = await request.patch('/api/v1/me/profile', {
    data: { display_name: 'Đặng Kim Chi', region_id: REGION },
  })
  expect(patch.status()).toBe(200)
  if (!legal) return
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    const r = await request.post('/api/v1/me/consents/accept', {
      data: { consent_type: doc.type, policy_version: doc.version },
    })
    expect(r.ok()).toBe(true)
  }
}

async function profile(accountId: string) {
  return query<{ status: string; completed_at: Date | null }>(
    `SELECT status::text AS status, onboarding_completed_at AS completed_at
       FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
}

const countFor = async (table: string, column: string, value: string, accountId: string) =>
  (
    await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${table} WHERE ${table === 'audit_events' ? 'actor_account_id' : 'account_id'} = $1 AND ${column} = $2`,
      [accountId, value],
    )
  )[0]!.n

const cta = (page: Page) => page.getByRole('link', { name: 'Vào 1hub.network' })

async function openComplete(page: Page) {
  await page.goto('/onboarding/complete', { waitUntil: 'networkidle' })
}

test.describe('WF01-S08 functional and security', () => {
  test('a guest is sent to /auth; the API refuses', async ({ page, request }) => {
    await page.goto('/onboarding/complete')
    await expect(page).toHaveURL('/auth')
    expect((await request.post(COMPLETE_API)).status()).toBe(401)
  })

  test('D1: opening S08 completes onboarding; success only after the server confirms', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    await makeReady(page.request)
    const completion = page.waitForResponse((r) => r.url().endsWith(COMPLETE_API))
    await openComplete(page)
    expect((await completion).status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xong. Giờ làm gì?')
    expect(await profile(accountId)).toMatchObject([{ status: 'ACTIVE' }])
    expect((await profile(accountId))[0]!.completed_at).toBeInstanceOf(Date)
  })

  test('below 80% and with NULL intent the profile still completes; percent is the server’s', async ({
    page,
  }) => {
    await signInFresh(page.request)
    await makeReady(page.request)
    await openComplete(page)
    const server = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(server.percent).toBeLessThan(80)
    await expect(page.locator('[data-completion]')).toContainText(`${server.percent}%`)
  })

  test('missing requirements: 422 with fields, no false success, links back to the steps', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    await makeReady(page.request, false)
    const response = await page.request.post(COMPLETE_API)
    expect(response.status()).toBe(422)
    expect((await response.json()).error).toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
      fields: { TERMS_ACCEPTANCE: 'missing', PRIVACY_DATA_PROCESSING: 'missing' },
    })
    await openComplete(page)
    await expect(page.getByRole('heading', { name: 'Chưa hoàn tất được' })).toBeVisible()
    await expect(page.getByText('Xong. Giờ làm gì?')).toHaveCount(0)
    await expect(cta(page)).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Đồng ý với Điều khoản/ })).toHaveAttribute(
      'href',
      '/onboarding/privacy',
    )
    expect(await profile(accountId)).toMatchObject([{ status: 'DRAFT', completed_at: null }])
    expect(await countFor('audit_events', 'action', 'PROFILE_ACTIVATED', accountId)).toBe(0)
  })

  test('missing name and region point to S06', async ({ page }) => {
    await signInFresh(page.request)
    await openComplete(page)
    await expect(page.getByRole('link', { name: 'Họ và tên, tỉnh / thành phố' })).toHaveAttribute(
      'href',
      '/onboarding/profile',
    )
  })

  test('idempotent: retries and refresh keep one transition and the first timestamp', async ({
    page,
  }) => {
    const accountId = await signInFresh(page.request)
    await makeReady(page.request)
    const first = await page.request.post(COMPLETE_API, { data: { completion_percent: 100 } })
    expect(first.status()).toBe(200)
    const body = await first.json()
    const server = await (await page.request.get('/api/v1/me/profile/completion')).json()
    // The client's completion_percent is never read.
    expect(body).toEqual({
      completed: true,
      profile_status: 'ACTIVE',
      completion_percent: server.percent,
      next: '/me',
    })
    const stamp = (await profile(accountId))[0]!.completed_at!

    const retry = await page.request.post(COMPLETE_API)
    expect(retry.status()).toBe(200)
    expect(await retry.json()).toEqual(body)
    await openComplete(page)
    await expect(cta(page)).toBeVisible()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(cta(page)).toBeVisible()

    const rows = await profile(accountId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.completed_at!.getTime()).toBe(stamp.getTime())
    expect(await countFor('audit_events', 'action', 'PROFILE_ACTIVATED', accountId)).toBe(1)
    expect(
      await countFor('analytics_events', 'event_name', 'onboarding_completed', accountId),
    ).toBe(1)
  })

  test('concurrent completion requests produce one transition', async ({ page }) => {
    const accountId = await signInFresh(page.request)
    await makeReady(page.request)
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => page.request.post(COMPLETE_API)),
    )
    expect(responses.map((r) => r.status())).toEqual([200, 200, 200, 200])
    expect(await countFor('audit_events', 'action', 'PROFILE_ACTIVATED', accountId)).toBe(1)
    expect(
      await countFor('analytics_events', 'event_name', 'onboarding_completed', accountId),
    ).toBe(1)
  })

  test('/session reflects completion immediately', async ({ page }) => {
    await signInFresh(page.request)
    await makeReady(page.request)
    const before = await (await page.request.get('/api/v1/session')).json()
    expect(before.profile).toMatchObject({ status: 'DRAFT', onboarding_completed: false })
    const done = await (await page.request.post(COMPLETE_API)).json()
    const after = await (await page.request.get('/api/v1/session')).json()
    expect(after.profile).toMatchObject({
      status: 'ACTIVE',
      onboarding_completed: true,
      completion_percent: done.completion_percent,
    })
    // Earlier onboarding steps now send the user to /me.
    await page.goto('/onboarding/privacy')
    await expect(page).toHaveURL('/me')
  })

  test('audit and analytics carry no profile or consent content', async ({ page }) => {
    const accountId = await signInFresh(page.request)
    await makeReady(page.request)
    await page.request.post(COMPLETE_API)
    const rows = await query<{ payload: unknown }>(
      `SELECT jsonb_build_array(before_data, after_data) AS payload FROM audit_events
        WHERE actor_account_id = $1 AND action = 'PROFILE_ACTIVATED'
       UNION ALL
       SELECT properties FROM analytics_events WHERE account_id = $1`,
      [accountId],
    )
    const text = JSON.stringify(rows)
    expect(text).not.toMatch(/Đặng Kim Chi|@example\.test|TERMS_ACCEPTANCE|PRIVACY|policy/)
    const [event] = await query<{ properties: Record<string, unknown> }>(
      `SELECT properties FROM analytics_events WHERE account_id = $1 AND event_name = 'onboarding_completed'`,
      [accountId],
    )
    expect(event!.properties).toMatchObject({
      event_name: 'onboarding_completed',
      workflow: 'WF01',
      screen_id: 'WF01-S08',
      account_id: accountId,
    })
  })

  test('a transient failure shows no success and can be retried', async ({ page }) => {
    const accountId = await signInFresh(page.request)
    await makeReady(page.request)
    let calls = 0
    await page.route(`**${COMPLETE_API}`, (route) => {
      calls++
      return calls === 1
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x', request_id: 'r' } }),
          })
        : route.continue()
    })
    await openComplete(page)
    await expect(page.getByText('Chưa hoàn tất được. Vui lòng thử lại.')).toBeVisible()
    await expect(cta(page)).toHaveCount(0)
    expect(await profile(accountId)).toMatchObject([{ status: 'DRAFT' }])
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(cta(page)).toBeVisible()
    expect(await profile(accountId)).toMatchObject([{ status: 'ACTIVE' }])
  })

  test('D2–D4/D6: /me exit + card 02 project action (DEC-P0-SHELL-D6); no Challenge or Chapter action; no skip', async ({
    page,
  }) => {
    await signInFresh(page.request)
    await makeReady(page.request)
    await openComplete(page)
    await expect(cta(page)).toHaveAttribute('href', '/me')
    const links = await page
      .locator('main a, header a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
    expect(links).toEqual(['/', '/projects/new', '/me'])
    // Only card 02 of the reference is rendered (card 01 Challenge / card 03 Chapter stay omitted).
    await expect(page.locator('[data-action-card]')).toHaveCount(1)
    await expect(page.locator('[data-action-card="project"]')).toContainText('Lập hồ sơ đội')
    const text = (await page.locator('body').innerText()).toLowerCase()
    for (const absent of ['bài toán', 'chapter', 'bỏ qua, làm sau', 'dự sự kiện']) {
      expect(text, absent).not.toContain(absent)
    }
    // The stepper is finished and not interactive.
    await expect(page.locator('[aria-current="step"]')).toHaveCount(0)
    await expect(page.locator('header ol a, header ol button')).toHaveCount(0)
    await cta(page).click()
    await expect(page).toHaveURL('/me')
  })

  test('keyboard and a11y', async ({ page }) => {
    await signInFresh(page.request)
    await makeReady(page.request)
    await openComplete(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    // P0-SHELL (DEC-P0-SHELL-D1): the wordmark → / is the first Tab stop.
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-nav="home"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-nav="create-project"]')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(cta(page)).toBeFocused()
    expect(await cta(page).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/me')
  })

  test('key text colours match the approved inks', async ({ page }) => {
    await signInFresh(page.request)
    await makeReady(page.request)
    await openComplete(page)
    await expect(cta(page)).toBeVisible()
    const colours = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
      const rgb = (el: Element | null) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = getComputedStyle(el!).color
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)]
      }
      return {
        title: rgb(document.querySelector('h1')),
        lede: rgb(document.querySelector('h1 + p')),
        info: rgb(document.querySelector('[data-completion] p')),
        cta: rgb(document.querySelector('a.ui-button')),
      }
    })
    // Inks read from the approved WF01-S08 bitmap; +-3 per channel for raster rounding.
    const APPROVED: Record<keyof typeof colours, [number, number, number]> = {
      title: [0x17, 0x00, 0x02],
      lede: [0x53, 0x40, 0x41],
      info: [0x53, 0x40, 0x41],
      cta: [0x16, 0x00, 0x02],
    }
    for (const key of Object.keys(APPROVED) as (keyof typeof colours)[]) {
      colours[key].forEach((channel, i) => {
        expect(Math.abs(channel - APPROVED[key][i]!), `${key} channel ${i}`).toBeLessThanOrEqual(3)
      })
    }
  })
})

test.describe('WF01-S08 pixel QA', () => {
  /**
   * Measured once from the frozen reference: card 195–767, vertically centred
   * in the canvas; cards 01–03 at y 321–633 (not rendered, D2–D4); info panel
   * at 657. The runtime card is shorter (no cards; the /me CTA is added, D6),
   * so each region is compared at its own offset.
   */
  const REF = {
    cardTop: 195,
    panelTop: 657,
    cardBottom: 767,
    skip: { x: 1290, y: 0, width: 150, height: 62 },
    cards: { x: 340, y: 316, width: 760, height: 322 },
    /** Card 02 "Lập hồ sơ đội" of the reference (rendered since DEC-P0-SHELL-D6). */
    projectCard: { x: 377, y: 423, width: 686, height: 89 },
    discs: [544, 661],
    connectors: [625, 762],
    /** Baseline copy replaced by D5/D7 (text regions of the old wording). */
    replacedCopy: {
      lede: { x: 375, y: 274, width: 570, height: 22 },
      info: { x: 415, y: 670, width: 625, height: 46 },
    },
  } as const

  test('manifest-driven capture, typography contract and segment comparison', async ({ page }) => {
    const { screens } = loadManifest()
    const reports = await runScreenQa(
      page,
      findScreen(screens, 'WF01-S08'),
      qaConfigFor('WF01-S08')!,
      {
        beforeNavigate: async (p) => {
          await makeReady(p.request)
        },
        afterLoad: async (p) => {
          await expect(cta(p)).toBeVisible()
        },
      },
    )
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.conditions).toEqual({
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      fonts: 'loaded',
    })
    expect(viewport.typography!.violations).toEqual([])

    const fullBuffer = await page.screenshot({ fullPage: true, animations: 'disabled' })
    const fullPath = resolveOutputPath('actual', 'WF01-S08.full_page.png')
    writeBuffer(fullPath, fullBuffer)
    const actual = decodePng(fullBuffer)

    const card = (await page.locator('[data-ui="surface"]').boundingBox())!
    const panel = (await page.locator('[data-completion]').boundingBox())!
    const projectCard = (await page.locator('[data-action-card="project"]').boundingBox())!
    const upperDy = Math.round(card.y) - REF.cardTop
    const panelDy = Math.round(panel.y) - REF.panelTop
    const bottomDy = Math.round(card.y + card.height) - REF.cardBottom
    const discs = await page
      .locator('ol li > span:first-child')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)))
    const steps = await page
      .locator('ol li')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)))

    const textMask: Rect[] = await page.evaluate(() => {
      const rects: { x: number; y: number; width: number; height: number }[] = []
      const add = (r: DOMRect, pad = 2) =>
        rects.push({
          x: r.x - pad,
          y: r.y - pad,
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        })
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const node = walker.currentNode
        if (!node.textContent!.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of range.getClientRects()) add(r)
      }
      for (const svg of document.querySelectorAll('svg')) add(svg.getBoundingClientRect(), 1)
      return rects
    })
    // RASTER-NOISE: the baseline card edges sit on half pixels.
    const rasterRows: Rect[] = [
      { x: card.x, y: Math.round(card.y) - 2, width: card.width, height: 4 },
      { x: card.x, y: Math.round(card.y + card.height) - 2, width: card.width, height: 4 },
    ]

    const replaced: Rect[] = [
      { ...REF.replacedCopy.lede, y: REF.replacedCopy.lede.y + upperDy },
      { ...REF.replacedCopy.info, y: REF.replacedCopy.info.y + panelDy },
    ]

    const segments: Segment[] = [
      { name: 'header-left', reference: { x: 0, y: 0, width: 300, height: 64 }, dy: 0 },
      { name: 'header-right', reference: { x: 1140, y: 0, width: 150, height: 64 }, dy: 0 },
      ...REF.discs.map((x, i) => ({
        name: `step-${i + 1}-disc`,
        reference: { x: x - 4, y: 16, width: 30, height: 30 },
        dy: 0,
        dx: discs[i]! - x,
      })),
      ...REF.connectors.map((x, i) => ({
        name: `connector-${i + 1}`,
        reference: { x: x - 2, y: 27, width: 30, height: 8 },
        dy: 0,
        dx: steps[i + 1]! + 12 - x,
      })),
      { name: 'canvas-left', reference: { x: 0, y: 64, width: 300, height: 836 }, dy: 0 },
      { name: 'canvas-right', reference: { x: 1140, y: 64, width: 300, height: 836 }, dy: 0 },
      {
        name: 'card-upper',
        reference: {
          x: 340,
          y: REF.cardTop - 12,
          width: 760,
          height: REF.cards.y - REF.cardTop + 12,
        },
        dy: upperDy,
      },
      // DEC-P0-SHELL-D6: the rendered card 02 against the reference card 02 (text masked).
      {
        name: 'project-card',
        reference: {
          x: REF.projectCard.x - 4,
          y: REF.projectCard.y - 4,
          width: REF.projectCard.width + 8,
          height: REF.projectCard.height + 8,
        },
        dx: Math.round(projectCard.x) - REF.projectCard.x,
        dy: Math.round(projectCard.y) - REF.projectCard.y,
      },
      {
        name: 'info-panel-top',
        reference: { x: 377, y: REF.panelTop, width: 686, height: 40 },
        dy: panelDy,
      },
      {
        name: 'card-bottom',
        reference: { x: 340, y: REF.cardBottom - 26, width: 760, height: 60 },
        dy: bottomDy,
      },
    ]

    const reference = readPng(path.join(REPO_ROOT, viewport.images.REFERENCE))
    const diffPath = resolveOutputPath('diff', 'WF01-S08.segments.diff.png')
    const results = compareSegments(
      reference,
      actual,
      segments,
      [...textMask, ...rasterRows, ...replaced],
      {
        diffPath,
      },
    )

    writeJsonReport('WF01-S08.segments.json', {
      screen_id: 'WF01-S08',
      state: 'activation minimum met; completed on entry; percent from the server',
      images: {
        REFERENCE: viewport.images.REFERENCE,
        ACTUAL: viewport.images.ACTUAL,
        ACTUAL_FULL_PAGE: path.relative(REPO_ROOT, fullPath),
        DIFF_FULL: viewport.images.DIFF,
        DIFF_SEGMENTS: path.relative(REPO_ROOT, diffPath),
      },
      intentional: [
        {
          class: 'INTENTIONAL-DEMO-SCOPE',
          reference_region: { ...REF.cards, height: 90 },
          reason: 'DEC-WF01-S08-D2: Challenge Library card 01 not rendered',
        },
        {
          class: 'TEMPORARY-PRODUCTION-DEPENDENCY',
          reference_region: { ...REF.cards, y: 520, height: 118 },
          reason:
            'DEC-WF01-S08-D4: Chapter (03) card not rendered (no region→chapter mapping). Card 02 is rendered since DEC-P0-SHELL-D6 and compared as segment project-card',
        },
        {
          class: 'INTENTIONAL-CONTRACT',
          reference_region: REF.skip,
          reason:
            'DEC-WF01-S08-D6: no "Bỏ qua, làm sau"; stepper step 3 shown done (disc 3 not compared); "Vào 1hub.network" → /me added; card is shorter and re-centred',
          vertical_effect_px: {
            card_upper_dy: upperDy,
            panel_dy: panelDy,
            card_bottom_dy: bottomDy,
          },
        },
        {
          class: 'INTENTIONAL-COPY',
          reason:
            'DEC-WF01-S08-D5/D7: lede keeps only "Không làm gì cũng được — mọi thứ vẫn ở đó."; unsupported info-panel claims replaced by neutral copy (text masked)',
          reference_regions: REF.replacedCopy,
        },
        {
          class: 'INTENTIONAL-ICON-RENDERING',
          reason: 'DEC-WF01-S08-D7: SVG info mark in place of the OS emoji',
        },
        { class: 'RASTER-NOISE', rows: rasterRows },
      ],
      segments: results,
      text_mask: textMask,
      product_pixel_pass_claimed: false,
    })

    for (const r of results) {
      expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
    }
  })
})
