import { expect, test } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { query } from '../../../src/lib/db/client'
import { listTalents } from '../../../src/lib/public/talent-directory'

/**
 * S2-HOME-TALENT-SECTION-01 — the homepage "Nhân tài" section. A guest gets the
 * shell and the sign-in entry, and no talent name or picture in the HTML; a
 * NETWORK member gets the canonical directory (pinned first, then by name),
 * each person once.
 */

const MEMBER = '5d000000-0000-4000-8000-0000000000a1'
// Three NETWORK_ONLY people (default visibility) so the isolated database has a directory.
const PEOPLE = [
  ['5d000000-0000-4000-8000-0000000000a2', '5d000000-0000-4000-8000-0000000000b2', 'HT Ánh Dương'],
  ['5d000000-0000-4000-8000-0000000000a3', '5d000000-0000-4000-8000-0000000000b3', 'HT Bảo Châu'],
  ['5d000000-0000-4000-8000-0000000000a4', '5d000000-0000-4000-8000-0000000000b4', 'HT Cẩm Tú'],
] as const

async function clear() {
  const accounts = [MEMBER, ...PEOPLE.map((p) => p[0])]
  await query(`DELETE FROM user_sessions WHERE account_id = ANY($1::uuid[])`, [accounts])
  await query(`DELETE FROM individual_profiles WHERE account_id = ANY($1::uuid[])`, [accounts])
  await query(`DELETE FROM user_accounts WHERE id = ANY($1::uuid[])`, [accounts])
}

test.beforeAll(async () => {
  await clear()
  const accounts = [MEMBER, ...PEOPLE.map((p) => p[0])]
  for (const [i, account] of accounts.entries())
    await query(
      `INSERT INTO user_accounts (id, email, email_normalized, status)
       VALUES ($1, $2, $2, 'ACTIVE')`,
      [account, `home-talents-${i}@example.test`],
    )
  for (const [account, profile, name] of PEOPLE)
    await query(
      `INSERT INTO individual_profiles (id, account_id, status, display_name, headline)
       VALUES ($1, $2, 'ACTIVE', $3, 'Thành viên mạng lưới')`,
      [profile, account, name],
    )
})

test.afterAll(clear)

test('guest: the section shell and sign-in entry; no talent name or picture in the HTML', async ({
  page,
}) => {
  const people = (await listTalents('NETWORK')) ?? []
  expect(people.length).toBeGreaterThan(0)
  const html = await (await page.request.get('/')).text()
  for (const p of people) {
    expect(html, p.name).not.toContain(p.name)
    if (p.avatarUrl) expect(html, p.avatarUrl).not.toContain(p.avatarUrl)
  }
  await page.goto('/', { waitUntil: 'networkidle' })
  const sec = page.locator('[data-section="talents"]')
  await expect(sec).toHaveAttribute('data-viewer', 'GUEST')
  await expect(sec.locator('[data-state="talent-gate"]')).toBeVisible()
  await expect(sec.locator('[data-talent], [data-talent-featured], img')).toHaveCount(0)
  await expect(sec.getByRole('link', { name: /Xem tất cả nhân tài/ })).toHaveAttribute(
    'href',
    '/talents',
  )
})

for (const width of [1440, 390]) {
  test(`${width}: member — the canonical people, pinned first, once each`, async ({
    page,
    baseURL,
  }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    const people = [...((await listTalents('NETWORK')) ?? [])].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, 'vi'),
    )
    const { token } = await createSession(MEMBER)
    await page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: token, url: baseURL! }])
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await page.goto('/', { waitUntil: 'networkidle' })
    const sec = page.locator('[data-section="talents"]')
    await expect(sec).toHaveAttribute('data-viewer', 'NETWORK')
    await expect(sec.locator('[data-talent-featured]')).toHaveAttribute(
      'data-talent-featured',
      people[0]!.key,
    )
    await expect(sec.locator('h3')).toHaveText(people[0]!.name)
    await sec.screenshot({ path: `tests/visual/actual/s2-home-talents-${width}.png` })
    // The rail: the next people in order, each once, none twice on screen.
    const keys = await sec
      .locator('[data-talent]')
      .evaluateAll((n) => n.map((x) => x.getAttribute('data-talent')))
    expect(keys).toEqual(people.slice(1, 1 + keys.length).map((p) => p.key))
    expect(new Set([people[0]!.key, ...keys]).size).toBe(keys.length + 1)
    // A card becomes the featured person; the arrows move on.
    await sec.locator('[data-talent]').first().click()
    await expect(sec.locator('[data-talent-featured]')).toHaveAttribute(
      'data-talent-featured',
      people[1]!.key,
    )
    await sec.getByRole('button', { name: 'Nhân tài trước' }).click()
    await expect(sec.locator('h3')).toHaveText(people[0]!.name)
    // 6 s rotation.
    await page.clock.runFor(6_100)
    await expect(sec.locator('h3')).toHaveText(people[1]!.name)
    // Reduced motion: no autoplay, no pause control.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(sec.getByRole('button', { name: /Tạm dừng tự chuyển/ })).toHaveCount(0)
    await page.clock.runFor(12_100)
    await expect(sec.locator('h3')).toHaveText(people[1]!.name)
    expect(
      await page.evaluate(() =>
        [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
      ),
    ).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    )
    expect(errors).toEqual([])
  })
}
