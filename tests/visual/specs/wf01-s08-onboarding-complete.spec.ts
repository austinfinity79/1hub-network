import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import { IDS, reach, signInFresh, stored, watchConsole } from '../support/onboarding'

/**
 * WF01-S08 / ACC-10 — onboarding complete (/onboarding/complete). Production.
 * Decisions DEC-L1R-D6, D7 (docs/decisions/DECISION_LOG.md);
 * DEC-WF01-S08-D5..D8 still hold.
 */

const COMPLETE_API = '/api/v1/me/onboarding/complete'
const ROLES_API = '/api/v1/me/onboarding/roles'

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  watchConsole(page, consoleErrors)
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

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

  test('the page completes nothing: an unfinished account is sent to its step', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's08')
    await reach(page.request, 'REVIEW')
    const posts: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST') posts.push(r.url())
    })
    await page.goto('/onboarding/complete')
    await expect(page).toHaveURL('/onboarding/privacy')
    expect(posts).toEqual([])
    expect(await stored(accountId)).toMatchObject({ status: 'DRAFT', completed: null })
  })

  test('below 80% and with NULL intent the profile still completes; percent is the server’s', async ({
    page,
  }) => {
    await signInFresh(page.request, 's08')
    await reach(page.request, 'DONE')
    await openComplete(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ của bạn đã sẵn sàng')
    const server = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(server.percent).toBeLessThan(80)
    await expect(page.locator('[data-completion]')).toContainText(`${server.percent}%`)
    await expect(page.locator('header')).toContainText('HỒ SƠ ĐÃ HOÀN TẤT')
    await expect(page.locator('header ol li[data-state="done"]')).toHaveCount(4)
  })

  test('idempotent: retries and refresh keep one transition and the first timestamp', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's08')
    await reach(page.request, 'REVIEW')
    const { documents } = await (await page.request.get('/api/v1/legal/current')).json()
    for (const doc of documents) {
      await page.request.post('/api/v1/me/consents/accept', {
        data: { consent_type: doc.type, policy_version: doc.version },
      })
    }
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
    const stamp = (await stored(accountId))!.completed!

    const retry = await page.request.post(COMPLETE_API)
    expect(retry.status()).toBe(200)
    expect(await retry.json()).toEqual(body)
    await openComplete(page)
    await expect(cta(page)).toBeVisible()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(cta(page)).toBeVisible()

    const row = await stored(accountId)
    expect(row!.profiles).toBe(1)
    expect(row!.completed!.getTime()).toBe(stamp.getTime())
    expect(await countFor('audit_events', 'action', 'PROFILE_ACTIVATED', accountId)).toBe(1)
    expect(
      await countFor('analytics_events', 'event_name', 'onboarding_completed', accountId),
    ).toBe(1)
  })

  test('concurrent completion requests produce one transition', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's08')
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, {
      data: { roles: ['HUB_MEMBER'], hub_claims: [{ organization_id: IDS.chapter02 }] },
    })
    await reach(page.request, 'REVIEW')
    const { documents } = await (await page.request.get('/api/v1/legal/current')).json()
    for (const doc of documents) {
      await page.request.post('/api/v1/me/consents/accept', {
        data: { consent_type: doc.type, policy_version: doc.version },
      })
    }
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => page.request.post(COMPLETE_API)),
    )
    expect(responses.map((r) => r.status())).toEqual([200, 200, 200, 200])
    expect(await countFor('audit_events', 'action', 'PROFILE_ACTIVATED', accountId)).toBe(1)
    expect(await countFor('audit_events', 'action', 'MEMBERSHIP_REQUESTED', accountId)).toBe(1)
    expect(
      await countFor('analytics_events', 'event_name', 'onboarding_completed', accountId),
    ).toBe(1)
  })

  test('/session reflects completion immediately; the stages then lead to /me', async ({
    page,
  }) => {
    await signInFresh(page.request, 's08')
    await reach(page.request, 'REVIEW')
    const before = await (await page.request.get('/api/v1/session')).json()
    expect(before.profile).toMatchObject({ status: 'DRAFT', onboarding_completed: false })
    await reach(page.request, 'DONE')
    const after = await (await page.request.get('/api/v1/session')).json()
    expect(after.profile).toMatchObject({ status: 'ACTIVE', onboarding_completed: true })
    for (const route of [
      '/onboarding',
      '/onboarding/profile',
      '/onboarding/capability',
      '/onboarding/purpose',
      '/onboarding/privacy',
    ]) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/me')
    }
  })

  test('audit and analytics carry no profile or consent content', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's08')
    await reach(page.request, 'DONE', { phone: '+84901234567' })
    const rows = await query<{ payload: unknown }>(
      `SELECT jsonb_build_array(before_data, after_data) AS payload FROM audit_events
        WHERE actor_account_id = $1 AND action = 'PROFILE_ACTIVATED'
       UNION ALL
       SELECT properties FROM analytics_events WHERE account_id = $1`,
      [accountId],
    )
    const text = JSON.stringify(rows)
    expect(text).not.toMatch(
      /Đặng Kim Chi|Kim Chi Đặng|84901234567|@example\.test|TERMS_ACCEPTANCE|PRIVACY|policy/,
    )
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

  test('next actions: only routes that exist; the /me exit is in the header', async ({ page }) => {
    await signInFresh(page.request, 's08')
    await reach(page.request, 'DONE')
    await openComplete(page)
    await expect(cta(page)).toHaveAttribute('href', '/me')
    const links = await page
      .locator('main a, header a')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
    expect(links).toEqual(['/', '/me', '/projects/new'])
    await expect(page.locator('[data-action-card]')).toHaveCount(1)
    await expect(page.locator('[data-action-card="project"]')).toContainText('Lập hồ sơ đội')
    const text = (await page.locator('main').innerText()).toLowerCase()
    for (const absent of ['bài toán', 'chapter', 'bỏ qua, làm sau', 'dự sự kiện', 'thông báo']) {
      expect(text, absent).not.toContain(absent)
    }
    // The progress is finished and not interactive.
    await expect(page.locator('[aria-current="step"]')).toHaveCount(0)
    await expect(page.locator('header ol a, header ol button')).toHaveCount(0)
    await cta(page).click()
    await expect(page).toHaveURL('/me')
  })

  test('a named HUB unit adds "Theo dõi xác minh chức vụ HUB" → /me/roles', async ({ page }) => {
    await signInFresh(page.request, 's08')
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, {
      data: {
        roles: ['HUB_MEMBER'],
        hub_claims: [
          { organization_id: IDS.chapter01, position: 'Phó trưởng chapter', period: '2024 – nay' },
        ],
      },
    })
    await reach(page.request, 'DONE')
    await openComplete(page)
    await expect(page.locator('[data-action-card]')).toHaveCount(2)
    const card = page.locator('[data-action-card="hub-claim"]')
    await expect(card).toContainText('Theo dõi xác minh chức vụ HUB')
    await expect(card).toContainText('“Phó trưởng chapter”')
    await expect(card).toContainText('Chapter 01')
    await expect(card).toContainText('Chờ xác minh')
    await card.getByRole('link', { name: 'Xem trạng thái' }).click()
    await expect(page).toHaveURL('/me/roles')
    await expect(page.locator('main')).toContainText('Chapter 01')
  })

  test('keyboard and a11y', async ({ page }) => {
    await signInFresh(page.request, 's08')
    await reach(page.request, 'DONE')
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
    await signInFresh(page.request, 's08')
    await reach(page.request, 'DONE')
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
    // Inks read from the ACC-10 raster; +-3 per channel for raster rounding.
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

test.describe('WF01-S08 pixel QA (ACC-10)', () => {
  /**
   * ACC-10, measured once: header, card top, the two cards the build draws
   * ("Lập hồ sơ đội", "Theo dõi xác minh chức vụ HUB") and the info panel. The
   * board's challenge card is not drawn, so each region is compared at its own
   * offset.
   */
  const REF = { cardTop: 121, projectTop: 450, claimTop: 559, infoTop: 688 } as const

  test('1440×900: header, card head, action cards and info match ACC-10', async ({ page }) => {
    await signInFresh(page.request, 's08')
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, {
      data: {
        roles: ['HUB_MEMBER'],
        hub_claims: [{ organization_id: IDS.chapter01, position: 'Phó trưởng chapter' }],
      },
    })
    await reach(page.request, 'DONE')
    await openComplete(page)
    await expect(cta(page)).toBeVisible()

    const card = await topOf(page, '[data-ui="surface"]')
    const project = await topOf(page, '[data-action-card="project"]')
    const claim = await topOf(page, '[data-action-card="hub-claim"]')
    const info = await topOf(page, '[data-completion]')
    // Copy that differs from the reference by decision, in capture coordinates.
    const exclude = await page.evaluate(() =>
      [...document.querySelectorAll('[data-action-card] > span, [data-action-card] p + p')].map(
        (el) => {
          const r = el.getBoundingClientRect()
          return { x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 }
        },
      ),
    )

    await auditRevision(page, {
      name: 'WF01-S08.ACC-10',
      reference: 'design-reference/final/revision/L1/ACC-10__onboarding-complete__SOURCE.png',
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 66 }, dy: 0 },
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
          name: 'claim-card',
          reference: { x: 350, y: 554, width: 740, height: 112 },
          dy: claim - REF.claimTop,
        },
        {
          name: 'info-corner',
          reference: { x: 352, y: 684, width: 36, height: 34 },
          dy: info - REF.infoTop,
        },
        // The frame is drawn 897px high, so its pill sits 3px higher than in a 900px viewport.
        { name: 'feedback', reference: { x: 1290, y: 807, width: 150, height: 90 }, dy: 3 },
      ],
      exclude,
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'BA row 61 / DEC-L1R-D7: next actions are drawn only for routes that exist, so the challenge card is not rendered and the two cards are numbered 01 and 02',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'DEC-WF01-S08-D5/D7 and DEC-P0-SHELL-D6: intent-neutral lede, neutral info copy, the project card body without the WF04 claim; the claim card promises no notification, because none is sent',
        },
      ],
    })
  })
})
