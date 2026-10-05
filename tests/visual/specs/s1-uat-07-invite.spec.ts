import { expect, test, type Browser, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { completedAccount, watchConsole } from '../support/onboarding'
import { createVenture, freshAddress, invite } from '../support/workspace'

/**
 * S1-UAT-07 (DEC-S1I) — team invitations: FB-18 copy link, US-02.12 invite by
 * link (receiver, join, regenerate, expiry, full team, forged level), US-02.11
 * e-mail invitation (re-send, member, batch), FB-14 invitation detail in the
 * workspace shell; 1440 / 768 / 390.
 */

let consoleErrors: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  watchConsole(page, consoleErrors)
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

const LINK = /\/moi\/[a-z0-9-]+-[0-9a-f]{40}$/

async function ownerWithVenture(page: Page, label: string, name = 'Tracely Đà Nẵng') {
  const owner = await completedAccount(page.request, label)
  const venture = await createVenture(page.request, { type: 'STARTUP', name })
  return { owner, venture }
}

/** A second, signed-in member in its own browser context. */
async function member(browser: Browser, label: string) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  watchConsole(page, consoleErrors)
  const account = await completedAccount(page.request, label)
  return { context, page, account }
}

const memberships = (ventureId: string, profileId: string) =>
  query<{ state: string; role_label: string; permission: string }>(
    `SELECT state::text AS state, role_label, permission FROM project_members
      WHERE project_id = $1 AND profile_id = $2`,
    [ventureId, profileId],
  )

async function linkPath(page: Page, ventureId: string): Promise<string> {
  const response = await page.request.post(`/api/v1/ventures/${ventureId}/team/invite-link`)
  expect(response.status()).toBe(200)
  return (await response.json()).link.path
}

test.describe('FB-18 — "Sao chép link" on PRJ2', () => {
  test('copies the real URL, then shows "Đã sao chép" for a moment; a repeat copies the same link', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const { venture } = await ownerWithVenture(page, 's1i-copy')
    await page.goto(`/projects/new?venture=${venture.id}&step=team`, { waitUntil: 'networkidle' })
    const row = page.locator('[data-invite-link]')
    const copy = row.getByRole('button', { name: 'Sao chép link' })
    await expect(row.locator('[data-cta-kind="INERT"]')).toHaveCount(0)
    await copy.click()
    await expect(row.getByRole('button', { name: 'Đã sao chép' })).toBeVisible()
    await expect(row.locator('[data-invite-link-status]')).toHaveText('Đã sao chép')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(LINK)
    expect(copied.startsWith(new URL(page.url()).origin)).toBe(true)
    await expect(row.locator('[data-invite-link-meta]')).toContainText(
      'Ai mở link sẽ vào đội với vai trò Thành viên, quyền Xem · hết hạn',
    )
    // The copied state is temporary.
    await expect(row.getByRole('button', { name: 'Sao chép link' })).toBeVisible({ timeout: 6000 })
    await page.evaluate(() => navigator.clipboard.writeText(''))
    await row.getByRole('button', { name: 'Sao chép link' }).click()
    await expect(row.getByRole('button', { name: 'Đã sao chép' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copied)
  })

  test('a refused clipboard never claims success: the link is shown to copy by hand', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('denied')) },
      })
    })
    const { venture } = await ownerWithVenture(page, 's1i-clipfail')
    await page.goto(`/projects/new?venture=${venture.id}&step=team`, { waitUntil: 'networkidle' })
    const row = page.locator('[data-invite-link]')
    await row.getByRole('button', { name: 'Sao chép link' }).click()
    await expect(row.getByRole('alert')).toHaveText(
      'Chưa sao chép được tự động. Hãy chép link bên dưới.',
    )
    await expect(row.getByRole('button', { name: 'Đã sao chép' })).toHaveCount(0)
    const field = row.getByLabel('Link mời')
    await expect(field).toHaveValue(LINK)
    await expect(field).toHaveAttribute('readonly', '')
  })

  test('"Tạo lại link" from the keyboard: the old link dies at once, the new one works', async ({
    page,
    context,
    browser,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const { venture } = await ownerWithVenture(page, 's1i-regen')
    await page.goto(`/projects/new?venture=${venture.id}&step=team`, { waitUntil: 'networkidle' })
    const row = page.locator('[data-invite-link]')
    await row.getByRole('button', { name: 'Sao chép link' }).focus()
    await page.keyboard.press('Enter')
    await expect(row.getByRole('button', { name: 'Đã sao chép' })).toBeVisible()
    const old = new URL(await page.evaluate(() => navigator.clipboard.readText())).pathname
    await row.getByRole('button', { name: 'Tạo lại link' }).focus()
    await page.keyboard.press('Enter')
    await expect(row.locator('[data-invite-link-notice]')).toHaveText(
      'Đã tạo link mới. Link cũ không còn hiệu lực.',
    )
    const fresh = await linkPath(page, venture.id)
    expect(fresh).not.toBe(old)
    const receiver = await member(browser, 's1i-regen-r')
    await receiver.page.goto(old, { waitUntil: 'networkidle' })
    await expect(receiver.page.locator('[data-invite-state="invalid"]')).toContainText(
      'Lời mời không còn hiệu lực',
    )
    await receiver.page.goto(fresh, { waitUntil: 'networkidle' })
    await expect(receiver.page.locator('[data-invite-state="valid"]')).toContainText(
      'Tracely Đà Nẵng',
    )
    await receiver.context.close()
  })
})

test.describe('US-02.12 — receiver', () => {
  test('guest → sign-in with return → preview (no auto-join) → "Tham gia" → member · Xem; reopen adds nothing', async ({
    page,
    browser,
  }) => {
    const { venture } = await ownerWithVenture(page, 's1i-join')
    const path = await linkPath(page, venture.id)
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
    const guest = await context.newPage()
    watchConsole(guest, consoleErrors)
    await guest.goto(path)
    await expect(guest).toHaveURL(`/auth?redirect=${encodeURIComponent(path)}`)
    const account = await completedAccount(guest.request, 's1i-join-r')
    await guest.goto(path, { waitUntil: 'networkidle' })
    const offer = guest.locator('[data-invite-offer]')
    await expect(guest.locator('[data-shell="workspace"]')).toBeVisible()
    await expect(offer).toHaveText(
      /Tracely Đà Nẵng mời bạn vào đội với vai trò Thành viên · quyền Xem/,
    )
    expect(await memberships(venture.id, account.profileId)).toEqual([])
    await offer.getByRole('button', { name: 'Tham gia' }).click()
    await expect(guest).toHaveURL(`/projects/${venture.id}/team`)
    expect(await memberships(venture.id, account.profileId)).toEqual([
      { state: 'ACTIVE', role_label: 'Thành viên', permission: 'VIEW' },
    ])
    await guest.goto(path)
    await expect(guest).toHaveURL(`/projects/${venture.id}/team`)
    expect(await memberships(venture.id, account.profileId)).toHaveLength(1)
    await context.close()
  })

  test('unknown or expired links say only "Lời mời không còn hiệu lực"', async ({
    page,
    browser,
  }) => {
    const { venture } = await ownerWithVenture(page, 's1i-invalid')
    const path = await linkPath(page, venture.id)
    const receiver = await member(browser, 's1i-invalid-r')
    for (const target of [`/moi/doi-${'0'.repeat(40)}`, '/moi/khong-hop-le']) {
      await receiver.page.goto(target, { waitUntil: 'networkidle' })
      const card = receiver.page.locator('[data-invite-state="invalid"]')
      await expect(card).toContainText('Lời mời không còn hiệu lực')
      await expect(card).not.toContainText('Tracely')
    }
    await query(
      `UPDATE venture_invite_links SET created_at = now() - interval '8 days',
              expires_at = now() - interval '1 minute' WHERE project_id = $1`,
      [venture.id],
    )
    await receiver.page.goto(path, { waitUntil: 'networkidle' })
    await expect(receiver.page.locator('[data-invite-state="invalid"]')).toBeVisible()
    await receiver.context.close()
  })

  test('a full team (20 people, pending invitations counted) refuses; a forged level is refused', async ({
    page,
    browser,
  }) => {
    const { venture } = await ownerWithVenture(page, 's1i-full')
    const path = await linkPath(page, venture.id)
    const receiver = await member(browser, 's1i-full-r')
    const forged = await receiver.page.request.post(`/api/v1/invite-links/${path.slice(5)}/join`, {
      data: { permission: 'EDIT', role_label: 'Founder' },
    })
    expect(forged.status()).toBe(422)
    expect(await memberships(venture.id, receiver.account.profileId)).toEqual([])
    for (let i = 0; i < 19; i++)
      await invite(page.request, venture.id, { email: freshAddress('full') })
    await receiver.page.goto(path, { waitUntil: 'networkidle' })
    await receiver.page.getByRole('button', { name: 'Tham gia' }).click()
    await expect(receiver.page.locator('[data-invite-offer] [role="alert"]')).toContainText(
      'Đội đã đủ 20 người nên chưa tham gia được.',
    )
    expect(await memberships(venture.id, receiver.account.profileId)).toEqual([])
    await receiver.context.close()
  })
})

test.describe('US-02.11 — e-mail invitation', () => {
  test('re-send extends the same row; a member is refused; batches of more than 10 are refused; bad addresses are named', async ({
    page,
    browser,
  }) => {
    const { venture } = await ownerWithVenture(page, 's1i-email')
    const mate = await member(browser, 's1i-email-m')
    const join = await mate.page.request.post(
      `/api/v1/invite-links/${(await linkPath(page, venture.id)).slice(5)}/join`,
    )
    expect(join.status()).toBe(200)
    await page.goto(`/projects/new?venture=${venture.id}&step=team`, { waitUntil: 'networkidle' })
    const field = page.getByLabel('Email thành viên')
    const send = page.getByRole('button', { name: 'Gửi lời mời' })
    const address = freshAddress('resend')
    await field.fill(address)
    await send.click()
    await expect(page.getByText('Đã gửi lời mời.')).toBeVisible()
    await field.fill(address)
    await send.click()
    await expect(page.getByText('Đã gửi lại lời mời; hạn mới 7 ngày.')).toBeVisible()
    const [{ n }] = (await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM project_members WHERE project_id = $1 AND invite_email_normalized = $2`,
      [venture.id, address.toLowerCase()],
    )) as [{ n: number }]
    expect(n).toBe(1)

    await field.fill(mate.account.email)
    await send.click()
    await expect(page.locator('#team-invite-error')).toContainText('Người này đã ở trong đội.')

    await field.fill(Array.from({ length: 11 }, (_, i) => `b${i}@example.test`).join(', '))
    await send.click()
    await expect(page.locator('#team-invite-error')).toHaveText('Mỗi lần gửi tối đa 10 email.')

    const good = freshAddress('mixed')
    await field.fill(`khong-phai-email, ${good}`)
    await send.click()
    await expect(page.locator('#team-invite-error')).toContainText(
      'khong-phai-email (Email chưa hợp lệ.)',
    )
    await expect(field).toHaveValue('khong-phai-email')
    const sent = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND invite_email_normalized = $2`,
      [venture.id, good.toLowerCase()],
    )
    expect(sent).toHaveLength(1)
    await mate.context.close()
  })
})

test.describe('FB-14 — invitation detail in the workspace shell', () => {
  test('header, five-item sidebar, ME7 card and buttons; "Chấp nhận" from the keyboard', async ({
    page,
    browser,
  }) => {
    const { venture } = await ownerWithVenture(page, 's1i-detail')
    const invitee = await member(browser, 's1i-detail-r')
    await invite(page.request, venture.id, {
      email: invitee.account.email,
      role_label: 'Co-founder',
      permission: 'EDIT',
    })
    await invitee.page.goto(`/projects/${venture.id}/team`, { waitUntil: 'networkidle' })
    await expect(invitee.page.locator('[data-shell="workspace"]')).toBeVisible()
    const nav = invitee.page.getByRole('navigation', { name: 'Tài khoản của tôi' })
    for (const label of [
      'Hồ sơ của tôi',
      'Dự án & startup',
      'Hồ sơ đăng ký',
      'Tổ chức của tôi',
      'Cài đặt',
    ]) {
      await expect(nav).toContainText(label)
    }
    const detail = invitee.page.locator('[data-team-invitation]')
    await expect(detail.getByRole('heading', { level: 1 })).toHaveText('Tracely Đà Nẵng')
    await expect(detail.locator('[data-invitation]')).toContainText(
      'Tracely Đà Nẵng mời bạn vào đội với vai trò Co-founder · quyền Biên tập',
    )
    await expect(detail).toContainText('hết hạn')
    await detail.getByRole('button', { name: 'Chấp nhận' }).focus()
    await invitee.page.keyboard.press('Enter')
    await expect(invitee.page.locator('[data-team-table]')).toBeVisible()
    expect(await memberships(venture.id, invitee.account.profileId)).toEqual([
      { state: 'ACTIVE', role_label: 'Co-founder', permission: 'EDIT' },
    ])
    await invitee.context.close()
  })
})

test.describe('responsive 1440 / 768 / 390', () => {
  for (const width of [1440, 768, 390]) {
    test(`${width}: PRJ2 link row, team invite panel, receiver and detail fit, nothing clipped`, async ({
      page,
      context,
      browser,
    }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.setViewportSize({ width, height: 900 })
      const { venture } = await ownerWithVenture(page, `s1i-r${width}`)
      const overflow = (p: Page) =>
        p.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
      await page.goto(`/projects/new?venture=${venture.id}&step=team`, { waitUntil: 'networkidle' })
      await page
        .locator('[data-invite-link]')
        .getByRole('button', { name: 'Sao chép link' })
        .click()
      await expect(page.locator('[data-invite-link-meta]')).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      for (const name of ['Đã sao chép', 'Tạo lại link']) {
        const box = (await page.getByRole('button', { name }).boundingBox())!
        expect(box.x + box.width, name).toBeLessThanOrEqual(width)
      }
      await page.screenshot({
        path: `tests/visual/diff/s1-uat-07/prj2-link-${width}.png`,
        fullPage: true,
      })

      await page.goto(`/projects/${venture.id}/team`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: 'Mời thành viên' }).first().click()
      await expect(page.locator('[data-invite-link]')).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await page.screenshot({
        path: `tests/visual/diff/s1-uat-07/team-invite-${width}.png`,
        fullPage: true,
      })

      const path = await linkPath(page, venture.id)
      const receiver = await member(browser, `s1i-r${width}-m`)
      await receiver.page.setViewportSize({ width, height: 900 })
      await receiver.page.goto(path, { waitUntil: 'networkidle' })
      const join = receiver.page.getByRole('button', { name: 'Tham gia' })
      const box = (await join.boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      expect(await overflow(receiver.page)).toBeLessThanOrEqual(0)
      await receiver.page.screenshot({
        path: `tests/visual/diff/s1-uat-07/receiver-${width}.png`,
        fullPage: true,
      })
      await receiver.page.goto('/moi/khong-hop-le', { waitUntil: 'networkidle' })
      expect(await overflow(receiver.page)).toBeLessThanOrEqual(0)
      await receiver.page.screenshot({ path: `tests/visual/diff/s1-uat-07/invalid-${width}.png` })

      await invite(page.request, venture.id, { email: receiver.account.email })
      await receiver.page.goto(`/projects/${venture.id}/team`, { waitUntil: 'networkidle' })
      await expect(receiver.page.locator('[data-team-invitation]')).toBeVisible()
      expect(await overflow(receiver.page)).toBeLessThanOrEqual(0)
      await receiver.page.screenshot({
        path: `tests/visual/diff/s1-uat-07/detail-${width}.png`,
        fullPage: true,
      })
      await receiver.context.close()
    })
  }
})
