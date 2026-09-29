import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { resolveOutputPath } from '../pixel-qa/paths'
import { auditRevision, leftOf, topOf } from '../pixel-qa/revision'
import {
  applyVocabularyFixture,
  completedAccount,
  signInFresh,
  watchConsole,
} from '../support/onboarding'
import { createVenture, STAGE } from '../support/workspace'

/**
 * TASK 24.4 — L5 Startup Journey (DEC-L5-D1..D6). A founder applies to a
 * PUBLISHED programme from the member area, on the server (migration 013,
 * 05 §21): SUB0 quick team → SUB1 form → SUB2 review → SUB3 submitted.
 *
 * Journey, entry routing, ownership and IDOR, responsive 1440 / 1024 / 768 /
 * 390, and pixel audits against L37 / L38 / L40 / L41 / L42 / L43 (1440×900
 * DPR1, production build). Each block is compared at its own anchor: the
 * product leaves out what the frames draw for a Problem (DEC-L5-D6) and the
 * blocks below move up. Excluded regions are the documented intentional
 * differences, listed per audit.
 */

const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const RANDOM = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const APPS = '/api/v1/applications'
const REF = 'design-reference/final/revision/L5'
const PERSONA = { full_name: 'Đặng Kim Chi', display_name: 'Đặng Kim Chi' }
/** L38's answer, so the text inside the box is compared like with like. */
const L38_ANSWER =
  'Vấn đề không nằm ở chỗ thiếu dữ liệu mà ở chỗ dữ liệu đã có không được nối lại với nhau. Mỗi lần đổi trạng thái đều có dấu thời gian, nhưng không ai đối chiếu chúng theo chuyến...'

const applyUrl = (programme = PROGRAMME) => `/programmes/${programme}/apply`
const formUrl = (id: string, programme = PROGRAMME) => `/projects/${id}/applications/${programme}`
const reviewUrl = (id: string) => `${formUrl(id)}/review`
const submittedUrl = (id: string) => `${formUrl(id)}/submitted`

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
  expect(consoleErrors, 'browser console / hydration errors').toEqual([])
})

test.afterAll(async () => {
  await closePool()
})

// ------------------------------------------------------------------ helpers

const answers = (a0: string, a1: string) => [
  { question_id: 'q-problem', value: a0 },
  { question_id: 'q-support', value: a1 },
]

async function draft(request: APIRequestContext, ventureId: string, texts?: [string, string]) {
  const created = await request.post(APPS, {
    data: { venture_id: ventureId, programme_id: PROGRAMME },
  })
  expect(created.status(), await created.text()).toBe(201)
  const { id } = (await created.json()) as { id: string }
  if (texts)
    expect(
      (await request.patch(`${APPS}/${id}`, { data: { answers: answers(...texts) } })).status(),
    ).toBe(200)
  return id
}

async function submit(request: APIRequestContext, id: string) {
  const response = await request.post(`${APPS}/${id}/submit`)
  expect(response.status(), await response.text()).toBe(200)
}

async function errorCode(response: APIResponse) {
  const body = (await response.json()) as { error?: { code: string } }
  return `${response.status()} ${body.error?.code ?? ''}`.trim()
}

function rows(ventureIds: string[]) {
  return query<{ id: string; venture_id: string; status: string; answers: unknown }>(
    `SELECT id::text, venture_id::text, status::text, answers
       FROM applications WHERE venture_id = ANY($1::uuid[]) ORDER BY created_at`,
    [ventureIds],
  )
}

async function audits(resourceId: string) {
  const found = await query<{ action: string }>(
    `SELECT action FROM audit_events WHERE resource_id::text = $1 ORDER BY created_at`,
    [resourceId],
  )
  return found.map((r) => r.action)
}

const screen = (page: Page, id: string) => page.locator(`[data-screen="${id}"]`)
const step = (page: Page) => screen(page, 'L5-SUB1')
const answer = (page: Page, q: 'q-problem' | 'q-support') => page.locator(`#q-${q}`)

/** A capture-space rect around every element matching `selector` (text that differs by content). */
async function rectsOf(page: Page, selector: string, pad = 2) {
  return page.locator(selector).evaluateAll(
    (els, p) =>
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: r.x - p,
          y: r.y + scrollY - p,
          width: r.width + 2 * p,
          height: r.height + 2 * p,
        }
      }),
    pad,
  )
}

/** Sets the form's accepted applicant types for one test (HD-A11), restoring them after. */
async function withApplicantTypes<T>(types: string[], run: () => Promise<T>): Promise<T> {
  const [before] = await query<{ types: string }>(
    `SELECT applicant_types::text AS types FROM programme_application_forms WHERE programme_id = $1`,
    [PROGRAMME],
  )
  await query(
    `UPDATE programme_application_forms SET applicant_types = $2::applicant_type[] WHERE programme_id = $1`,
    [PROGRAMME, types],
  )
  try {
    return await run()
  } finally {
    await query(
      `UPDATE programme_application_forms SET applicant_types = $2::applicant_type[] WHERE programme_id = $1`,
      [PROGRAMME, before!.types],
    )
  }
}

// ------------------------------------------------------------------ journey

test.describe('L5-J founder journey', () => {
  test('a member without a venture: SUB0 quick team → SUB1 01 / 03 / 04 → refresh resumes → SUB2 → double submit → SUB3 once; SUBMITTED is final', async ({
    page,
  }) => {
    const me = await completedAccount(page.request, 'l5-journey', PERSONA)
    await page.goto(applyUrl(), { waitUntil: 'networkidle' })
    await expect(screen(page, 'L5-SUB0')).toBeVisible()
    await expect(page.locator('[data-anchor="chip"]')).toHaveText('Bước cuối trước khi vào phiếu')
    // HD-A11: the programme accepts TEAM and STARTUP, so the type is asked.
    await expect(page.getByRole('radio')).toHaveCount(2)

    // Every field is required (DEC-L5-D5): nothing is sent until they are filled.
    await page.locator('[data-action="quick-go"]').click()
    await expect(page.locator('form [role="alert"]')).toHaveCount(5)
    await page.locator('#quick-name').fill('Tracely')
    await page.getByRole('radio', { name: 'Startup' }).check()
    await page.locator('[data-action="domain-picker"]').click()
    await page.getByRole('button', { name: 'Logistics', exact: true }).click()
    await page.getByRole('button', { name: 'AI', exact: true }).click()
    await page.locator('[data-action="domain-picker"]').click()
    await expect(page.locator('[data-action="domain-picker"]')).toHaveText('Logistics · AI')
    await page.locator('#quick-stage').selectOption(STAGE.pilot)
    await page.locator('#quick-summary').fill('Truy vết chuỗi giao vận bằng dữ liệu sẵn có')
    // A double click creates one venture (the idempotency key of the visit).
    await page.locator('[data-action="quick-go"]').dblclick()
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}\/applications\//)
    const ventureId = new URL(page.url()).pathname.split('/')[2]!
    const ventures = await query<{ id: string; type: string; name: string }>(
      `SELECT p.id::text, p.type::text, p.name FROM projects p
         JOIN individual_profiles i ON i.id = p.owner_profile_id WHERE i.account_id = $1`,
      [me.accountId],
    )
    expect(ventures).toEqual([{ id: ventureId, type: 'STARTUP', name: 'Tracely' }])
    expect(await audits(ventureId)).toEqual(['VENTURE_CREATED'])

    // SUB1: the application is created on the first save, not on opening.
    await expect(step(page)).toHaveAttribute('data-step', '1')
    expect(await rows([ventureId])).toEqual([])
    await answer(page, 'q-problem').fill('Dữ liệu có sẵn nhưng không được nối lại.')
    await page.locator('[data-action="next"]').click()
    await expect(step(page)).toHaveAttribute('data-step', '3')
    await expect(page.locator('[data-anchor="team"]')).toContainText('Đặng Kim Chi')
    await page.locator('[data-action="next"]').click()
    await expect(step(page)).toHaveAttribute('data-step', '4')
    await answer(page, 'q-support').fill('Dữ liệu thử nghiệm và cố vấn vận hành.')
    await answer(page, 'q-support').blur()
    await expect(page.locator('[data-save-state="idle"]')).toHaveText(/^Đã lưu lúc/)
    await page.reload({ waitUntil: 'networkidle' })
    await expect(step(page)).toHaveAttribute('data-step', '4')
    await expect(answer(page, 'q-support')).toHaveValue('Dữ liệu thử nghiệm và cố vấn vận hành.')
    await expect(page.locator('[data-anchor="remaining"]')).toHaveText('Đủ điều kiện nộp')

    // SUB2 → double submit → SUB3.
    await page.locator('[data-action="to-review"]').click()
    await expect(page).toHaveURL(reviewUrl(ventureId))
    await expect(page.locator('[data-question]')).toHaveCount(2)
    await page.locator('[data-action="submit"]').dblclick()
    await expect(page).toHaveURL(submittedUrl(ventureId))
    await expect(page.locator('[data-anchor="hero"] h1')).toHaveText('Đã nhận hồ sơ của bạn')
    const [done, ...more] = await rows([ventureId])
    expect(more).toEqual([])
    expect(done).toMatchObject({ status: 'SUBMITTED' })
    expect(await audits(done!.id)).toEqual(['APPLICATION_DRAFT_CREATED', 'APPLICATION_SUBMITTED'])

    // SUBMITTED is final: every entry opens SUB3; every write is refused.
    for (const url of [applyUrl(), formUrl(ventureId), reviewUrl(ventureId)]) {
      await page.goto(url, { waitUntil: 'networkidle' })
      await expect(page, url).toHaveURL(submittedUrl(ventureId))
    }
    expect(
      await errorCode(
        await page.request.patch(`${APPS}/${done!.id}`, { data: { answers: answers('x', 'y') } }),
      ),
    ).toBe('409 APPLICATION_SUBMITTED')
    expect(await errorCode(await page.request.post(`${APPS}/${done!.id}/submit`))).toBe(
      '409 APPLICATION_SUBMITTED',
    )
    await page.locator('a[href="#ho-so-da-nop"]').click()
    await expect(page.locator('#ho-so-da-nop [data-question="q-support"]')).toContainText(
      'Dữ liệu thử nghiệm và cố vấn vận hành.',
    )
    expect(await rows([ventureId])).toEqual([done])
  })
})

// ------------------------------------------------------------------ entry

test.describe('L5-E entry routing', () => {
  test('/programmes/:id/apply: none → SUB0; one → its form or SUB3; several → the choice; archived only → SUB0; guest, onboarding, closed or unknown programme', async ({
    page,
    browser,
    baseURL,
  }) => {
    // Guest → /auth; onboarding not done → its resolver step.
    await page.goto(applyUrl())
    await expect(page).toHaveURL('/auth')
    await signInFresh(page.request, 'l5-entry-new')
    await page.goto(applyUrl())
    await expect(page).toHaveURL(/\/onboarding(\/|$)/)

    // One eligible venture: straight to its form; once submitted, to SUB3.
    await page.context().clearCookies()
    await completedAccount(page.request, 'l5-entry-one', PERSONA)
    const one = await createVenture(page.request, { type: 'PROJECT', name: 'Một hồ sơ' })
    await page.goto(applyUrl(), { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(formUrl(one.id))
    await submit(page.request, await draft(page.request, one.id, ['Một', 'Hai']))
    await page.goto(applyUrl(), { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(submittedUrl(one.id))

    // Several: the choice, each with its state.
    const two = await createVenture(page.request, { type: 'STARTUP', name: 'Hai hồ sơ' })
    await page.goto(applyUrl(), { waitUntil: 'networkidle' })
    await expect(screen(page, 'L5-CHOOSE')).toBeVisible()
    await expect(page.locator('[data-venture]')).toHaveCount(2)
    await expect(page.locator(`[data-venture="${one.id}"] a`)).toHaveAttribute(
      'href',
      submittedUrl(one.id),
    )
    await expect(page.locator(`[data-venture="${two.id}"] a`)).toHaveAttribute(
      'href',
      formUrl(two.id),
    )
    await expect(page.locator(`[data-venture="${one.id}"]`)).toContainText('Đã nộp')

    // Archived only: nothing may apply, so SUB0.
    const alone = await browser.newContext({ baseURL })
    const other = await alone.newPage()
    await completedAccount(other.request, 'l5-entry-archived', PERSONA)
    const archived = await createVenture(other.request, { type: 'STARTUP', name: 'Lưu trữ' })
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [archived.id])
    await other.goto(applyUrl(), { waitUntil: 'networkidle' })
    await expect(screen(other, 'L5-SUB0')).toBeVisible()
    await alone.close()

    // HD-A11: one accepted type is derived, not asked; the venture takes it.
    await withApplicantTypes(['STARTUP'], async () => {
      await page.context().clearCookies()
      const me = await completedAccount(page.request, 'l5-entry-derived', PERSONA)
      await page.goto(applyUrl(), { waitUntil: 'networkidle' })
      await expect(screen(page, 'L5-SUB0')).toBeVisible()
      await expect(page.getByRole('radio')).toHaveCount(0)
      await page.locator('#quick-name').fill('Chỉ startup')
      await page.locator('[data-action="domain-picker"]').click()
      await page.getByRole('button', { name: 'Logistics', exact: true }).click()
      await page.locator('#quick-stage').selectOption(STAGE.idea)
      await page.locator('#quick-summary').fill('Một dòng')
      await page.locator('[data-action="quick-go"]').click()
      await expect(page).toHaveURL(/\/applications\//)
      const [venture] = await query<{ type: string }>(
        `SELECT p.type::text FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
          WHERE i.account_id = $1`,
        [me.accountId],
      )
      expect(venture!.type).toBe('STARTUP')
    })

    // A programme without a published form, an unknown or malformed id: 404.
    for (const id of [CHALLENGE, RANDOM, 'abc'])
      expect((await page.goto(applyUrl(id)))?.status(), id).toBe(404)
  })
})

// ------------------------------------------------------------------ security

test.describe('L5-S ownership', () => {
  test('owner only: a teammate, a stranger and a guest never read or write it; a foreign venture is never attached, a foreign application never submitted; old demo paths redirect', async ({
    page,
    browser,
    baseURL,
  }) => {
    const owner = await completedAccount(page.request, 'l5-sec-owner', PERSONA)
    const venture = await createVenture(page.request, { type: 'STARTUP', name: 'Của chủ' })
    const own = await draft(page.request, venture.id, ['Một', ''])

    const make = async (label: string) => {
      const context = await browser.newContext({ baseURL })
      const account = await completedAccount(context.request, label, PERSONA)
      return { context, account }
    }
    const teammate = await make('l5-sec-team')
    const [profile] = await query<{ id: string }>(
      'SELECT id::text FROM individual_profiles WHERE account_id = $1',
      [teammate.account.accountId],
    )
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
       VALUES ($1, $2, 'Founder', 'ACTIVE', now())`,
      [venture.id, profile!.id],
    )
    const stranger = await make('l5-sec-stranger')
    const theirs = await createVenture(stranger.context.request, {
      type: 'STARTUP',
      name: 'Của người khác',
    })
    const foreign = await draft(stranger.context.request, theirs.id, ['Khác', 'Khác'])
    const before = await rows([venture.id, theirs.id])

    // The teammate reads the venture (WF02), never its application.
    for (const [who, request, create] of [
      ['teammate', teammate.context.request, '403 SCOPE_FORBIDDEN'],
      ['stranger', stranger.context.request, '404 UNCONTRACTED_NOT_FOUND'],
    ] as const) {
      for (const url of [formUrl(venture.id), reviewUrl(venture.id), submittedUrl(venture.id)])
        expect((await request.get(url)).status(), `${who} ${url}`).toBe(404)
      expect(
        await errorCode(
          await request.post(APPS, { data: { venture_id: venture.id, programme_id: PROGRAMME } }),
        ),
        who,
      ).toBe(create)
      expect(await errorCode(await request.get(`${APPS}/${own}`)), who).toBe(
        '404 UNCONTRACTED_NOT_FOUND',
      )
      expect(
        await errorCode(
          await request.patch(`${APPS}/${own}`, {
            data: { answers: answers('Sửa', 'Sửa') },
            headers: { 'x-account-id': owner.accountId, 'x-role': 'PLATFORM_ADMIN' },
          }),
        ),
        who,
      ).toBe('404 UNCONTRACTED_NOT_FOUND')
      expect(await errorCode(await request.post(`${APPS}/${own}/submit`)), who).toBe(
        '404 UNCONTRACTED_NOT_FOUND',
      )
      expect(await (await request.get('/api/v1/me/applications')).json(), who).toEqual(
        who === 'stranger' ? [expect.objectContaining({ id: foreign })] : [],
      )
    }
    await teammate.context.close()
    await stranger.context.close()

    // The owner cannot attach a foreign venture or touch a foreign application.
    expect(
      await errorCode(
        await page.request.post(APPS, { data: { venture_id: theirs.id, programme_id: PROGRAMME } }),
      ),
    ).toBe('404 UNCONTRACTED_NOT_FOUND')
    for (const call of [
      () => page.request.get(`${APPS}/${foreign}`),
      () => page.request.patch(`${APPS}/${foreign}`, { data: { answers: answers('x', 'y') } }),
      () => page.request.post(`${APPS}/${foreign}/submit`),
    ])
      expect(await errorCode(await call())).toBe('404 UNCONTRACTED_NOT_FOUND')
    expect((await page.goto(formUrl(theirs.id)))?.status()).toBe(404)
    expect(
      await errorCode(
        await page.request.patch(`${APPS}/${own}`, {
          data: { answers: answers('x', 'y'), venture_id: theirs.id },
        }),
      ),
    ).toBe('422 APPLICATION_VALIDATION_FAILED')

    // HD-A10: the old demo paths redirect to the member routes.
    for (const [from, to] of [
      [`/demo/projects/${venture.id}/applications/${PROGRAMME}`, formUrl(venture.id)],
      [`/demo/projects/${venture.id}/applications/${PROGRAMME}/review`, reviewUrl(venture.id)],
    ] as const) {
      const hop = await page.request.get(from, { maxRedirects: 0 })
      expect(hop.status(), from).toBe(307)
      expect(hop.headers().location, from).toBe(to)
    }

    // A guest: 401 on the API, /auth on the screens.
    await page.context().clearCookies()
    expect(await errorCode(await page.request.get(`${APPS}/${own}`))).toBe(
      '401 UNCONTRACTED_UNAUTHENTICATED',
    )
    await page.goto(formUrl(venture.id))
    await expect(page).toHaveURL('/auth')
    expect(await rows([venture.id, theirs.id])).toEqual(before)
  })
})

// ------------------------------------------------------------------ responsive

/** Interactive controls that leave the viewport's width, as "tag text [left, right]". */
async function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select',
    )) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.left < -0.5 || r.right > width + 0.5)
        out.push(
          `${el.tagName} ${(el.textContent ?? '').trim().slice(0, 30)} [${r.left}, ${r.right}]`,
        )
    }
    return out
  })
}

async function usable(page: Page, tag: string, actions: string[]) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `${tag} horizontal overflow`).toBeLessThanOrEqual(0)
  expect(await clipped(page), `${tag} controls outside the viewport`).toEqual([])
  const width = page.viewportSize()!.width
  for (const selector of actions) {
    const control = page.locator(selector).first()
    await control.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await expect(control, `${tag} ${selector}`).toBeVisible()
    const box = (await control.boundingBox())!
    expect(box.x + box.width, `${tag} ${selector}`).toBeLessThanOrEqual(width)
    const hit = await control.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return Boolean(at && (el === at || el.contains(at) || at.contains(el)))
    })
    expect(hit, `${tag} ${selector} is covered`).toBe(true)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: resolveOutputPath('actual', `L5.${tag}.png`), fullPage: true })
}

for (const width of [1440, 1024, 768, 390] as const) {
  test(`L5-R ${width}px: SUB0, SUB1 01 / 03 / 04, SUB2, SUB3 and the choice: no overflow, controls inside, actions reachable`, async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const fresh = await browser.newContext({ baseURL, viewport: { width, height: 900 } })
    const newcomer = await fresh.newPage()
    await completedAccount(newcomer.request, `l5-resp-new-${width}`, PERSONA)
    await newcomer.goto(applyUrl(), { waitUntil: 'networkidle' })
    await expect(screen(newcomer, 'L5-SUB0')).toBeVisible()
    await newcomer.locator('[data-action="domain-picker"]').click()
    await usable(newcomer, `SUB0-${width}`, ['#quick-name', '[data-action="quick-go"]'])
    await fresh.close()

    await completedAccount(page.request, `l5-resp-${width}`, PERSONA)
    const startup = await createVenture(page.request, {
      type: 'STARTUP',
      name: 'Tracely',
      owner_role_label: 'Trưởng đội',
    })
    const project = await createVenture(page.request, { type: 'PROJECT', name: 'Kho lạnh' })
    await draft(page.request, startup.id, ['Một câu trả lời dài '.repeat(20).trim(), ''])
    await submit(page.request, await draft(page.request, project.id, ['Một', 'Hai']))
    for (const [n, actions] of [
      ['1', ['[data-nav="application-back"]', '[data-action="next"]']],
      ['3', ['[data-action="prev"]', '[data-action="next"]']],
      ['4', ['[data-action="prev"]', '[data-action="to-review"]']],
    ] as const) {
      await page.goto(`${formUrl(startup.id)}?buoc=${n}`, { waitUntil: 'networkidle' })
      await expect(step(page)).toHaveAttribute('data-step', n)
      await usable(page, `SUB1-${n}-${width}`, [...actions])
    }
    await page.goto(reviewUrl(startup.id), { waitUntil: 'networkidle' })
    await usable(page, `SUB2-${width}`, ['[data-question] a', '[data-action="submit"]'])
    await page.goto(submittedUrl(project.id), { waitUntil: 'networkidle' })
    await usable(page, `SUB3-${width}`, ['a[href="#ho-so-da-nop"]', 'a[href="/projects"]'])
    await page.goto(applyUrl(), { waitUntil: 'networkidle' })
    await expect(screen(page, 'L5-CHOOSE')).toBeVisible()
    await usable(page, `CHOOSE-${width}`, ['[data-venture] a'])
  })
}

// ------------------------------------------------------------------ pixel

const intentional = (reason: string) => ({ class: 'INTENTIONAL-CONTENT', reason })

/** The SUB1 bar below its texts, and the readiness pill. */
const HEADER_SUB1 = [
  { name: 'header-rule', reference: { x: 0, y: 64, width: 1440, height: 20 }, dy: 0 },
  { name: 'pill', reference: { x: 1120, y: 14, width: 246, height: 52 }, dy: 0 },
]

/** SUB2: the bar title ("Soát lại trước khi nộp"), the rule and the pill. */
const HEADER_SUB2 = [
  { name: 'header-title', reference: { x: 70, y: 14, width: 300, height: 32 }, dy: 0 },
  { name: 'header-rule', reference: { x: 0, y: 64, width: 1440, height: 20 }, dy: 0 },
  { name: 'pill', reference: { x: 1220, y: 16, width: 146, height: 48 }, dy: 0 },
]

test.describe('L5 pixel QA', () => {
  test('L37 SUB0 1440: header, intro, name, domain and summary fields, note and action', async ({
    page,
  }) => {
    await completedAccount(page.request, 'l5-px-sub0', PERSONA)
    await page.goto(applyUrl(), { waitUntil: 'networkidle' })
    await page.locator('#quick-name').fill('Tracely')
    await page.locator('[data-action="domain-picker"]').click()
    await page.getByRole('button', { name: 'Logistics', exact: true }).click()
    await page.getByRole('button', { name: 'AI', exact: true }).click()
    await page.locator('[data-action="domain-picker"]').click()
    await page.locator('#quick-summary').fill('Truy vết chuỗi giao vận bằng dữ liệu sẵn có')
    await page.locator('#quick-summary').blur()
    // Anchors are page coordinates of the full capture.
    await page.evaluate(() => window.scrollTo(0, 0))
    const go = await topOf(page, '[data-action="quick-go"]')
    await auditRevision(page, {
      name: 'L5-SUB0.L37',
      reference: `${REF}/L37__sub0-quick-team__SOURCE.png`,
      full: true,
      segments: [
        { name: 'header', reference: { x: 0, y: 0, width: 1440, height: 65 }, dy: 0 },
        { name: 'intro', reference: { x: 370, y: 128, width: 700, height: 164 }, dy: 0 },
        {
          name: 'name',
          reference: { x: 370, y: 306, width: 700, height: 126 },
          dy: (await topOf(page, '#quick-name')) - 365,
        },
        {
          name: 'domain',
          reference: { x: 370, y: 445, width: 700, height: 126 },
          dy: (await topOf(page, '[data-action="domain-picker"]')) - 504,
        },
        {
          name: 'summary',
          reference: { x: 370, y: 583, width: 700, height: 126 },
          dy: (await topOf(page, '#quick-summary')) - 643,
        },
        {
          name: 'note-action',
          reference: { x: 370, y: 725, width: 700, height: 142 },
          dy: go - 810,
        },
      ],
      exclude: [
        // The member's name is the persona's; the board's is another.
        ...(await rectsOf(page, '[data-screen="L5-SUB0"] header > span:last-child')),
        // "Ba trường" → "Vài trường": the form asks more fields (DEC-L5-D5).
        ...(await rectsOf(page, 'h1 + p')),
        // Helps worded for this form (DEC-L5-D5), and the action's label (DEC-L5-D6).
        ...(await rectsOf(page, '#quick-domain-help')),
        ...(await rectsOf(page, 'label[for="quick-summary"] ~ p')),
        ...(await rectsOf(page, '[data-action="quick-go"]', -8)),
      ],
      intentional: [
        intentional(
          'HD-A11 / DEC-L5-D5: "Loại hồ sơ" is asked when the programme accepts both types, "Giai đoạn" because the canonical venture requires it; both sit between the drawn fields, which are compared at their own anchors.',
        ),
        intentional(
          'DEC-L5-D6: "Vào phiếu đăng ký" (a programme application), not "Vào phiếu giải pháp".',
        ),
      ],
    })
  })

  async function formPersona(page: Page, label: string) {
    await completedAccount(page.request, label, PERSONA)
    return createVenture(page.request, {
      type: 'STARTUP',
      name: 'Tracely',
      stage_id: STAGE.pilot,
      owner_role_label: 'Trưởng đội',
    })
  }

  /** The texts that name the Problem in the frames and the programme here (DEC-L5-D6). */
  async function formTexts(page: Page) {
    return [
      ...(await rectsOf(page, '[data-screen="L5-SUB1"] header p')),
      ...(await rectsOf(page, '[data-anchor="remaining"]', -6)),
    ]
  }

  test('L38 SUB1 step 01 1440: header, stepper, answer box, progress and autosave cards, action', async ({
    page,
  }) => {
    const venture = await formPersona(page, 'l5-px-sub1')
    await page.goto(formUrl(venture.id), { waitUntil: 'networkidle' })
    await answer(page, 'q-problem').fill(L38_ANSWER)
    const next = await topOf(page, '[data-action="next"]')
    await auditRevision(page, {
      name: 'L5-SUB1.L38',
      reference: `${REF}/L38__sub1-understand__SOURCE.png`,
      segments: [
        // The title and save line name the Problem there, the programme here (DEC-L5-D6).
        ...HEADER_SUB1,
        { name: 'stepper-first', reference: { x: 70, y: 106, width: 140, height: 46 }, dy: 0 },
        {
          name: 'answer',
          reference: { x: 78, y: 328, width: 876, height: 204 },
          dy: (await topOf(page, '#q-q-problem')) - 330,
        },
        {
          name: 'progress-card',
          reference: { x: 998, y: 191, width: 364, height: 78 },
          dy: (await topOf(page, '[data-anchor="progress"]')) - 193,
        },
        {
          name: 'autosave-card',
          reference: { x: 998, y: 406, width: 364, height: 108 },
          dy: (await topOf(page, '[data-anchor="autosave"]')) - 408,
        },
        {
          name: 'action',
          reference: { x: 800, y: 785, width: 154, height: 50 },
          dy: next - 787,
        },
      ],
      exclude: [...(await formTexts(page)), ...(await rectsOf(page, '[data-action="next"]', -8))],
      intentional: [
        intentional(
          "DEC-L5-D6: the header names the programme and the save state, not the Problem and its deadline; the step titles are the programme's questions.",
        ),
        intentional(
          'HD-A8: steps without a configured question are skipped ("Cách giải"), so the stepper and the progress card list three steps; "Mở lại đề bài" and the "Trước khi viết" Problem card are not drawn.',
        ),
      ],
    })
  })

  test('L40 SUB1 step 03 1440: header, team card with its first member and invite action', async ({
    page,
  }) => {
    const venture = await formPersona(page, 'l5-px-sub1-team')
    await draft(page.request, venture.id, ['Một', ''])
    await page.goto(`${formUrl(venture.id)}?buoc=3`, { waitUntil: 'networkidle' })
    const card = await topOf(page, '[data-anchor="team"]')
    await auditRevision(page, {
      name: 'L5-SUB1.L40',
      reference: `${REF}/L40__sub1-team-plan__SOURCE.png`,
      segments: [
        // The title and save line name the Problem there, the programme here (DEC-L5-D6).
        ...HEADER_SUB1,
        {
          name: 'team-head',
          reference: { x: 998, y: 191, width: 364, height: 96 },
          dy: card - 193,
        },
        {
          name: 'invite',
          reference: { x: 1016, y: 398, width: 328, height: 52 },
          dy: (await topOf(page, '[data-anchor="team"] a')) - 403,
        },
      ],
      exclude: await formTexts(page),
      intentional: [
        intentional(
          'The team is the venture\'s own: one member here, three on the board; the milestone table and "Mốc là cam kết" are not drawn (HD-A8).',
        ),
      ],
    })
  })

  test('L41 SUB1 step 04 1440: header, stepper, back and review actions', async ({ page }) => {
    const venture = await formPersona(page, 'l5-px-sub1-support')
    await draft(page.request, venture.id, ['Một', ''])
    await page.goto(`${formUrl(venture.id)}?buoc=4`, { waitUntil: 'networkidle' })
    await auditRevision(page, {
      name: 'L5-SUB1.L41',
      reference: `${REF}/L41__sub1-support__SOURCE.png`,
      segments: [
        // The title and save line name the Problem there, the programme here (DEC-L5-D6).
        ...HEADER_SUB1,
        { name: 'stepper-first', reference: { x: 70, y: 106, width: 140, height: 46 }, dy: 0 },
        {
          name: 'actions',
          reference: { x: 78, y: 982, width: 876, height: 52 },
          dy: (await topOf(page, '[data-action="to-review"]')) - 984,
        },
      ],
      exclude: await formTexts(page),
      intentional: [
        intentional(
          "HD-A8: the support checklist and its side notes are not drawn; the step holds the programme's question.",
        ),
      ],
    })
  })

  test('L42 SUB2 1440: header, answer card, attached venture, submit', async ({ page }) => {
    const venture = await formPersona(page, 'l5-px-sub2')
    await draft(page.request, venture.id, [L38_ANSWER, 'Dữ liệu thử nghiệm.'])
    await page.goto(reviewUrl(venture.id), { waitUntil: 'networkidle' })
    const submit = await topOf(page, '[data-action="submit"]')
    await auditRevision(page, {
      name: 'L5-SUB2.L42',
      reference: `${REF}/L42__sub2-review__SOURCE.png`,
      segments: [
        ...HEADER_SUB2,
        { name: 'attached-heading', reference: { x: 915, y: 112, width: 450, height: 44 }, dy: 0 },
        {
          name: 'answer-card',
          reference: { x: 78, y: 168, width: 804, height: 89 },
          dy: (await topOf(page, '[data-question]')) - 170,
        },
        {
          name: 'venture',
          reference: { x: 918, y: 168, width: 444, height: 64 },
          dy: (await topOf(page, '[data-anchor="attached"]')) - 170,
        },
        // The button's ends: its label differs (DEC-L5-D6) and the board's "Góp ý" covers its right end.
        {
          name: 'submit-left',
          reference: { x: 918, y: 824, width: 100, height: 61 },
          dy: submit - 826,
        },
        {
          name: 'submit-right',
          reference: { x: 1262, y: 824, width: 40, height: 61 },
          dy: submit - 826,
        },
      ],
      exclude: [
        ...(await rectsOf(page, '[data-screen="L5-SUB2"] header p:last-child')),
        ...(await rectsOf(page, '[data-question] p')),
        ...(await rectsOf(page, '[data-anchor="attached"] p:not(:first-child)')),
        ...(await rectsOf(page, '[data-anchor="attached"] span[aria-hidden]', -6)),
      ],
      intentional: [
        intentional(
          'DEC-L5-D6: the answers are the programme\'s questions; profile completion, "Hồ sơ đang ở mức tối thiểu", the commitments and "sửa được cho tới hạn" are not drawn; "Nộp hồ sơ", not "Nộp giải pháp".',
        ),
      ],
    })
  })

  test('L43 SUB3 1440: hero, primary action, "Trong lúc chờ" card', async ({ page }) => {
    const venture = await formPersona(page, 'l5-px-sub3')
    await submit(page.request, await draft(page.request, venture.id, ['Một', 'Hai']))
    await page.goto(submittedUrl(venture.id), { waitUntil: 'networkidle' })
    const card = await topOf(page, '[data-anchor="waiting"] li')
    await auditRevision(page, {
      name: 'L5-SUB3.L43',
      reference: `${REF}/L43__sub3-submitted__SOURCE.png`,
      segments: [
        { name: 'hero-top', reference: { x: 0, y: 0, width: 1440, height: 140 }, dy: 0 },
        {
          name: 'primary',
          reference: { x: 546, y: 246, width: 182, height: 54 },
          dx: (await leftOf(page, 'a[href="#ho-so-da-nop"]')) - 551,
          dy: (await topOf(page, 'a[href="#ho-so-da-nop"]')) - 251,
        },
        { name: 'waiting', reference: { x: 78, y: 700, width: 416, height: 92 }, dy: card - 743 },
      ],
      exclude: [
        ...(await rectsOf(page, '[data-anchor="hero"] h1')),
        ...(await rectsOf(page, '[data-anchor="hero"] p')),
        ...(await rectsOf(page, '[data-anchor="waiting"] li p:not(:first-child)')),
      ],
      intentional: [
        intentional(
          'DEC-L5-D6: no application code, e-mail or timeline ("Tiếp theo là gì"); "Đã nhận hồ sơ", not "giải pháp"; "Về Dự án & startup của tôi" leads to /projects (no "Việc của tôi" route); the chapter-event and related-problem cards are Future. The submitted answers follow below the drawn frame.',
        ),
      ],
    })
  })
})
