import { expect, test, type APIRequestContext, type Browser } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { applyVocabularyFixture, completedAccount, type Account } from '../support/onboarding'
import { createVenture, freshAddress, invite } from '../support/workspace'

/**
 * TASK 22-L1-L2-PO-DECISION-FREEZE — the PO's Alpha decisions as the member
 * and the operator meet them (DEC-PDF). Each state is prepared through the
 * real APIs; the HUB declaration row is written as onboarding files it.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'

test.beforeAll(async () => {
  await applyVocabularyFixture()
})

test.afterAll(async () => {
  await closePool()
})

async function other(browser: Browser, label: string, display_name = label) {
  const context = await browser.newContext()
  const account = await completedAccount(context.request, label, { display_name })
  return { context, request: context.request, account }
}

const publish = (request: APIRequestContext, id: string) =>
  request.post(`/api/v1/ventures/${id}/publish`)

test.describe('DEC-PDF-D1 venture publication', () => {
  test('the owner publishes a complete venture from the editor; incomplete is refused first', async ({
    page,
  }) => {
    await completedAccount(page.request, 'pdf-owner', { display_name: 'Chủ PDF' })
    const name = `PDF Công khai ${Date.now()}`
    // No creator role yet: not eligible.
    const v = await createVenture(page.request, { type: 'STARTUP', name })
    expect((await (await page.request.get(`/api/v1/ventures/${v.id}`)).json()).visibility).toBe(
      'PRIVATE',
    )
    const refused = await publish(page.request, v.id)
    expect(refused.status()).toBe(422)
    expect((await refused.json()).error.fields).toEqual({ owner_role_label: 'required' })

    await page.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    const section = page.locator('[data-publication]')
    await expect(section).toHaveAttribute('data-publication', 'PRIVATE')
    await expect(section.locator('[data-publish-missing]')).toHaveText(
      'Còn thiếu: Vai trò của bạn trong đội.',
    )
    await expect(section.locator('[data-action="publish"]')).toBeDisabled()

    await page.locator('#ve-role').selectOption('Founder')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await expect(page.locator('[data-status]')).toContainText('đã lưu lúc')
    await expect(section.locator('[data-publish-missing]')).toHaveCount(0)
    const answered = page.waitForResponse((r) => r.url().endsWith('/publish'))
    await section.locator('[data-action="publish"]').click()
    expect((await answered).status()).toBe(200)
    await expect(section).toHaveAttribute('data-publication', 'PUBLIC')
    await expect(page.locator('[data-status]')).toContainText('Công khai')

    // ME7 names it; the record is ACTIVE and PUBLIC, audited once.
    await page.goto('/projects', { waitUntil: 'networkidle' })
    await expect(page.locator(`[data-venture="${v.id}"] [data-kind="status"]`)).toHaveText(
      'Công khai',
    )
    const [row] = await query<{ status: string; visibility: string }>(
      'SELECT status::text AS status, visibility::text AS visibility FROM projects WHERE id = $1',
      [v.id],
    )
    expect(row).toEqual({ status: 'ACTIVE', visibility: 'PUBLIC' })
  })

  test('only the owner publishes: members 403, others 404, guests 401; nothing is public', async ({
    page,
    browser,
  }) => {
    const owner = await completedAccount(page.request, 'pdf-own2')
    const name = `PDF Riêng ${Date.now()}`
    const v = await createVenture(page.request, {
      type: 'PROJECT',
      name,
      owner_role_label: 'Founder',
    })
    const editor = await other(browser, 'pdf-editor')
    const sent = await invite(page.request, v.id, {
      email: editor.account.email,
      permission: 'EDIT',
    })
    expect(
      (
        await editor.request.post(
          `/api/v1/ventures/${v.id}/team/invitations/${sent.membership_id}/accept`,
        )
      ).status(),
    ).toBe(200)
    const stranger = await other(browser, 'pdf-stranger')
    const guest = await browser.newContext()

    // Spoofed headers and body change nothing.
    const spoof = { 'x-role': 'OWNER', 'x-permission': 'OWNER', 'x-profile-id': owner.accountId }
    expect(
      (await editor.request.post(`/api/v1/ventures/${v.id}/publish`, { headers: spoof })).status(),
    ).toBe(403)
    expect((await publish(stranger.request, v.id)).status()).toBe(404)
    expect((await publish(guest.request, v.id)).status()).toBe(401)
    expect(
      (
        await page.request.patch(`/api/v1/ventures/${v.id}`, { data: { visibility: 'PUBLIC' } })
      ).status(),
    ).toBe(422)
    // The editor's page offers no "Công khai".
    const editorPage = await editor.context.newPage()
    await editorPage.goto(`/projects/${v.id}/edit`, { waitUntil: 'networkidle' })
    await expect(editorPage.locator('[data-venture-editor]')).toBeVisible()
    await expect(editorPage.locator('[data-publication]')).toHaveCount(0)

    // DRAFT, then PUBLIC: neither reaches a public page; no public venture path exists.
    for (const step of ['draft', 'public'] as const) {
      if (step === 'public') expect((await publish(page.request, v.id)).status()).toBe(200)
      for (const path of ['/', '/library', '/organizations/chapter-01']) {
        const response = await guest.request.get(path)
        expect(response.status(), path).toBe(200)
        const html = await response.text()
        expect(html.includes(name) || html.includes(v.id), `${step} ${path}`).toBe(false)
      }
      expect((await stranger.request.get(`/api/v1/ventures/${v.id}`)).status()).toBe(404)
    }
    await Promise.all([editor.context.close(), stranger.context.close(), guest.close()])
  })
})

test.describe('DEC-PDF-D6B HUB verification authority', () => {
  async function declaration(browser: Browser): Promise<Account & { profileId: string }> {
    const context = await browser.newContext()
    const account = await completedAccount(context.request, 'pdf-declared', {
      display_name: 'Người Khai HUB',
    })
    await context.close()
    await query(
      `INSERT INTO community_memberships
         (profile_id, organization_id, state, source, claimed_position, hub_declaration)
       VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED', 'Phó chủ nhiệm', true)`,
      [account.profileId, CHAPTER_01],
    )
    return account
  }

  test('the Chapter leader sees the declaration but cannot verify it; the Platform Admin can', async ({
    page,
    browser,
  }) => {
    const declared = await declaration(browser)
    const [m] = await query<{ id: string }>(
      `SELECT id::text FROM community_memberships WHERE profile_id = $1 AND organization_id = $2`,
      [declared.profileId, CHAPTER_01],
    )

    expect(
      (await page.request.post('/dev/login', { data: { email: 'leader@example.test' } })).ok(),
    ).toBe(true)
    await page.goto(`/ops/org/${CHAPTER_01}/members`, { waitUntil: 'networkidle' })
    const row = page.locator(`[data-member-row="${declared.profileId}"]`)
    await expect(row).toBeVisible()
    await expect(row.locator('[data-action="approve"]')).toHaveCount(0)
    await expect(row.locator('[data-action="reject"]')).toHaveCount(0)
    await page.goto(`/ops/org/${CHAPTER_01}/members/${declared.profileId}`, {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('[data-declaration-note]')).toContainText(
      'Chỉ quản trị nền tảng xác minh',
    )
    await expect(page.locator('[data-action="approve"]')).toHaveCount(0)
    for (const status of ['ACTIVE', 'REJECTED']) {
      const refused = await page.request.patch(
        `/api/v1/ops/organizations/${CHAPTER_01}/memberships/${m!.id}`,
        { data: { status } },
      )
      expect(refused.status(), status).toBe(403)
    }

    await page.context().clearCookies()
    expect(
      (await page.request.post('/dev/login', { data: { email: 'ops@example.test' } })).ok(),
    ).toBe(true)
    await page.goto(`/ops/org/${CHAPTER_01}/members/${declared.profileId}`, {
      waitUntil: 'networkidle',
    })
    await expect(page.locator('[data-declaration-note]')).toHaveCount(0)
    await page.locator('[data-action="approve"]').click()
    await expect(page.locator('[data-action="approve"]')).toHaveCount(0)
    const [after] = await query<{ state: string; source: string }>(
      'SELECT state::text AS state, source FROM community_memberships WHERE id = $1',
      [m!.id],
    )
    expect(after).toEqual({ state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED' })
    // The stated position granted nothing.
    expect(
      await query('SELECT 1 FROM leadership_records WHERE profile_id = $1', [declared.profileId]),
    ).toEqual([])
    expect(
      await query(
        `SELECT 1 FROM role_assignments WHERE individual_profile_id = $1
            AND role_code IN ('HUB_COMMUNITY_LEADER', 'PLATFORM_ADMIN')`,
        [declared.profileId],
      ),
    ).toEqual([])
  })
})

test.describe('DEC-PDF-D2 invitation by link is deferred', () => {
  test('PRJ2 draws the link row inert and says it comes later; e-mail stays the way', async ({
    page,
  }) => {
    await completedAccount(page.request, 'pdf-link')
    const v = await createVenture(page.request, { type: 'PROJECT', name: `PDF Link ${Date.now()}` })
    const requests: string[] = []
    page.on('request', (r) => {
      if (r.method() !== 'GET') requests.push(r.url())
    })
    await page.goto(`/projects/new?venture=${v.id}&step=team`, { waitUntil: 'networkidle' })
    const link = page.locator('[data-invite-link] [data-cta-kind="INERT"]')
    await expect(link).toHaveAttribute('aria-disabled', 'true')
    await expect(link).toHaveAttribute(
      'title',
      'Tính năng giai đoạn sau — chưa có trong phiên bản này',
    )
    await link.click({ force: true })
    expect(requests).toEqual([])
    await page.locator('#team-invite-email').fill(freshAddress('pdf-link-invitee'))
    await page.getByRole('button', { name: 'Gửi lời mời' }).click()
    await expect(page.locator('[data-row-kind="PENDING_INVITATION"]')).toHaveCount(1)
  })
})
