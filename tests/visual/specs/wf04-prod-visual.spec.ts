import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { assertTypography, settle } from '../pixel-qa/capture'
import {
  call,
  CHAPTER_01,
  cleanupProgrammes,
  clubWithLeader,
  createProgramme,
  LEADER,
  login,
  MEMBER,
  routes,
  SEED_CHALLENGE,
  SEED_VENTURE,
  track,
  watchConsole,
} from '../support/programmes'

/**
 * WF04-PROD-06 — pixel / responsive / visual-state regression of the hardened
 * WF04 screens, on the real API. Approved baseline: the released WF04 UI
 * (production `78f21f2`, DEC-W4P-D08), compared side by side by
 * `scripts/qa/wf04-visual-compare.mjs`; this spec pins what must hold on every
 * build:
 *  - viewport matrix 1440 / 1024 / 768 / 430 / 390 / 320 × every WF04 state:
 *    status, typography, no page overflow, no control outside the viewport, no
 *    overlapping controls, no clipped text, no close control, no console error;
 *  - interaction states at 1440 and 390: loading, API error + retry,
 *    validation, save failure + retry, inline confirmation, incomplete review,
 *    keyboard focus, closed, archived owner, locked form, Q3(b).
 * 320 is a spot-check below the certified widths (1440 / 768 / 390). There the
 * approved baseline already overflows: the shared OpsShell keeps its 13.5rem
 * sidebar (desktop-first, IA-L1), leaving ~100px of content, and eight WF04
 * primitives do not wrap. Those causes are pinned (KNOWN_320, measured on the
 * baseline with the same rule) so the overflow cannot spread or grow; every
 * other width must be clean.
 */

const WIDTHS = [1440, 1024, 768, 430, 390, 320]
const STATE_WIDTHS = [1440, 390]
/** Pre-existing at 320 in the approved baseline (78f21f2): every cause it shows there. */
const KNOWN_320 = [
  'programme-form_typeOption',
  'status-pill_pill',
  'journey_editLink',
  'journey_cardMeta',
  'journey_textAction',
  'journey_chip',
  'journey_checkState',
  'journey_publishText',
]
const KNOWN_320_MAX = 64
const CLOSE = /đóng chương trình|đóng challenge|kết thúc chương trình|close programme|\bclose\b/i

const ids = {
  challenge: '',
  programme: '',
  locked: '',
  closed: '',
  archived: '',
  blank: '',
  archivedLeader: '',
  emptyLeader: '',
}

test.beforeAll(async ({ playwright }, info) => {
  const baseURL = info.project.use.baseURL
  const leader = await playwright.request.newContext({ baseURL })
  await login(leader, LEADER)
  const dates = { starts_at: '2026-11-01T02:00:00.000Z', ends_at: '2027-01-31T10:00:00.000Z' }

  const challenge = await createProgramme(leader, {
    type: 'CHALLENGE',
    name: 'Thử thách đổi mới (PROD-06)',
    summary: 'Các đội đề xuất giải pháp cho bài toán của đơn vị.',
    ...dates,
  })
  ids.challenge = challenge.programme.id
  await call(leader, 'patch', `/${ids.challenge}`, {
    stages: [
      { name: 'Nhận giải pháp', starts_on: '2026-11-01', ends_on: '2026-12-15' },
      { name: 'Kết nối thí điểm', starts_on: '2026-12-16', ends_on: '2027-01-31' },
    ],
    problem_statements: [
      { title: 'Bài toán 1: tối ưu giao hàng chặng cuối', summary: 'Giảm thời gian giao hàng.' },
      { title: 'Bài toán 2: số hoá hồ sơ khách hàng' },
    ],
  })

  const form = {
    applicant_types: ['TEAM', 'STARTUP'],
    questions: [
      { id: 'q-1', prompt: 'Dự án của bạn giải quyết vấn đề gì?', required: true, step: 1 },
      { id: 'q-2', prompt: 'Bạn cần chương trình hỗ trợ điều gì?', required: false, step: 1 },
    ],
  }
  const published = async (name: string) => {
    const { programme } = await createProgramme(leader, { name, ...dates })
    await call(leader, 'patch', `/${programme.id}`, {
      stages: [{ name: 'Ươm tạo', starts_on: '2026-11-01', ends_on: '2026-12-15' }],
    })
    await call(leader, 'put', `/${programme.id}/registration`, form)
    await call(leader, 'post', `/${programme.id}/publish`)
    return programme.id
  }
  ids.programme = await published('Chương trình ươm tạo (PROD-06)')
  ids.locked = await published('Chương trình đã có hồ sơ (PROD-06)')
  ids.closed = await published('Chương trình đã đóng (PROD-06)')
  await call(leader, 'post', `/${ids.closed}/close`)

  const member = await playwright.request.newContext({ baseURL })
  await login(member, MEMBER)
  const applied = await member.post('/api/v1/applications', {
    data: { venture_id: SEED_VENTURE, programme_id: ids.locked },
  })
  expect(applied.status(), await applied.text()).toBe(201)

  const club = await clubWithLeader()
  const owner = await playwright.request.newContext({ baseURL })
  await login(owner, club.leader)
  ids.archived = (
    await createProgramme(owner, { organization_id: club.id, name: 'Chương trình CLB lưu trữ' })
  ).programme.id
  await club.archive()
  ids.archivedLeader = club.leader
  ids.emptyLeader = (await clubWithLeader()).leader

  const [blank] = await query<{ id: string }>(
    `INSERT INTO programmes (organization_id, programme_type, slug, name) VALUES ($1, 'PROGRAMME', $2, '   ') RETURNING id::text`,
    [CHAPTER_01, `wf04-prod06-blank-${Date.now()}`],
  )
  ids.blank = blank!.id
  track(ids.blank)
  await Promise.all([leader.dispose(), member.dispose(), owner.dispose()])
})

test.afterAll(async () => {
  await cleanupProgrammes()
  await closePool()
})

type State = {
  name: string
  path: () => string
  actor?: () => string
  ready: string
  status?: number
}

const STATES: State[] = [
  { name: 'S01 list', path: () => routes.list, ready: '[data-programme-row]' },
  {
    name: 'S01 empty',
    path: () => routes.list,
    actor: () => ids.emptyLeader,
    ready: '[data-state="list-empty"]',
  },
  { name: 'S02 create', path: () => routes.create, ready: '[data-screen="WF04-S02"]' },
  {
    name: 'S08 draft Challenge',
    path: () => routes.detail(SEED_CHALLENGE),
    ready: '[data-detail-status="DRAFT"]',
  },
  {
    name: 'S08 published',
    path: () => routes.detail(ids.programme),
    ready: '[data-detail-status="PUBLISHED"]',
  },
  {
    name: 'S08 closed',
    path: () => routes.detail(ids.closed),
    ready: '[data-detail-status="CLOSED"]',
  },
  {
    name: 'S08 archived owner',
    path: () => routes.detail(ids.archived),
    actor: () => ids.archivedLeader,
    ready: '[data-detail-status]',
  },
  {
    name: 'S08 basic',
    path: () => routes.setup(ids.challenge, 'basic'),
    ready: '[data-readonly="type"]',
  },
  {
    name: 'S03 journey',
    path: () => routes.setup(ids.challenge, 'journey'),
    ready: '[data-problem-id]',
  },
  {
    name: 'S04 events',
    path: () => routes.setup(SEED_CHALLENGE, 'events'),
    ready: '[data-event-id]',
  },
  {
    name: 'S05 registration',
    path: () => routes.setup(ids.programme, 'registration'),
    ready: '[data-action="edit-registration"]',
  },
  {
    name: 'S05 locked',
    path: () => routes.setup(ids.locked, 'registration'),
    ready: '[data-state="registration-locked"]',
  },
  {
    name: 'S06 team',
    path: () => routes.setup(ids.programme, 'team'),
    ready: '[data-state="team-empty"]',
  },
  {
    name: 'S07 ready',
    path: () => routes.setup(ids.challenge, 'review'),
    ready: '[data-action="publish"]',
  },
  {
    name: 'S07 published',
    path: () => routes.setup(ids.programme, 'review'),
    ready: '[data-state="published"]',
  },
  {
    name: '404 unknown id',
    path: () => routes.detail('00000000-0000-4000-8000-000000000404'),
    ready: 'body',
    status: 404,
  },
  { name: '404 member', path: () => routes.list, actor: () => MEMBER, ready: 'body', status: 404 },
]

/** Layout facts at the current viewport, collected in the page. */
async function layout(page: Page) {
  return page.evaluate((closePattern) => {
    const W = window.innerWidth
    const close = new RegExp(closePattern, 'i')
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'
    }
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if (o === 'auto' || o === 'scroll') return true
      }
      return false
    }
    const signature = (el: Element) =>
      [...el.classList]
        .filter((c) => /^[a-z0-9-]+_[A-Za-z0-9]+__/.test(c))
        .map((c) => c.replace(/__[A-Za-z0-9_-]+$/, ''))
    const text = (el: Element) =>
      `${(el as HTMLElement).innerText ?? ''} ${el.getAttribute('aria-label') ?? ''}`.trim()
    const escaping: string[] = []
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || inScroller(el)) continue
      const r = el.getBoundingClientRect()
      if (r.right <= W + 1 && r.left >= -1) continue
      const parent = el.parentElement?.getBoundingClientRect()
      const leaf = !parent || (parent.right <= W + 1 && parent.left >= -1) || !el.children.length
      if (leaf) escaping.push(signature(el).join(' ') || `${el.tagName}: ${text(el).slice(0, 30)}`)
    }
    const controls = [
      ...document.querySelectorAll('a[href], button, input, select, textarea, [role=button]'),
    ].filter(visible)
    const overlaps: string[] = []
    for (let i = 0; i < controls.length; i += 1)
      for (let j = i + 1; j < controls.length; j += 1) {
        const [a, b] = [controls[i]!, controls[j]!]
        if (a.contains(b) || b.contains(a)) continue
        const [x, y] = [a.getBoundingClientRect(), b.getBoundingClientRect()]
        const w = Math.min(x.right, y.right) - Math.max(x.left, y.left)
        const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top)
        if (w > 2 && h > 2) overlaps.push(`${text(a).slice(0, 24)} × ${text(b).slice(0, 24)}`)
      }
    const clipped = [...document.querySelectorAll('body *')]
      .filter((el) => visible(el) && !el.matches('input, select, textarea'))
      .filter((el) => {
        const s = getComputedStyle(el)
        const hides = ['hidden', 'clip'].includes(s.overflowX) || s.textOverflow === 'ellipsis'
        return hides && (el as HTMLElement).innerText?.trim() && el.scrollWidth > el.clientWidth + 1
      })
      .map((el) => text(el).slice(0, 40))
    const closeControls = [
      ...document.querySelectorAll('a, button, [role=button], [role=menuitem], [data-action]'),
    ]
      .filter(
        (el) =>
          close.test(`${text(el)} ${el.getAttribute('title') ?? ''}`) ||
          /close/i.test(el.getAttribute('data-action') ?? '') ||
          /\/close\b/.test(el.getAttribute('href') ?? ''),
      )
      .map((el) => `${el.tagName} ${text(el).slice(0, 30)}`)
    return {
      overflow: document.documentElement.scrollWidth - W,
      escaping: [...new Set(escaping)],
      overlaps,
      clipped,
      closeControls,
    }
  }, CLOSE.source)
}

/** The element is visible and lies horizontally inside the viewport. */
async function inside(page: Page, selector: string, label: string) {
  const target = page.locator(selector).first()
  await expect(target, label).toBeVisible()
  await target.scrollIntoViewIfNeeded()
  const box = (await target.boundingBox())!
  const width = page.viewportSize()!.width
  expect(box.x, `${label}: left edge`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${label}: right edge`).toBeLessThanOrEqual(width + 1)
}

for (const width of WIDTHS) {
  test.describe(`WF04-PROD-06 viewport ${width}`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const state of STATES)
      test(`${state.name}: layout, typography, no close control`, async ({ page }) => {
        const errors = watchConsole(page)
        await login(page.request, state.actor?.() ?? LEADER)
        const response = await page.goto(state.path())
        expect(response?.status()).toBe(state.status ?? 200)
        await expect(page.locator(state.ready).first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        await settle(page)
        expect((await assertTypography(page)).violations).toEqual([])

        const facts = await layout(page)
        expect(facts.overlaps, 'overlapping controls').toEqual([])
        expect(facts.clipped, 'clipped text').toEqual([])
        expect(facts.closeControls, 'close control (DEC-W4P-D14)').toEqual([])
        if (width === 320) {
          expect(facts.overflow).toBeLessThanOrEqual(KNOWN_320_MAX)
          for (const cause of facts.escaping)
            expect(
              KNOWN_320.some((known) => cause.includes(known)),
              `320 cause: ${cause}`,
            ).toBe(true)
        } else {
          expect(facts.overflow, 'page overflow').toBe(0)
          expect(facts.escaping, 'outside the viewport').toEqual([])
        }
        expect(errors).toEqual([])
      })
  })
}

for (const width of STATE_WIDTHS) {
  test.describe(`WF04-PROD-06 visual states ${width}`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('loading: the placeholder row starts inside the visible table; no page overflow', async ({
      page,
    }) => {
      await login(page.request, LEADER)
      await page.route('**/api/v1/programmes', async (route) => {
        await new Promise((done) => setTimeout(done, 600))
        await route.continue()
      })
      await page.goto(routes.list)
      const loading = page.locator('[data-state="list-loading"]')
      await expect(loading).toBeVisible()
      // A row of the S01 table: it scrolls with the table, as in the approved
      // baseline (identical position there); its first glyph is visible.
      const place = await loading.evaluate((el) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        const text = range.getBoundingClientRect()
        const table = el.closest('[class*="scroller"]')!.getBoundingClientRect()
        return { start: text.x, from: table.x, to: table.right }
      })
      expect(place.start).toBeGreaterThanOrEqual(place.from)
      expect(place.start).toBeLessThan(place.to)
      expect((await layout(page)).overflow).toBe(0)
      await expect(page.locator('[data-programme-row]').first()).toBeVisible()
    })

    test('API error: the message and "Thử lại" sit inside the viewport; the retry recovers', async ({
      page,
    }) => {
      const errors = watchConsole(page)
      await login(page.request, LEADER)
      let fail = true
      await page.route('**/api/v1/programmes', async (route) => {
        if (!fail) return route.continue()
        fail = false
        await route.fulfill({
          status: 500,
          body: '{"error":{"code":"X","message":"boom","request_id":"r"}}',
        })
      })
      await page.goto(routes.list)
      await inside(page, '[data-state="list-failed"]', 'error')
      await inside(page, '[data-state="list-failed"] button', 'retry')
      await expect(page.locator('[data-state="list-failed"] button')).toBeEnabled()
      await page.locator('[data-state="list-failed"] button').click()
      await expect(page.locator('[data-programme-row]').first()).toBeVisible()
      expect(errors.filter((e) => !/status of 500/.test(e))).toEqual([])
      expect((await layout(page)).overflow).toBe(0)
    })

    test('validation: the create form shows its errors inside the viewport', async ({ page }) => {
      await login(page.request, LEADER)
      await page.goto(routes.create)
      await page.locator('[data-screen="WF04-S02"] button[type="submit"]').click()
      await inside(page, '[data-error="name"]', 'name error')
      await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
      expect((await layout(page)).overflow).toBe(0)
    })

    test('save failure: "Thử lại" sits inside the viewport; the retry saves', async ({ page }) => {
      const errors = watchConsole(page)
      await login(page.request, LEADER)
      let fail = true
      await page.route(`**/api/v1/programmes/${ids.challenge}`, async (route) => {
        if (route.request().method() !== 'PATCH' || !fail) return route.continue()
        fail = false
        await route.fulfill({
          status: 500,
          body: '{"error":{"code":"X","message":"boom","request_id":"r"}}',
        })
      })
      await page.goto(routes.setup(ids.challenge, 'journey'))
      await page.locator('[data-stage-id]').first().locator('[data-move="down"]').click()
      await inside(page, '[data-state="save-failed"]', 'save failure')
      await page.locator('[data-state="save-failed"] button').first().click()
      await expect(page.locator('[data-state="save-failed"]')).toHaveCount(0)
      expect(errors.filter((e) => !/status of 500/.test(e))).toEqual([])
      expect((await layout(page)).overflow).toBe(0)
    })

    test('inline confirmation: the question and both answers fit the viewport', async ({
      page,
    }) => {
      await login(page.request, LEADER)
      await page.goto(routes.setup(ids.challenge, 'journey'))
      const before = await page.locator('[data-stage-id]').count()
      await page.locator('[data-stage-id]').first().locator('[data-action="remove"]').click()
      await inside(page, 'div[data-confirm]', 'confirmation')
      await inside(page, '[data-confirm="yes"]', 'confirm')
      await inside(page, '[data-confirm="no"]', 'cancel')
      expect((await layout(page)).overlaps).toEqual([])
      await page.locator('[data-confirm="no"]').click()
      await expect(page.locator('div[data-confirm]')).toHaveCount(0)
      await expect(page.locator('[data-stage-id]')).toHaveCount(before)
    })

    test('incomplete review: the failing check and the disabled publish are visible', async ({
      page,
    }) => {
      await login(page.request, LEADER)
      await page.goto(routes.setup(ids.blank, 'review'))
      await expect(page.locator('[data-check="name"]')).toHaveAttribute('data-ok', 'false')
      await inside(page, '[data-fix="name"]', 'fix link')
      await inside(page, '[data-action="publish"]', 'publish')
      await expect(page.locator('[data-action="publish"]')).toBeDisabled()
    })

    test('keyboard focus is visible on the primary action; hover moves nothing', async ({
      page,
    }) => {
      await login(page.request, LEADER)
      await page.goto(routes.list)
      await expect(page.locator('[data-programme-row]').first()).toBeVisible()
      const create = page.locator('[data-nav="programme-create"]')
      const box = await create.boundingBox()
      await create.hover()
      expect(await create.boundingBox()).toEqual(box)
      let focused = false
      for (let i = 0; i < 40 && !focused; i += 1) {
        await page.keyboard.press('Tab')
        focused = await create.evaluate((el) => el === document.activeElement)
      }
      expect(focused, 'reachable by keyboard').toBe(true)
      const ring = await create.evaluate((el) => {
        const s = getComputedStyle(el)
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }
      })
      expect(ring.style).not.toBe('none')
      expect(ring.width).toBeGreaterThan(0)
    })

    test('closed: read only, no manage, publish or close control', async ({ page }) => {
      await login(page.request, LEADER)
      await page.goto(routes.detail(ids.closed))
      await inside(page, '[data-detail-status="CLOSED"]', 'closed status')
      await expect(page.locator('[data-detail-status="CLOSED"]')).toContainText('Đã đóng')
      await expect(page.locator('[data-manage]')).toHaveCount(0)
      expect((await layout(page)).closeControls).toEqual([])
      await page.goto(routes.setup(ids.closed, 'review'))
      const publish = page.locator('[data-action="publish"]')
      if (await publish.count()) await expect(publish).toBeDisabled()
      expect((await layout(page)).closeControls).toEqual([])
    })

    test('archived owner: no manage link; publish is not offered as enabled', async ({ page }) => {
      await login(page.request, ids.archivedLeader)
      await page.goto(routes.detail(ids.archived))
      await expect(page.locator('[data-detail-status]')).toBeVisible()
      await expect(page.locator('[data-manage]')).toHaveCount(0)
      await page.goto(routes.setup(ids.archived, 'review'))
      await inside(page, '[data-action="publish"]', 'publish')
      await expect(page.locator('[data-action="publish"]')).toBeDisabled()
    })

    test('locked form: the note sits inside the viewport; no edit, no add-question', async ({
      page,
    }) => {
      await login(page.request, LEADER)
      await page.goto(routes.setup(ids.locked, 'registration'))
      await inside(page, '[data-state="registration-locked"]', 'locked note')
      await expect(page.locator('[data-action="edit-registration"]')).toHaveCount(0)
      await expect(page.locator('[data-action="add-question"]')).toHaveCount(0)
    })

    test('Q3(b): "Thêm câu hỏi" stays disabled in the editor and fits the viewport', async ({
      page,
    }) => {
      await login(page.request, LEADER)
      await page.goto(routes.setup(ids.programme, 'registration'))
      await page.locator('[data-action="edit-registration"]').click()
      await inside(page, '[data-action="add-question"]', 'add question')
      const add = page.locator('[data-action="add-question"]')
      await expect(add).toBeDisabled()
      await expect(add).toHaveAttribute('aria-disabled', 'true')
      expect((await layout(page)).overflow).toBe(0)
    })
  })
}
