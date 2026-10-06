import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import { getOrganizationDashboard } from './dashboard'

/**
 * WF03-S02 — organization dashboard read model against live PostgreSQL
 * (API 05 §8.2, DEC-WF03-G1/G9/G10/G11).
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const MEMBER = '30000000-0000-0000-0000-000000000001'
const LEADER = '30000000-0000-0000-0000-000000000002'
const ADMIN = '30000000-0000-0000-0000-000000000003'

const created: string[] = []
const profiles: string[] = []

afterAll(async () => {
  for (const table of ['community_memberships', 'leadership_records']) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
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

async function sql(text: string, id: string) {
  const [row] = await query<{ n: number }>(text, [id])
  return row!.n
}

describe('WF03-S02 dashboard metrics (canonical queries only)', () => {
  it('leader, Chapter 01: every counter equals its canonical query', async () => {
    const d = await getOrganizationDashboard(LEADER, CHAPTER_01)
    expect(d.organization).toEqual({
      id: CHAPTER_01,
      slug: 'chapter-01',
      name: 'Chapter 01',
      type: 'CHAPTER',
    })
    expect(d.summary).toEqual({
      active_members: await sql(
        `SELECT count(*)::int AS n FROM community_memberships WHERE organization_id = $1 AND state = 'ACTIVE'`,
        CHAPTER_01,
      ),
      pending_memberships: await sql(
        `SELECT count(*)::int AS n FROM community_memberships WHERE organization_id = $1 AND state = 'PENDING_APPROVAL'`,
        CHAPTER_01,
      ),
      active_leaders: await sql(
        `SELECT count(*)::int AS n FROM leadership_records WHERE organization_id = $1 AND state = 'ACTIVE'`,
        CHAPTER_01,
      ),
      // The seeded programme-linked DRAFT event (WF04) is not a WF03 event.
      standalone_events: 1,
      published_events: 1,
      child_organizations: 1, // Club 01, through the canonical PARENT relation
    })
    expect(d.summary.pending_memberships).toBeGreaterThanOrEqual(1)
    expect(d.permissions).toEqual([
      'org:read',
      'member:read',
      'membership:confirm',
      'leadership:manage',
      'org:manage',
      'event:manage',
      'org:manage_relationship',
    ])
  })

  it('counts only the named states and direct children', async () => {
    // Rows in non-counted states on Chapter 02 change nothing.
    const [a] = await query<{ id: string }>(
      `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
      [`s02-${Date.now()}@example.test`],
    )
    const [q] = await query<{ id: string }>(
      `INSERT INTO individual_profiles (account_id, display_name, status) VALUES ($1, 'S02', 'ACTIVE') RETURNING id::text`,
      [a!.id],
    )
    profiles.push(q!.id)
    const before = (await getOrganizationDashboard(ADMIN, CHAPTER_02)).summary
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'REJECTED', 'SELF_DECLARED')`,
      [q!.id, CHAPTER_02],
    )
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state, ended_at) VALUES ($1, $2, 'Cựu trưởng', 'ALUMNI', now())`,
      [q!.id, CHAPTER_02],
    )
    const after = (await getOrganizationDashboard(ADMIN, CHAPTER_02)).summary
    expect(after).toEqual(before)
    // HUB: its direct children are the Chapters — the two fixture ones and the 13 of
    // the canonical catalogue (S1-UAT-03) — never a CLB (no recursion).
    expect((await getOrganizationDashboard(ADMIN, HUB)).summary.child_organizations).toBe(15)
  })
})

describe('WF03-S02 dashboard authorization (exact scope)', () => {
  it('leader: own org only; child, sibling and parent refused alike; no inheritance', async () => {
    for (const id of [CLUB_01, CHAPTER_02, HUB, 'not-a-uuid']) {
      expect(await refusal(getOrganizationDashboard(LEADER, id))).toEqual({
        code: 'SCOPE_FORBIDDEN',
        status: 403,
      })
    }
  })

  it('member and membership-only actors refused; admin sees any operational org, 404 otherwise', async () => {
    expect(await refusal(getOrganizationDashboard(MEMBER, CHAPTER_01))).toMatchObject({
      status: 403,
    })
    expect((await getOrganizationDashboard(ADMIN, CLUB_01)).organization.id).toBe(CLUB_01)
    const [company] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('COMPANY', $1, 'S02 Co', 'PUBLISHED') RETURNING id::text`,
      [`s02-co-${Date.now()}`],
    )
    created.push(company!.id)
    expect(await refusal(getOrganizationDashboard(ADMIN, company!.id))).toMatchObject({
      status: 404,
    })
    expect(
      await refusal(getOrganizationDashboard(ADMIN, '00000000-0000-0000-0000-000000000000')),
    ).toMatchObject({ status: 404 })
  })

  it('DTO carries aggregates only: no identities, metadata or programme figures', async () => {
    const d = await getOrganizationDashboard(LEADER, CHAPTER_01)
    expect(Object.keys(d).sort()).toEqual(['organization', 'permissions', 'summary'])
    expect(Object.keys(d.summary).sort()).toEqual([
      'active_leaders',
      'active_members',
      'child_organizations',
      'pending_memberships',
      'published_events',
      'standalone_events',
    ])
    expect(JSON.stringify(d)).not.toMatch(/@|profile|email|metadata|programme|challenge/i)
  })
})
