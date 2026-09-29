import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision, topOf } from '../pixel-qa/revision'
import {
  acceptLegal,
  applyVocabularyFixture,
  IDS,
  memberships,
  QA,
  reach,
  saveProfile,
  signInFresh,
  stored,
  watchConsole,
} from '../support/onboarding'

/**
 * WF01-S07 / ACC-09 — onboarding stage 4, "Rà soát hồ sơ trước khi hoàn tất"
 * (/onboarding/privacy). Production. Decisions DEC-L1R-D3, D6, D7
 * (docs/decisions/DECISION_LOG.md); DEC-WF01-S07-D1, D2, D8 still hold.
 */

const COMPLETE_API = '/api/v1/me/onboarding/complete'
const VISIBILITY_API = '/api/v1/me/visibility'
const ROLES_API = '/api/v1/me/onboarding/roles'

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

async function openReview(page: Page) {
  await page.goto('/onboarding/privacy', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Rà soát hồ sơ trước khi hoàn tất',
  )
}

const finish = (page: Page) => page.getByRole('button', { name: 'Hoàn tất hồ sơ' })
const agree = (page: Page) => page.getByRole('checkbox', { name: /Tôi đồng ý/ })
const discovery = (page: Page) =>
  page.getByRole('switch', { name: 'Hiển thị hồ sơ trong Mạng lưới' })

const consents = async (accountId: string) =>
  (
    await query<{ type: string; version: string }>(
      `SELECT c.consent_type::text AS type, d.version FROM consent_records c
         JOIN legal_documents d ON d.id = c.legal_document_id
        WHERE c.account_id = $1 AND c.withdrawn_at IS NULL`,
      [accountId],
    )
  ).sort((a, b) => a.type.localeCompare(b.type))

/** The stored PROFILE_DISCOVERY level, as the owner's API reports it. */
const level = async (page: Page) =>
  (await (await page.request.get(VISIBILITY_API)).json()).groups.find(
    (g: { group_code: string }) => g.group_code === 'PROFILE_DISCOVERY',
  ).level as string

/** The board's state, as far as the manual flow stores it. */
const BOARD = {
  headline: 'Đồng sáng lập · CEO tại Tracely',
  bio: 'Mười năm vận hành chuỗi lạnh nông sản.',
  domain_ids: [QA.domain.logistics, QA.domain.agritech, QA.domain.climate],
  specialization_ids: [
    QA.specialization.operations,
    QA.specialization.technology,
    QA.specialization.finance,
  ],
  skill_ids: [QA.skill.data, QA.skill.b2b, QA.skill.pitching],
  experience: [
    { title: 'Đồng sáng lập · CEO', organization_name: 'Tracely', started_on: '2022-02' },
    {
      title: 'Trưởng bộ phận vận hành chuỗi lạnh',
      organization_name: 'Minh Phát Agri',
      started_on: '2017-03',
      ended_on: '2022-01',
    },
  ],
  links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/dangkimchi' }],
}

const CLAIM = {
  organization_id: IDS.chapter01,
  position: 'Phó trưởng chapter',
  period: '2024 – nay',
}

test.describe('WF01-S07 functional and security', () => {
  test('a guest is sent to /auth; the stage opens only after stage 3 is passed', async ({
    page,
  }) => {
    await page.goto('/onboarding/privacy')
    await expect(page).toHaveURL('/auth')
    await signInFresh(page.request, 's07')
    await reach(page.request, 'ROLE')
    await page.goto('/onboarding/privacy')
    await expect(page).toHaveURL('/onboarding/purpose')
  })

  test('the review shows what the three stages stored, with "Sửa" to each', async ({ page }) => {
    await signInFresh(page.request, 's07')
    await reach(page.request, 'CAPABILITY', BOARD)
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, {
      data: { roles: ['HUB_MEMBER', 'INNOVATOR', 'STARTUP_FOUNDER'], hub_claims: [CLAIM] },
    })
    await reach(page.request, 'REVIEW', BOARD)
    await openReview(page)
    await expect(page.locator('header')).toContainText('BƯỚC 4/4 · RÀ SOÁT VÀ HOÀN TẤT')
    await expect(page.locator('header ol li').nth(3)).toHaveAttribute('aria-current', 'step')

    const part = (n: number) => page.locator(`[data-anchor="part-${n}"]`)
    await expect(part(1).getByRole('heading', { level: 2 })).toHaveText('Thông tin cơ bản')
    await expect(part(1).locator('dd')).toHaveText([
      'Đặng Kim Chi',
      'Kim Chi Đặng',
      'Đồng sáng lập · CEO tại Tracely',
      'Đà Nẵng, Việt Nam',
      'Chưa có',
      'Chưa thêm · riêng tư',
    ])
    await expect(part(2).locator('dd')).toHaveText([
      'Logistics · AgriTech · Climate Tech',
      'Vận hành · Công nghệ · Tài chính',
      'Phân tích dữ liệu · Đàm phán B2B · Pitching',
      '2 mục',
      'LinkedIn',
    ])
    await expect(part(3).locator('dd')).toHaveText([
      'Thành viên HUB Network · Innovator · Founder',
      'Phó trưởng chapter · Chapter 01 — Chờ xác minh',
    ])
    await expect(page.locator('[data-nav^="edit-"]')).toHaveCount(3)
    const targets = await page
      .locator('[data-nav^="edit-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('href')))
    expect(targets).toEqual([
      '/onboarding/profile',
      '/onboarding/capability',
      '/onboarding/purpose',
    ])
    await expect(page.locator('main')).not.toContainText(/AI đề xuất|do AI/)
  })

  test('completion is the server’s; the preview never shows private fields', async ({ page }) => {
    await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW', { ...BOARD, phone: '+84901234567' })
    await openReview(page)
    const server = await (await page.request.get('/api/v1/me/profile/completion')).json()
    expect(server.percent).toBe(70)
    const box = page.locator('[data-completion]')
    await expect(box).toContainText('70%')
    await expect(box.locator('li')).toHaveText([
      'Ảnh hồ sơ',
      'Mục tiêu phát triển',
      'Nhu cầu hiện tại',
    ])
    const preview = page.locator('[data-preview]')
    await expect(preview).toContainText('Kim Chi Đặng')
    await expect(preview).toContainText('Đồng sáng lập · CEO tại Tracely · Đà Nẵng')
    await expect(preview.locator('li')).toHaveText(['Logistics', 'AgriTech', 'Climate Tech'])
    const text = await preview.innerText()
    for (const hidden of ['Đặng Kim Chi', '84901234567', '@example.test']) {
      expect(text, hidden).not.toContain(hidden)
    }
    // Nothing was declared, so the card carries no role chip.
    await expect(preview.locator('[data-preview-roles]')).toHaveCount(0)
  })

  test('the preview’s role chips are descriptive text, never authority', async ({ page }) => {
    await signInFresh(page.request, 's07')
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, {
      data: { roles: ['HUB_MEMBER', 'INNOVATOR', 'STARTUP_FOUNDER'] },
    })
    await reach(page.request, 'REVIEW')
    await openReview(page)
    const chips = page.locator('[data-preview-roles] li')
    // Without a named unit the HUB role is only self-declared.
    await expect(chips).toHaveText(['Thành viên HUB · Tự khai', 'Innovator', 'Founder'])
    await expect(page.locator('[data-preview] a, [data-preview] button')).toHaveCount(0)

    await page.request.put(ROLES_API, {
      data: { roles: ['HUB_MEMBER', 'INNOVATOR', 'STARTUP_FOUNDER'], hub_claims: [CLAIM] },
    })
    await page.reload({ waitUntil: 'networkidle' })
    await expect(chips).toHaveText(['Thành viên HUB · Chờ xác minh', 'Innovator', 'Founder'])
    await expect(page.locator('[data-preview]')).not.toContainText(/Đã xác minh|Phó trưởng chapter/)
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.capabilities ?? []).toEqual([])
    expect(session.managed_scopes ?? []).toEqual([])
  })

  test('the confirmation is required: without it nothing is completed', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    const calls: string[] = []
    page.on('request', (r) => {
      if (r.method() !== 'GET') calls.push(`${r.method()} ${new URL(r.url()).pathname}`)
    })
    await openReview(page)
    await expect(agree(page)).not.toBeChecked()
    await finish(page).click()
    await expect(page.getByText('Vui lòng đồng ý với hai văn bản để hoàn tất hồ sơ.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/privacy')
    expect(calls).toEqual([])
    expect(await consents(accountId)).toEqual([])
    expect(await stored(accountId)).toMatchObject({ status: 'DRAFT', completed: null })
    // The API holds the same line.
    const refused = await page.request.post(COMPLETE_API)
    expect(refused.status()).toBe(422)
    expect((await refused.json()).error.fields).toEqual({
      TERMS_ACCEPTANCE: 'missing',
      PRIVACY_DATA_PROCESSING: 'missing',
    })
  })

  test('the documents open by their current version', async ({ page }) => {
    await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    await openReview(page)
    const { documents } = await (await page.request.get('/api/v1/legal/current')).json()
    const links = page.locator('[data-legal] a')
    await expect(links).toHaveCount(2)
    for (const doc of documents) {
      const link = page.locator('[data-legal]').getByRole('link', { name: doc.title })
      await expect(link).toHaveAttribute('href', doc.content_url)
      await expect(link).toHaveAttribute('target', '_blank')
      expect((await page.request.get(doc.content_url)).status()).toBe(200)
    }
  })

  test('B. "Hoàn tất hồ sơ" records two consents, the visibility and activates one profile', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    await openReview(page)
    await agree(page).check({ force: true })
    await finish(page).click()
    await expect(page).toHaveURL('/onboarding/complete')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hồ sơ của bạn đã sẵn sàng')

    const { documents } = await (await page.request.get('/api/v1/legal/current')).json()
    expect(await consents(accountId)).toEqual(
      [...documents]
        .sort((a: { type: string }, b: { type: string }) => a.type.localeCompare(b.type))
        .map((d: { type: string; version: string }) => ({ type: d.type, version: d.version })),
    )
    const row = await stored(accountId)
    expect(row).toMatchObject({ status: 'ACTIVE', profiles: 1 })
    expect(row!.completed).toBeInstanceOf(Date)
    expect(await level(page)).toBe('NETWORK_ONLY')
    const audits = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE actor_account_id = $1 ORDER BY action`,
      [accountId],
    )
    expect(audits.map((a) => a.action)).toEqual([
      'CONSENT_ACCEPTED',
      'CONSENT_ACCEPTED',
      'PROFILE_ACTIVATED',
    ])
  })

  test('G. visibility is its own choice: off stores PRIVATE, and it is not consent', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    await openReview(page)
    await expect(discovery(page)).toHaveAttribute('aria-checked', 'true')
    await discovery(page).click()
    await expect(discovery(page)).toHaveAttribute('aria-checked', 'false')
    // Switching visibility neither ticks nor replaces the confirmation.
    await expect(agree(page)).not.toBeChecked()
    await page
      .locator('[data-anchor="footer"]')
      .getByRole('button', { name: 'Lưu và hoàn tất sau' })
      .click()
    await expect(page).toHaveURL('/')
    expect(await level(page)).toBe('PRIVATE')
    expect(await consents(accountId)).toEqual([])
    expect(await stored(accountId)).toMatchObject({ status: 'DRAFT', completed: null })

    await page.goto('/me')
    await expect(page).toHaveURL('/onboarding/privacy')
    await expect(discovery(page)).toHaveAttribute('aria-checked', 'false')
    await agree(page).check({ force: true })
    await finish(page).click()
    await expect(page).toHaveURL('/onboarding/complete')
    expect(await level(page)).toBe('PRIVATE')
    expect(await (await page.request.get(VISIBILITY_API)).json()).toEqual({
      groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'PRIVATE' }],
    })
  })

  test('F. completing files the named unit as a pending, self-declared request only', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's07')
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, { data: { roles: ['HUB_MEMBER'], hub_claims: [CLAIM] } })
    await reach(page.request, 'REVIEW')
    expect(await memberships(accountId)).toEqual([])
    await openReview(page)
    await agree(page).check({ force: true })
    await finish(page).click()
    await expect(page).toHaveURL('/onboarding/complete')

    expect(await memberships(accountId)).toEqual([
      {
        organization_id: IDS.chapter01,
        state: 'PENDING_APPROVAL',
        source: 'SELF_DECLARED',
        claimed_position: 'Phó trưởng chapter',
        claimed_period: '2024 – nay',
      },
    ])
    expect((await stored(accountId))!.claims).toEqual([])
    const [granted] = await query<{ leadership: number; assignments: number }>(
      `SELECT (SELECT count(*)::int FROM leadership_records l WHERE l.profile_id = p.id) AS leadership,
              (SELECT count(*)::int FROM role_assignments r
                WHERE r.individual_profile_id = p.id) AS assignments
         FROM individual_profiles p WHERE p.account_id = $1`,
      [accountId],
    )
    expect(granted).toEqual({ leadership: 0, assignments: 0 })
    const session = await (await page.request.get('/api/v1/session')).json()
    expect(session.capabilities ?? []).toEqual([])
    expect(session.managed_scopes ?? []).toEqual([])
    const ops = `/api/v1/ops/organizations/${IDS.chapter01}`
    for (const path of [`${ops}/members`, `${ops}/dashboard`]) {
      expect([403, 404], path).toContain((await page.request.get(path)).status())
    }
    // The ops area does not exist for this account (DEC-WF03-G11: the same 404).
    for (const route of ['/ops/network', `/ops/org/${IDS.chapter01}`]) {
      expect((await page.goto(route))?.status(), route).toBe(404)
    }
  })

  test('a stale document version asks again and completes nothing', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    await openReview(page)
    const version = `s07-${Date.now()}`
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ('TERMS_ACCEPTANCE', $1, 'Điều khoản (bản mới)', $2, now())`,
      [version, `/legal/terms/${version}`],
    )
    try {
      await agree(page).check({ force: true })
      await finish(page).click()
      await expect(
        page.getByText('Văn bản vừa được cập nhật. Vui lòng xem lại và đồng ý với phiên bản mới.'),
      ).toBeVisible()
      await expect(page).toHaveURL('/onboarding/privacy')
      await expect(agree(page)).not.toBeChecked()
      await expect(page.locator('[data-legal]')).toContainText('Điều khoản (bản mới)')
      expect(await stored(accountId)).toMatchObject({ status: 'DRAFT', completed: null })
    } finally {
      await query('UPDATE legal_documents SET retired_at = now() WHERE version = $1', [version])
    }
  })

  test('an acceptance made stale behind a confirmed screen is asked again', async ({ page }) => {
    const { accountId } = await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    await acceptLegal(page.request)
    await openReview(page)
    await expect(agree(page)).toBeChecked()
    await expect(agree(page)).toBeDisabled()
    const version = `s07b-${Date.now()}`
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ('TERMS_ACCEPTANCE', $1, 'Điều khoản (bản mới hơn)', $2, now())`,
      [version, `/legal/terms/${version}`],
    )
    try {
      await finish(page).click()
      await expect(
        page.getByText('Văn bản vừa được cập nhật. Vui lòng xem lại và đồng ý với phiên bản mới.'),
      ).toBeVisible()
      await expect(page).toHaveURL('/onboarding/privacy')
      await expect(agree(page)).toBeEnabled()
      await expect(agree(page)).not.toBeChecked()
      await expect(page.locator('[data-legal]')).toContainText('Điều khoản (bản mới hơn)')
      expect(await stored(accountId)).toMatchObject({ status: 'DRAFT', completed: null })
      // Agreeing to the new version completes.
      await agree(page).check({ force: true })
      await finish(page).click()
      await expect(page).toHaveURL('/onboarding/complete')
      expect(await stored(accountId)).toMatchObject({ status: 'ACTIVE' })
    } finally {
      await query('UPDATE legal_documents SET retired_at = now() WHERE version = $1', [version])
    }
  })

  test('double submit completes once; a failure shows no success and can be retried', async ({
    page,
  }) => {
    const { accountId } = await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    let calls = 0
    await page.route(`**${COMPLETE_API}`, async (route) => {
      calls++
      if (calls === 1) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'INTERNAL', message: 'x', request_id: 'r' } }),
        })
      }
      await new Promise((r) => setTimeout(r, 300))
      return route.continue()
    })
    await openReview(page)
    await agree(page).check({ force: true })
    await finish(page).click()
    await expect(page.getByText('Chưa hoàn tất được. Vui lòng thử lại.')).toBeVisible()
    await expect(page).toHaveURL('/onboarding/privacy')
    expect(await stored(accountId)).toMatchObject({ status: 'DRAFT', completed: null })

    await finish(page).dblclick()
    await expect(page).toHaveURL('/onboarding/complete')
    expect(calls).toBe(2)
    const audits = await query(
      `SELECT 1 FROM audit_events WHERE actor_account_id = $1 AND action = 'PROFILE_ACTIVATED'`,
      [accountId],
    )
    expect(audits).toHaveLength(1)
    expect(await consents(accountId)).toHaveLength(2)
  })

  test('missing stage 1 data is named with the stage that collects it', async ({ page }) => {
    await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    await openReview(page)
    // The province is removed behind the open screen.
    await saveProfile(page.request, { region_id: null })
    await agree(page).check({ force: true })
    await finish(page).click()
    const notice = page.getByText(/Còn thiếu thông tin bắt buộc/)
    await expect(notice).toBeVisible()
    await expect(notice.getByRole('link', { name: /Thông tin cơ bản/ })).toHaveAttribute(
      'href',
      '/onboarding/profile',
    )
    await expect(page).toHaveURL('/onboarding/privacy')
  })

  test('keyboard and a11y', async ({ page }) => {
    await signInFresh(page.request, 's07')
    await reach(page.request, 'REVIEW')
    await openReview(page)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await discovery(page).focus()
    await page.keyboard.press('Space')
    await expect(discovery(page)).toHaveAttribute('aria-checked', 'false')
    await agree(page).focus()
    await page.keyboard.press('Space')
    await expect(agree(page)).toBeChecked()
    await finish(page).focus()
    expect(await finish(page).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
  })
})

test.describe('WF01-S07 pixel QA (ACC-09)', () => {
  /**
   * ACC-09, measured once. The board draws the AI-filled state, where rows
   * with an "AI" mark are taller. The manual state has no mark, so each block
   * is compared at its own anchor and the rows inside the review cards by
   * position only.
   */
  const REF = {
    cardTop: 113,
    part1Top: 251,
    part3Top: 765,
    confirmTop: 915,
    previewTop: 281,
    completionTop: 601,
    visibilityTop: 875,
    ruleTop: 1044,
  } as const

  test('1440×900: header, review cards, side column and footer match ACC-09', async ({ page }) => {
    await signInFresh(page.request, 's07')
    await reach(page.request, 'CAPABILITY', BOARD)
    await reach(page.request, 'ROLE')
    await page.request.put(ROLES_API, {
      data: { roles: ['HUB_MEMBER', 'INNOVATOR', 'STARTUP_FOUNDER'], hub_claims: [CLAIM] },
    })
    await reach(page.request, 'REVIEW', BOARD)
    await openReview(page)
    const at = (name: string) => topOf(page, `[data-anchor="${name}"]`)
    const card = await topOf(page, '[data-ui="surface"]')

    await auditRevision(page, {
      name: 'WF01-S07.ACC-09',
      reference: 'design-reference/final/revision/L1/ACC-09__onboarding-review__SOURCE.png',
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 66 }, dy: 0 },
        {
          name: 'card-head',
          reference: { x: 160, y: 100, width: 1120, height: 140 },
          dy: card - REF.cardTop,
        },
        {
          name: 'part-1-head',
          reference: { x: 230, y: 244, width: 612, height: 50 },
          dy: (await at('part-1')) - REF.part1Top,
        },
        {
          name: 'part-3-head',
          reference: { x: 230, y: 758, width: 612, height: 50 },
          dy: (await at('part-3')) - REF.part3Top,
        },
        {
          name: 'confirm',
          reference: { x: 230, y: 908, width: 612, height: 116 },
          dy: (await at('confirm')) - REF.confirmTop,
        },
        {
          name: 'preview',
          reference: { x: 848, y: 244, width: 362, height: 350 },
          dy: (await at('preview')) - REF.previewTop,
        },
        {
          name: 'completion',
          reference: { x: 848, y: 594, width: 362, height: 274 },
          dy: (await at('completion')) - REF.completionTop,
        },
        {
          name: 'visibility',
          reference: { x: 848, y: 868, width: 362, height: 80 },
          dy: (await at('visibility')) - REF.visibilityTop,
        },
        {
          name: 'footer',
          reference: { x: 160, y: 1034, width: 1120, height: 150 },
          dy: (await at('rule')) - REF.ruleTop,
        },
      ],
      // The bar's fill is the server's percent (70), the board's is its sample (75); the
      // confirmation's sentence is the consent, the board's is the AI one.
      exclude: await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-completion] [aria-hidden="true"], [data-anchor="confirm"] > span:last-child',
          ),
        ].map((el) => {
          const r = el.getBoundingClientRect()
          const wide = el.closest('[data-anchor="confirm"]') ? 540 : r.width
          return { x: r.x - 2, y: r.y + scrollY - 2, width: wide + 4, height: r.height + 4 }
        }),
      ),
      intentional: [
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'D-L1 (PO, 2026-09-29): the dark confirmation is the required acceptance of the two current documents, in the place of the AI confirmation the board draws',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'D-A1: no AI provider, so no "AI" mark is drawn and review rows keep their plain height; the cards are compared at their own anchors',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'D-C1: completion is the frozen ten groups, so the percent and the list are the server’s; the preview’s role chips are the member’s own declaration shown as text',
        },
        {
          class: 'INTENTIONAL-BUSINESS',
          reason:
            'the preview’s role chips keep the order of ACC-08, which the board’s own review row uses ("Innovator · Founder"); the board’s card draws the two the other way round',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason:
            'the screen code "(ME0)" of the board’s hint is a design annotation and is not shown',
        },
      ],
    })

    // The blocks the masks above leave out keep the board's geometry.
    const box = async (name: string) => {
      const b = (await page.locator(`[data-anchor="${name}"]`).boundingBox())!
      return { x: Math.round(b.x), width: Math.round(b.width) }
    }
    for (const name of ['part-1', 'part-2', 'part-3', 'confirm']) {
      expect(await box(name), name).toEqual({ x: 241, width: 590 })
    }
    for (const name of ['preview', 'completion', 'visibility']) {
      expect(await box(name), name).toEqual({ x: 859, width: 340 })
    }
  })
})
