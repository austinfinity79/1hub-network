import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { reach, signInFresh } from '../support/onboarding'

/**
 * S1-UAT-02 — "Góp ý" (FB-01, US-X.01) in the browser: one launcher on the
 * homepage, WF01 and WF02; submit as guest and member; context; screenshot;
 * errors and retry; no duplicate; the page's own form untouched; a11y;
 * 1440 / 768 / 390.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const TAG = `S1F-UI-${Date.now()}`

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (409|422|429|500)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'S1F-UI-%'`)
  await closePool()
})

const launcher = (page: Page) => page.locator('[data-feedback-launcher]')
const dialog = (page: Page) => page.locator('dialog[data-dialog="feedback"]')

async function openFeedback(page: Page) {
  await launcher(page).click()
  await expect(dialog(page)).toBeVisible()
}

async function fill(page: Page, text: string, kind = 'Báo lỗi') {
  await dialog(page).getByRole('radio', { name: kind }).check()
  await dialog(page).getByLabel('Nội dung').fill(text)
}

const send = (page: Page) => dialog(page).getByRole('button', { name: 'Gửi góp ý' }).click()

async function stored(body: string) {
  return query<{
    account_id: string | null
    type: string
    status: string
    guest_email: string | null
    screenshot_asset_id: string | null
    context: Record<string, string>
  }>(
    `SELECT account_id::text, type::text, status::text, guest_email, screenshot_asset_id, context
       FROM feedback_submissions WHERE body = $1`,
    [body],
  )
}

test.describe('entry points (US-X.01)', () => {
  test('offered on the homepage, auth, onboarding, member and project pages; not on WF03 / ops / demo / legal', async ({
    page,
    request,
  }) => {
    for (const path of ['/', '/about', '/library', '/auth', '/auth/reset-password']) {
      await page.goto(path)
      await expect(launcher(page), path).toHaveCount(1)
      await expect(launcher(page)).toHaveText('Góp ý')
    }
    await signInFresh(page.request, 's1f-entry')
    await reach(page.request, 'DONE')
    for (const path of ['/me', '/me/settings', '/projects', '/projects/new']) {
      await page.goto(path)
      await expect(launcher(page), path).toHaveCount(1)
    }
    await page.request.post('/dev/login', { data: { email: 'ops@example.test' } })
    for (const path of [
      '/ops/network',
      '/organizations/chapter-01',
      '/demo/projects',
      '/legal/terms',
    ]) {
      await page.goto(path)
      await expect(launcher(page), path).toHaveCount(0)
    }
    expect(request).toBeTruthy()
  })
})

test.describe('homepage (guest)', () => {
  test('a guest sends with an optional e-mail; the record has the context and no account', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const before = page.url()
    await openFeedback(page)
    await expect(dialog(page).getByRole('heading', { name: 'Góp ý' })).toBeVisible()
    await expect(dialog(page).getByLabel(/Email/)).toBeVisible()
    await expect(
      dialog(page).getByText('Chỉ dùng để phản hồi bạn, không hiển thị công khai.'),
    ).toBeVisible()
    const body = `${TAG} home guest`
    await fill(page, body, 'Đề xuất tính năng')
    await dialog(page).getByLabel(/Email/).fill('khach@example.test')
    await send(page)
    await expect(dialog(page).getByRole('heading', { name: 'Cảm ơn bạn đã góp ý' })).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Đóng', exact: true }).last().click()
    await expect(dialog(page)).toBeHidden()
    expect(page.url()).toBe(before)
    const [row] = await stored(body)
    expect(row).toMatchObject({
      account_id: null,
      type: 'FEATURE',
      status: 'NEW',
      guest_email: 'khach@example.test',
      screenshot_asset_id: null,
    })
    expect(row!.context).toMatchObject({ route: '/', screen: 'HOME', workflow: 'PUBLIC' })
    expect(row!.context.user_agent).toContain('Chrome')
  })
})

test.describe('WF01 (onboarding stage 3)', () => {
  test('a member sends from Bước 3; the stage keeps what was chosen; identity from the session', async ({
    page,
  }) => {
    const account = await signInFresh(page.request, 's1f-wf01')
    await reach(page.request, 'ROLE')
    await page.goto('/onboarding/purpose', { waitUntil: 'networkidle' })
    const role = page.getByRole('checkbox', { name: /Innovator/ })
    await role.check({ force: true })
    await expect(role).toBeChecked()

    await openFeedback(page)
    // A member is their account: no e-mail field.
    await expect(dialog(page).getByLabel(/Email/)).toHaveCount(0)
    const body = `${TAG} wf01 stage 3`
    await fill(page, body)
    // Open → close → open keeps the unsent draft.
    await dialog(page).getByRole('button', { name: 'Đóng' }).first().click()
    await openFeedback(page)
    await expect(dialog(page).getByLabel('Nội dung')).toHaveValue(body)
    await send(page)
    await expect(dialog(page).getByRole('heading', { name: 'Cảm ơn bạn đã góp ý' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()

    await expect(page).toHaveURL('/onboarding/purpose')
    await expect(role).toBeChecked()
    const [row] = await stored(body)
    expect(row).toMatchObject({ account_id: account.accountId, type: 'BUG', guest_email: null })
    expect(row!.context).toMatchObject({
      route: '/onboarding/purpose',
      screen: 'WF01-S05',
      workflow: 'WF01',
      step: 'Bước 3/4',
    })
  })
})

test.describe('WF02 (PRJ1 and profile)', () => {
  test('PRJ1 keeps the typed name; a screenshot is attached by choice and stored', async ({
    page,
  }) => {
    await signInFresh(page.request, 's1f-wf02')
    await reach(page.request, 'DONE')
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await page.locator('#ve-name').fill('Dự án đang gõ dở')

    await openFeedback(page)
    const body = `${TAG} wf02 prj1`
    await fill(page, body, 'Góp ý trải nghiệm')
    await dialog(page)
      .getByLabel(/Ảnh chụp màn hình/)
      .setInputFiles({ name: 'man-hinh.png', mimeType: 'image/png', buffer: PNG })
    await expect(dialog(page).getByText('Đã chọn: man-hinh.png')).toBeVisible()
    await send(page)
    await expect(dialog(page).getByRole('heading', { name: 'Cảm ơn bạn đã góp ý' })).toBeVisible()
    await dialog(page).getByRole('button', { name: 'Đóng' }).last().click()

    await expect(page).toHaveURL('/projects/new')
    await expect(page.locator('#ve-name')).toHaveValue('Dự án đang gõ dở')
    const [row] = await stored(body)
    expect(row!.screenshot_asset_id).toMatch(/^asset_[0-9a-f]{32}$/)
    expect(row!.context).toMatchObject({
      route: '/projects/new',
      screen: 'WF02-S05',
      workflow: 'WF02',
    })
    // A sent draft is cleared for the next message.
    await openFeedback(page)
    await expect(dialog(page).getByLabel('Nội dung')).toHaveValue('')
  })

  test('profile page: the launcher opens over FP1-OWN without leaving it', async ({ page }) => {
    await signInFresh(page.request, 's1f-me')
    await reach(page.request, 'DONE')
    await page.goto('/me', { waitUntil: 'networkidle' })
    await openFeedback(page)
    const body = `${TAG} wf02 me`
    await fill(page, body, 'Góp ý trải nghiệm')
    await send(page)
    await expect(dialog(page).getByRole('heading', { name: 'Cảm ơn bạn đã góp ý' })).toBeVisible()
    await expect(page).toHaveURL('/me')
    expect((await stored(body))[0]!.context).toMatchObject({ screen: 'WF02-S01' })
  })
})

test.describe('validation, errors, retry, duplicates', () => {
  test('type and content are required; nothing is sent until they are valid', async ({ page }) => {
    let sent = 0
    await page.route('**/api/v1/feedback', (route) => {
      sent++
      return route.continue()
    })
    await page.goto('/auth')
    await openFeedback(page)
    await send(page)
    await expect(dialog(page).getByText('Vui lòng chọn loại góp ý.')).toBeVisible()
    await expect(dialog(page).getByText('Vui lòng nhập nội dung góp ý.')).toBeVisible()
    await expect(dialog(page).getByRole('radio', { name: 'Báo lỗi' })).toBeFocused()
    await expect(dialog(page).getByLabel('Nội dung')).toHaveAttribute('maxlength', '2000')
    await dialog(page).getByLabel(/Email/).fill('sai-email')
    await fill(page, `${TAG} invalid email`)
    await send(page)
    await expect(dialog(page).getByText('Email chưa đúng định dạng.')).toBeVisible()
    expect(sent).toBe(0)
  })

  test('a screenshot that is not an image or over 5 MB is refused before sending', async ({
    page,
  }) => {
    await page.goto('/')
    await openFeedback(page)
    const input = dialog(page).getByLabel(/Ảnh chụp màn hình/)
    await input.setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
    await expect(dialog(page).getByText('Chỉ nhận ảnh PNG, JPG hoặc WebP.')).toBeVisible()
    await input.setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]),
    })
    await expect(dialog(page).getByText('Ảnh tối đa 5MB.')).toBeVisible()
    // Without a screenshot it still sends.
    const body = `${TAG} no shot`
    await fill(page, body)
    await send(page)
    await expect(dialog(page).getByRole('heading', { name: 'Cảm ơn bạn đã góp ý' })).toBeVisible()
    expect((await stored(body))[0]!.screenshot_asset_id).toBeNull()
  })

  test('an upload refused by the server keeps the text; a server failure can be retried once', async ({
    page,
  }) => {
    await page.goto('/')
    await openFeedback(page)
    const body = `${TAG} retry`
    await fill(page, body)
    await page.route('**/api/v1/feedback', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'FEEDBACK_VALIDATION_FAILED',
            message: 'x',
            fields: { screenshot: 'unsupported' },
            request_id: 'r',
          },
        }),
      }),
    )
    await send(page)
    await expect(dialog(page).getByText('Chỉ nhận ảnh PNG, JPG hoặc WebP.')).toBeVisible()
    await expect(dialog(page).getByLabel('Nội dung')).toHaveValue(body)
    await page.unroute('**/api/v1/feedback')

    await page.route('**/api/v1/feedback', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNCONTRACTED_INTERNAL', message: 'x', request_id: 'r' },
        }),
      }),
    )
    await send(page)
    await expect(dialog(page).getByRole('alert')).toContainText('Nội dung vẫn được giữ')
    await expect(dialog(page).getByText(/stack|Error:/)).toHaveCount(0)
    await page.unroute('**/api/v1/feedback')
    await send(page)
    await expect(dialog(page).getByRole('heading', { name: 'Cảm ơn bạn đã góp ý' })).toBeVisible()
    expect(await stored(body)).toHaveLength(1)
  })

  test('a double click sends once; a network retry of the same draft replays, never duplicates', async ({
    page,
  }) => {
    const keys: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/api/v1/feedback', async (route) => {
      keys.push(route.request().headers()['idempotency-key'] ?? '')
      await gate
      await route.continue()
    })
    await page.goto('/')
    await openFeedback(page)
    const body = `${TAG} double`
    await fill(page, body)
    await send(page)
    await dialog(page).getByRole('button', { name: 'Gửi góp ý' }).click({ force: true })
    release()
    await expect(dialog(page).getByRole('heading', { name: 'Cảm ơn bạn đã góp ý' })).toBeVisible()
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)

    // The same key and draft sent again (a retry after a lost answer): one row.
    const form = new FormData()
    form.set('type', 'BUG')
    form.set('content', body)
    form.set('route', '/')
    const replay = await page.request.post('/api/v1/feedback', {
      headers: { 'Idempotency-Key': keys[0]! },
      multipart: { type: 'BUG', content: body, route: '/' },
    })
    expect(replay.status()).toBe(201)
    expect(await stored(body)).toHaveLength(1)
  })
})

test.describe('direct API', () => {
  test('identity is the session; a missing key or a non-multipart body is refused; envelopes only', async ({
    page,
  }) => {
    const account = await signInFresh(page.request, 's1f-api')
    const body = `${TAG} api`
    const res = await page.request.post('/api/v1/feedback', {
      headers: { 'Idempotency-Key': `k-${Date.now()}` },
      multipart: {
        type: 'UX',
        content: body,
        account_id: '00000000-0000-0000-0000-000000000000',
        route: '/me?x=1',
      },
    })
    expect(res.status()).toBe(201)
    expect(await res.json()).toMatchObject({
      id: expect.stringMatching(/^fb_/),
      status: 'RECEIVED',
    })
    expect((await stored(body))[0]).toMatchObject({ account_id: account.accountId })
    expect((await stored(body))[0]!.context.route).toBe('/me')

    const noKey = await page.request.post('/api/v1/feedback', {
      multipart: { type: 'UX', content: 'x' },
    })
    expect(noKey.status()).toBe(400)
    expect((await noKey.json()).error.fields).toEqual({ idempotency_key: 'required' })
    const json = await page.request.post('/api/v1/feedback', {
      headers: { 'Idempotency-Key': `k2-${Date.now()}` },
      data: { type: 'UX', content: 'x' },
    })
    expect(json.status()).toBe(400)
    const text = await json.text()
    expect(text).not.toMatch(/stack|at \//)
  })
})

test.describe('accessibility', () => {
  test('modal: initial focus, labelled, Tab stays inside, Escape closes, focus returns to "Góp ý"', async ({
    page,
  }) => {
    await page.goto('/auth', { waitUntil: 'networkidle' })
    await launcher(page).focus()
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toHaveAttribute('aria-labelledby', /.+/)
    await expect(dialog(page).getByRole('radio', { name: 'Báo lỗi' })).toBeFocused()
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest('dialog[data-dialog="feedback"]')),
      )
      expect(inside).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(launcher(page)).toBeFocused()
  })
})

test.describe('responsive (1440 / 768 / 390)', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: launcher and dialog fit; textarea, file input and buttons usable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/auth', { waitUntil: 'networkidle' })
      const pill = (await launcher(page).boundingBox())!
      expect(pill.x + pill.width).toBeLessThanOrEqual(width)
      await openFeedback(page)
      const box = (await dialog(page).boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      for (const control of await dialog(page).locator('button, input, textarea').all()) {
        if (!(await control.isVisible())) continue
        const c = (await control.boundingBox())!
        expect(c.x).toBeGreaterThanOrEqual(box.x - 1)
        expect(c.x + c.width).toBeLessThanOrEqual(box.x + box.width + 1)
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
      await page.screenshot({ path: `tests/visual/diff/s1-uat-02/feedback-${width}.png` })
    })
  }
})
