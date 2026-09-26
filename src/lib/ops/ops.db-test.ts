import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { closePool, query } from '@/lib/db/client'

import { childrenOf, parentsOf } from './hierarchy'
import { listManagedOrganizations, requireOpsOrganization } from './organizations'
import { hasOpsAccess, organizationScope } from './scope'

/**
 * WF03-T00 — ops foundation against live PostgreSQL (DEC-WF03-G6/G9/G11,
 * DEC-WF03-C2, DECISION-AUTHZ-01B).
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const MEMBER = '30000000-0000-0000-0000-000000000001' // HUB_MEMBER on Chapter 01 + ACTIVE membership
const LEADER = '30000000-0000-0000-0000-000000000002' // HUB_COMMUNITY_LEADER on Chapter 01
const ADMIN = '30000000-0000-0000-0000-000000000003' // PLATFORM_ADMIN

const created: string[] = []
const people: string[] = []

afterAll(async () => {
  // Chapter 02 is the "no members" fixture: leave it as found.
  for (const table of ['community_memberships', 'leadership_records']) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [people])
  }
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    people,
  ])
  await query(
    'DELETE FROM organization_relationships WHERE source_org_id = ANY($1::uuid[]) OR target_org_id = ANY($1::uuid[])',
    [created],
  )
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [created])
  await closePool()
})

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status }
    throw error
  }
  throw new Error('expected a refusal')
}

async function org(type: string, parentId: string | null = null) {
  const slug = `t00-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [row] = await query<{ id: string }>(
    `INSERT INTO organizations (type, parent_id, slug, name, status) VALUES ($1, $2, $3, $4, 'PUBLISHED') RETURNING id::text`,
    [type, parentId, slug, `T00 ${slug}`],
  )
  created.push(row!.id)
  return row!.id
}

async function parentRel(parent: string, child: string) {
  await query(
    `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type, state) VALUES ($1, $2, 'PARENT', 'ACTIVE')`,
    [parent, child],
  )
}

/** A completed person with membership + leadership (+ a HUB_MEMBER role) but no ops role. */
async function relationsOnly() {
  const email = `t00-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'T00', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED')`,
    [p!.id, CHAPTER_02],
  )
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Chủ tịch', 'ACTIVE')`,
    [p!.id, CHAPTER_02],
  )
  await query(
    `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, 'HUB_MEMBER', 'ORGANIZATION', $2, 'ACTIVE')`,
    [p!.id, CHAPTER_02],
  )
  people.push(p!.id)
  return a!.id
}

describe('WF03-T00 scope (exact RoleAssignment scope, no inheritance)', () => {
  it('PLATFORM_ADMIN covers all; the leader exactly Chapter 01; a member nothing', async () => {
    expect(organizationScope(await resolveActor(ADMIN), 'network:read')).toEqual({ kind: 'ALL' })
    expect(organizationScope(await resolveActor(LEADER), 'network:read')).toEqual({
      kind: 'SOME',
      organizationIds: [CHAPTER_01],
    })
    const member = await resolveActor(MEMBER)
    expect(organizationScope(member, 'network:read')).toEqual({ kind: 'SOME', organizationIds: [] })
    expect(hasOpsAccess(member)).toBe(false)
  })

  it('membership, leadership, a "Chủ tịch" title and HUB_MEMBER grant nothing', async () => {
    const account = await relationsOnly()
    const actor = await resolveActor(account)
    for (const c of ['network:read', 'org:read', 'member:read', 'membership:confirm'] as const) {
      expect(organizationScope(actor, c)).toEqual({ kind: 'SOME', organizationIds: [] })
    }
    expect(await refusal(listManagedOrganizations(account, { limit: 50 }))).toEqual({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
    expect(await refusal(requireOpsOrganization(account, CHAPTER_02, 'org:read'))).toMatchObject({
      status: 404,
    })
  })
})

describe('WF03-T00 canonical hierarchy (organization_relationships only)', () => {
  it('reads the seeded tree, incl. the C2 fixture row HUB → Chapter 02', async () => {
    const parents = await parentsOf(query, [HUB, CHAPTER_01, CHAPTER_02, CLUB_01])
    expect(parents.get(HUB)).toEqual({ kind: 'NONE' })
    expect(parents.get(CHAPTER_01)).toEqual({ kind: 'PARENT', parentId: HUB })
    expect(parents.get(CHAPTER_02)).toEqual({ kind: 'PARENT', parentId: HUB })
    expect(parents.get(CLUB_01)).toEqual({ kind: 'PARENT', parentId: CHAPTER_01 })
    expect(await childrenOf(query, HUB)).toEqual([CHAPTER_01, CHAPTER_02].sort())
  })

  it('never reads parent_id, and reports two ACTIVE parents as an inconsistency', async () => {
    const legacyOnly = await org('CLB', CHAPTER_01) // parent_id set, no relationship row
    const twoParents = await org('CLB')
    await parentRel(CHAPTER_01, twoParents)
    await parentRel(CHAPTER_02, twoParents)
    const parents = await parentsOf(query, [legacyOnly, twoParents])
    expect(parents.get(legacyOnly)).toEqual({ kind: 'NONE' })
    expect(parents.get(twoParents)).toMatchObject({ kind: 'INCONSISTENT' })
    const { items } = await listManagedOrganizations(ADMIN, { q: 'T00 t00-', limit: 50 })
    const row = items.find((i) => i.id === twoParents)!
    expect(row.parent).toBeNull()
  })
})

describe('WF03-T00 GET /ops/organizations read model', () => {
  it('leader: exactly Chapter 01, with its canonical parent and member count; safe DTO', async () => {
    const { items, nextCursor } = await listManagedOrganizations(LEADER, { limit: 50 })
    expect(items).toEqual([
      {
        id: CHAPTER_01,
        slug: 'chapter-01',
        name: 'Chapter 01',
        type: 'CHAPTER',
        status: 'PUBLISHED',
        parent: { id: HUB, slug: 'hub-network', name: 'HUB Network', type: 'HUB' },
        active_members: expect.any(Number),
      },
    ])
    expect(nextCursor).toBeNull()
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM community_memberships WHERE organization_id = $1 AND state = 'ACTIVE'`,
      [CHAPTER_01],
    )
    expect(items[0]!.active_members).toBe(n!.n)
    expect(JSON.stringify(items)).not.toMatch(/metadata|description|logo|email|profile|role|audit/i)
  })

  it('admin: every HUB / CHAPTER / CLB, filters, cursor paging, unknown type and bad cursor', async () => {
    const all = await listManagedOrganizations(ADMIN, { q: 'Chapter 0', limit: 50 })
    expect(all.items.map((i) => i.id)).toEqual([CHAPTER_01, CHAPTER_02])
    expect(all.items[1]!.parent?.id).toBe(HUB)
    const clubs = await listManagedOrganizations(ADMIN, { type: 'CLB', q: 'Club 01', limit: 50 })
    expect(clubs.items.map((i) => i.id)).toEqual([CLUB_01])
    const company = await listManagedOrganizations(ADMIN, { type: 'COMPANY', limit: 50 })
    expect(company.items).toEqual([])
    const first = await listManagedOrganizations(ADMIN, { q: 'Chapter 0', limit: 1 })
    expect(first.items.map((i) => i.id)).toEqual([CHAPTER_01])
    const second = await listManagedOrganizations(ADMIN, {
      q: 'Chapter 0',
      limit: 1,
      cursor: first.nextCursor!,
    })
    expect(second.items.map((i) => i.id)).toEqual([CHAPTER_02])
    expect(second.nextCursor).toBeNull()
    const bad = await listManagedOrganizations(ADMIN, { q: 'Chapter 0', limit: 1, cursor: '%%%' })
    expect(bad.items.map((i) => i.id)).toEqual([CHAPTER_01])
    // `q` is matched literally, not as a LIKE pattern.
    expect((await listManagedOrganizations(ADMIN, { q: '%', limit: 50 })).items).toEqual([])
  })
})

describe('WF03-T00 organization context (URL is context, never authority)', () => {
  it('leader: own org with capabilities; sibling, child, parent, malformed and COMPANY ids are 404', async () => {
    const ctx = await requireOpsOrganization(LEADER, CHAPTER_01, 'org:read')
    expect(ctx.organization).toMatchObject({ id: CHAPTER_01, name: 'Chapter 01' })
    expect(ctx.capabilities).toEqual([
      'org:read',
      'member:read',
      'org:manage',
      'event:manage',
      'org:manage_relationship',
    ])
    const company = await org('COMPANY')
    for (const id of [CHAPTER_02, CLUB_01, HUB, 'not-a-uuid', company]) {
      expect(await refusal(requireOpsOrganization(LEADER, id, 'org:read'))).toMatchObject({
        status: 404,
      })
    }
    // Even the platform admin gets no ops context for a non-operational type.
    expect(await refusal(requireOpsOrganization(ADMIN, company, 'org:read'))).toMatchObject({
      status: 404,
    })
    expect((await requireOpsOrganization(ADMIN, CLUB_01, 'org:read')).organization.id).toBe(CLUB_01)
    expect(await refusal(requireOpsOrganization(MEMBER, CHAPTER_01, 'org:read'))).toMatchObject({
      status: 404,
    })
  })
})
