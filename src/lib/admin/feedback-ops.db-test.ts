import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'
import { saveAvatarAsset, storageDir } from '@/lib/media/avatar-storage'

import {
  runRetention,
  SQL as SCRIPT_RETENTION_SQL,
} from '../../../scripts/admin/feedback-retention.mjs'

import {
  feedbackWeeklySummary,
  getFeedback,
  listFeedback,
  managerMayFetchScreenshot,
  runFeedbackScreenshotRetention,
  SCREENSHOT_RETENTION_SQL,
  updateFeedback,
} from './feedback-ops'
import { ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from './testing'

/**
 * ADMIN-PROD-05 — feedback operations on live PostgreSQL: queue and detail
 * scope, triage (owner, priority, status, note), lifecycle, audit, the 90-day
 * screenshot retention and the weekly summary.
 */

const P = ADM_PEOPLE
type Person = keyof typeof P
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7])

async function feedback(input: {
  member?: Person
  guestEmail?: string
  type?: string
  status?: string
  priority?: string | null
  createdAt?: string
  screenshot?: string | null
  body?: string
  context?: Record<string, string>
}): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO feedback_submissions (account_id, profile_id, body, type, status, priority, guest_email,
                                       screenshot_asset_id, context, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()))
     RETURNING id::text`,
    [
      input.member ? P[input.member].account : null,
      input.member ? P[input.member].profile : null,
      input.body ?? 'ADM05 Nút Lưu không phản hồi',
      input.type ?? 'BUG',
      input.status ?? 'NEW',
      input.priority ?? null,
      input.guestEmail ?? null,
      input.screenshot ?? null,
      JSON.stringify(input.context ?? { route: '/me', screen: 'WF02-S01', browser: 'Safari 18' }),
      input.createdAt ?? null,
    ],
  )
  return row!.id
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

const patch = (who: Person, id: string, body: unknown) =>
  updateFeedback(P[who].account, id, body, 'adm05')
const list = (who: Person, params: Record<string, string> = {}) =>
  listFeedback(P[who].account, new URLSearchParams(params))

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

beforeEach(async () => {
  await query(`DELETE FROM audit_events WHERE resource_type = 'feedback_submission'`)
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'ADM05%'`)
})

afterAll(async () => {
  await query(`DELETE FROM feedback_submissions WHERE body LIKE 'ADM05%'`)
  await clearAdminFixture()
  await closePool()
})

describe('queue and detail (PLATFORM_ADMIN only)', () => {
  it('refuses non-managers: list 403, every id 404', async () => {
    const id = await feedback({ member: 'memberA' })
    for (const who of ['hubLeader', 'chALeader', 'memberA'] as const) {
      expect(await failure(list(who)), who).toMatchObject({ status: 403, code: 'SCOPE_FORBIDDEN' })
      expect(await failure(getFeedback(P[who].account, id)), who).toMatchObject({ status: 404 })
      expect(await failure(patch(who, id, { status: 'IN_REVIEW' })), who).toMatchObject({
        status: 404,
      })
    }
    for (const raw of ['00000000-0000-4000-8000-000000000000', 'nope']) {
      expect(await failure(getFeedback(P.admin.account, raw))).toMatchObject({ status: 404 })
    }
  })

  it('filters, pages newest first and counts the open ones', async () => {
    const old = await feedback({
      type: 'UX',
      createdAt: '2026-09-01T03:00:00Z',
      guestEmail: 'guest@example.test',
    })
    const mid = await feedback({
      member: 'memberB',
      type: 'BUG',
      priority: 'HIGH',
      createdAt: '2026-09-15T03:00:00Z',
    })
    const newest = await feedback({
      member: 'memberA',
      type: 'FEATURE',
      status: 'DONE',
      createdAt: '2026-10-01T03:00:00Z',
    })
    const ids = (r: { items: { id: string }[] }) =>
      r.items.map((i) => i.id).filter((id) => [old, mid, newest].includes(id))
    expect(ids(await list('admin', { limit: '50' }))).toEqual([newest, mid, old])
    expect(ids(await list('admin', { type: 'BUG' }))).toEqual([mid])
    expect(ids(await list('admin', { priority: 'NONE' }))).toEqual([newest, old])
    expect(ids(await list('admin', { status: 'DONE' }))).toEqual([newest])
    expect(
      ids(await list('admin', { created_from: '2026-09-10', created_to: '2026-09-30' })),
    ).toEqual([mid])
    const page1 = await list('admin', { limit: '1', created_to: '2026-10-02' })
    const page2 = await list('admin', {
      limit: '1',
      created_to: '2026-10-02',
      cursor: page1.nextCursor!,
    })
    expect([page1.items[0]!.id, page2.items[0]!.id]).toEqual([newest, mid])
    expect((await list('admin')).counts.open).toBeGreaterThanOrEqual(2)
    for (const [params, field] of [
      [{ status: 'CLOSED' }, 'status'],
      [{ priority: 'URGENT' }, 'priority'],
      [{ owner: 'x' }, 'owner'],
      [{ created_from: '2026-02-30' }, 'created_from'],
      [{ limit: '0' }, 'limit'],
      [{ email: 'x' }, 'email'],
    ] as const) {
      expect(await failure(list('admin', params)), JSON.stringify(params)).toMatchObject({
        status: 422,
        fields: { [field]: expect.any(String) },
      })
    }
    const summary = (await list('admin', { limit: '50' })).items.find((i) => i.id === old)!
    expect(JSON.stringify(summary)).not.toContain('guest@example.test')
  })

  it('details a guest and a member submission without extra metadata', async () => {
    const guest = await feedback({
      guestEmail: 'reply@example.test',
      context: {
        route: '/library',
        screen: 'WF06',
        user_agent: 'UA',
        secret_token: 'x',
        ip: '1.2.3.4',
      },
    })
    const detail = await getFeedback(P.admin.account, guest)
    expect(detail).toMatchObject({
      content: 'ADM05 Nút Lưu không phản hồi',
      sender: { kind: 'GUEST', guest_email: 'reply@example.test', profile_id: null },
      context: { route: '/library', screen: 'WF06', user_agent: 'UA' },
      status: 'NEW',
      priority: null,
      owner: null,
      screenshot: null,
    })
    expect(JSON.stringify(detail.context)).not.toMatch(/secret|1\.2\.3\.4/)
    const member = await getFeedback(P.admin.account, await feedback({ member: 'memberA' }))
    expect(member.sender).toEqual({
      kind: 'MEMBER',
      profile_id: P.memberA.profile,
      display_name: 'ADM02 memberA',
      guest_email: null,
    })
    expect(JSON.stringify(member)).not.toMatch(/@example\.test|account_id/)
  })
})

describe('triage: owner, priority, status, note', () => {
  it('assigns, prioritises and moves NEW → IN_REVIEW → DONE, each audited without text', async () => {
    const id = await feedback({ member: 'memberA' })
    await patch('admin', id, { owner_profile_id: P.admin.profile, priority: 'HIGH' })
    await patch('admin', id, { status: 'IN_REVIEW' })
    const done = await patch('admin', id, {
      status: 'DONE',
      resolution_note: 'Đã sửa ở bản 1.2',
      type: 'UX',
    })
    expect(done).toMatchObject({
      status: 'DONE',
      priority: 'HIGH',
      type: 'UX',
      owner: { profile_id: P.admin.profile },
      resolution_note: 'Đã sửa ở bản 1.2',
    })
    const audits = await query<{ action: string; data: string }>(
      `SELECT action, coalesce(before_data::text, '') || after_data::text AS data FROM audit_events
        WHERE resource_id = $1 ORDER BY created_at, action`,
      [id],
    )
    expect(audits.map((a) => a.action).sort()).toEqual(
      [
        'FEEDBACK_ASSIGNED',
        'FEEDBACK_PRIORITY_CHANGED',
        'FEEDBACK_STATUS_CHANGED',
        'FEEDBACK_STATUS_CHANGED',
        'FEEDBACK_UPDATED',
      ].sort(),
    )
    expect(audits.map((a) => a.data).join('|')).not.toContain('Đã sửa')
    expect(done.history.map((h) => h.event)).toEqual(
      expect.arrayContaining(['ASSIGNED', 'PRIORITY_CHANGED', 'STATUS_CHANGED']),
    )
  })

  it('enforces the lifecycle: no reopen, NEW → DONE only with a note, same status is no change', async () => {
    const id = await feedback({ member: 'memberB' })
    expect(await failure(patch('admin', id, { status: 'DONE' }))).toMatchObject({
      status: 422,
      fields: { resolution_note: 'required' },
    })
    await patch('admin', id, { status: 'DONE', resolution_note: 'Trùng #12' })
    expect(await failure(patch('admin', id, { status: 'IN_REVIEW' }))).toMatchObject({
      status: 409,
    })
    expect(await failure(patch('admin', id, { status: 'NEW' }))).toMatchObject({ status: 409 })
    const before = (
      await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1`,
        [id],
      )
    )[0]!.n
    await patch('admin', id, { status: 'DONE' })
    const after = (
      await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1`,
        [id],
      )
    )[0]!.n
    expect(after).toBe(before)
  })

  it('assigns only a feedback manager and validates every field', async () => {
    const id = await feedback({ member: 'memberC' })
    expect(
      await failure(patch('admin', id, { owner_profile_id: P.chALeader.profile })),
    ).toMatchObject({
      status: 422,
      fields: { owner_profile_id: 'not_eligible' },
    })
    for (const body of [
      {},
      { status: 'CLOSED' },
      { priority: 'URGENT' },
      { type: 'SPAM' },
      { resolution_note: 'x'.repeat(2001) },
      { body: 'x' },
      { guest_email: 'x@y.z' },
      null,
    ]) {
      expect(await failure(patch('admin', id, body)), JSON.stringify(body)).toMatchObject({
        status: 422,
      })
    }
    expect((await patch('admin', id, { owner_profile_id: P.admin.profile })).owner).toMatchObject({
      profile_id: P.admin.profile,
    })
    expect((await patch('admin', id, { owner_profile_id: null })).owner).toBeNull()
  })

  it('two concurrent status updates resolve deterministically', async () => {
    const id = await feedback({ member: 'memberA' })
    const race = await Promise.allSettled([
      patch('admin', id, { status: 'IN_REVIEW' }),
      patch('admin', id, { status: 'DONE', resolution_note: 'Đã xử lý' }),
    ])
    for (const r of race)
      if (r.status === 'rejected') expect(r.reason).toMatchObject({ status: 409 })
    expect((await getFeedback(P.admin.account, id)).status).toBe('DONE')
    const same = await feedback({ member: 'memberB' })
    await Promise.all([
      patch('admin', same, { status: 'IN_REVIEW' }),
      patch('admin', same, { status: 'IN_REVIEW' }),
    ])
    const changes = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1 AND action = 'FEEDBACK_STATUS_CHANGED'`,
      [same],
    )
    expect(changes[0]!.n).toBe(1)
  })
})

describe('screenshot retention (90 days)', () => {
  it('represents the expiry, stops serving at 90 days and removes the file', async () => {
    const now = new Date()
    const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
    const fresh = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
    const stale = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
    const keep = await feedback({ member: 'memberA', screenshot: fresh, createdAt: days(89) })
    const drop = await feedback({ member: 'memberA', screenshot: stale, createdAt: days(91) })
    const detail = await getFeedback(P.admin.account, keep)
    expect(detail.screenshot).toMatchObject({
      asset_id: fresh,
      url: `/media/assets/${fresh}`,
      expired: false,
      deleted_at: null,
    })
    expect(new Date(detail.screenshot!.expires_at!).getTime()).toBeCloseTo(
      new Date(days(89)).getTime() + 90 * 86_400_000,
      -3,
    )
    expect(await managerMayFetchScreenshot(P.admin.account, fresh)).toBe(true)
    expect(await managerMayFetchScreenshot(P.chALeader.account, fresh)).toBe(false)
    expect(await managerMayFetchScreenshot(P.admin.account, stale)).toBe(false)
    expect((await getFeedback(P.admin.account, drop)).screenshot).toMatchObject({
      asset_id: null,
      url: null,
      expired: true,
    })

    expect(await runFeedbackScreenshotRetention(100)).toBeGreaterThanOrEqual(1)
    const [row] = await query<{ asset: string | null; deleted: Date | null }>(
      `SELECT screenshot_asset_id AS asset, screenshot_deleted_at AS deleted FROM feedback_submissions WHERE id = $1`,
      [drop],
    )
    expect(row!.asset).toBeNull()
    expect(row!.deleted).not.toBeNull()
    expect(existsSync(join(storageDir(), stale))).toBe(false)
    expect(existsSync(join(storageDir(), fresh))).toBe(true)
    expect(await runFeedbackScreenshotRetention(100)).toBe(0)
    // A queue read runs the same bounded retention.
    const later = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
    const due = await feedback({ member: 'memberB', screenshot: later, createdAt: days(120) })
    await list('admin')
    expect((await getFeedback(P.admin.account, due)).screenshot).toMatchObject({
      asset_id: null,
      expired: true,
    })
    expect(existsSync(join(storageDir(), later))).toBe(false)
    await query(`UPDATE feedback_submissions SET screenshot_asset_id = NULL WHERE id = $1`, [keep])
  })

  it('never removes a file another record still uses; the cron script runs the same statement', async () => {
    const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
    expect(SCRIPT_RETENTION_SQL).toBe(SCREENSHOT_RETENTION_SQL)
    const shared = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
    const [before] = await query<{ avatar: string | null }>(
      `SELECT avatar_asset_id AS avatar FROM individual_profiles WHERE id = $1`,
      [P.memberA.profile],
    )
    await query(`UPDATE individual_profiles SET avatar_asset_id = $2 WHERE id = $1`, [
      P.memberA.profile,
      shared,
    ])
    try {
      const old = await feedback({ member: 'memberA', screenshot: shared, createdAt: days(95) })
      expect(await runFeedbackScreenshotRetention(100)).toBeGreaterThanOrEqual(1)
      const [row] = await query<{ asset: string | null }>(
        `SELECT screenshot_asset_id AS asset FROM feedback_submissions WHERE id = $1`,
        [old],
      )
      expect(row!.asset).toBeNull()
      expect(existsSync(join(storageDir(), shared))).toBe(true)
    } finally {
      await query(`UPDATE individual_profiles SET avatar_asset_id = $2 WHERE id = $1`, [
        P.memberA.profile,
        before!.avatar,
      ])
    }

    const own = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
    const due = await feedback({ member: 'memberB', screenshot: own, createdAt: days(100) })
    const cleared = await runRetention({
      connectionString: process.env.DATABASE_URL!,
      storageDir: storageDir(),
    })
    expect(cleared).toBeGreaterThanOrEqual(1)
    expect((await getFeedback(P.admin.account, due)).screenshot).toMatchObject({ asset_id: null })
    expect(existsSync(join(storageDir(), own))).toBe(false)
  })
})

describe('weekly summary', () => {
  it('groups one ISO week by type × open / closed, priority and owner', async () => {
    const week = '2026-W38' // 14 – 20 Sep 2026, Vietnam time
    await feedback({
      type: 'BUG',
      status: 'NEW',
      priority: 'HIGH',
      createdAt: '2026-09-14T01:00:00+07:00',
    })
    await feedback({ type: 'BUG', status: 'DONE', createdAt: '2026-09-16T10:00:00+07:00' })
    await feedback({ type: 'UX', status: 'IN_REVIEW', createdAt: '2026-09-20T23:30:00+07:00' })
    const owned = await feedback({
      type: 'FEATURE',
      status: 'NEW',
      createdAt: '2026-09-18T09:00:00+07:00',
    })
    await patch('admin', owned, { owner_profile_id: P.admin.profile })
    await feedback({ type: 'OTHER', createdAt: '2026-09-21T00:30:00+07:00' }) // next week
    const s = await feedbackWeeklySummary(P.admin.account, new URLSearchParams({ week }))
    expect(s).toMatchObject({ week, from: '2026-09-14', to: '2026-09-20', total: 4 })
    expect(s.by_type).toEqual([
      { type: 'BUG', group: 'technical_bug', open: 1, closed: 1, total: 2 },
      { type: 'UX', group: 'ux', open: 1, closed: 0, total: 1 },
      { type: 'FEATURE', group: 'feature_request', open: 1, closed: 0, total: 1 },
      { type: 'OTHER', group: 'other', open: 0, closed: 0, total: 0 },
    ])
    expect(s.by_priority.find((p) => p.priority === 'HIGH')).toEqual({
      priority: 'HIGH',
      open: 1,
      closed: 0,
    })
    expect(s.by_owner.find((o) => o.owner_profile_id === P.admin.profile)).toMatchObject({
      open: 1,
      closed: 0,
    })
    for (const bad of ['2026-40', '2025-W53', '2026-W00', 'W40']) {
      expect(
        await failure(feedbackWeeklySummary(P.admin.account, new URLSearchParams({ week: bad }))),
        bad,
      ).toMatchObject({ status: 422 })
    }
    expect(
      await failure(feedbackWeeklySummary(P.chALeader.account, new URLSearchParams())),
    ).toMatchObject({ status: 403 })
    expect((await feedbackWeeklySummary(P.admin.account, new URLSearchParams())).week).toMatch(
      /^\d{4}-W\d{2}$/,
    )
  })
})
