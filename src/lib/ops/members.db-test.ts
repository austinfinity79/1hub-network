import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import { listOrganizationMembers } from './members'

/**
 * WF03-S03 — organization members read model against live PostgreSQL
 * (API 05 §8.3, DEC-WF03-G3/G4/G5/G6).
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const MEMBER = '30000000-0000-0000-0000-000000000001'
const LEADER = '30000000-0000-0000-0000-000000000002'
const ADMIN = '30000000-0000-0000-0000-000000000003'

let ORG = ''
const accounts: string[] = []
const P: Record<string, { profileId: string; name: string; email: string }> = {}

async function person(key: string, name: string, level?: 'PRIVATE' | 'NETWORK_ONLY') {
  const email = `s03-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  accounts.push(a!.id)
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, headline, bio, status) VALUES ($1, $2, 'Kỹ sư', 'Tiểu sử riêng', 'ACTIVE') RETURNING id::text`,
    [a!.id, name],
  )
  if (level) {
    await query(
      `INSERT INTO profile_visibility_settings (profile_id, group_overrides) VALUES ($1, $2)`,
      [p!.id, JSON.stringify({ PROFILE_DISCOVERY: level })],
    )
  }
  P[key] = { profileId: p!.id, name, email }
  return p!.id
}

async function membership(profileId: string, state: string, source: string, createdAt: string) {
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at, created_at)
     VALUES ($1, $2, $3::membership_state, $4, CASE WHEN $3::text = 'PENDING_APPROVAL' THEN NULL ELSE $5::timestamptz END, $5::timestamptz)`,
    [profileId, ORG, state, source, createdAt],
  )
}

beforeAll(async () => {
  const [o] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'S03 Test Club', 'PUBLISHED') RETURNING id::text`,
    [`s03-${Date.now()}`],
  )
  ORG = o!.id
  await membership(
    await person('active', 'An Active'),
    'ACTIVE',
    'ORGANIZATION_VERIFIED',
    '2026-02-01T03:00:00Z',
  )
  await membership(
    await person('pending', 'Bình Pending'),
    'PENDING_APPROVAL',
    'SELF_DECLARED',
    '2026-09-20T03:00:00Z',
  )
  await membership(
    await person('private', 'Cúc Private', 'PRIVATE'),
    'ACTIVE',
    'PRESEED',
    '2026-03-01T03:00:00Z',
  )
  // History: an older REJECTED request and a newer ACTIVE membership → one row, ACTIVE.
  const again = await person('again', 'Dũng Again')
  await membership(again, 'REJECTED', 'SELF_DECLARED', '2026-01-01T03:00:00Z')
  await membership(again, 'ACTIVE', 'ORGANIZATION_VERIFIED', '2026-04-01T03:00:00Z')
  await membership(
    await person('alumni', 'Én Alumni'),
    'ALUMNI',
    'ORGANIZATION_VERIFIED',
    '2025-01-01T03:00:00Z',
  )
  // Leadership without membership, and a leader who is also an ACTIVE member.
  const leaderOnly = await person('leaderOnly', 'Giang Leader')
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Chủ nhiệm', 'ACTIVE')`,
    [leaderOnly, ORG],
  )
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Phó chủ nhiệm', 'ACTIVE'), ($1, $2, 'Thủ quỹ', 'ALUMNI')`,
    [P.active!.profileId, ORG],
  )
})

afterAll(async () => {
  const ids = Object.values(P).map((p) => p.profileId)
  for (const table of [
    'community_memberships',
    'leadership_records',
    'profile_visibility_settings',
  ]) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [ids])
  }
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [ids])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
  await query('DELETE FROM organizations WHERE id = $1', [ORG])
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

const list = (params: Record<string, string> = {}, limit = 50) =>
  listOrganizationMembers(ADMIN, ORG, { limit, ...params })

describe('WF03-S03 rows (one per person; records stay separate)', () => {
  it('lists every related person once, alphabetically, with canonical facts', async () => {
    const { items, nextCursor } = await list()
    expect(nextCursor).toBeNull()
    const byKey = Object.fromEntries(
      Object.entries(P).map(([k, v]) => [k, items.find((i) => i.profile_id === v.profileId)]),
    )
    expect(items).toHaveLength(Object.keys(P).length)
    // Alphabetical by visible name (vi collation); the hidden identity comes last.
    expect(items.map((i) => i.profile_id)).toEqual(
      ['active', 'pending', 'again', 'alumni', 'leaderOnly', 'private'].map((k) => P[k]!.profileId),
    )
    expect(byKey.active).toEqual({
      profile_id: P.active!.profileId,
      profile: { display_name: 'An Active', headline: 'Kỹ sư' },
      membership: { state: 'ACTIVE', source_type: 'ORGANIZATION_VERIFIED', since: '2026-02-01' },
      leadership: [{ title: 'Phó chủ nhiệm', state: 'ACTIVE' }],
    })
    expect(byKey.pending!.membership).toEqual({
      state: 'PENDING_APPROVAL',
      source_type: 'SELF_DECLARED',
      since: '2026-09-20',
    })
    expect(byKey.again!.membership!.state).toBe('ACTIVE') // open row wins over the older REJECTED
    expect(byKey.leaderOnly).toMatchObject({
      membership: null,
      leadership: [{ title: 'Chủ nhiệm', state: 'ACTIVE' }],
    })
  })

  it('G4: PRIVATE discovery hides identity from ops (admin included); facts remain', async () => {
    const { items } = await list()
    const hidden = items.find((i) => i.profile_id === P.private!.profileId)!
    expect(hidden.profile).toBeNull()
    expect(hidden.membership).toEqual({
      state: 'ACTIVE',
      source_type: 'ORGANIZATION_VERIFIED', // PRESEED is roster-confirmed provenance
      since: '2026-03-01',
    })
    // Search cannot probe a hidden name.
    expect((await list({ q: 'Cúc' })).items).toEqual([])
    expect((await list({ q: 'an act' })).items.map((i) => i.profile_id)).toEqual([
      P.active!.profileId,
    ])
  })

  it('never returns email, account ids, bio, roles or metadata', async () => {
    const json = JSON.stringify((await list()).items)
    for (const p of Object.values(P)) expect(json).not.toContain(p.email)
    for (const a of accounts) expect(json).not.toContain(a)
    expect(json).not.toMatch(/Tiểu sử riêng|bio|email|account|role_code|capabilit|metadata/i)
  })
})

describe('WF03-S03 filters and paging (API §8.3)', () => {
  it('membership_status, leadership_status, unknown values, and the offset cursor', async () => {
    expect(
      (await list({ membership_status: 'PENDING_APPROVAL' })).items.map((i) => i.profile_id),
    ).toEqual([P.pending!.profileId])
    expect(
      (await list({ leadership_status: 'ACTIVE' })).items.map((i) => i.profile_id).sort(),
    ).toEqual([P.active!.profileId, P.leaderOnly!.profileId].sort())
    expect((await list({ leadership_status: 'ALUMNI' })).items.map((i) => i.profile_id)).toEqual([
      P.active!.profileId,
    ])
    expect((await list({ membership_status: 'NOPE' })).items).toEqual([])
    const first = await list({}, 4)
    const second = await listOrganizationMembers(ADMIN, ORG, {
      limit: 4,
      cursor: first.nextCursor!,
    })
    expect(first.items).toHaveLength(4)
    expect(second.items).toHaveLength(2)
    expect(second.nextCursor).toBeNull()
    const bad = await listOrganizationMembers(ADMIN, ORG, { limit: 4, cursor: '%%' })
    expect(bad.items.map((i) => i.profile_id)).toEqual(first.items.map((i) => i.profile_id))
  })
})

describe('WF03-S03 authorization (exact scope)', () => {
  it('leader: own Chapter only; child, sibling, test org refused alike; member refused', async () => {
    const own = await listOrganizationMembers(LEADER, CHAPTER_01, { limit: 50 })
    expect(own.items.length).toBeGreaterThan(0)
    for (const id of [CLUB_01, CHAPTER_02, ORG, 'x']) {
      expect(await refusal(listOrganizationMembers(LEADER, id, { limit: 50 }))).toEqual({
        code: 'SCOPE_FORBIDDEN',
        status: 403,
      })
    }
    expect(await refusal(listOrganizationMembers(MEMBER, CHAPTER_01, { limit: 50 }))).toMatchObject(
      {
        status: 403,
      },
    )
  })
})
