import { expect, test, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { completedAccount, reach, watchConsole } from '../support/onboarding'

/**
 * ALPHA INTERACTION GAP FIX (PO decision freeze, 30/09). Every changed item of
 * docs/uat/INTERACTION_GAP_REGISTER.csv ends in exactly one outcome: a valid
 * navigation, intentionally hidden, or intentionally non-clickable. Pixel
 * fidelity of the touched screens stays with their own specs.
 */

const RETURN_KEY = '1hub.auth.return-path'
const KEYWORD = 'Ùn tắc giao thông'

let errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors = []
  watchConsole(page, errors)
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(errors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

async function login(page: Page, email: string) {
  expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** The e-mailed link of the dev outbox, opened on this server. */
async function openInboxLink(page: Page, email: string) {
  const res = await page.request.get(`/dev/outbox?email=${encodeURIComponent(email)}`)
  expect(res.status(), `an e-mail for ${email}`).toBe(200)
  const link = new URL(((await res.json()) as { link: string }).link)
  await page.goto(`${link.pathname}${link.search}`)
}

async function requestLinkFrom(page: Page, entry: string, email: string) {
  await page.goto(entry, { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill(email)
  const [res] = await Promise.all([
    page.waitForResponse('**/api/v1/auth/magic-link'),
    page.getByRole('button', { name: 'Gửi liên kết đăng nhập' }).click(),
  ])
  expect(res.status()).toBe(202)
  await expect(page).toHaveURL('/auth/check-email')
}

test.describe('homepage search → /library?q=', () => {
  test('a keyword opens the Library with the same results as its own search; Back returns', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const libraryRequests: string[] = []
    // The navigation carries `q`; a prefetch of the plain /library link does not count.
    page.on('request', (r) => {
      const url = new URL(r.url())
      if (url.pathname === '/library' && url.searchParams.has('q')) libraryRequests.push(r.url())
    })
    const hero = page.getByRole('search', { name: 'Tìm trong Thư viện' })
    const input = hero.getByRole('searchbox')
    await expect(input).toBeEnabled()
    await expect(input).not.toHaveAttribute('aria-disabled')

    // An empty or blank keyword navigates nowhere.
    await input.fill('   ')
    await input.press('Enter')
    await hero.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL('/')
    await expect(input).toBeFocused()
    expect(libraryRequests).toEqual([])

    await input.fill(KEYWORD)
    await hero.getByRole('button', { name: 'Tìm kiếm' }).click()
    await expect(page).toHaveURL(`/library?q=${encodeURIComponent(KEYWORD)}`)
    const libraryInput = page
      .getByRole('search', { name: 'Tìm trong thư viện' })
      .getByRole('searchbox')
    await expect(libraryInput).toHaveValue(KEYWORD)
    const count = page.locator('[data-section="directory"] [aria-live="polite"]')
    await expect(count).toHaveText(/^[1-9]\d* bài toán$/)
    const viaAddress = await count.innerText()
    const firstViaAddress = await page.locator('[data-anchor="grid"] > li h2').first().innerText()
    // One navigation request, no retry or duplicate.
    expect(libraryRequests).toHaveLength(1)

    // The Library's own search gives the same result for the same keyword.
    await page.goto('/library', { waitUntil: 'networkidle' })
    const total = await count.innerText()
    await libraryInput.fill(KEYWORD)
    await page.getByRole('search', { name: 'Tìm trong thư viện' }).getByRole('button').click()
    await expect(count).toHaveText(viaAddress)
    expect(viaAddress).not.toBe(total)
    await expect(page.locator('[data-anchor="grid"] > li h2').first()).toHaveText(firstViaAddress)

    // Back from the Library returns to the homepage.
    await page.goto('/', { waitUntil: 'networkidle' })
    await input.fill('mobifone')
    await input.press('Enter')
    await expect(page).toHaveURL('/library?q=mobifone')
    await page.goBack()
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-screen="P0-LANDING"]')).toBeVisible()
  })

  test('a keyword in the address is plain text; a blank one is no search', async ({ page }) => {
    await page.goto(`/library?q=${encodeURIComponent('<b>x</b>')}`)
    await expect(page.getByRole('searchbox', { name: 'Từ khoá' })).toHaveValue('<b>x</b>')
    await expect(page.locator('[data-section="directory"] b')).toHaveCount(0)
    await page.goto('/library?q=%20%20')
    await expect(page.getByRole('searchbox', { name: 'Từ khoá' })).toHaveValue('')
    await expect(page.locator('[data-anchor="grid"] > li')).toHaveCount(9)
  })
})

test.describe('public pages: no dead control', () => {
  test('/ and /about: Chương trình and Sự kiện are plain labels; phone is text; ihub opens', async ({
    page,
  }) => {
    for (const url of ['/', '/about']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const nav = page.getByRole('navigation', { name: 'Trang chủ' })
      for (const label of ['Chương trình', 'Sự kiện']) {
        const item = nav.getByText(label, { exact: true })
        await expect(item, `${url} ${label}`).toHaveAttribute('data-nav-kind', 'LABEL')
        await expect(item).not.toHaveAttribute('aria-disabled')
        await expect(item).not.toHaveAttribute('title')
        await expect(nav.getByRole('link', { name: label, exact: true })).toHaveCount(0)
      }
    }
    // The About phone number: no approved tel: action, plain text only.
    await expect(page.getByText('0936 966 001', { exact: true })).toHaveCount(1)
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
    const phone = page.getByText('0936 966 001', { exact: true })
    expect(await phone.evaluate((n) => n.tagName)).toBe('SPAN')
    await expect(phone).not.toHaveAttribute('aria-disabled')

    await page.goto('/', { waitUntil: 'networkidle' })
    const ihub = page.getByRole('link', { name: /Truy cập ihub\.ventures/ })
    await expect(ihub).toHaveAttribute('href', 'https://ihub.ventures')
    await expect(ihub).toHaveAttribute('target', '_blank')
    await expect(ihub).toHaveAttribute('rel', 'noopener noreferrer')
    // "Chi tiết" is not drawn on the illustrative event and programme cards.
    for (const section of ['events', 'programmes'])
      await expect(
        page.locator(`[data-section="${section}"] li`).filter({ hasText: /Chi tiết/ }),
      ).toHaveCount(0)
  })

  test('/library: every card control is real; "Góp ý" is hidden', async ({ page }) => {
    await page.goto('/library', { waitUntil: 'networkidle' })
    await expect(page.getByText('Góp ý')).toHaveCount(0)
    for (const tab of [/^Bài toán/, /^Startup/, /^Nhà sáng lập/]) {
      await page.getByRole('tab', { name: tab }).click()
      const grid = page.locator('[data-anchor="grid"]')
      await expect(grid.locator('> li').first()).toBeVisible()
      await expect(grid.locator('[aria-disabled], [data-cta-kind="INERT"]')).toHaveCount(0)
      await expect(
        grid.getByText(/^(Theo dõi|Kết nối|Theo dõi bài toán|Xem bài toán)$/),
      ).toHaveCount(0)
      for (const link of await grid.locator('a').all()) {
        expect(await link.getAttribute('href')).toMatch(/^https?:\/\//)
        await expect(link).toHaveAttribute('target', '_blank')
      }
    }
  })
})

test.describe('account and workspace menus', () => {
  test('Thư viện, Tổ chức của tôi, Mạng lưới and Hồ sơ đăng ký lead to existing pages', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    const hops: Array<[string, string, string]> = [
      ['/me/settings', 'Thư viện', '/library'],
      ['/me/settings', 'Tổ chức của tôi', '/me/roles'],
      ['/demo/projects', 'Thư viện', '/library'],
      ['/demo/projects', 'Tổ chức của tôi', '/me/roles'],
      ['/projects', 'Mạng lưới', '/library'],
      ['/projects', 'Hồ sơ đăng ký', '/demo/projects'],
    ]
    for (const [from, name, to] of hops) {
      await page.goto(from, { waitUntil: 'networkidle' })
      await expect(page.getByText('Góp ý'), from).toHaveCount(0)
      await page.getByRole('link', { name, exact: true }).first().click()
      await expect(page, `${from} → ${name}`).toHaveURL(to)
      await expect(page.locator('[data-route-placeholder]')).toHaveCount(0)
    }
    // The L5 entry lists the member's ventures and their programme applications.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('sign in and return to venture creation (BD-02 return-to rule)', () => {
  test('guest → /auth?redirect → e-mailed link → /projects/new; unsafe paths are ignored', async ({
    page,
  }) => {
    const account = await completedAccount(page.request, 'return')
    await page.context().clearCookies()
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('[data-cta="startup"]').click()
    await expect(page).toHaveURL('/auth?redirect=%2Fprojects%2Fnew')
    await requestLinkFrom(page, '/auth?redirect=%2Fprojects%2Fnew', account.email)
    await openInboxLink(page, account.email)
    await expect(page).toHaveURL('/projects/new')
    expect(await page.evaluate((k) => localStorage.getItem(k), RETURN_KEY)).toBeNull()

    // Another origin, a protocol-relative path or an auth path is never followed.
    for (const redirect of ['https://evil.example/', '//evil.example', '/auth/callback']) {
      await page.context().clearCookies()
      await requestLinkFrom(page, `/auth?redirect=${encodeURIComponent(redirect)}`, account.email)
      await openInboxLink(page, account.email)
      await expect(page, redirect).toHaveURL('/me')
    }

    // A plain entry after an unused return forgets it.
    await page.context().clearCookies()
    await requestLinkFrom(page, '/auth?redirect=%2Fprojects%2Fnew', account.email)
    await requestLinkFrom(page, '/auth', account.email)
    await openInboxLink(page, account.email)
    await expect(page).toHaveURL('/me')
  })

  test('a new account finishes onboarding first, then its exit continues to the return path', async ({
    page,
  }) => {
    const email = `return-new-${Date.now()}@example.test`
    await requestLinkFrom(page, '/auth?redirect=%2Fprojects%2Fnew', email)
    await openInboxLink(page, email)
    await expect(page).toHaveURL('/onboarding')
    await reach(page.request, 'DONE')
    await page.goto('/onboarding/complete', { waitUntil: 'networkidle' })
    const exit = page.locator('[data-nav="exit-return"]')
    await expect(exit).toHaveText('Tiếp tục')
    await expect(exit).toHaveAttribute('href', '/projects/new')
    await exit.click()
    await expect(page).toHaveURL('/projects/new')
    // Used once: the onboarding exit is the account home again.
    await page.goto('/onboarding/complete', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-nav="exit-me"]')).toHaveAttribute('href', '/me')
  })

  test('a signed-in member goes straight to the canonical venture creation', async ({ page }) => {
    await login(page, 'member@example.test')
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.locator('[data-cta="startup"]').click()
    await expect(page).toHaveURL('/projects/new')
  })
})

test.describe('runtime on the changed screens', () => {
  test('no hydration error, 5xx, broken asset or console error', async ({ page }) => {
    const bad: string[] = []
    const origin = new URL(test.info().project.use.baseURL!).origin
    page.on('response', (r) => {
      const url = new URL(r.url())
      if (r.status() >= 500) bad.push(`${r.status()} ${url.pathname}`)
      if (url.origin === origin && r.status() === 404 && /\.[a-z0-9]{2,5}$/i.test(url.pathname))
        bad.push(`404 ${url.pathname}`)
    })
    // A prefetch cancelled by the next navigation (ERR_ABORTED) is not a broken asset.
    page.on('requestfailed', (r) => {
      if (r.failure()?.errorText !== 'net::ERR_ABORTED') bad.push(`failed ${r.url()}`)
    })
    const visit = async (url: string) => {
      await page.goto(url, { waitUntil: 'networkidle' })
      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
          .map((i) => i.currentSrc),
      )
      expect(broken, `${url} images`).toEqual([])
    }
    for (const url of [
      '/',
      '/about',
      `/library?q=${encodeURIComponent(KEYWORD)}`,
      '/auth?redirect=%2Fprojects%2Fnew',
      '/onboarding',
    ])
      await visit(url)
    await login(page, 'member@example.test')
    for (const url of ['/', '/me/settings', '/me/roles', '/projects', '/demo/projects'])
      await visit(url)
    expect(bad).toEqual([])
    expect(errors.filter((e) => /#418|hydrat/i.test(e))).toEqual([])
  })
})
