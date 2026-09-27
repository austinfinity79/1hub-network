import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision } from '../pixel-qa/revision'

/**
 * WF01-S08 — Onboarding Complete (/onboarding/complete). Production.
 * Decisions DEC-WF01-S08-D1..D8 (docs/decisions/DECISION_LOG.md); the card
 * follows the corrected ACC-10 subset (TASK 22.2, DEC-L1-D7).
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

const cta = (page: Page) => page.getByRole('link', { name: 'Vào Tài khoản của tôi' })

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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ của bạn đã sẵn sàng')
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
    await expect(page.getByText('Hồ sơ của bạn đã sẵn sàng')).toHaveCount(0)
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
    // The /me exit sits in the header, as ACC-10 draws it.
    expect(links).toEqual(['/', '/me', '/projects/new'])
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
        cta: rgb(document.querySelector('[data-nav="exit-me"]')),
      }
    })
    // Inks read from the corrected ACC-10 raster; +-3 per channel for raster rounding.
    const APPROVED: Record<keyof typeof colours, [number, number, number]> = {
      title: [0x17, 0x00, 0x02],
      lede: [0x53, 0x40, 0x41],
      info: [0x53, 0x40, 0x41],
      cta: [0xb9, 0x16, 0x10],
    }
    for (const key of Object.keys(APPROVED) as (keyof typeof colours)[]) {
      colours[key].forEach((channel, i) => {
        expect(Math.abs(channel - APPROVED[key][i]!), `${key} channel ${i}`).toBeLessThanOrEqual(3)
      })
    }
  })
})

test.describe('WF01-S08 pixel QA (corrected ACC-10 subset)', () => {
  /**
   * Corrected ACC-10, measured once: card top, card 02 "Lập hồ sơ đội" (the one
   * rendered), the info panel and the header exit's text box. Cards 01 and 03
   * are not rendered (D2, D4, HD-02), so each region is compared at its own
   * offset; the legacy onboarding header is not part of the revision (HD-02).
   */
  const REF = { cardTop: 121, projectTop: 450, infoTop: 688, exit: { x: 1262, y: 22 } } as const

  test('1440×900: card head, project card, info corner and exit match ACC-10', async ({ page }) => {
    await signInFresh(page.request)
    await makeReady(page.request)
    await openComplete(page)
    await expect(cta(page)).toBeVisible()

    const top = async (selector: string) =>
      Math.round((await page.locator(selector).first().boundingBox())!.y)
    const card = await top('[data-ui="surface"]')
    const project = await top('[data-action-card="project"]')
    const info = await top('[data-completion]')
    const exit = await page.locator('[data-nav="exit-me"]').evaluate((el) => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const r = range.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y) }
    })
    // Copy that differs from the reference by decision, in capture coordinates.
    const exclude = await page.evaluate(() =>
      ['[data-action-card] > span', '[data-action-card] p + p'].map((sel) => {
        const r = document.querySelector(sel)!.getBoundingClientRect()
        return { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 }
      }),
    )

    await auditRevision(page, {
      name: 'WF01-S08.ACC-10',
      reference: 'design-reference/final/revision/L1/ACC-10__onboarding-complete__SOURCE.png',
      segments: [
        {
          name: 'card-head',
          reference: { x: 300, y: 114, width: 840, height: 206 },
          dy: card - REF.cardTop,
        },
        {
          name: 'project-card',
          reference: { x: 350, y: 445, width: 740, height: 93 },
          dy: project - REF.projectTop,
        },
        {
          name: 'info-corner',
          reference: { x: 352, y: 684, width: 36, height: 34 },
          dy: info - REF.infoTop,
        },
        {
          name: 'exit',
          reference: { x: REF.exit.x - 4, y: REF.exit.y - 4, width: 142, height: 28 },
          dx: exit.x - REF.exit.x,
          dy: exit.y - REF.exit.y,
        },
      ],
      exclude,
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'HD-02 / DEC-L1-D7: the onboarding shell and stepper stay (the 4-step header belongs to the Bucket B flow); cards 01 (Challenge, D2) and 03 (HUB position, HD-02) are not rendered, so the one card is numbered 01',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'DEC-WF01-S08-D5/D7 and DEC-P0-SHELL-D6: intent-neutral lede, neutral info copy and the project card body without the WF04 claim',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason: 'HD-11: no floating "Góp ý" button until a feedback flow is approved',
        },
      ],
    })
  })
})
