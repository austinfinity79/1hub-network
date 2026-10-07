import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import { GUEST, startupAccess, type Viewer } from './access'
import { follow, followStatus, unfollow } from './follow'
import { currentQuarter, readMetrics, recordMetric, setMetricVisibility } from './metrics'
import { deleteUpdate, editUpdate, postUpdate, readUpdates } from './updates'

/**
 * THAO-06 — Startup Profile v2 against live PostgreSQL (migration 021,
 * DEC-THAO-SP D2–D4): catalogue, append-only quarters, visibility, write
 * permissions (owner / EDIT / VIEW / stranger / guest / inactive), venture
 * mismatch, soft delete, follow without count or list.
 */

afterAll(async () => {
  await closePool()
})

const RID = 'req-thao06-test'
const tag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

async function person(status: 'ACTIVE' | 'BLOCKED' = 'ACTIVE'): Promise<Viewer> {
  const email = `thao06-${tag()}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, $2::account_status) RETURNING id::text`,
    [email, status],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status) VALUES ($1, 'THAO06 Người', 'ACTIVE') RETURNING id::text`,
    [a!.id],
  )
  return { accountId: a!.id, profileId: p!.id, member: status === 'ACTIVE' }
}

async function startup(
  owner: Viewer,
  { status = 'ACTIVE', visibility = 'PUBLIC', type = 'STARTUP' } = {},
): Promise<{ id: string; slug: string }> {
  const slug = `thao06-${tag()}`
  const [row] = await query<{ id: string }>(
    `INSERT INTO projects (type, owner_profile_id, slug, name, summary, status, visibility)
     VALUES ($1::project_type, $2, $3, 'THAO06 Startup', 'Mô tả', $4::project_status, $5::visibility_level)
     RETURNING id::text`,
    [type, owner.profileId, slug, status, visibility],
  )
  return { id: row!.id, slug }
}

async function member(ventureId: string, who: Viewer, permission: 'EDIT' | 'VIEW') {
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, permission, state)
     VALUES ($1, $2, 'Thành viên', $3, 'ACTIVE')`,
    [ventureId, who.profileId, permission],
  )
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status, fields: error.fields }
    throw error
  }
  throw new Error('expected a refusal')
}

const now = currentQuarter()
const point = (value: number, q = now) => ({
  metric: 'customers',
  year: q.year,
  quarter: q.quarter,
  value,
})

describe('migration 021', () => {
  it('ships the governed VENTURE_METRIC catalogue and refuses UPDATE of a value row', async () => {
    const items = await query<{ slug: string }>(
      `SELECT slug FROM vocabulary_items WHERE type_code = 'VENTURE_METRIC' ORDER BY sort_order`,
    )
    expect(items.map((i) => i.slug)).toEqual([
      'customers',
      'active-users',
      'pilots',
      'team-size',
      'revenue',
    ])
    const owner = await person()
    const s = await startup(owner)
    await recordMetric(owner, s.slug, point(10), RID)
    await expect(
      query(`UPDATE venture_metric_values SET value = 1 WHERE venture_id = $1`, [s.id]),
    ).rejects.toThrow(/append-only/)
    await expect(
      query(`UPDATE venture_metrics SET visibility = 'GRANTED_ACCESS' WHERE venture_id = $1`, [
        s.id,
      ]),
    ).rejects.toThrow(/ck_venture_metrics_visibility/)
  })
})

describe('access', () => {
  it('an unlisted startup exists for its own team only; a PROJECT never', async () => {
    const owner = await person()
    const stranger = await person()
    const draft = await startup(owner, { status: 'DRAFT', visibility: 'PRIVATE' })
    expect(await startupAccess(draft.slug, GUEST)).toBeNull()
    expect(await startupAccess(draft.slug, stranger)).toBeNull()
    expect((await startupAccess(draft.slug, owner))?.role).toBe('OWNER')
    const project = await startup(owner, { type: 'PROJECT' })
    expect(await startupAccess(project.slug, owner)).toBeNull()
    expect(await startupAccess("x'; DROP TABLE projects; --", owner)).toBeNull()
  })
})

describe('metrics v1 (D2)', () => {
  it('owner and EDIT write; VIEW, stranger, guest and an archived venture are refused', async () => {
    const owner = await person()
    const editor = await person()
    const viewer = await person()
    const stranger = await person()
    const s = await startup(owner)
    await member(s.id, editor, 'EDIT')
    await member(s.id, viewer, 'VIEW')
    await recordMetric(owner, s.slug, point(5), RID)
    await recordMetric(editor, s.slug, { ...point(7), metric: 'pilots' }, RID)
    expect((await refusal(recordMetric(viewer, s.slug, point(1), RID))).status).toBe(403)
    expect((await refusal(recordMetric(stranger, s.slug, point(1), RID))).status).toBe(403)
    expect((await refusal(recordMetric(GUEST, s.slug, point(1), RID))).status).toBe(401)
    const archived = await startup(owner, { status: 'ARCHIVED' })
    expect((await refusal(recordMetric(owner, archived.slug, point(1), RID))).status).toBe(409)
  })

  it('validates: fixed catalogue, no future quarter, non-negative two-decimal values, no extra keys', async () => {
    const owner = await person()
    const s = await startup(owner)
    const bad = async (body: unknown) =>
      (await refusal(recordMetric(owner, s.slug, body, RID))).fields
    expect(await bad({ ...point(1), metric: 'my-own-metric' })).toEqual({ metric: 'unknown' })
    const next =
      now.quarter === 4 ? { year: now.year + 1, quarter: 1 } : { ...now, quarter: now.quarter + 1 }
    expect(await bad(point(1, next))).toEqual({ quarter: 'future' })
    expect(await bad(point(-1))).toEqual({ value: 'negative' })
    expect(await bad(point(1.234))).toEqual({ value: 'precision' })
    expect(await bad({ ...point(1), visibility: 'PUBLIC' })).toEqual({ visibility: 'not_accepted' })
  })

  it('PRIVATE by default and hidden from everyone but owner / EDIT; PUBLIC shown where the startup is', async () => {
    const owner = await person()
    const viewer = await person()
    const stranger = await person()
    const s = await startup(owner)
    await member(s.id, viewer, 'VIEW')
    await recordMetric(owner, s.slug, point(42), RID)
    for (const who of [GUEST, stranger, viewer]) {
      const seen = await readMetrics((await startupAccess(s.slug, who))!)
      expect(seen.metrics).toEqual([])
      expect(seen.catalogue).toBeUndefined()
      expect(seen.can_edit).toBe(false)
    }
    const own = await readMetrics((await startupAccess(s.slug, owner))!)
    expect(own.metrics[0]).toMatchObject({ slug: 'customers', visibility: 'PRIVATE' })
    await setMetricVisibility(owner, s.slug, 'customers', { visibility: 'PUBLIC' }, RID)
    const pub = await readMetrics((await startupAccess(s.slug, GUEST))!)
    expect(pub.metrics).toEqual([
      { slug: 'customers', label: 'Khách hàng', unit: 'count', history: [{ ...now, value: 42 }] },
    ])
    expect(
      (
        await refusal(
          setMetricVisibility(owner, s.slug, 'customers', { visibility: 'INVESTOR' }, RID),
        )
      ).fields,
    ).toEqual({ visibility: 'invalid' })
    expect(
      (
        await refusal(
          setMetricVisibility(viewer, s.slug, 'customers', { visibility: 'PRIVATE' }, RID),
        )
      ).status,
    ).toBe(403)
    // A private venture shows nothing to a guest, PUBLIC metrics included.
    await query(`UPDATE projects SET visibility = 'PRIVATE' WHERE id = $1`, [s.id])
    expect(await startupAccess(s.slug, GUEST)).toBeNull()
  })

  it('quarters are append-only: a correction is a new row and becomes current; history keeps one value per quarter', async () => {
    const owner = await person()
    const s = await startup(owner)
    const prev =
      now.quarter === 1 ? { year: now.year - 1, quarter: 4 } : { ...now, quarter: now.quarter - 1 }
    await recordMetric(owner, s.slug, point(10, prev), RID)
    await recordMetric(owner, s.slug, point(20), RID)
    const after = await recordMetric(owner, s.slug, point(25), RID)
    expect(after.metrics[0]!.history).toEqual([
      { ...now, value: 25 },
      { ...prev, value: 10 },
    ])
    const rows = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM venture_metric_values WHERE venture_id = $1`,
      [s.id],
    )
    expect(rows[0]!.n).toBe(3)
    const audit = await query<{ after_data: { correction: boolean; period: string } }>(
      `SELECT after_data FROM audit_events WHERE resource_id = $1 AND action = 'VENTURE_METRIC_RECORDED' ORDER BY created_at`,
      [s.id],
    )
    expect(audit.map((a) => a.after_data.correction)).toEqual([false, false, true])
    expect(JSON.stringify(audit)).not.toContain('25')
  })

  it('a metric of another venture cannot be reached through this slug', async () => {
    const a = await person()
    const b = await person()
    const sa = await startup(a)
    const sb = await startup(b)
    await recordMetric(b, sb.slug, point(9), RID)
    expect(
      (await refusal(setMetricVisibility(a, sa.slug, 'customers', { visibility: 'PUBLIC' }, RID)))
        .status,
    ).toBe(404)
    expect((await refusal(recordMetric(a, sb.slug, point(1), RID))).status).toBe(403)
  })
})

describe('updates v1 (D3)', () => {
  it('owner / EDIT post, edit and soft-delete; VIEW, stranger and guest cannot; plain text kept', async () => {
    const owner = await person()
    const editor = await person()
    const viewer = await person()
    const s = await startup(owner)
    await member(s.id, editor, 'EDIT')
    await member(s.id, viewer, 'VIEW')
    const posted = await postUpdate(owner, s.slug, { body: '  <b>Hello</b>\r\nLine two  ' }, RID)
    expect(posted.updates[0]!.body).toBe('<b>Hello</b>\nLine two')
    const id = posted.updates[0]!.id
    expect((await refusal(postUpdate(viewer, s.slug, { body: 'x' }, RID))).status).toBe(403)
    expect((await refusal(postUpdate(GUEST, s.slug, { body: 'x' }, RID))).status).toBe(401)
    expect((await refusal(postUpdate(owner, s.slug, { body: ' ' }, RID))).fields).toEqual({
      body: 'required',
    })
    expect(
      (await refusal(postUpdate(owner, s.slug, { body: 'x'.repeat(2001) }, RID))).fields,
    ).toEqual({ body: 'too_long' })
    const edited = await editUpdate(editor, s.slug, id, { body: 'Đã sửa' }, RID)
    expect(edited.updates[0]).toMatchObject({ body: 'Đã sửa', edited: true })
    expect((await refusal(editUpdate(viewer, s.slug, id, { body: 'x' }, RID))).status).toBe(403)
    await deleteUpdate(editor, s.slug, id, RID)
    expect((await readUpdates((await startupAccess(s.slug, GUEST))!)).updates).toEqual([])
    expect((await refusal(deleteUpdate(owner, s.slug, id, RID))).status).toBe(404)
    const [row] = await query<{ deleted: boolean }>(
      `SELECT deleted_at IS NOT NULL AS deleted FROM venture_updates WHERE id = $1`,
      [id],
    )
    expect(row!.deleted).toBe(true)
  })

  it('visibility follows the venture; an update id of another venture is 404', async () => {
    const a = await person()
    const b = await person()
    const sa = await startup(a)
    const sb = await startup(b, { status: 'DRAFT', visibility: 'PRIVATE' })
    const other = await postUpdate(b, sb.slug, { body: 'Riêng' }, RID)
    expect(await startupAccess(sb.slug, GUEST)).toBeNull()
    expect((await readUpdates((await startupAccess(sb.slug, b))!)).updates).toHaveLength(1)
    expect(
      (await refusal(editUpdate(a, sa.slug, other.updates[0]!.id, { body: 'x' }, RID))).status,
    ).toBe(404)
    expect((await refusal(deleteUpdate(a, sa.slug, 'not-a-uuid', RID))).status).toBe(404)
  })
})

describe('follow v1 (D4)', () => {
  it('signed-in ACTIVE only; idempotent; published startups only; no count or list anywhere', async () => {
    const owner = await person()
    const fan = await person()
    const blocked = await person('BLOCKED')
    const s = await startup(owner)
    expect((await refusal(follow(GUEST, s.slug))).status).toBe(401)
    expect((await refusal(follow(blocked, s.slug))).status).toBe(401)
    expect(await follow(fan, s.slug)).toEqual({ following: true })
    expect(await follow(fan, s.slug)).toEqual({ following: true })
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM venture_follows WHERE venture_id = $1`,
      [s.id],
    )
    expect(n!.n).toBe(1)
    expect(await followStatus(fan, s.slug)).toEqual({ following: true })
    expect(await followStatus(owner, s.slug)).toEqual({ following: false })
    expect(await unfollow(fan, s.slug)).toEqual({ following: false })
    expect(await unfollow(fan, s.slug)).toEqual({ following: false })
    const draft = await startup(owner, { status: 'DRAFT', visibility: 'PRIVATE' })
    expect((await refusal(follow(fan, draft.slug))).status).toBe(404)
    expect((await refusal(follow(owner, draft.slug))).status).toBe(404)
  })
})
