import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import { getMemberDetail } from './member-detail'
import { createLeadership, endLeadership, reviewMembership } from './review'

/**
 * WF03-S04 — membership review, leadership operations and member detail
 * against live PostgreSQL (API 05 §8.3, DEC-WF03-G3/G4/G5/G6/G14).
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const MEMBER = '30000000-0000-0000-0000-000000000001'
const LEADER = '30000000-0000-0000-0000-000000000002'
const ADMIN = '30000000-0000-0000-0000-000000000003'

let ORG = ''
let OTHER = ''
const accounts: string[] = []
const P: Record<string, { profileId: string; accountId: string; email: string }> = {}
let seq = 0
const rid = () => `s04-test-${Date.now()}-${seq++}`

async function person(key: string, name: string, level?: 'PRIVATE') {
  const email = `s04-${key}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
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
  P[key] = { profileId: p!.id, accountId: a!.id, email }
  return p!.id
}

async function membership(profileId: string, state: string, org = ORG) {
  const [m] = await query<{ id: string }>(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
     VALUES ($1, $2, $3::membership_state, 'SELF_DECLARED',
             CASE WHEN $3::text = 'ACTIVE' THEN now() END)
     RETURNING id::text`,
    [profileId, org, state],
  )
  return m!.id
}

const M: Record<string, string> = {}

beforeAll(async () => {
  for (const [key, name] of [
    ['s04a', 'S04 Test Club A'],
    ['s04b', 'S04 Test Club B'],
  ] as const) {
    const [o] = await query<{ id: string }>(
      `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, $2, 'PUBLISHED') RETURNING id::text`,
      [`${key}-${Date.now()}`, name],
    )
    if (key === 's04a') ORG = o!.id
    else OTHER = o!.id
  }
  M.approve = await membership(await person('approve', 'An Approve'), 'PENDING_APPROVAL')
  M.reject = await membership(await person('reject', 'Bình Reject'), 'PENDING_APPROVAL')
  M.race = await membership(await person('race', 'Cúc Race'), 'PENDING_APPROVAL')
  M.active = await membership(await person('active', 'Dũng Active'), 'ACTIVE')
  M.hidden = await membership(await person('hidden', 'Én Hidden', 'PRIVATE'), 'PENDING_APPROVAL')
  M.elsewhere = await membership(
    await person('elsewhere', 'Giang Elsewhere'),
    'PENDING_APPROVAL',
    OTHER,
  )
  await person('stranger', 'Hà Stranger')
})

afterAll(async () => {
  const ids = Object.values(P).map((p) => p.profileId)
  await query(
    `DELETE FROM audit_events WHERE resource_id IN (
       SELECT id FROM community_memberships WHERE profile_id = ANY($1::uuid[])
       UNION SELECT id FROM leadership_records WHERE profile_id = ANY($1::uuid[]))`,
    [ids],
  )
  for (const table of [
    'community_memberships',
    'leadership_records',
    'profile_visibility_settings',
  ]) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [ids])
  }
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [ids])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [[ORG, OTHER]])
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

const audits = (resourceId: string) =>
  query<{ action: string; actor: string; before: unknown; after: unknown }>(
    `SELECT action, actor_account_id::text AS actor, before_data AS before, after_data AS after
       FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id`,
    [resourceId],
  )
const roleCount = async () =>
  Number(
    (
      await query<{ n: string }>(
        `SELECT count(*) AS n FROM role_assignments WHERE account_id = ANY($1::uuid[])`,
        [accounts],
      )
    )[0]!.n,
  )
const row = async (table: string, id: string) =>
  (
    await query<{ state: string; source?: string; started_at: Date | null; ended_at: Date | null }>(
      `SELECT * , state::text AS state FROM ${table} WHERE id = $1`,
      [id],
    )
  )[0]!

describe('WF03-S04 membership review (DEC-WF03-G5)', () => {
  it('approve: PENDING_APPROVAL → ACTIVE, organization-verified, started now, audited', async () => {
    const dto = await reviewMembership(ADMIN, ORG, M.approve!, { status: 'ACTIVE' }, rid())
    expect(dto).toMatchObject({
      id: M.approve,
      state: 'ACTIVE',
      source_type: 'ORGANIZATION_VERIFIED',
      ended_at: null,
    })
    expect(dto.started_at).not.toBeNull()
    const r = await row('community_memberships', M.approve!)
    expect(r).toMatchObject({ state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED', ended_at: null })
    expect(await audits(M.approve!)).toEqual([
      {
        action: 'MEMBERSHIP_APPROVED',
        actor: ADMIN,
        before: { organization_id: ORG, state: 'PENDING_APPROVAL' },
        after: { organization_id: ORG, state: 'ACTIVE', source_type: 'ORGANIZATION_VERIFIED' },
      },
    ])
  })

  it('reject: PENDING_APPROVAL → REJECTED with ended_at; history row kept', async () => {
    const dto = await reviewMembership(ADMIN, ORG, M.reject!, { status: 'REJECTED' }, rid())
    expect(dto).toMatchObject({ state: 'REJECTED', started_at: null })
    expect(dto.ended_at).not.toBeNull()
    expect((await audits(M.reject!)).map((a) => a.action)).toEqual(['MEMBERSHIP_REJECTED'])
  })

  it('every other transition is 409, unknown values 422, and refusals write nothing', async () => {
    const conflict = { code: 'MEMBERSHIP_INVALID_TRANSITION', status: 409 }
    expect(
      await refusal(reviewMembership(ADMIN, ORG, M.approve!, { status: 'REJECTED' }, rid())),
    ).toEqual(conflict)
    expect(
      await refusal(reviewMembership(ADMIN, ORG, M.reject!, { status: 'ACTIVE' }, rid())),
    ).toEqual(conflict)
    expect(
      await refusal(reviewMembership(ADMIN, ORG, M.active!, { status: 'ALUMNI' }, rid())),
    ).toEqual(conflict)
    expect(
      await refusal(reviewMembership(ADMIN, ORG, M.hidden!, { status: 'WITHDRAWN' }, rid())),
    ).toEqual(conflict)
    expect(
      await refusal(reviewMembership(ADMIN, ORG, M.hidden!, { status: 'SUSPENDED' }, rid())),
    ).toEqual(conflict)
    for (const body of [{ status: 'NOPE' }, {}, { status: 'ACTIVE', source: 'X' }, null]) {
      expect(await refusal(reviewMembership(ADMIN, ORG, M.hidden!, body, rid()))).toMatchObject({
        status: 422,
      })
    }
    expect(await audits(M.hidden!)).toEqual([])
    expect(await audits(M.active!)).toEqual([])
    expect((await row('community_memberships', M.hidden!)).state).toBe('PENDING_APPROVAL')
  })

  it('a membership of another organization is not reachable through this one (404)', async () => {
    expect(
      await refusal(reviewMembership(ADMIN, ORG, M.elsewhere!, { status: 'ACTIVE' }, rid())),
    ).toMatchObject({
      status: 404,
    })
    expect(
      await refusal(reviewMembership(ADMIN, ORG, 'not-a-uuid', { status: 'ACTIVE' }, rid())),
    ).toMatchObject({
      status: 404,
    })
    expect((await row('community_memberships', M.elsewhere!)).state).toBe('PENDING_APPROVAL')
  })

  it('concurrent approve and reject: exactly one wins, the other is 409, one audit event', async () => {
    const results = await Promise.allSettled([
      reviewMembership(ADMIN, ORG, M.race!, { status: 'ACTIVE' }, rid()),
      reviewMembership(ADMIN, ORG, M.race!, { status: 'REJECTED' }, rid()),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(isApiError(rejected.reason) && rejected.reason.status).toBe(409)
    const events = await audits(M.race!)
    expect(events).toHaveLength(1)
    const final = (await row('community_memberships', M.race!)).state
    expect(events[0]!.action).toBe(
      final === 'ACTIVE' ? 'MEMBERSHIP_APPROVED' : 'MEMBERSHIP_REJECTED',
    )
  })
})

describe('DEC-PDF-D6B HUB declarations: platform verification only', () => {
  it('a unit leader neither approves nor rejects a declaration; the admin verifies it; grants nothing', async () => {
    const declared = await person('declared', 'Khánh Declared')
    const [d] = await query<{ id: string }>(
      `INSERT INTO community_memberships
         (profile_id, organization_id, state, source, claimed_position, hub_declaration)
       VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED', 'Phó chủ nhiệm', true)
       RETURNING id::text`,
      [declared, CHAPTER_01],
    )
    const roles = await roleCount()
    for (const status of ['ACTIVE', 'REJECTED']) {
      expect(await refusal(reviewMembership(LEADER, CHAPTER_01, d!.id, { status }, rid()))).toEqual(
        { code: 'SCOPE_FORBIDDEN', status: 403 },
      )
    }
    expect((await row('community_memberships', d!.id)).state).toBe('PENDING_APPROVAL')
    expect(await audits(d!.id)).toEqual([])

    // The detail offers the review to whoever may decide it, and says why not to the leader.
    const byLeader = await getMemberDetail(LEADER, CHAPTER_01, declared)
    expect(byLeader.membership).toMatchObject({ state: 'PENDING_APPROVAL', declaration: true })
    expect(byLeader.permissions).not.toContain('membership:confirm')
    expect(byLeader.permissions).toContain('leadership:manage')
    expect((await getMemberDetail(ADMIN, CHAPTER_01, declared)).permissions).toContain(
      'membership:confirm',
    )

    const verified = await reviewMembership(ADMIN, CHAPTER_01, d!.id, { status: 'ACTIVE' }, rid())
    expect(verified).toMatchObject({
      state: 'ACTIVE',
      source_type: 'ORGANIZATION_VERIFIED',
      declaration: true,
    })
    // The stated position stays text: no leadership, no RoleAssignment.
    expect(
      await query('SELECT 1 FROM leadership_records WHERE profile_id = $1', [declared]),
    ).toEqual([])
    expect(await roleCount()).toBe(roles)
  })

  it('an ordinary join request stays the unit leader’s to decide', async () => {
    const asked = await membership(
      await person('asked', 'Lan Asked'),
      'PENDING_APPROVAL',
      CHAPTER_01,
    )
    const approved = await reviewMembership(LEADER, CHAPTER_01, asked, { status: 'ACTIVE' }, rid())
    expect(approved).toMatchObject({ state: 'ACTIVE', declaration: false })
  })
})

describe('WF03-S04 leadership (DEC-WF03-G6)', () => {
  let created = ''

  it('create: ACTIVE record for a related person; no RoleAssignment; audited', async () => {
    const before = await roleCount()
    const dto = await createLeadership(
      ADMIN,
      ORG,
      {
        profile_id: P.active!.profileId,
        title: '  Chủ nhiệm  ',
        valid_from: '2026-01-15',
        valid_to: null,
      },
      rid(),
    )
    created = dto.id
    expect(dto).toMatchObject({ title: 'Chủ nhiệm', state: 'ACTIVE', ended_at: null })
    expect(dto.started_at).toBe('2026-01-14T17:00:00.000Z') // 15/01 00:00 Asia/Ho_Chi_Minh
    expect(await roleCount()).toBe(before)
    expect(await audits(created)).toEqual([
      {
        action: 'LEADERSHIP_CREATED',
        actor: ADMIN,
        before: null,
        after: { organization_id: ORG, profile_id: P.active!.profileId, state: 'ACTIVE' },
      },
    ])
  })

  it('create refusals: duplicate 409, unrelated 404, invalid input 422', async () => {
    const base = { profile_id: P.active!.profileId, title: 'Chủ nhiệm' }
    expect(await refusal(createLeadership(ADMIN, ORG, base, rid()))).toEqual({
      code: 'MEMBERSHIP_INVALID_TRANSITION',
      status: 409,
    })
    expect(
      await refusal(
        createLeadership(ADMIN, ORG, { ...base, profile_id: P.stranger!.profileId }, rid()),
      ),
    ).toMatchObject({ status: 404 })
    expect(
      await refusal(
        createLeadership(ADMIN, ORG, { ...base, profile_id: P.elsewhere!.profileId }, rid()),
      ),
    ).toMatchObject({ status: 404 })
    for (const body of [
      { ...base, title: '   ' },
      { ...base, title: 'x'.repeat(101) },
      { ...base, title: 'Thủ quỹ', valid_to: '2027-01-01' },
      { ...base, title: 'Thủ quỹ', valid_from: '2999-01-01' },
      { ...base, title: 'Thủ quỹ', valid_from: '15/01/2026' },
      { ...base, title: 'Thủ quỹ', role_code: 'HUB_COMMUNITY_LEADER' },
      { title: 'Thủ quỹ' },
    ]) {
      expect(await refusal(createLeadership(ADMIN, ORG, body, rid()))).toMatchObject({
        status: 422,
      })
    }
    const n = await query(`SELECT 1 FROM leadership_records WHERE organization_id = $1`, [ORG])
    expect(n).toHaveLength(1)
  })

  it('end: ACTIVE → ALUMNI keeps the row; a closed record is 409; REVOKED works too', async () => {
    const dto = await endLeadership(ADMIN, ORG, created, { status: 'ALUMNI' }, rid())
    expect(dto).toMatchObject({ id: created, state: 'ALUMNI' })
    expect(dto.ended_at).not.toBeNull()
    expect(await refusal(endLeadership(ADMIN, ORG, created, { status: 'REVOKED' }, rid()))).toEqual(
      {
        code: 'MEMBERSHIP_INVALID_TRANSITION',
        status: 409,
      },
    )
    for (const status of ['ACTIVE', 'NOPE']) {
      expect(await refusal(endLeadership(ADMIN, ORG, created, { status }, rid()))).toMatchObject({
        status: 422,
      })
    }
    // The title is free again once the earlier record is closed.
    const again = await createLeadership(
      ADMIN,
      ORG,
      { profile_id: P.active!.profileId, title: 'Chủ nhiệm' },
      rid(),
    )
    expect((await endLeadership(ADMIN, ORG, again.id, { status: 'REVOKED' }, rid())).state).toBe(
      'REVOKED',
    )
    expect((await audits(created)).map((a) => a.action)).toEqual([
      'LEADERSHIP_CREATED',
      'LEADERSHIP_ENDED',
    ])
    expect((await audits(created))[1]!.after).toEqual({ organization_id: ORG, state: 'ALUMNI' })
    expect(
      await refusal(endLeadership(ADMIN, OTHER, again.id, { status: 'ALUMNI' }, rid())),
    ).toMatchObject({
      status: 404,
    })
  })
})

describe('WF03-S04 member detail (API §8.3, G4)', () => {
  it('returns the relationship records, projection and consent summary only', async () => {
    const d = await getMemberDetail(ADMIN, ORG, P.active!.profileId)
    expect(d.profile).toEqual({ display_name: 'Dũng Active', headline: 'Kỹ sư' })
    expect(d.membership).toMatchObject({ id: M.active, state: 'ACTIVE' })
    expect(d.leadership.map((l) => l.state).sort()).toEqual(['ALUMNI', 'REVOKED'])
    expect(d.consent_summary).toEqual({ discovery_visible: true })
    expect(d.permissions).toEqual(['membership:confirm', 'leadership:manage'])
    const json = JSON.stringify(d)
    expect(json).not.toContain(P.active!.email)
    expect(json).not.toContain(P.active!.accountId)
    expect(json).not.toMatch(/Tiểu sử riêng|email|account|role_code|audit/i)
  })

  it('PRIVATE discovery: no identity for ops (admin included); facts remain', async () => {
    const d = await getMemberDetail(ADMIN, ORG, P.hidden!.profileId)
    expect(d.profile).toBeNull()
    expect(d.membership!.state).toBe('PENDING_APPROVAL')
    expect(d.consent_summary).toEqual({ discovery_visible: false })
  })

  it('an unrelated person or a person of another organization is 404', async () => {
    for (const key of ['stranger', 'elsewhere']) {
      expect(await refusal(getMemberDetail(ADMIN, ORG, P[key]!.profileId))).toMatchObject({
        status: 404,
      })
    }
    expect(await refusal(getMemberDetail(ADMIN, ORG, 'nope'))).toMatchObject({ status: 404 })
  })
})

describe('WF03-S04 authorization (exact scope, no inheritance)', () => {
  it('leader: refused outside the own Chapter; member refused; nothing changes', async () => {
    const forbidden = { code: 'SCOPE_FORBIDDEN', status: 403 }
    for (const actor of [LEADER, MEMBER]) {
      expect(
        await refusal(reviewMembership(actor, ORG, M.hidden!, { status: 'ACTIVE' }, rid())),
      ).toEqual(forbidden)
      expect(
        await refusal(
          createLeadership(actor, ORG, { profile_id: P.hidden!.profileId, title: 'X' }, rid()),
        ),
      ).toEqual(forbidden)
      expect(await refusal(getMemberDetail(actor, ORG, P.hidden!.profileId))).toEqual(forbidden)
    }
    expect(
      await refusal(reviewMembership(LEADER, CHAPTER_02, M.hidden!, { status: 'ACTIVE' }, rid())),
    ).toEqual(forbidden)
    expect(
      await refusal(reviewMembership(MEMBER, CHAPTER_01, M.hidden!, { status: 'ACTIVE' }, rid())),
    ).toEqual(forbidden)
    // The leader's own Chapter does not reach a membership of another organization.
    expect(
      await refusal(reviewMembership(LEADER, CHAPTER_01, M.hidden!, { status: 'ACTIVE' }, rid())),
    ).toMatchObject({
      status: 404,
    })
    expect(await audits(M.hidden!)).toEqual([])
    expect((await row('community_memberships', M.hidden!)).state).toBe('PENDING_APPROVAL')
  })
})
