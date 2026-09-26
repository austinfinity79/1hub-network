import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import { parentsOf } from './hierarchy'
import {
  closeRelationship,
  createRelationship,
  getOrganizationRelationships,
} from './relationships'

/**
 * WF03-S08 — relationship contract against live PostgreSQL
 * (API 05 §8.7, DEC-WF03-S08-RELATIONSHIP-CONTRACT, migration 009).
 * Every mutation uses test-only organizations; the seeded tree is only read.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const MEMBER = '30000000-0000-0000-0000-000000000001'
const LEADER = '30000000-0000-0000-0000-000000000002'
const ADMIN = '30000000-0000-0000-0000-000000000003'

const O: Record<string, string> = {}
let seq = 0
const rid = () => `s08-test-${Date.now()}-${seq++}`

async function org(key: string, type: string, status = 'PUBLISHED') {
  const [o] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status, parent_id)
     VALUES ($1::org_type, $2, $3, $4::publication_status, NULL) RETURNING id::text`,
    [type, `s08-${key}-${Date.now()}-${seq++}`, `S08 ${key}`, status],
  )
  O[key] = o!.id
}

beforeAll(async () => {
  await org('hubA', 'HUB')
  await org('hubB', 'HUB')
  await org('chA', 'CHAPTER')
  await org('chB', 'CHAPTER')
  await org('chC', 'CHAPTER')
  await org('clbA', 'CLB')
  await org('clbB', 'CLB')
  await org('clbArchived', 'CLB', 'ARCHIVED')
  await org('company', 'COMPANY')
  for (const [k, t] of [
    ['chD', 'CHAPTER'],
    ['clbX', 'CLB'],
    ['hubC', 'HUB'],
    ['chE', 'CHAPTER'],
    ['clbY', 'CLB'],
  ] as const)
    await org(k, t)
})

afterAll(async () => {
  const ids = Object.values(O)
  await query(
    `DELETE FROM audit_events WHERE resource_id IN (
       SELECT id FROM organization_relationships WHERE source_org_id = ANY($1::uuid[]) OR target_org_id = ANY($1::uuid[]))`,
    [ids],
  )
  await query(
    `DELETE FROM organization_relationships WHERE source_org_id = ANY($1::uuid[]) OR target_org_id = ANY($1::uuid[])`,
    [ids],
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

const rows = (child: string) =>
  query<{ id: string; source: string; state: string; ended: boolean }>(
    `SELECT id::text, source_org_id::text AS source, state::text AS state, ended_at IS NOT NULL AS ended
       FROM organization_relationships WHERE target_org_id = $1 ORDER BY created_at, id`,
    [child],
  )
const audits = (id: string) =>
  query<{ action: string; before: unknown; after: unknown }>(
    `SELECT action, before_data AS before, after_data AS after FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
    [id],
  )
const relAuditCount = async () =>
  Number(
    (
      await query<{ n: string }>(
        `SELECT count(*) AS n FROM audit_events WHERE action LIKE 'ORGANIZATION_RELATIONSHIP_%'`,
      )
    )[0]!.n,
  )
const create = (
  parent: string,
  child: string,
  extra: Record<string, unknown> = {},
  actor = ADMIN,
) =>
  createRelationship(
    actor,
    parent,
    { target_organization_id: child, relationship_type: 'PARENT', ...extra },
    rid(),
  )
const V = (reason: string, field = 'target_organization_id') => ({
  code: 'PROFILE_VALIDATION_FAILED',
  status: 422,
  fields: { [field]: reason },
})
const CONFLICT = { code: 'MEMBERSHIP_INVALID_TRANSITION', status: 409, fields: null }

describe('WF03-S08 create (type matrix, invariant, audit)', () => {
  it('HUB → CHAPTER and CHAPTER → CLB create ACTIVE rows with one CREATED event', async () => {
    const r1 = await create(O.hubA!, O.chA!)
    expect(r1).toMatchObject({ direction: 'CHILD', state: 'ACTIVE', ended_at: null })
    const r2 = await create(O.chA!, O.clbA!)
    expect((await parentsOf(query, [O.clbA!])).get(O.clbA!)).toEqual({
      kind: 'PARENT',
      parentId: O.chA,
    })
    expect(await audits(r2.id)).toEqual([
      {
        action: 'ORGANIZATION_RELATIONSHIP_CREATED',
        before: null,
        after: {
          relationship_id: r2.id,
          parent_organization_id: O.chA,
          child_organization_id: O.clbA,
          relationship_type: 'PARENT',
          state: 'ACTIVE',
        },
      },
    ])
    // parent_id is never written.
    const [legacy] = await query<{ parent_id: string | null }>(
      `SELECT parent_id::text FROM organizations WHERE id = $1`,
      [O.clbA],
    )
    expect(legacy!.parent_id).toBeNull()
  })

  it('refuses unsupported pairs, self, other types, unknown types and extra fields', async () => {
    const before = await relAuditCount()
    for (const [p, c] of [
      [O.hubA, O.clbB], // HUB → CLB is not a valid pair (BR-FS03-09)
      [O.chB, O.hubB],
      [O.clbB, O.hubB],
      [O.clbB, O.chB],
      [O.chB, O.chC],
      [O.hubA, O.hubB],
    ]) {
      expect(await refusal(create(p!, c!))).toEqual(V('type_not_allowed'))
    }
    expect(await refusal(create(O.chB!, O.chB!))).toEqual(V('self'))
    expect(await refusal(create(O.chB!, O.company!))).toMatchObject({ status: 404 })
    expect(await refusal(create(O.company!, O.chB!))).toMatchObject({ status: 404 })
    expect(
      await refusal(
        createRelationship(
          ADMIN,
          O.hubB!,
          { target_organization_id: O.chB, relationship_type: 'PARTNER' },
          rid(),
        ),
      ),
    ).toEqual(V('not_supported', 'relationship_type'))
    expect(
      await refusal(
        createRelationship(
          ADMIN,
          O.hubB!,
          { target_organization_id: O.chB, relationship_type: 'PARENT', parent_id: O.hubA },
          rid(),
        ),
      ),
    ).toEqual(V('not_accepted', 'parent_id'))
    expect(await rows(O.chB!)).toEqual([])
    expect(await relAuditCount()).toBe(before)
  })

  it('duplicate and second ACTIVE parent are 409; archived is 409; nothing written', async () => {
    const before = await relAuditCount()
    expect(await refusal(create(O.chA!, O.clbA!))).toEqual(CONFLICT)
    expect(await refusal(create(O.hubB!, O.chA!))).toEqual(CONFLICT) // chA already has hubA
    expect(await refusal(create(O.chA!, O.clbArchived!))).toEqual(CONFLICT)
    expect((await rows(O.chA!)).filter((r) => r.state === 'ACTIVE')).toHaveLength(1)
    expect(await relAuditCount()).toBe(before)
  })

  it('the database rejects a second ACTIVE parent even without the service (migration 009)', async () => {
    await expect(
      query(
        `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type) VALUES ($1, $2, 'PARENT')`,
        [O.hubB, O.chA],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })
})

describe('WF03-S08 cycles (server-side)', () => {
  it('rejects A → B → A and A → B → C → A even when the new edge itself is a valid pair', async () => {
    // Legacy-shaped upward rows inserted directly (the service never writes them):
    // with them present, a type-valid downward edge would close a cycle.
    await query(
      `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type) VALUES
         ($1, $2, 'PARENT'), ($3, $4, 'PARENT'), ($4, $5, 'PARENT')`,
      [O.clbX, O.chD, O.clbY, O.hubC, O.chE],
    )
    const before = await relAuditCount()
    // 2-cycle: clbX → chD exists; chD → clbX (CHAPTER → CLB) would close it.
    expect(await refusal(create(O.chD!, O.clbX!))).toEqual(V('cycle'))
    // 3-cycle: clbY → hubC → chE exists; chE → clbY would close it.
    expect(await refusal(create(O.chE!, O.clbY!))).toEqual(V('cycle'))
    expect(await relAuditCount()).toBe(before)
    expect((await rows(O.clbX!)).length + (await rows(O.clbY!)).length).toBe(0)
  })
})

describe('WF03-S08 change parent and close (history kept)', () => {
  it('change parent: stale id 409; current id closes old + creates new atomically, two events', async () => {
    const old = (await rows(O.chA!)).find((r) => r.state === 'ACTIVE')!
    expect(await refusal(create(O.hubB!, O.chA!, { replaces_relationship_id: O.clbB }))).toEqual(
      CONFLICT,
    )
    const next = await create(O.hubB!, O.chA!, { replaces_relationship_id: old.id })
    const history = await rows(O.chA!)
    expect(history.filter((r) => r.state === 'ACTIVE')).toEqual([
      { id: next.id, source: O.hubB, state: 'ACTIVE', ended: false },
    ])
    expect(history.find((r) => r.id === old.id)).toMatchObject({ state: 'CLOSED', ended: true })
    expect((await audits(old.id)).map((a) => a.action)).toEqual([
      'ORGANIZATION_RELATIONSHIP_CREATED',
      'ORGANIZATION_RELATIONSHIP_ENDED',
    ])
    expect((await audits(next.id))[0]!.after).toMatchObject({ replaces_relationship_id: old.id })
    // Replaying the same change is stale now.
    expect(await refusal(create(O.hubA!, O.chA!, { replaces_relationship_id: old.id }))).toEqual(
      CONFLICT,
    )
  })

  it('close: from either end; reason kept on the row, not in the audit; re-close 409', async () => {
    const [active] = (await rows(O.clbA!)).filter((r) => r.state === 'ACTIVE')
    expect(
      await refusal(
        closeRelationship(ADMIN, O.chA!, active!.id, { ended_at: '2999-01-01T00:00:00Z' }, rid()),
      ),
    ).toEqual(V('future', 'ended_at'))
    expect(
      await refusal(
        closeRelationship(ADMIN, O.chA!, active!.id, { ended_at: '2000-01-01T00:00:00Z' }, rid()),
      ),
    ).toEqual(V('before_start', 'ended_at'))
    expect(
      await refusal(closeRelationship(ADMIN, O.chA!, active!.id, { state: 'CLOSED' }, rid())),
    ).toEqual(V('not_accepted', 'state'))
    const closed = await closeRelationship(
      ADMIN,
      O.clbA!,
      active!.id,
      { reason: '  Kết thúc nhiệm kỳ  ' },
      rid(),
    )
    expect(closed).toMatchObject({
      state: 'CLOSED',
      direction: 'PARENT',
      close_reason: 'Kết thúc nhiệm kỳ',
    })
    const events = await audits(active!.id)
    expect(events.at(-1)).toEqual({
      action: 'ORGANIZATION_RELATIONSHIP_ENDED',
      before: expect.objectContaining({ state: 'ACTIVE' }),
      after: expect.objectContaining({ state: 'CLOSED', child_organization_id: O.clbA }),
    })
    expect(JSON.stringify(events)).not.toContain('nhiệm kỳ')
    expect(await refusal(closeRelationship(ADMIN, O.chA!, active!.id, {}, rid()))).toEqual(CONFLICT)
    // A relationship of another organization is not reachable through this one.
    const [other] = (await rows(O.chA!)).filter((r) => r.state === 'ACTIVE')
    expect(await refusal(closeRelationship(ADMIN, O.clbB!, other!.id, {}, rid()))).toMatchObject({
      status: 404,
    })
    // History remains readable.
    const model = await getOrganizationRelationships(ADMIN, O.clbA!)
    expect(model.parent).toBeNull()
    expect(model.history.map((h) => h.id)).toContain(active!.id)
  })
})

describe('WF03-S08 concurrency', () => {
  it('two concurrent parents for one child: exactly one ACTIVE parent, one 409', async () => {
    const results = await Promise.allSettled([create(O.chB!, O.clbB!), create(O.chC!, O.clbB!)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(isApiError(failed.reason) && failed.reason.status).toBe(409)
    expect((await rows(O.clbB!)).filter((r) => r.state === 'ACTIVE')).toHaveLength(1)
  })
})

describe('WF03-S08 read model and candidates', () => {
  it('fixture tree: Chapter 01 has HUB parent and Club 01 child; candidates server-filtered', async () => {
    const m = await getOrganizationRelationships(ADMIN, CHAPTER_01)
    expect(m.parent?.organization.id).toBe(HUB)
    expect(m.children.map((c) => c.organization.id)).toContain(CLUB_01)
    // Children candidates: parentless, non-archived CLBs only.
    for (const c of m.candidates.children) expect(c.type).toBe('CLB')
    expect(m.candidates.children.map((c) => c.id)).not.toContain(O.clbArchived)
    expect(m.candidates.children.map((c) => c.id)).not.toContain(CLUB_01)
    // Parent candidates: other HUBs only (a change, never the current parent).
    for (const p of m.candidates.parents) expect(p.type).toBe('HUB')
    expect(m.candidates.parents.map((p) => p.id)).not.toContain(HUB)
    expect(JSON.stringify(m)).not.toMatch(/email|account|parent_id|role_code/i)
  })
})

describe('WF03-S08 authorization (both ends, exact scope)', () => {
  it('leader: Chapter 01 read only works in scope; any mutation touching another org is 403', async () => {
    const forbidden = { code: 'SCOPE_FORBIDDEN', status: 403, fields: null }
    const own = await getOrganizationRelationships(LEADER, CHAPTER_01)
    // Only Chapter 01 is in scope, so no counterpart is manageable.
    expect(own.candidates).toEqual({ children: [], parents: [] })
    const before = await relAuditCount()
    expect(await refusal(create(CHAPTER_01, O.clbB!, {}, LEADER))).toEqual(forbidden)
    expect(await refusal(create(O.chB!, O.clbB!, {}, LEADER))).toEqual(forbidden)
    const [hubLink] = (await rows(CHAPTER_01)).filter((r) => r.state === 'ACTIVE')
    expect(await refusal(closeRelationship(LEADER, CHAPTER_01, hubLink!.id, {}, rid()))).toEqual(
      forbidden,
    )
    for (const actor of [MEMBER]) {
      expect(await refusal(getOrganizationRelationships(actor, CHAPTER_01))).toEqual(forbidden)
      expect(await refusal(create(CHAPTER_01, O.clbB!, {}, actor))).toEqual(forbidden)
    }
    expect(await relAuditCount()).toBe(before)
    expect((await rows(CHAPTER_01)).filter((r) => r.state === 'ACTIVE')).toHaveLength(1)
  })
})
