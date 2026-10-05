import { afterAll, describe, expect, it } from 'vitest'

import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { closePool, query } from '@/lib/db/client'

import { getOwnNetwork, toSourceType } from './network'

/**
 * WF02-T00 — GET /me/network read model against live PostgreSQL. Records are
 * written directly as canonical rows (the state the roster, WF03 or a later
 * S04 request would leave), then read back only through the owner service.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'

afterAll(async () => {
  await closePool()
})

async function member(
  label = 'net',
): Promise<{ accountId: string; profileId: string; email: string }> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [account] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [profile] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status) VALUES ($1, 'Net', 'ACTIVE') RETURNING id::text`,
    [account!.id],
  )
  return { accountId: account!.id, profileId: profile!.id, email }
}

async function membership(profileId: string, org: string, state: string, source: string) {
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
     VALUES ($1, $2, $3, $4, '2026-09-01T00:00:00Z')`,
    [profileId, org, state, source],
  )
}

async function project(ownerProfileId: string, name: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO projects (type, owner_profile_id, slug, name, summary, status, metadata)
     VALUES ('STARTUP', $1, $2, $3, 'Summary', 'DRAFT', '{"secret":"x"}') RETURNING id::text`,
    [ownerProfileId, `t00-${Date.now()}-${Math.random().toString(36).slice(2)}`, name],
  )
  return row!.id
}

const serialized = async (accountId: string) => JSON.stringify(await getOwnNetwork(accountId))

describe('GET /me/network read model (WF02-T00)', () => {
  it('2. a member with no relationships gets empty arrays', async () => {
    const { accountId } = await member()
    expect(await getOwnNetwork(accountId)).toEqual({
      memberships: [],
      leadership: [],
      roles: [],
      activity_summary: [],
    })
  })

  it('2b. an account without a profile gets the same empty model', async () => {
    const [account] = await query<{ id: string }>(
      `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
      [`noprof-${Date.now()}@example.test`],
    )
    expect((await getOwnNetwork(account!.id)).memberships).toEqual([])
  })

  it('3/4. ACTIVE and PENDING_APPROVAL memberships are returned in the MembershipDTO shape', async () => {
    const { accountId, profileId } = await member()
    await membership(profileId, CHAPTER_01, 'ACTIVE', 'ORGANIZATION_VERIFIED')
    await membership(profileId, CHAPTER_02, 'PENDING_APPROVAL', 'SELF_DECLARED')

    const { memberships } = await getOwnNetwork(accountId)
    expect(memberships).toHaveLength(2)
    expect(memberships[0]).toEqual({
      id: expect.any(String),
      organization: { id: CHAPTER_01, name: 'Chapter 01', type: 'CHAPTER' },
      status: 'ACTIVE',
      source_type: 'ORGANIZATION_VERIFIED',
      valid_from: '2026-09-01',
      valid_to: null,
    })
    expect(memberships[1]).toMatchObject({
      organization: { id: CHAPTER_02 },
      status: 'PENDING_APPROVAL',
      source_type: 'SELF_DECLARED',
    })
  })

  it('source codes follow Data SOT §7; PRESEED maps to ORGANIZATION_VERIFIED; unknown → null', () => {
    expect(toSourceType('ORGANIZATION_VERIFIED')).toBe('ORGANIZATION_VERIFIED')
    expect(toSourceType('SELF_DECLARED')).toBe('SELF_DECLARED')
    expect(toSourceType('PRESEED')).toBe('ORGANIZATION_VERIFIED')
    expect(toSourceType('ROSTER_IMPORT_X')).toBeNull()
    expect(toSourceType(null)).toBeNull()
  })

  it('5. leadership is returned independently of membership', async () => {
    const { accountId, profileId } = await member()
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state, started_at)
       VALUES ($1, $2, 'Chapter Leader', 'ACTIVE', '2026-09-02T00:00:00Z')`,
      [profileId, CHAPTER_01],
    )
    const network = await getOwnNetwork(accountId)
    expect(network.memberships).toEqual([])
    expect(network.leadership).toEqual([
      {
        id: expect.any(String),
        organization: { id: CHAPTER_01, name: 'Chapter 01', type: 'CHAPTER' },
        title: 'Chapter Leader',
        status: 'ACTIVE',
        valid_from: '2026-09-02',
        valid_to: null,
      },
    ])
  })

  it('6/7. membership and leadership never create a capability or managed scope', async () => {
    const { accountId, profileId } = await member()
    await membership(profileId, CHAPTER_01, 'ACTIVE', 'ORGANIZATION_VERIFIED')
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Chapter Leader', 'ACTIVE')`,
      [profileId, CHAPTER_01],
    )
    const actor = await resolveActor(accountId)
    expect(deriveCapabilities(actor)).toEqual([])
    expect(deriveManagedScopes(actor)).toEqual([])
    const network = await getOwnNetwork(accountId)
    expect(network).not.toHaveProperty('capabilities')
    expect(network.leadership[0]).not.toHaveProperty('capabilities')
  })

  it('8. roster/bootstrap rows never leak', async () => {
    const { accountId, profileId, email } = await member()
    await query(
      `INSERT INTO membership_bootstrap (email_normalized, organization_id, membership_state, leadership_role_label, source_batch)
       VALUES ($1, $2, 'ACTIVE', 'CLB Leader', 'batch-secret-t00')`,
      [email, CLUB_01],
    )
    await membership(profileId, CHAPTER_01, 'ACTIVE', 'ORGANIZATION_VERIFIED')
    const json = await serialized(accountId)
    // An unconsumed bootstrap row is not a membership, and none of its data shows.
    expect(json).not.toContain(CLUB_01)
    expect(json).not.toContain('batch-secret-t00')
    expect(json).not.toContain('CLB Leader')
    expect(json).not.toMatch(/bootstrap|consumed|source_batch|email/i)
  })

  it('9. owned and confirmed-member ventures are represented; owned rows are not repeated', async () => {
    const owner = await member('own')
    const other = await member('oth')
    const owned = await project(owner.profileId, 'Alpha Venture')
    const joined = await project(other.profileId, 'Beta Venture')
    const pending = await project(other.profileId, 'Gamma Venture')
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state) VALUES
         ($1, $3, 'Owner row', 'ACTIVE'),
         ($2, $3, 'Co-founder', 'ACTIVE')`,
      [owned, joined, owner.profileId],
    )
    // A pending invitation to this member's email is not a relation yet (DEC-WF02-S06-G2).
    await query(
      `INSERT INTO project_members (project_id, role_label, state, joined_at, invite_email_normalized, invited_by_profile_id, invited_at, invite_expires_at)
       SELECT $1, 'Invitee', 'PENDING_CONFIRMATION', NULL, a.email_normalized, $2, now(), now() + interval '7 days'
         FROM user_accounts a WHERE a.id = $3`,
      [pending, other.profileId, owner.accountId],
    )
    const { roles } = await getOwnNetwork(owner.accountId)
    expect(roles).toEqual([
      {
        venture: { id: owned, type: 'STARTUP', name: 'Alpha Venture', status: 'DRAFT' },
        relation: 'OWNER',
        role_label: null,
      },
      {
        venture: { id: joined, type: 'STARTUP', name: 'Beta Venture', status: 'DRAFT' },
        relation: 'MEMBER',
        role_label: 'Co-founder',
      },
    ])
  })

  it('10/14. DTO only: no account, contact, slug or metadata fields', async () => {
    const { accountId, profileId, email } = await member()
    await membership(profileId, CHAPTER_01, 'ACTIVE', 'ORGANIZATION_VERIFIED')
    await project(profileId, 'Delta Venture')
    const network = await getOwnNetwork(accountId)
    const json = JSON.stringify(network)
    expect(json).not.toContain(email)
    expect(json).not.toContain(accountId)
    expect(json).not.toContain(profileId)
    expect(json).not.toContain('secret')
    expect(json).not.toMatch(
      /"(slug|metadata|email|phone|account_id|profile_id|owner_profile_id|created_at|updated_at)"/,
    )
    expect(Object.keys(network).sort()).toEqual([
      'activity_summary',
      'leadership',
      'memberships',
      'roles',
    ])
    expect(Object.keys(network.memberships[0]!).sort()).toEqual(
      ['id', 'organization', 'source_type', 'status', 'valid_from', 'valid_to'].sort(),
    )
    expect(Object.keys(network.roles[0]!.venture).sort()).toEqual(['id', 'name', 'status', 'type'])
  })

  it('11. one member cannot read another member through the service', async () => {
    const a = await member()
    const b = await member()
    await membership(b.profileId, CHAPTER_01, 'ACTIVE', 'ORGANIZATION_VERIFIED')
    expect((await getOwnNetwork(a.accountId)).memberships).toEqual([])
    expect((await getOwnNetwork(b.accountId)).memberships).toHaveLength(1)
  })

  it('13. ordering is deterministic (organisation name, then creation)', async () => {
    const { accountId, profileId } = await member()
    await membership(profileId, CLUB_01, 'ACTIVE', 'ORGANIZATION_VERIFIED')
    await membership(profileId, CHAPTER_02, 'PENDING_APPROVAL', 'SELF_DECLARED')
    await membership(profileId, CHAPTER_01, 'WITHDRAWN', 'SELF_DECLARED')
    const first = await getOwnNetwork(accountId)
    expect(first.memberships.map((m) => m.organization.name)).toEqual([
      'Chapter 01',
      'Chapter 02',
      'Club 01',
    ])
    expect(await getOwnNetwork(accountId)).toEqual(first)
  })

  it('activity_summary is always empty: no fabricated activity', async () => {
    const { accountId, profileId } = await member()
    await membership(profileId, CHAPTER_01, 'ACTIVE', 'ORGANIZATION_VERIFIED')
    expect((await getOwnNetwork(accountId)).activity_summary).toEqual([])
  })
})
