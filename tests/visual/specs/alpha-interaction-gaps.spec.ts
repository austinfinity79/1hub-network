import { expect, test, type Locator, type Page } from '@playwright/test'

import { closePool } from '../../../src/lib/db/client'
import { TEST_PASSWORD, ensurePassword, logInThroughUi, signUpThroughUi } from '../support/auth'
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
    // DEMO-HOME-ABOUT-01: the DM01 hero search; "Tất cả" searches the Library.
    const hero = page.locator('[data-search="hero"]')
    const input = hero.getByRole('searchbox')
    await expect(hero.getByRole('radio', { name: 'Tất cả' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
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
  test('/ and /about: unbuilt destinations are not links; contacts are text; external pages open', async ({
    page,
  }) => {
    // DEMO-HOME-ABOUT-01 (DEMO-D6): the new public shell; an unbuilt screen is plain text.
    // THAO-05 (DEC-THAO-DIR): Chương trình, cuộc thi and Nhân tài now have their screens.
    for (const url of ['/', '/about']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
      await expect(nav.getByRole('link', { name: 'Chương trình', exact: true })).toHaveCount(0)
      await nav.getByRole('button', { name: 'Mở menu Chương trình' }).click()
      await expect(
        nav.getByRole('link', { name: 'Chương trình, cuộc thi', exact: true }),
      ).toHaveAttribute('href', '/programmes')
      // S2-PROGRAMME-EVENT-CONTENT-01: the event screen exists.
      await expect(nav.getByRole('link', { name: 'Sự kiện', exact: true })).toHaveAttribute(
        'href',
        '/events',
      )
      // DEMO-DIR2-01: Sản phẩm opens /products; THAO-05: Nhân tài opens /talents.
      await expect(nav.getByRole('link', { name: 'Sản phẩm', exact: true })).toHaveAttribute(
        'href',
        '/products',
      )
      await expect(nav.getByRole('link', { name: 'Nhân tài', exact: true })).toHaveAttribute(
        'href',
        '/talents',
      )
      const news = nav.getByText('Tin tức', { exact: true })
      await expect(news, `${url} Tin tức`).toHaveAttribute('data-nav-kind', 'LABEL')
      await expect(page.locator('a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0)
      const ihub = page
        .locator('[data-shell="public-footer"]')
        .getByRole('link', { name: /iHUB Ventures/ })
      await expect(ihub).toHaveAttribute('href', 'https://deck.ihub.ventures/')
      await expect(ihub).toHaveAttribute('target', '_blank')
      await expect(ihub).toHaveAttribute('rel', 'noopener noreferrer')
    }
    await expect(page.getByText('global@1hub.network', { exact: true })).toHaveCount(1)
  })

  test('/library: every card control is real; "Góp ý" is the shared launcher', async ({ page }) => {
    await page.goto('/library', { waitUntil: 'networkidle' })
    // S1-UAT-02 (FB-01, DEC-S1F-D1): "Góp ý" is the one shared launcher.
    await expect(page.locator('[data-feedback-launcher]')).toHaveCount(1)
    for (const tab of [/^Bài toán/, /^Startup/, /^Nhà sáng lập/]) {
      await page.getByRole('tab', { name: tab }).click()
      // WF06-PROD-04 realignment. OLD: every tab drew cards for a guest. NEW (DEC-W6P-D03): a
      // guest's founder tab is the sign-in state, whose one control leads to the real /auth.
      if (tab.source.includes('Nhà')) {
        const state = page.locator('[data-anchor="sign-in"]')
        await expect(state).toBeVisible()
        await expect(state.locator('a, button')).toHaveCount(1)
        await expect(state.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
          'href',
          '/auth',
        )
        continue
      }
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
      // S1-UAT-02 (FB-01): the one shared launcher on FB-01 surfaces; none on the demo.
      await expect(page.locator('[data-feedback-launcher]'), from).toHaveCount(
        from.startsWith('/demo') ? 0 : 1,
      )
      await page.getByRole('link', { name, exact: true }).first().click()
      await expect(page, `${from} → ${name}`).toHaveURL(to)
      await expect(page.locator('[data-route-placeholder]')).toHaveCount(0)
    }
    // The L5 entry lists the member's ventures and their programme applications.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})

test.describe('sign in and return to venture creation (BD-02 return-to rule)', () => {
  test('guest → /auth?redirect → password sign-in → /projects/new; unsafe paths are ignored', async ({
    page,
  }) => {
    // S1-UAT-01: the return-to rule now rides the password sign-in (DEC-S1A-D1).
    const account = await completedAccount(page.request, 'return')
    await ensurePassword(account.email)
    await page.context().clearCookies()
    // DEMO-HOME-ABOUT-01: Homepage v2 (DM01) draws no venture-creation CTA (it
    // carried the return path); the sign-in with that return path is unchanged.
    await logInThroughUi(page, account.email, TEST_PASSWORD, '/auth?redirect=%2Fprojects%2Fnew')
    await expect(page).toHaveURL('/projects/new')
    expect(await page.evaluate((k) => localStorage.getItem(k), RETURN_KEY)).toBeNull()

    // Another origin, a protocol-relative path or an auth path is never followed.
    for (const redirect of ['https://evil.example/', '//evil.example', '/auth/callback']) {
      await page.context().clearCookies()
      await logInThroughUi(
        page,
        account.email,
        TEST_PASSWORD,
        `/auth?redirect=${encodeURIComponent(redirect)}`,
      )
      await expect(page, redirect).toHaveURL('/me')
    }

    // A plain entry has no return path.
    await page.context().clearCookies()
    await logInThroughUi(page, account.email)
    await expect(page).toHaveURL('/me')
  })

  test('a new account finishes onboarding first, then its exit continues to the return path', async ({
    page,
  }) => {
    const email = `return-new-${Date.now()}@example.test`
    await signUpThroughUi(page, email, 'Người Dùng Mới', '/auth?redirect=%2Fprojects%2Fnew')
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
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
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
      '/khong-ton-tai',
    ])
      await visit(url)
    await login(page, 'member@example.test')
    for (const url of ['/', '/me/settings', '/me/roles', '/projects', '/demo/projects'])
      await visit(url)
    expect(bad).toEqual([])
    expect(errors.filter((e) => /#418|hydrat/i.test(e))).toEqual([])
  })
})

/** opacity, cursor, tag, href, tabindex of an element. */
const look = (l: Locator) =>
  l.evaluate((n) => {
    const cs = getComputedStyle(n)
    return [
      Number(cs.opacity),
      cs.cursor,
      n.tagName,
      n.getAttribute('href'),
      n.getAttribute('tabindex'),
    ] as const
  })

test.describe('P3 UX cleanup: what cannot be clicked no longer looks clickable', () => {
  test('member and workspace headers: inert items are dimmed beside the working link', async ({
    page,
  }) => {
    await login(page, 'member@example.test')
    const cases = [
      ['/me/settings', 'Thư viện', ['Challenge', 'Sự kiện']],
      ['/projects', 'Mạng lưới', ['Chương trình', 'Sự kiện']],
    ] as const
    for (const [url, live, inert] of cases) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const header = page.locator('header').first()
      const link = header.getByRole('link', { name: live, exact: true })
      expect((await look(link))[0], `${url} ${live}`).toBe(1)
      await link.focus()
      await expect(link).toBeFocused()
      for (const label of inert) {
        const item = header.locator('[data-nav-kind="INERT"]', { hasText: label })
        const [opacity, cursor, tag, href, tabindex] = await look(item)
        expect(opacity, `${url} ${label}`).toBeLessThan(0.6)
        expect([cursor, tag, href, tabindex]).toEqual(['default', 'SPAN', null, null])
        await item.click()
        await expect(page).toHaveURL(url)
      }
    }
  })

  test('homepage and About: visual-only CTAs never navigate, are not focusable and say why', async ({
    page,
  }) => {
    // DEMO-HOME-ABOUT-01 (DEMO-D6): drawn as the frame draws them, never a fake success.
    for (const url of ['/', '/about']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const inert = page.locator('[data-screen] [data-cta-kind="INERT"]')
      // THAO-05: the programme and talent CTAs became links; S2-PROGRAMME-EVENT-CONTENT-01:
      // About's "Xem lịch sự kiện" opens /events. The rest stay drawn and inert.
      expect(await inert.count(), url).toBeGreaterThanOrEqual(2)
      if (url === '/about')
        await expect(page.getByRole('link', { name: /Xem lịch sự kiện/ })).toHaveAttribute(
          'href',
          '/events',
        )
      for (const el of await inert.all()) {
        const [, cursor, tag, href, tabindex] = await look(el)
        expect([cursor, tag, href, tabindex]).toEqual(['default', 'SPAN', null, null])
        await expect(el).toHaveAttribute('aria-disabled', 'true')
        await expect(el).toHaveAttribute('title', /Sắp có/)
      }
      await inert.first().click()
      await expect(page).toHaveURL(url)
    }
  })

  test('Library keyword chip is display only; the facet chips keep their remove action', async ({
    page,
  }) => {
    await page.goto('/library?q=giao%20th%C3%B4ng', { waitUntil: 'networkidle' })
    const chip = page.locator('[class*="chips"] span', { hasText: '“giao thông”' })
    const [, cursor, tag, href, tabindex] = await look(chip)
    expect([cursor, tag, href, tabindex]).toEqual(['default', 'SPAN', null, null])
    const count = page.locator('[data-section="directory"] [aria-live="polite"]')
    const before = await count.innerText()
    await chip.click()
    await expect(page).toHaveURL('/library?q=giao%20th%C3%B4ng')
    await expect(count).toHaveText(before)
    await page
      .getByRole('complementary', { name: 'Bộ lọc' })
      .getByRole('checkbox', { name: /^Logistics/ })
      .check()
    const facet = page.getByRole('button', { name: /^Bỏ lọc / }).first()
    expect((await look(facet))[1]).toBe('pointer')
    await facet.click()
    await expect(page.getByRole('button', { name: /^Bỏ lọc / })).toHaveCount(0)
  })

  test('404: "Về trang chủ" leads home, by keyboard too; Back still works', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    const res = await page.goto('/khong-ton-tai', { waitUntil: 'networkidle' })
    expect(res?.status()).toBe(404)
    const home = page.getByRole('link', { name: 'Về trang chủ' })
    await expect(home).toHaveAttribute('href', '/')
    await page.keyboard.press('Tab')
    await expect(home).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/')
    await page.goBack()
    await expect(page).toHaveURL('/khong-ton-tai')
    await page.goBack()
    await expect(page).toHaveURL('/')
  })

  test('mobile 390: the "Sắp có" labels fit; no horizontal scroll', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    watchConsole(page, errors)
    for (const url of ['/', '/about', '/library?q=giao%20th%C3%B4ng', '/khong-ton-tai']) {
      await page.goto(url, { waitUntil: 'networkidle' })
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, url).toBe(0)
    }
    await page.goto('/about', { waitUntil: 'networkidle' })
    for (const pill of await page
      .locator('[data-cta-kind="INERT"] > span[aria-hidden="true"]')
      .all()) {
      const box = (await pill.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(390)
    }
    await ctx.close()
  })

  test('BD-01: "Tạo tài khoản" and "Đăng nhập" open the one auth surface, which names both intents', async ({
    page,
    request,
  }) => {
    for (const url of ['/', '/about']) {
      for (const name of ['Tạo tài khoản', 'Đăng nhập']) {
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.getByRole('link', { name, exact: true }).first().click()
        await expect(page, `${url} ${name}`).toHaveURL('/auth')
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Đăng nhập & đăng ký')
      }
    }
    // No separate sign-up route, alias or mode.
    for (const path of ['/signup', '/login', '/dang-ky'])
      expect((await request.get(path)).status(), path).toBe(404)
  })
})
