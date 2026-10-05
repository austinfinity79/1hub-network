import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { getFeedback, isFeedbackScreenshot, listFeedback } from '@/lib/admin/feedback-ops'
import { ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from '@/lib/admin/testing'
import { isApiError } from '@/lib/api/errors'
import { closePool, query, withTransaction } from '@/lib/db/client'
import { readAssetMeta } from '@/lib/media/avatar-storage'

import {
  FEEDBACK_PER_HOUR,
  assertFeedbackRate,
  buildFeedbackContext,
  parseFeedbackForm,
  storeFeedback,
} from './submit'

/**
 * S1-UAT-02 — FB-01 submission against live PostgreSQL: validation, derived
 * context, guest vs member identity, screenshot in the existing media store,
 * the 10-per-hour limit, and the Admin queue reading the very same rows.
 */

const P = ADM_PEOPLE
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

function form(fields: Record<string, string | Blob>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code, fields: error.fields }
    throw error
  }
  throw new Error('accepted')
}

async function submit(accountId: string | null, fields: Record<string, string | Blob>, ua = UA) {
  const input = await parseFeedbackForm(form(fields), accountId !== null)
  const context = buildFeedbackContext(input, ua)
  return withTransaction((exec) => storeFeedback(exec, { accountId }, input, context))
}

const row = async (id: string) =>
  (
    await query<{
      account_id: string | null
      profile_id: string | null
      body: string
      type: string
      status: string
      guest_email: string | null
      screenshot_asset_id: string | null
      context: Record<string, string>
    }>(
      `SELECT account_id::text, profile_id::text, body, type::text, status::text, guest_email,
              screenshot_asset_id, context FROM feedback_submissions WHERE id = $1`,
      [id.replace(/^fb_/, '')],
    )
  )[0]!

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

beforeEach(async () => {
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'S1F%'`)
})

afterAll(async () => {
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'S1F%'`)
  await clearAdminFixture()
  await closePool()
})

describe('validation (US-X.01)', () => {
  it.each([
    [{ content: 'S1F x' }, { type: 'required' }],
    [{ type: 'OTHER', content: 'S1F x' }, { type: 'invalid' }],
    [{ type: 'BUG', content: '   ' }, { content: 'required' }],
    [{ type: 'BUG', content: 'S1F' + 'x'.repeat(2000) }, { content: 'too_long' }],
    [{ type: 'BUG', content: 'S1F x', email: 'not-an-email' }, { email: 'invalid' }],
  ])('%j → 422 %j', async (fields, expected) => {
    expect(await failure(parseFeedbackForm(form(fields), false))).toMatchObject({
      status: 422,
      code: 'FEEDBACK_VALIDATION_FAILED',
      fields: expected,
    })
  })

  it('a screenshot must be a real PNG / JPEG / WebP of at most 5 MB', async () => {
    const fake = new Blob([new TextEncoder().encode('<svg/>')], { type: 'image/png' })
    expect(
      await failure(
        parseFeedbackForm(form({ type: 'BUG', content: 'S1F', screenshot: fake }), false),
      ),
    ).toMatchObject({ fields: { screenshot: 'unsupported' } })
    const big = new Blob([PNG, new Uint8Array(5 * 1024 * 1024)])
    expect(
      await failure(
        parseFeedbackForm(form({ type: 'BUG', content: 'S1F', screenshot: big }), false),
      ),
    ).toMatchObject({ fields: { screenshot: 'too_large' } })
  })

  it('exactly 2000 characters are accepted', async () => {
    const input = await parseFeedbackForm(form({ type: 'UX', content: 'x'.repeat(2000) }), true)
    expect(input.content).toHaveLength(2000)
  })
})

describe('persistence and identity', () => {
  it('a member: account and profile from the session, NEW, no e-mail even if sent', async () => {
    const res = await submit(P.memberA.account, {
      type: 'FEATURE',
      content: 'S1F member',
      email: 'spoof@example.test',
      route: '/onboarding/purpose',
    })
    expect(res).toMatchObject({ id: expect.stringMatching(/^fb_/), status: 'RECEIVED' })
    expect(await row(res.id)).toMatchObject({
      account_id: P.memberA.account,
      profile_id: P.memberA.profile,
      type: 'FEATURE',
      status: 'NEW',
      guest_email: null,
      screenshot_asset_id: null,
    })
  })

  it('a guest: no account, the optional e-mail kept privately', async () => {
    const withMail = await submit(null, {
      type: 'BUG',
      content: 'S1F guest',
      email: ' g@example.test ',
    })
    expect(await row(withMail.id)).toMatchObject({
      account_id: null,
      guest_email: 'g@example.test',
    })
    const without = await submit(null, { type: 'UX', content: 'S1F guest 2' })
    expect(await row(without.id)).toMatchObject({ account_id: null, guest_email: null })
  })

  it('context: route path only, screen / workflow / step derived, UA from the request', async () => {
    const res = await submit(P.memberA.account, {
      type: 'BUG',
      content: 'S1F context',
      route: '/onboarding/purpose?token=secret&redirect=/x#token=abc',
      viewport: '390x844',
      locale: 'vi-VN',
      // Ignored: not a context field the server keeps.
      cookie: '1hub_session=leak',
      screen: 'FORGED',
      workflow: 'WF99',
    })
    const { context } = await row(res.id)
    expect(context).toEqual({
      route: '/onboarding/purpose',
      screen: 'WF01-S05',
      workflow: 'WF01',
      step: 'Bước 3/4',
      browser: 'Safari',
      os: 'iOS',
      device: 'mobile',
      user_agent: UA,
      viewport: '390x844',
      locale: 'vi-VN',
    })
    expect(JSON.stringify(context)).not.toMatch(/secret|token|leak|FORGED|WF99/)
  })

  it('a foreign or malformed route is not recorded', async () => {
    for (const route of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)']) {
      const res = await submit(null, { type: 'BUG', content: 'S1F route', route })
      expect((await row(res.id)).context.route, route).toBeUndefined()
    }
  })

  it('a screenshot lands in the existing media store and is a feedback screenshot', async () => {
    const res = await submit(null, {
      type: 'BUG',
      content: 'S1F shot',
      screenshot: new Blob([PNG], { type: 'image/png' }),
    })
    const { screenshot_asset_id } = await row(res.id)
    expect(screenshot_asset_id).toMatch(/^asset_[0-9a-f]{32}$/)
    expect(await readAssetMeta(screenshot_asset_id!)).toMatchObject({ content_type: 'image/png' })
    expect(await isFeedbackScreenshot(screenshot_asset_id!)).toBe(true)
  })
})

describe('limit (US-X.01 "Quá 10 góp ý/giờ")', () => {
  it('a member is refused the 11th in an hour', async () => {
    for (let i = 0; i < FEEDBACK_PER_HOUR; i++) {
      await assertFeedbackRate(P.memberB.account, null)
      await submit(P.memberB.account, { type: 'UX', content: `S1F rate ${i}` })
    }
    expect(await failure(assertFeedbackRate(P.memberB.account, null))).toMatchObject({
      status: 429,
      code: 'FEEDBACK_RATE_LIMITED',
    })
  })

  it('a guest is limited by address, for an hour', async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`
    const t0 = Date.now()
    for (let i = 0; i < FEEDBACK_PER_HOUR; i++) await assertFeedbackRate(null, ip, t0)
    expect(await failure(assertFeedbackRate(null, ip, t0))).toMatchObject({ status: 429 })
    await assertFeedbackRate(null, ip, t0 + 61 * 60 * 1000)
  })
})

describe('Admin compatibility (the same canonical store)', () => {
  it('a submission appears in the Admin queue and detail with its context and sender', async () => {
    const member = await submit(P.memberC.account, {
      type: 'BUG',
      content: 'S1F admin',
      route: '/projects/new',
    })
    const guest = await submit(null, {
      type: 'FEATURE',
      content: 'S1F admin guest',
      email: 'a@b.vn',
    })
    const queue = await listFeedback(P.admin.account, new URLSearchParams({ status: 'NEW' }))
    const ids = queue.items.map((i: { id: string }) => i.id)
    const raw = (id: string) => id.replace(/^fb_/, '')
    expect(ids).toEqual(expect.arrayContaining([raw(member.id), raw(guest.id)]))

    const detail = await getFeedback(P.admin.account, raw(member.id))
    expect(detail).toMatchObject({
      type: 'BUG',
      status: 'NEW',
      sender: { kind: 'MEMBER', profile_id: P.memberC.profile },
      context: { route: '/projects/new', screen: 'WF02-S05', workflow: 'WF02' },
    })
    const guestDetail = await getFeedback(P.admin.account, raw(guest.id))
    expect(guestDetail).toMatchObject({ sender: { kind: 'GUEST', guest_email: 'a@b.vn' } })
    // Still PLATFORM_ADMIN only: a member cannot read the queue.
    expect(await failure(listFeedback(P.memberA.account, new URLSearchParams()))).toMatchObject({
      status: 403,
    })
  })
})
