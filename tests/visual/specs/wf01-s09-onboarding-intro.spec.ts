import { expect, test } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import { reach, signInFresh, stored, watchConsole } from '../support/onboarding'

/**
 * WF01-S09 / ACC-05 — onboarding intro (/onboarding). Production.
 * Decisions DEC-L1R-D3, D7 (docs/decisions/DECISION_LOG.md).
 */

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

test.describe('WF01-S09 functional and security', () => {
  test('a guest is sent to /auth', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page).toHaveURL('/auth')
  })

  test('a new account lands here, sees the four stages, and the page writes nothing', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's09')
    expect(await (await page.request.get('/api/v1/me/onboarding')).json()).toEqual({
      completed: false,
      current_step: 'INTRO',
      intent: null,
    })
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hoàn thiện hồ sơ để bắt đầu')
    await expect(page.locator('[data-anchor="stages"] li')).toHaveText([
      /01\s*Thông tin cơ bản/,
      /02\s*Chuyên môn/,
      /03\s*Vai trò trong hệ sinh thái/,
      /04\s*Hoàn tất/,
    ])
    // The intro has no progress bars: no stage is current yet.
    await expect(page.locator('header ol')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    expect(await stored(accountId)).toBeUndefined()
  })

  test('"Bắt đầu" opens stage 1; "Để sau" leaves to the homepage, twice over', async ({ page }) => {
    await signInFresh(page.request, 's09')
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    const later = page.getByRole('link', { name: 'Để sau' })
    await expect(later).toHaveCount(2)
    for (const link of await later.all()) await expect(link).toHaveAttribute('href', '/')
    await later.first().click()
    await expect(page).toHaveURL('/')

    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Bắt đầu' }).click()
    await expect(page).toHaveURL('/onboarding/profile')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thông tin cơ bản')
  })

  test('member pages bring an unfinished account back to its step', async ({ page }) => {
    await signInFresh(page.request, 's09')
    for (const route of ['/me', '/me/profile/edit', '/projects/new']) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/onboarding')
    }
    await reach(page.request, 'CAPABILITY')
    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/capability')
    // The intro stays open to an account that is further along.
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL('/onboarding')
  })

  test('a completed account is sent to /me', async ({ page }) => {
    await signInFresh(page.request, 's09')
    await reach(page.request, 'DONE')
    await page.goto('/onboarding')
    await expect(page).toHaveURL('/me')
  })

  test('the AI block is drawn and starts nothing; "Góp ý" is hidden for Alpha', async ({
    page,
  }) => {
    await signInFresh(page.request, 's09')
    const requests: string[] = []
    page.on('request', (r) => {
      if (r.method() !== 'GET') requests.push(`${r.method()} ${r.url()}`)
    })
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    const ai = page.locator('[data-anchor="ai"]')
    await expect(ai.getByRole('heading', { level: 2 })).toHaveText(
      'Hoàn thiện hồ sơ nhanh hơn với AI',
    )
    await expect(ai.locator('a, button, input')).toHaveCount(0)
    // PO decision (Alpha interaction gap fix 30/09): no feedback channel, so no "Góp ý".
    await expect(page.locator('[data-anchor="feedback"]')).toHaveCount(0)
    await expect(page.getByText('Góp ý')).toHaveCount(0)
    await ai.click()
    await expect(page).toHaveURL('/onboarding')
    expect(requests).toEqual([])
  })

  test('keyboard and a11y', async ({ page }) => {
    await signInFresh(page.request, 's09')
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    const order: string[] = []
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab')
      order.push(
        await page.evaluate(() => document.activeElement?.getAttribute('data-nav') ?? 'other'),
      )
    }
    expect(order).toEqual(['home', 'onboarding-later', 'later', 'start'])
    expect(
      await page.locator('[data-nav="start"]').evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/onboarding/profile')
  })
})

test.describe('WF01-S09 pixel QA (ACC-05)', () => {
  /** ACC-05, measured once: card top, stage cards, AI block, footer, feedback pill. */
  const REF = { cardTop: 121, stagesTop: 297, aiTop: 463, footerTop: 809 } as const

  test('1440×900: header, card, stages, AI block and footer match ACC-05', async ({ page }) => {
    await signInFresh(page.request, 's09')
    await page.goto('/onboarding', { waitUntil: 'networkidle' })
    const card = await topOf(page, '[data-ui="surface"]')
    const stages = await topOf(page, '[data-anchor="stages"]')
    const ai = await topOf(page, '[data-anchor="ai"]')
    const footer = await topOf(page, '[data-anchor="footer"]')

    await auditRevision(page, {
      name: 'WF01-S09.ACC-05',
      reference: 'design-reference/final/revision/L1/ACC-05__onboarding-intro__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 66 }, dy: 0 },
        {
          name: 'card-head',
          reference: { x: 300, y: 100, width: 840, height: 190 },
          dy: card - REF.cardTop,
        },
        {
          name: 'stages',
          reference: { x: 340, y: 290, width: 760, height: 160 },
          dy: stages - REF.stagesTop,
        },
        {
          name: 'ai-block',
          reference: { x: 340, y: 455, width: 760, height: 330 },
          dy: ai - REF.aiTop,
        },
        {
          name: 'footer',
          reference: { x: 300, y: 790, width: 840, height: 150 },
          dy: footer - REF.footerTop,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-A1: no AI provider is configured, so the AI block is drawn and has nothing to press; "Góp ý" is hidden for Alpha (PO decision 30/09), so its pill is not compared',
        },
      ],
    })
  })
})
