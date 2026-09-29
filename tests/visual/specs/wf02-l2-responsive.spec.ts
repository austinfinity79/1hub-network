import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { applyVocabularyFixture, completedAccount, watchConsole } from '../support/onboarding'
import { BOARD_PROFILE, boardVentures, freshAddress, invite } from '../support/workspace'

/**
 * WF02 L2 workspace at 1440 / 1024 / 768 / 390 (DEC-L2R-D11).
 *
 * The profile, project and startup creation, the team and the invitation must
 * stay usable at every width: no horizontal overflow, every control inside the
 * viewport's width, and the primary actions reachable with nothing drawn over
 * them. Desktop follows the board; narrower widths are the build's own
 * adaptation and are checked for use, not for pixels.
 */

const WIDTHS = [1440, 1024, 768, 390] as const

type Screen = {
  id: string
  /** The route, `{kho}` standing for the draft project of the persona. */
  route: string
  /** What shows the screen is there (the WF02 editor header has no h1). */
  ready: string
  /** False for the WF02 editor header, which leads back rather than home. */
  home?: false
  actions: { role: 'button' | 'link'; name: string | RegExp }[]
}

const SCREENS: Screen[] = [
  {
    id: 'FP1-OWN',
    route: '/me',
    ready: 'h1',
    actions: [
      { role: 'link', name: '+ Thêm mục vào hồ sơ' },
      { role: 'button', name: 'Thêm kinh nghiệm' },
      { role: 'button', name: 'Thêm học vấn' },
      { role: 'link', name: 'Cài đặt hồ sơ' },
    ],
  },
  {
    id: 'ME7',
    route: '/projects',
    ready: 'h1',
    actions: [
      { role: 'link', name: '+ Tạo dự án / startup' },
      { role: 'link', name: 'Hoàn thiện hồ sơ' },
      { role: 'link', name: 'Mời thành viên' },
    ],
  },
  {
    id: 'PRJ1',
    route: '/projects/new',
    ready: 'h1',
    actions: [
      { role: 'button', name: 'Tiếp tục · Mời đội ngũ' },
      { role: 'button', name: 'Lưu nháp' },
    ],
  },
  {
    id: 'PRJ2',
    route: '/projects/new?venture={kho}&step=team',
    ready: 'h1',
    actions: [
      { role: 'button', name: 'Gửi lời mời' },
      { role: 'button', name: 'Hoàn tất' },
      { role: 'button', name: 'Quay lại' },
    ],
  },
  {
    id: 'PRJ3',
    route: '/projects/new?venture={kho}&step=done',
    ready: 'h1',
    actions: [{ role: 'link', name: 'Hoàn thiện hồ sơ' }],
  },
  {
    id: 'EDIT',
    route: '/projects/{kho}/edit',
    ready: '[data-venture-editor]',
    home: false,
    actions: [
      { role: 'button', name: 'Lưu' },
      { role: 'link', name: 'Đội ngũ' },
    ],
  },
  {
    id: 'TEAM',
    route: '/projects/{kho}/team',
    ready: '[data-team-view]',
    home: false,
    actions: [
      { role: 'button', name: 'Mời thành viên' },
      { role: 'link', name: 'Hồ sơ dự án' },
    ],
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

/** Interactive controls that leave the viewport's width, as "tag text [left, right]". */
async function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="file"]), textarea, select, [aria-disabled="true"]',
    )) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // Visually hidden radios sit under their drawn control.
      if (getComputedStyle(el).opacity === '0') continue
      // A wide table scrolls sideways inside its own frame (IA-P2-03): the control
      // is reached by scrolling that frame, which itself stays inside the page.
      let frame = el.parentElement
      while (frame && !/auto|scroll/.test(getComputedStyle(frame).overflowX)) {
        frame = frame.parentElement
      }
      if (frame) {
        const f = frame.getBoundingClientRect()
        if (f.left >= -0.5 && f.right <= width + 0.5) continue
      }
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
        await completedAccount(page.request, `l2-resp-${screen.id.toLowerCase()}`, BOARD_PROFILE)
        const { kho } = await boardVentures(page.request)
        await invite(page.request, kho.id, { email: freshAddress('resp'), permission: 'EDIT' })
        await page.goto(screen.route.replace('{kho}', kho.id), { waitUntil: 'networkidle' })
        await expect(page.locator(screen.ready).first()).toBeVisible()

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0)
        expect(await clipped(page), 'controls outside the viewport').toEqual([])
        if (screen.home !== false) {
          await expect(page.locator('[data-nav="home"]').first()).toBeVisible()
        }

        for (const action of screen.actions) {
          const control = page.getByRole(action.role, { name: action.name, exact: true }).first()
          // "Góp ý" floats over the bottom corner; the page's bottom padding lets a
          // control be brought clear of it.
          await control.evaluate((el) => el.scrollIntoView({ block: 'center' }))
          await expect(control, String(action.name)).toBeVisible()
          const box = (await control.boundingBox())!
          expect(box.x, String(action.name)).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width, String(action.name)).toBeLessThanOrEqual(width)
          const hit = await control.evaluate((el) => {
            const r = el.getBoundingClientRect()
            const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            return Boolean(at && (el === at || el.contains(at) || at.contains(el)))
          })
          expect(hit, `${String(action.name)} is covered`).toBe(true)
        }
      })
    }
  })
}

test('390px: the experience and education dialogs fit and close', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await completedAccount(page.request, 'l2-resp-dialog', BOARD_PROFILE)
  await page.goto('/me', { waitUntil: 'networkidle' })
  for (const [open, name] of [
    ['Thêm kinh nghiệm', 'experience'],
    ['Thêm học vấn', 'education'],
  ] as const) {
    await page.getByRole('button', { name: open, exact: true }).click()
    const dialog = page.locator(`dialog[data-dialog="${name}"]`)
    await expect(dialog).toBeVisible()
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(390)
    await expect(dialog.getByRole('button', { name: 'Lưu' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
})
