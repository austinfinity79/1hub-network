import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { resolveOutputPath } from '../pixel-qa/paths'
import {
  applyVocabularyFixture,
  IDS,
  QA,
  reach,
  signInFresh,
  watchConsole,
  type Reach,
} from '../support/onboarding'

/**
 * WF01 four-stage onboarding at 1440 / 1024 / 768 / 390 (DEC-L1R-D7).
 *
 * Every screen must stay usable: no horizontal overflow, every control inside
 * the viewport's width, the stage's actions reachable and the progress in the
 * header readable. Desktop follows the board; the narrower widths are the
 * build's own adaptation and are checked for use, not for pixels.
 */

const WIDTHS = [1440, 1024, 768, 390] as const

const PROFILE = {
  headline: 'Đồng sáng lập · CEO tại Tracely',
  bio: 'Mười năm vận hành chuỗi lạnh nông sản.',
  domain_ids: [QA.domain.logistics, QA.domain.agritech, QA.domain.climate],
  specialization_ids: [QA.specialization.operations, QA.specialization.technology],
  skill_ids: [QA.skill.data, QA.skill.b2b, QA.skill.pitching],
  experience: [
    {
      title: 'Trưởng bộ phận vận hành chuỗi lạnh khu vực miền Trung',
      organization_name: 'Minh Phát Agri',
      started_on: '2017-03',
      ended_on: '2022-01',
    },
  ],
  links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/dangkimchi' }],
}

/** A complete position row (US-01.11, S1-UAT-03). */
const CLAIM = {
  level: 'CHAPTER',
  organization_id: IDS.chapter01,
  position: 'HEAD_OF_BOARD',
  board_name: 'Truyền thông',
  from: '2024-01',
  current: true,
}

type Screen = {
  id: string
  route: string
  reach: Reach
  /** Accessible names of the actions that must be reachable. */
  actions: { role: 'button' | 'link'; name: string | RegExp }[]
  progress: boolean
}

const SCREENS: Screen[] = [
  {
    id: 'ACC-05',
    route: '/onboarding',
    reach: 'BASIC',
    actions: [{ role: 'link', name: 'Bắt đầu' }],
    progress: false,
  },
  {
    id: 'ACC-06',
    route: '/onboarding/profile',
    reach: 'BASIC',
    actions: [
      { role: 'button', name: 'Tiếp tục' },
      { role: 'button', name: 'Tải ảnh lên' },
    ],
    progress: true,
  },
  {
    id: 'ACC-07',
    route: '/onboarding/capability',
    reach: 'CAPABILITY',
    actions: [
      { role: 'button', name: 'Tiếp tục' },
      { role: 'link', name: 'Quay lại' },
      { role: 'button', name: '+ Thêm kinh nghiệm' },
    ],
    progress: true,
  },
  {
    id: 'ACC-08',
    route: '/onboarding/purpose',
    reach: 'ROLE',
    actions: [
      { role: 'button', name: 'Tiếp tục' },
      { role: 'link', name: 'Quay lại' },
      { role: 'button', name: /Thêm vị trí khác/ },
    ],
    progress: true,
  },
  {
    id: 'ACC-09',
    route: '/onboarding/privacy',
    reach: 'REVIEW',
    actions: [
      { role: 'button', name: 'Hoàn tất hồ sơ' },
      { role: 'link', name: 'Quay lại' },
    ],
    progress: true,
  },
  {
    id: 'ACC-10',
    route: '/onboarding/complete',
    reach: 'DONE',
    actions: [
      { role: 'link', name: 'Vào Tài khoản của tôi' },
      { role: 'link', name: 'Lập hồ sơ đội' },
      { role: 'link', name: 'Xem trạng thái' },
    ],
    progress: true,
  },
]

let consoleErrors: string[] = []

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

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

/** The account as far as the screen needs it, with a full profile and a named unit. */
async function prepare(page: Page, screen: Screen) {
  await signInFresh(page.request, `resp-${screen.id.toLowerCase()}`)
  if (screen.id === 'ACC-05') return
  if (screen.reach === 'BASIC') return
  await reach(page.request, 'CAPABILITY', PROFILE)
  if (screen.reach === 'CAPABILITY') return
  await reach(page.request, 'ROLE')
  const saved = await page.request.put('/api/v1/me/onboarding/roles', {
    data: { roles: ['HUB_MEMBER', 'INNOVATOR', 'STARTUP_FOUNDER'], hub_claims: [CLAIM] },
  })
  expect(saved.status()).toBe(200)
  if (screen.reach === 'ROLE') return
  await reach(page.request, screen.reach, PROFILE)
}

/** Interactive controls that leave the viewport's width, as "tag text [left, right]". */
async function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="file"]), textarea, [role="switch"], label',
    )) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // Visually hidden inputs sit under their drawn control.
      if (getComputedStyle(el).clip !== 'auto' && r.width <= 1) continue
      if (r.left < -0.5 || r.right > width + 0.5) {
        out.push(
          `${el.tagName} ${(el.textContent ?? '').trim().slice(0, 30)} [${Math.round(r.left)}, ${Math.round(r.right)}]`,
        )
      }
    }
    return out
  })
}

for (const screen of SCREENS) {
  test.describe(`${screen.id} ${screen.route}`, () => {
    for (const width of WIDTHS) {
      test(`${width}px: no overflow, controls inside, actions reachable`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await prepare(page, screen)
        await page.goto(screen.route, { waitUntil: 'networkidle' })
        await expect(page).toHaveURL(screen.route)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
        expect(await clipped(page), 'controls outside the viewport').toEqual([])

        // The header keeps the wordmark, the action and, in a stage, the four bars.
        const header = page.locator('header')
        await expect(header.locator('[data-nav="home"]')).toBeVisible()
        if (screen.progress) {
          await expect(header.locator('ol li')).toHaveCount(4)
          for (const bar of await header.locator('ol li').all()) {
            const box = (await bar.boundingBox())!
            expect(box.width).toBeGreaterThanOrEqual(24)
            expect(box.x + box.width).toBeLessThanOrEqual(width)
          }
        }

        for (const action of screen.actions) {
          const control = page.getByRole(action.role, { name: action.name }).last()
          // "Góp ý" floats over the bottom corner; a control is reachable when the
          // page can bring it clear of that, which its bottom padding allows.
          await control.evaluate((el) => el.scrollIntoView({ block: 'center' }))
          await expect(control, String(action.name)).toBeVisible()
          const box = (await control.boundingBox())!
          expect(box.x, String(action.name)).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, String(action.name)).toBeLessThanOrEqual(width)
          // Nothing lies over it: the point in its middle is the control itself.
          const hit = await control.evaluate((el) => {
            const r = el.getBoundingClientRect()
            const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            return Boolean(at && (el === at || el.contains(at) || at.contains(el)))
          })
          expect(hit, `${String(action.name)} is covered`).toBe(true)
        }

        // Text fields stay wide enough to type in.
        for (const field of await page.locator('main input.ui-input, main textarea').all()) {
          expect((await field.boundingBox())!.width).toBeGreaterThanOrEqual(140)
        }

        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({
          path: resolveOutputPath('actual', `WF01-RESP.${screen.id}.${width}.png`),
          fullPage: true,
        })
      })
    }
  })
}

test.describe('ACC-07 experience dialog', () => {
  for (const width of WIDTHS) {
    test(`${width}px: the dialog fits and its actions are reachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await signInFresh(page.request, 'resp-dialog')
      await reach(page.request, 'CAPABILITY', PROFILE)
      await page.goto('/onboarding/capability', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: '+ Thêm kinh nghiệm' }).click()
      const dialog = page.locator('dialog[data-dialog="experience"]')
      await expect(dialog).toBeVisible()
      const box = (await dialog.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(box.height).toBeLessThanOrEqual(900)
      for (const name of ['Lưu', 'Huỷ', 'Đóng']) {
        const control = dialog.getByRole('button', { name, exact: true })
        await control.scrollIntoViewIfNeeded()
        await expect(control).toBeVisible()
      }
      await dialog.getByLabel('Chức danh').fill('Kỹ sư')
      await dialog.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.locator('[data-anchor="experience"] li')).toHaveCount(2)
    })
  }
})
