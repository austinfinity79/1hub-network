import { completedAccount } from '../../visual/support/onboarding'
import { expect, gap, test, uatHooks } from './uat'
import {
  assertNoLeak,
  countCreates,
  fillStep1,
  next,
  ventureCount,
  ventureRow,
  VENTURES,
} from './ventures'

/**
 * UC06 — User tạo Startup. The same canonical record with type STARTUP:
 * stage, creator role, owner, DRAFT and private, kept in the workspace. No
 * unique-name rule exists and none is invented.
 */
uatHooks()

test('UC06 · UI+API+DB · a Startup is created as STARTUP, DRAFT and private, owned by its creator', async ({
  page,
  browser,
}) => {
  const me = await completedAccount(page.request, 'uat-uc06')
  await page.goto('/projects', { waitUntil: 'networkidle' })
  await page.locator('[data-nav="create-project-empty"]').click()
  const creates = countCreates(page)

  // The AI block only suggests and is inert: pressing it sends nothing, publishes nothing.
  const ai = page.locator('[data-ai-block] [data-cta-kind="INERT"]').first()
  await expect(ai).toHaveAttribute('aria-disabled', 'true')
  await ai.click({ force: true })
  expect(creates.n).toBe(0)

  const name = `UAT Startup ${Date.now()}`
  await fillStep1(page, { type: 'Startup', name, stage: 'Pilot / Thử nghiệm', role: 'Founder' })
  await next(page).click()
  await expect(page).toHaveURL(/step=team$/)
  const id = new URL(page.url()).searchParams.get('venture')!
  expect(creates.n).toBe(1)

  await page.goto('/projects', { waitUntil: 'networkidle' })
  const card = page.locator(`[data-venture="${id}"]`)
  await expect(card.locator('[data-kind="type"]')).toHaveText('Startup')
  await expect(card.locator('[data-kind="status"]')).toHaveText('Nháp · chỉ đội thấy')
  await expect(card).toContainText('Giai đoạn: Pilot / Thử nghiệm')
  await expect(card).toContainText('Founder')

  expect(await (await page.request.get(`${VENTURES}/${id}`)).json()).toMatchObject({
    type: 'STARTUP',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    relation: 'OWNER',
    stage: { code: 'PILOT' },
    role_label: 'Founder',
  })
  expect(await ventureRow(id)).toEqual({
    type: 'STARTUP',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    owner: me.profileId,
    stage: 'PILOT',
    role: 'Founder',
    team_rows: 0,
  })

  const outsider = await browser.newContext()
  await completedAccount(outsider.request, 'uat-uc06-out')
  await assertNoLeak(browser, outsider.request, { id, name })
  await outsider.close()

  // "Startup có thể gắn website/pitch deck": no such field on the venture record.
  for (const data of [
    { website: 'https://tracely.example' },
    { pitch_deck_url: 'https://x.example/deck.pdf' },
  ]) {
    const res = await page.request.patch(`${VENTURES}/${id}`, { data })
    expect(res.status(), JSON.stringify(data)).toBe(422)
  }
  gap(
    'PRODUCT GAP',
    'Startup website and pitch deck: the venture record holds neither (PRJ1 "Tải pitch deck" is the inert AI block).',
  )
})

test('UC06 · exceptions · same name, missing data, stopping midway', async ({ page }) => {
  const me = await completedAccount(page.request, 'uat-uc06-x')
  const name = `UAT Trùng Tên ${Date.now()}`

  // Thông tin thiếu: the server refuses the same fields the screen names.
  const missing = await page.request.post(VENTURES, { data: { type: 'STARTUP', name } })
  expect(missing.status()).toBe(422)
  expect(Object.keys((await missing.json()).error.fields)).toEqual(['summary'])
  expect(await ventureCount(me.profileId)).toBe(0)

  // Startup trùng tên: no unique-name rule exists; two records, two ids.
  const ids: string[] = []
  for (let n = 0; n < 2; n++) {
    await page.goto('/projects/new', { waitUntil: 'networkidle' })
    await fillStep1(page, { type: 'Startup', name })
    await next(page).click()
    await expect(page).toHaveURL(/step=team$/)
    ids.push(new URL(page.url()).searchParams.get('venture')!)
  }
  expect(new Set(ids).size).toBe(2)
  gap(
    'NOT APPLICABLE',
    'Duplicate startup name: no uniqueness rule is defined, so two ventures with one name are two records (not invented).',
  )

  // Người dùng dừng giữa chừng: before step 1 is sent nothing exists; after it, the
  // draft stays and opens again from the workspace.
  await page.goto('/projects/new', { waitUntil: 'networkidle' })
  await page.locator('#ve-name').fill('Dừng giữa chừng')
  await page.goto('/projects', { waitUntil: 'networkidle' })
  expect(await ventureCount(me.profileId)).toBe(2)
  await page.locator(`[data-venture="${ids[0]}"] [data-nav="venture-edit"]`).click()
  await expect(page).toHaveURL(`/projects/${ids[0]}/edit`)
  await expect(page.locator('#ve-name')).toHaveValue(name)
})
