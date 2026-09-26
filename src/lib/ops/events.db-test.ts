import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import {
  cancelEvent,
  createEvent,
  getManagedEvent,
  listOrganizationEvents,
  publishEvent,
  updateEvent,
} from './events'

/**
 * WF03-S07 — standalone Event lifecycle against live PostgreSQL
 * (API 05 §8.6, DEC-WF03-G10/G14, DEC-WF03-S07-EVENT-LIFECYCLE).
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const PROGRAMME_EVENT = 'b0000000-0000-0000-0000-000000000002' // DRAFT, linked to a programme
const MEMBER = '30000000-0000-0000-0000-000000000001'
const LEADER = '30000000-0000-0000-0000-000000000002'
const ADMIN = '30000000-0000-0000-0000-000000000003'

let ORG = ''
let ARCHIVED_ORG = ''
const created: string[] = []
let seq = 0
const rid = () => `s07-test-${Date.now()}-${seq++}`
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
const past = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

beforeAll(async () => {
  const make = async (status: string) =>
    (
      await query<{ id: string }>(
        `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S07 Club', $2::publication_status) RETURNING id::text`,
        [`s07-${Date.now()}-${seq++}`, status],
      )
    )[0]!.id
  ORG = await make('PUBLISHED')
  ARCHIVED_ORG = await make('ARCHIVED')
})

afterAll(async () => {
  const ids = [ORG, ARCHIVED_ORG]
  await query(
    `DELETE FROM audit_events WHERE resource_id IN (SELECT id FROM events WHERE organization_id = ANY($1::uuid[]))`,
    [ids],
  )
  await query(`DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])`, [created])
  await query(
    `DELETE FROM events WHERE organization_id = ANY($1::uuid[]) OR id = ANY($2::uuid[])`,
    [ids, created],
  )
  await query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [ids])
  await closePool()
})

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error))
      return { code: error.code, status: error.status, fields: error.fields ?? null }
    throw error
  }
  throw new Error('expected a refusal')
}

const row = async (id: string) =>
  (
    await query(
      `SELECT name, summary, starts_at, ends_at, location_text, status::text, programme_id, organization_id::text, slug, updated_at
         FROM events WHERE id = $1`,
      [id],
    )
  )[0]
const audits = (id: string) =>
  query<{ action: string; before: unknown; after: unknown }>(
    `SELECT action, before_data AS before, after_data AS after FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
    [id],
  )
const V = (field: string, reason: string) => ({
  code: 'PROFILE_VALIDATION_FAILED',
  status: 422,
  fields: { [field]: reason },
})
const CONFLICT = { code: 'MEMBERSHIP_INVALID_TRANSITION', status: 409, fields: null }
const NOT_FOUND = { status: 404 }

const draft = async (extra: Record<string, unknown> = {}) => {
  const e = await createEvent(
    ADMIN,
    ORG,
    { name: 'S07 Summit', starts_at: future(10), ends_at: future(11), ...extra },
    rid(),
  )
  return e
}

describe('WF03-S07 create (E4, G10)', () => {
  it('creates a DRAFT standalone event owned by the path organization; one EVENT_CREATED', async () => {
    const e = await createEvent(
      ADMIN,
      ORG,
      {
        name: '  Chapter Summit  ',
        summary: 'Gặp mặt',
        location_text: 'Cần Thơ',
        starts_at: '2030-10-01T02:00:00Z',
        ends_at: '2030-10-01T12:00:00+07:00',
        programme_id: null,
        timezone: 'Asia/Ho_Chi_Minh',
      },
      rid(),
    )
    expect(e).toMatchObject({
      organization_id: ORG,
      name: 'Chapter Summit',
      status: 'DRAFT',
      starts_at: '2030-10-01T02:00:00.000Z',
      ends_at: '2030-10-01T05:00:00.000Z', // +07:00 normalised to UTC
    })
    expect(e.slug).toMatch(/^chapter-summit-[0-9a-f]{8}$/)
    expect((await row(e.id))!.programme_id).toBeNull()
    expect(await audits(e.id)).toEqual([
      {
        action: 'EVENT_CREATED',
        before: null,
        after: { event_id: e.id, organization_id: ORG, status: 'DRAFT' },
      },
    ])
    expect(Object.keys(e).sort()).toEqual([
      'created_at',
      'ends_at',
      'id',
      'location_text',
      'name',
      'organization_id',
      'slug',
      'starts_at',
      'status',
      'summary',
      'updated_at',
    ])
  })

  it('refuses programme_id, registration, timezone, server-owned fields and bad input; nothing written', async () => {
    const before = await listOrganizationEvents(ADMIN, ORG)
    const base = { name: 'X' }
    for (const [body, field, reason] of [
      [
        { ...base, programme_id: 'c0000000-0000-0000-0000-000000000001' },
        'programme_id',
        'not_supported',
      ],
      [{ ...base, registration_enabled: true }, 'registration_enabled', 'not_accepted'],
      [{ ...base, timezone: 'UTC' }, 'timezone', 'not_supported'],
      [{ ...base, status: 'PUBLISHED' }, 'status', 'not_accepted'],
      [{ ...base, organization_id: CHAPTER_02 }, 'organization_id', 'not_accepted'],
      [{ ...base, slug: 'x' }, 'slug', 'not_accepted'],
      [{ ...base, metadata: {} }, 'metadata', 'not_accepted'],
      [{ ...base, id: ORG }, 'id', 'not_accepted'],
      [{ name: '   ' }, 'name', 'required'],
      [{ summary: 'no name' }, 'name', 'required'],
      [{ name: 'x'.repeat(201) }, 'name', 'too_long'],
      [{ ...base, starts_at: '01/10/2030' }, 'starts_at', 'invalid'],
      [{ ...base, starts_at: '2030-10-01T10:00' }, 'starts_at', 'invalid'],
      [{ ...base, starts_at: future(5), ends_at: future(4) }, 'ends_at', 'before_start'],
    ] as const) {
      expect(await refusal(createEvent(ADMIN, ORG, body, rid()))).toEqual(V(field, reason))
    }
    expect(await listOrganizationEvents(ADMIN, ORG)).toEqual(before)
    expect(await refusal(createEvent(ADMIN, ARCHIVED_ORG, base, rid()))).toEqual(CONFLICT)
  })
})

describe('WF03-S07 lifecycle (E1–E3)', () => {
  it('edit a DRAFT; publish needs name + dates, end ≥ start, start not past', async () => {
    const e = await createEvent(ADMIN, ORG, { name: 'S07 Draft' }, rid())
    expect(await refusal(publishEvent(ADMIN, e.id, undefined, rid()))).toEqual(
      V('starts_at', 'required'),
    )
    await updateEvent(ADMIN, e.id, { starts_at: past(2), ends_at: past(1) }, rid())
    expect(await refusal(publishEvent(ADMIN, e.id, undefined, rid()))).toEqual(
      V('starts_at', 'past'),
    )
    const edited = await updateEvent(
      ADMIN,
      e.id,
      { starts_at: future(3), ends_at: future(4), summary: 'Mô tả', location_text: 'Huế' },
      rid(),
    )
    expect(edited).toMatchObject({ summary: 'Mô tả', location_text: 'Huế', status: 'DRAFT' })
    const updates = (await audits(e.id)).filter((a) => a.action === 'EVENT_UPDATED')
    expect(updates.at(-1)!.after).toEqual({
      event_id: e.id,
      organization_id: ORG,
      status: 'DRAFT',
      changed_fields: ['summary', 'starts_at', 'ends_at', 'location_text'],
    })
    // A no-op PATCH writes nothing.
    const count = (await audits(e.id)).length
    const snapshot = await row(e.id)
    await updateEvent(ADMIN, e.id, { summary: 'Mô tả' }, rid())
    expect(await row(e.id)).toEqual(snapshot)
    expect(await audits(e.id)).toHaveLength(count)

    const published = await publishEvent(ADMIN, e.id, undefined, rid())
    expect(published.status).toBe('PUBLISHED')
    expect((await audits(e.id)).at(-1)).toEqual({
      action: 'EVENT_PUBLISHED',
      before: { event_id: e.id, organization_id: ORG, status: 'DRAFT' },
      after: { event_id: e.id, organization_id: ORG, status: 'PUBLISHED' },
    })
    // Re-publish is 409; PUBLISHED stays editable but keeps the publish requirements.
    expect(await refusal(publishEvent(ADMIN, e.id, undefined, rid()))).toEqual(CONFLICT)
    expect(await refusal(updateEvent(ADMIN, e.id, { starts_at: null }, rid()))).toEqual(
      V('starts_at', 'required'),
    )
    expect(await refusal(updateEvent(ADMIN, e.id, { starts_at: past(1) }, rid()))).toEqual(
      V('starts_at', 'past'),
    )
    expect((await updateEvent(ADMIN, e.id, { name: 'S07 Published' }, rid())).name).toBe(
      'S07 Published',
    )
  })

  it('cancel: DRAFT 409; PUBLISHED → CANCELLED; CANCELLED is terminal; LIVE cancellable', async () => {
    const d = await draft()
    expect(await refusal(cancelEvent(ADMIN, d.id, undefined, rid()))).toEqual(CONFLICT)
    await publishEvent(ADMIN, d.id, undefined, rid())
    const c = await cancelEvent(ADMIN, d.id, undefined, rid())
    expect(c.status).toBe('CANCELLED')
    expect((await audits(d.id)).at(-1)).toEqual({
      action: 'EVENT_CANCELLED',
      before: { event_id: d.id, organization_id: ORG, status: 'PUBLISHED' },
      after: { event_id: d.id, organization_id: ORG, status: 'CANCELLED' },
    })
    const count = (await audits(d.id)).length
    expect(await refusal(cancelEvent(ADMIN, d.id, undefined, rid()))).toEqual(CONFLICT)
    expect(await refusal(publishEvent(ADMIN, d.id, undefined, rid()))).toEqual(CONFLICT)
    expect(await refusal(updateEvent(ADMIN, d.id, { name: 'Back' }, rid()))).toEqual(CONFLICT)
    expect(await audits(d.id)).toHaveLength(count)
    expect(await row(d.id)).toBeTruthy() // kept, never deleted

    // LIVE / ENDED are never set by S07 (E5); a LIVE row (set directly) is cancellable, ENDED is not.
    const live = await draft()
    await query(`UPDATE events SET status = 'LIVE' WHERE id = $1`, [live.id])
    expect(await refusal(updateEvent(ADMIN, live.id, { name: 'x' }, rid()))).toEqual(CONFLICT)
    expect((await cancelEvent(ADMIN, live.id, undefined, rid())).status).toBe('CANCELLED')
    const ended = await draft()
    await query(`UPDATE events SET status = 'ENDED' WHERE id = $1`, [ended.id])
    expect(await refusal(cancelEvent(ADMIN, ended.id, undefined, rid()))).toEqual(CONFLICT)
    expect(await refusal(cancelEvent(ADMIN, ended.id, { reason: 'x' }, rid()))).toEqual(
      V('reason', 'not_accepted'),
    )
  })

  it('PATCH refuses programme / ownership / status fields', async () => {
    const d = await draft()
    for (const [body, field] of [
      [{ programme_id: null }, 'programme_id'],
      [{ status: 'PUBLISHED' }, 'status'],
      [{ organization_id: CHAPTER_02 }, 'organization_id'],
      [{ registration_enabled: false }, 'registration_enabled'],
    ] as const) {
      expect(await refusal(updateEvent(ADMIN, d.id, body, rid()))).toEqual(V(field, 'not_accepted'))
    }
    expect(await refusal(updateEvent(ADMIN, d.id, {}, rid()))).toEqual(V('body', 'empty'))
  })
})

describe('WF03-S07 concurrency', () => {
  it('duplicate publish: one wins; publish vs cancel on a DRAFT: publish wins, cancel 409', async () => {
    const a = await draft()
    const dup = await Promise.allSettled([
      publishEvent(ADMIN, a.id, undefined, rid()),
      publishEvent(ADMIN, a.id, undefined, rid()),
    ])
    expect(dup.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await audits(a.id)).filter((x) => x.action === 'EVENT_PUBLISHED')).toHaveLength(1)
    const dupCancel = await Promise.allSettled([
      cancelEvent(ADMIN, a.id, undefined, rid()),
      cancelEvent(ADMIN, a.id, undefined, rid()),
    ])
    expect(dupCancel.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await audits(a.id)).filter((x) => x.action === 'EVENT_CANCELLED')).toHaveLength(1)

    const b = await draft()
    const race = await Promise.allSettled([
      publishEvent(ADMIN, b.id, undefined, rid()),
      cancelEvent(ADMIN, b.id, undefined, rid()),
    ])
    // Serialized by the row lock: either publish then cancel (both succeed, a valid
    // sequence) or cancel first (409 on a DRAFT) then publish. Never an invalid state.
    const final = (await row(b.id))!.status
    expect(['PUBLISHED', 'CANCELLED']).toContain(final)
    const actions = (await audits(b.id)).map((x) => x.action)
    expect(actions.filter((x) => x === 'EVENT_PUBLISHED')).toHaveLength(1)
    expect(race.some((r) => r.status === 'fulfilled')).toBe(true)
  })
})

describe('WF03-S07 scope (exact organization, standalone only)', () => {
  it('leader: own Chapter only; foreign / child / sibling refused; programme-linked events invisible', async () => {
    const forbidden = { code: 'SCOPE_FORBIDDEN', status: 403, fields: null }
    const own = await listOrganizationEvents(LEADER, CHAPTER_01)
    expect(own.map((e) => e.id)).not.toContain(PROGRAMME_EVENT)
    expect(own.every((e) => e.organization_id === CHAPTER_01)).toBe(true)
    for (const org of [CLUB_01, CHAPTER_02, ORG, 'x']) {
      expect(await refusal(listOrganizationEvents(LEADER, org))).toEqual(forbidden)
      expect(await refusal(createEvent(LEADER, org, { name: 'Hijack' }, rid()))).toEqual(forbidden)
    }
    expect(await refusal(listOrganizationEvents(MEMBER, CHAPTER_01))).toEqual(forbidden)
    // An event of another organization: every event-id call is the same 404.
    const foreign = await draft()
    const before = await row(foreign.id)
    for (const call of [
      () => getManagedEvent(LEADER, foreign.id),
      () => updateEvent(LEADER, foreign.id, { name: 'Hijack' }, rid()),
      () => publishEvent(LEADER, foreign.id, undefined, rid()),
      () => cancelEvent(LEADER, foreign.id, undefined, rid()),
      () => getManagedEvent(MEMBER, foreign.id),
      // Programme-linked events are WF04: not reachable through S07, even for admin.
      () => getManagedEvent(ADMIN, PROGRAMME_EVENT),
      () => updateEvent(ADMIN, PROGRAMME_EVENT, { name: 'x' }, rid()),
      () => publishEvent(ADMIN, PROGRAMME_EVENT, undefined, rid()),
    ]) {
      expect(await refusal(call())).toMatchObject(NOT_FOUND)
    }
    expect(await row(foreign.id)).toEqual(before)
    expect((await audits(foreign.id)).map((a) => a.action)).toEqual(['EVENT_CREATED'])
  })
})
