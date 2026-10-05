import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'
import { listPublicStartups } from '@/lib/library/canonical-source'
import { assertSelectable } from '@/lib/vocabulary/vocabulary'

import { listCategories, reorderCategories, updateCategory } from './category-ops'
import { ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from './testing'

/**
 * ADMIN-PROD-05 — lightweight categories on live PostgreSQL: scope, label /
 * order / status, the VENTURE_STAGE limits, referential safety of archiving,
 * whole-type reorder and its races. Seeded items touched here are restored.
 */

const P = ADM_PEOPLE
const ITEM = (n: number) => `ad050000-0000-4000-8000-00000000000${n}`
const VENTURE = 'ad050000-0000-4000-8000-0000000000f1'
let seededOrder: { id: string; sort_order: number; label: string; status: string }[] = []

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code, fields: error.fields }
    throw error
  }
  throw new Error('accepted')
}

const patch = (type: string, id: string, body: unknown) =>
  updateCategory(P.admin.account, type, id, body, 'adm05')

beforeAll(async () => {
  await seedAdminFixture()
  seededOrder = await query(
    `SELECT id::text, sort_order, label, status::text AS status FROM vocabulary_items WHERE type_code IN ('DOMAIN', 'VENTURE_STAGE')`,
  )
}, 60_000)

beforeEach(async () => {
  await query(`DELETE FROM project_domains WHERE project_id = $1`, [VENTURE])
  await query(`DELETE FROM projects WHERE id = $1`, [VENTURE])
  await query(`DELETE FROM vocabulary_items WHERE id::text LIKE 'ad050000-%'`)
  for (const n of [1, 2]) {
    await query(
      `INSERT INTO vocabulary_items (id, type_code, slug, label, sort_order) VALUES ($1, 'DOMAIN', $2, $3, 9000)`,
      [ITEM(n), `adm05-fx-${n}`, `ADM05 Domain ${n}`],
    )
  }
})

afterAll(async () => {
  for (const row of seededOrder) {
    await query(
      `UPDATE vocabulary_items SET sort_order = $2, label = $3, status = $4::vocab_status WHERE id = $1`,
      [row.id, row.sort_order, row.label, row.status],
    )
  }
  await query(`DELETE FROM project_domains WHERE project_id = $1`, [VENTURE])
  await query(`DELETE FROM projects WHERE id = $1`, [VENTURE])
  await query(`DELETE FROM vocabulary_items WHERE id::text LIKE 'ad050000-%'`)
  await clearAdminFixture()
  await closePool()
})

describe('scope and shape', () => {
  it('is PLATFORM_ADMIN only; unknown types are 404; no create or delete exists', async () => {
    for (const who of ['hubLeader', 'chALeader', 'memberA'] as const) {
      expect(await failure(listCategories(P[who].account, 'DOMAIN')), who).toMatchObject({
        status: 403,
      })
      expect(
        await failure(updateCategory(P[who].account, 'DOMAIN', ITEM(1), { label: 'x' }, 'adm05')),
        who,
      ).toMatchObject({
        status: 403,
      })
    }
    expect(await failure(listCategories(P.admin.account, 'INDUSTRY'))).toMatchObject({
      status: 404,
    })
    const domains = await listCategories(P.admin.account, 'DOMAIN')
    expect(domains.items.find((i) => i.id === ITEM(1))).toMatchObject({
      code: 'adm05-fx-1',
      label: 'ADM05 Domain 1',
      status: 'ACTIVE',
      in_use: 0,
    })
    for (const type of ['COUNTRY', 'REGION', 'SKILL', 'SPECIALIZATION', 'VENTURE_STAGE'])
      expect((await listCategories(P.admin.account, type)).type).toBe(type)
  })

  it('updates label, order and status; VENTURE_STAGE keeps its status', async () => {
    const updated = await patch('DOMAIN', ITEM(1), { label: '  ADM05 Renamed  ', sort_order: 5 })
    expect(updated).toMatchObject({ label: 'ADM05 Renamed', sort_order: 5 })
    expect((await patch('DOMAIN', ITEM(1), { status: 'ARCHIVED' })).status).toBe('ARCHIVED')
    expect((await patch('DOMAIN', ITEM(1), { status: 'ACTIVE' })).status).toBe('ACTIVE')
    const audits = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE resource_id = $1 ORDER BY created_at`,
      [ITEM(1)],
    )
    expect(audits.map((a) => a.action)).toEqual([
      'VOCABULARY_ITEM_UPDATED',
      'VOCABULARY_ITEM_ARCHIVED',
      'VOCABULARY_ITEM_ACTIVATED',
    ])
    const [stage] = await query<{ id: string }>(
      `SELECT id::text FROM vocabulary_items WHERE type_code = 'VENTURE_STAGE' LIMIT 1`,
    )
    expect(await failure(patch('VENTURE_STAGE', stage!.id, { status: 'ARCHIVED' }))).toMatchObject({
      status: 422,
      fields: { status: 'not_allowed' },
    })
    for (const body of [
      {},
      { label: '' },
      { label: 'x'.repeat(201) },
      { sort_order: -1 },
      { sort_order: 1.5 },
      { status: 'DELETED' },
      { slug: 'x' },
      { type_code: 'SKILL' },
    ]) {
      expect(await failure(patch('DOMAIN', ITEM(1), body)), JSON.stringify(body)).toMatchObject({
        status: 422,
      })
    }
    expect(await failure(patch('SKILL', ITEM(1), { label: 'x' }))).toMatchObject({ status: 404 })
  })
})

describe('referential safety', () => {
  it('archiving keeps every existing reference and label; only new selections are refused', async () => {
    await query(
      `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, status, visibility, owner_role_label)
       VALUES ($1, 'STARTUP', $2, 'adm05-fx-venture', 'ADM05 Venture', 'Mô tả', 'ACTIVE', 'PUBLIC', 'Founder')`,
      [VENTURE, P.memberA.profile],
    )
    await query(`INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`, [
      VENTURE,
      ITEM(2),
    ])
    expect(
      (await listCategories(P.admin.account, 'DOMAIN')).items.find((i) => i.id === ITEM(2))!.in_use,
    ).toBe(1)
    await patch('DOMAIN', ITEM(2), { status: 'ARCHIVED' })
    const [kept] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM project_domains WHERE project_id = $1 AND vocabulary_item_id = $2`,
      [VENTURE, ITEM(2)],
    )
    expect(kept!.n).toBe(1)
    const listed = (await listPublicStartups()).find((s) => s.ventureId === VENTURE)!
    expect(listed.domains.map((d) => d.label)).toEqual(['ADM05 Domain 2'])
    await expect(assertSelectable(query, 'domain_ids', 'DOMAIN', [ITEM(2)])).rejects.toMatchObject({
      status: 422,
    })
    await expect(
      assertSelectable(query, 'domain_ids', 'DOMAIN', [ITEM(2)], new Set([ITEM(2)])),
    ).resolves.toBeUndefined()
    const [item] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM vocabulary_items WHERE id = $1`,
      [ITEM(2)],
    )
    expect(item!.n).toBe(1)
  })
})

describe('ordering', () => {
  it("S1-UAT-05: members' unnormalised tags are not categories: not listed, not ordered, not edited", async () => {
    const free = 'ad050000-0000-4000-8000-000000000009'
    await query(
      `INSERT INTO vocabulary_items (id, type_code, slug, label, sort_order, status)
       VALUES ($1, 'DOMAIN', 'adm05-free', 'ADM05 free text', 0, 'UNNORMALIZED')`,
      [free],
    )
    const listed = (await listCategories(P.admin.account, 'DOMAIN')).items.map((i) => i.id)
    expect(listed).not.toContain(free)
    // The listed ids are the whole type for ordering: the free tag is not required.
    const result = await reorderCategories(P.admin.account, 'DOMAIN', { ids: listed }, 'adm05')
    expect(result.items.map((i) => i.id)).toEqual(listed)
    expect(await failure(patch('DOMAIN', free, { label: 'x' }))).toMatchObject({ status: 404 })
  })

  it('reorders a whole type atomically and refuses an incomplete list', async () => {
    const all = (await listCategories(P.admin.account, 'DOMAIN')).items.map((i) => i.id)
    const reversed = [...all].reverse()
    const result = await reorderCategories(P.admin.account, 'DOMAIN', { ids: reversed }, 'adm05')
    expect(result.items.map((i) => i.id)).toEqual(reversed)
    expect(result.items.map((i) => i.sort_order)).toEqual(reversed.map((_, i) => (i + 1) * 10))
    for (const body of [
      { ids: reversed.slice(1) },
      { ids: [...reversed, reversed[0]] },
      { ids: ['x'] },
      { order: reversed },
    ]) {
      expect(
        await failure(reorderCategories(P.admin.account, 'DOMAIN', body, 'adm05')),
      ).toMatchObject({ status: 422 })
    }
    const stages = (await listCategories(P.admin.account, 'VENTURE_STAGE')).items.map((i) => i.id)
    expect(
      (
        await reorderCategories(P.admin.account, 'VENTURE_STAGE', { ids: stages }, 'adm05')
      ).items.map((i) => i.id),
    ).toEqual(stages)
  })

  it('serializes concurrent reorders: the result is exactly one of them', async () => {
    const all = (await listCategories(P.admin.account, 'DOMAIN')).items.map((i) => i.id)
    const a = [...all]
    const b = [...all].reverse()
    await Promise.all([
      reorderCategories(P.admin.account, 'DOMAIN', { ids: a }, 'adm05'),
      reorderCategories(P.admin.account, 'DOMAIN', { ids: b }, 'adm05'),
    ])
    const final = (await listCategories(P.admin.account, 'DOMAIN')).items.map((i) => i.id)
    expect([JSON.stringify(a), JSON.stringify(b)]).toContain(JSON.stringify(final))
  })

  it('collisions on a single sort_order stay deterministic (order, label, id)', async () => {
    await Promise.all([
      patch('DOMAIN', ITEM(1), { sort_order: 1 }),
      patch('DOMAIN', ITEM(2), { sort_order: 1 }),
    ])
    const items = (await listCategories(P.admin.account, 'DOMAIN')).items.filter(
      (i) => i.sort_order === 1,
    )
    expect(items.map((i) => i.label)).toEqual(['ADM05 Domain 1', 'ADM05 Domain 2'])
  })
})
