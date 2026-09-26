import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import { getOrganizationProfile, updateOrganizationProfile } from './organization-profile'

/**
 * WF03-S06 — organization profile read / update against live PostgreSQL
 * (API 05 §8.5, DEC-WF03-C1/G8/G9/G14, DEC-WF03-S06-D1..D3).
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const MEMBER = '30000000-0000-0000-0000-000000000001'
const LEADER = '30000000-0000-0000-0000-000000000002'
const ADMIN = '30000000-0000-0000-0000-000000000003'

let ORG = ''
let ARCHIVED = ''
let COMPANY = ''
let seq = 0
const rid = () => `s06-test-${Date.now()}-${seq++}`

beforeAll(async () => {
  const make = async (type: string, status: string, name: string) =>
    (
      await query<{ id: string }>(
        `INSERT INTO organizations (type, slug, name, description, status)
         VALUES ($1::org_type, $2, $3, 'Mô tả cũ', $4::publication_status) RETURNING id::text`,
        [type, `s06-${Date.now()}-${seq++}`, name, status],
      )
    )[0]!.id
  ORG = await make('CLB', 'PUBLISHED', 'S06 Club')
  ARCHIVED = await make('CLB', 'ARCHIVED', 'S06 Archived')
  COMPANY = await make('COMPANY', 'PUBLISHED', 'S06 Company')
  // Chapter 01 → ORG as a canonical child; a legacy parent_id that disagrees is ignored.
  await query(
    `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type) VALUES ($1, $2, 'PARENT')`,
    [CHAPTER_01, ORG],
  )
  await query(`UPDATE organizations SET parent_id = $2 WHERE id = $1`, [ORG, CHAPTER_02])
})

afterAll(async () => {
  const ids = [ORG, ARCHIVED, COMPANY]
  await query(`DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])`, [ids])
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

const snapshot = async (id: string) =>
  (
    await query(
      `SELECT name, description, slug, type::text, status::text, parent_id::text, logo_asset_id, metadata, updated_at
         FROM organizations WHERE id = $1`,
      [id],
    )
  )[0]
const audits = (id: string) =>
  query<{ action: string; before: unknown; after: unknown }>(
    `SELECT action, before_data AS before, after_data AS after FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
    [id],
  )

describe('WF03-S06 read (canonical profile, hierarchy read-only)', () => {
  it('returns canonical fields; hierarchy from organization_relationships only', async () => {
    const own = await getOrganizationProfile(LEADER, CHAPTER_01)
    expect(own).toMatchObject({
      id: CHAPTER_01,
      type: 'CHAPTER',
      status: 'PUBLISHED',
      parent: { id: HUB, type: 'HUB' },
      permissions: ['org:manage'],
    })
    expect(own.children.map((c) => c.id)).toEqual(expect.arrayContaining([CLUB_01, ORG]))
    const club = await getOrganizationProfile(ADMIN, ORG)
    expect(club.parent?.id).toBe(CHAPTER_01) // not the legacy parent_id (Chapter 02)
    expect(Object.keys(club).sort()).toEqual([
      'children',
      'description',
      'id',
      'name',
      'parent',
      'permissions',
      'slug',
      'status',
      'type',
    ])
    expect(JSON.stringify(club)).not.toMatch(/metadata|parent_id|logo|email|account/i)
  })
})

describe('WF03-S06 update (DEC-WF03-S06-D1/D2)', () => {
  it('updates name and description atomically; one ORGANIZATION_UPDATED event', async () => {
    const dto = await updateOrganizationProfile(
      ADMIN,
      ORG,
      { name: '  S06 Club mới  ', description: ' Mô tả mới ' },
      rid(),
    )
    expect(dto).toMatchObject({ name: 'S06 Club mới', description: 'Mô tả mới' })
    expect(await audits(ORG)).toEqual([
      {
        action: 'ORGANIZATION_UPDATED',
        before: { organization_id: ORG, name: 'S06 Club' },
        after: {
          organization_id: ORG,
          changed_fields: ['name', 'description'],
          name: 'S06 Club mới',
        },
      },
    ])
  })

  it('description only; an empty description clears it; a no-op writes nothing', async () => {
    await updateOrganizationProfile(ADMIN, ORG, { description: '' }, rid())
    const after = await audits(ORG)
    expect(after.at(-1)).toEqual({
      action: 'ORGANIZATION_UPDATED',
      before: { organization_id: ORG },
      after: { organization_id: ORG, changed_fields: ['description'] },
    })
    expect((await snapshot(ORG))!.description).toBeNull()
    const before = await snapshot(ORG)
    const dto = await updateOrganizationProfile(ADMIN, ORG, { name: 'S06 Club mới' }, rid())
    expect(dto.name).toBe('S06 Club mới')
    expect(await snapshot(ORG)).toEqual(before)
    expect(await audits(ORG)).toHaveLength(after.length)
  })

  it('refuses server-owned, hierarchy and invalid input; nothing changes (422)', async () => {
    const before = await snapshot(ORG)
    const count = (await audits(ORG)).length
    for (const [body, field, reason] of [
      [{ name: 'X', slug: 'x' }, 'slug', 'not_accepted'],
      [{ type: 'HUB' }, 'type', 'not_accepted'],
      [{ status: 'ARCHIVED' }, 'status', 'not_accepted'],
      [{ parent_id: HUB }, 'parent_id', 'not_accepted'],
      [{ parent: { id: HUB } }, 'parent', 'not_accepted'],
      [{ id: CHAPTER_01 }, 'id', 'not_accepted'],
      [{ organization_id: CHAPTER_01, name: 'X' }, 'organization_id', 'not_accepted'],
      [{ logo_asset_id: 'x' }, 'logo_asset_id', 'not_accepted'],
      [{ metadata: {} }, 'metadata', 'not_accepted'],
      [{ updated_at: '2020-01-01' }, 'updated_at', 'not_accepted'],
      [{ name: '   ' }, 'name', 'required'],
      [{ name: 'x'.repeat(201) }, 'name', 'too_long'],
      [{ description: 'x'.repeat(2001) }, 'description', 'too_long'],
      [{ description: 5 }, 'description', 'invalid'],
      [{}, 'body', 'empty'],
    ] as const) {
      expect(await refusal(updateOrganizationProfile(ADMIN, ORG, body, rid()))).toEqual({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [field]: reason },
      })
    }
    expect(await snapshot(ORG)).toEqual(before)
    expect(await audits(ORG)).toHaveLength(count)
  })

  it('ARCHIVED is read-only (409); non-operational types are 404', async () => {
    const before = await snapshot(ARCHIVED)
    expect(await refusal(updateOrganizationProfile(ADMIN, ARCHIVED, { name: 'X' }, rid()))).toEqual(
      { code: 'MEMBERSHIP_INVALID_TRANSITION', status: 409, fields: null },
    )
    expect(await snapshot(ARCHIVED)).toEqual(before)
    expect(await audits(ARCHIVED)).toEqual([])
    expect(
      await refusal(updateOrganizationProfile(ADMIN, COMPANY, { name: 'X' }, rid())),
    ).toMatchObject({ status: 404 })
  })
})

describe('WF03-S06 authorization (exact scope, no inheritance)', () => {
  it('leader: own Chapter only; child, parent, sibling and member refused; nothing changes', async () => {
    const forbidden = { code: 'SCOPE_FORBIDDEN', status: 403, fields: null }
    const chapter02 = await snapshot(CHAPTER_02)
    for (const org of [CLUB_01, HUB, CHAPTER_02, ORG, 'x']) {
      expect(
        await refusal(updateOrganizationProfile(LEADER, org, { name: 'Hijack' }, rid())),
      ).toEqual(forbidden)
      expect(await refusal(getOrganizationProfile(LEADER, org))).toEqual(forbidden)
    }
    expect(
      await refusal(updateOrganizationProfile(MEMBER, CHAPTER_01, { name: 'Hijack' }, rid())),
    ).toEqual(forbidden)
    expect(await snapshot(CHAPTER_02)).toEqual(chapter02)
    expect(await audits(CHAPTER_02)).toEqual([])
  })
})
