import { completedAccount } from '../../visual/support/onboarding'
import { expect, gap, test, uatHooks } from './uat'
import {
  alerts,
  assertNoLeak,
  countCreates,
  fillStep1,
  next,
  ventureCount,
  ventureRow,
  VENTURES,
} from './ventures'

/**
 * UC05 — User tạo Project. "Dự án & startup của tôi" → create → "Dự án / ý
 * tưởng" → required fields → save. One PROJECT, owned by its creator, DRAFT
 * and private, listed in the member's workspace.
 */
uatHooks()

test('UC05 · UI+API+DB · a Project is created once, DRAFT and private, owned by its creator, listed on ME7', async ({
  page,
  browser,
}) => {
  const me = await completedAccount(page.request, 'uat-uc05')
  await page.goto('/projects', { waitUntil: 'networkidle' })
  await page.locator('[data-nav="create-project-empty"]').click()
  await expect(page).toHaveURL('/projects/new')
  const creates = countCreates(page)

  // Thiếu tên / lĩnh vực / giai đoạn: named on the screen, nothing sent.
  await next(page).click()
  await expect(alerts(page)).toHaveText(Array(5).fill('Trường này là bắt buộc.'))
  expect(creates.n).toBe(0)

  const name = `UAT Dự án ${Date.now()}`
  await fillStep1(page, { type: 'Dự án / ý tưởng', name, stage: 'MVP', role: 'Co-founder' })
  // Double submit: one request, one venture.
  await next(page).dblclick()
  await expect(page).toHaveURL(/\/projects\/new\?venture=[0-9a-f-]{36}&step=team$/)
  const id = new URL(page.url()).searchParams.get('venture')!
  expect(creates.n).toBe(1)

  // Refresh re-reads the stored draft; Back leaves the wizard (it replaced its
  // own address); neither creates anything again.
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('#team-invite-email')).toBeVisible()
  await page.goBack({ waitUntil: 'networkidle' })
  expect(await ventureCount(me.profileId)).toBe(1)
  // "Lưu nháp và thoát" from the team step → the workspace.
  await page.goto(`/projects/new?venture=${id}&step=team`, { waitUntil: 'networkidle' })
  await page.locator('[data-nav="wizard-exit"]').first().click()
  await expect(page).toHaveURL('/projects')
  expect(creates.n).toBe(1)
  const card = page.locator(`[data-venture="${id}"]`)
  await expect(card.locator('[data-kind="type"]')).toHaveText('Dự án')
  await expect(card.locator('[data-kind="status"]')).toHaveText('Nháp · chỉ đội thấy')
  await expect(card.locator('[data-kind="permission"]')).toHaveText('Chủ sở hữu')
  await expect(card).toContainText('Giai đoạn: MVP')

  // API.
  const v = await (await page.request.get(`${VENTURES}/${id}`)).json()
  expect(v).toMatchObject({
    type: 'PROJECT',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    relation: 'OWNER',
    permission: 'OWNER',
    role_label: 'Co-founder',
    stage: { code: 'MVP' },
  })
  const mine = await (await page.request.get('/api/v1/me/ventures')).json()
  expect(mine.items.map((x: { id: string }) => x.id)).toEqual([id])

  // DB: owner from the session, no owner team row, the stable stage code.
  expect(await ventureRow(id)).toEqual({
    type: 'PROJECT',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    owner: me.profileId,
    stage: 'MVP',
    role: 'Co-founder',
    team_rows: 0,
  })

  // DRAFT leakage = 0.
  const outsider = await browser.newContext()
  await completedAccount(outsider.request, 'uat-uc05-out')
  await assertNoLeak(browser, outsider.request, { id, name })
  await outsider.close()

  // "Project có thể chuyển thành Startup về sau": the type is fixed once created.
  const convert = await page.request.patch(`${VENTURES}/${id}`, { data: { type: 'STARTUP' } })
  expect(convert.status()).toBe(422)
  expect((await convert.json()).error.fields).toEqual({ type: 'immutable' })
  gap(
    'PRODUCT GAP',
    'Project → Startup conversion is not supported: the type is fixed at creation (DEC-WF02-S05-G4, PRJ1 "Chọn một lần khi tạo").',
  )
})

test('UC05 · exceptions · cancel creates nothing; "Lưu nháp" keeps a draft', async ({ page }) => {
  const me = await completedAccount(page.request, 'uat-uc05-cancel')
  await page.goto('/projects/new', { waitUntil: 'networkidle' })
  await page.locator('#ve-name').fill('Không lưu')
  await page.locator('[data-nav="wizard-cancel"]').click()
  await expect(page).toHaveURL('/projects')
  expect(await ventureCount(me.profileId)).toBe(0)

  await page.goto('/projects/new', { waitUntil: 'networkidle' })
  await fillStep1(page, { type: 'Dự án / ý tưởng', name: 'Chỉ lưu nháp' })
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click()
  await expect(page).toHaveURL(/venture=[0-9a-f-]{36}/)
  expect(await ventureCount(me.profileId)).toBe(1)
  const id = new URL(page.url()).searchParams.get('venture')!
  expect(await ventureRow(id)).toMatchObject({ status: 'DRAFT', visibility: 'PRIVATE' })
})
