import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { closePool, query } from '@/lib/db/client'
import { listOrganizationEvents } from '@/lib/ops/events'
import { hasOpsAccess } from '@/lib/ops/scope'

import { DEMO_CHALLENGE_ID, DEMO_PROGRAMME_ID } from './fixtures'
import { demoAccess, demoOwnerOptions, getDemoProgramme, listDemoProgrammes } from './read-model'

/**
 * WF04-T00 — the demo read model against live PostgreSQL (DEC-WF04-H2,
 * DEC-WF04-T00-D2): exact `programme:read` scope, labels and relations grant
 * nothing, and reading writes nothing.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const MEMBER = '30000000-0000-0000-0000-000000000001'
const LEADER = '30000000-0000-0000-0000-000000000002' // HUB_COMMUNITY_LEADER on Chapter 01
const ADMIN = '30000000-0000-0000-0000-000000000003' // PLATFORM_ADMIN

const accounts: string[] = []
const people: string[] = []

afterAll(async () => {
  for (const table of ['community_memberships', 'leadership_records']) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [people])
  }
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    people,
  ])
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [people])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
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

/** A completed person; `role` adds one RoleAssignment row as given (valid or not). */
async function person(role?: { code: string; scopeType: string; scopeId: string | null }) {
  const email = `wf04-t00-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 T00', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  accounts.push(a!.id)
  people.push(p!.id)
  if (role) {
    await query(
      `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [p!.id, role.code, role.scopeType, role.scopeId],
    )
  }
  return { account: a!.id, profile: p!.id }
}

async function snapshot() {
  const [row] = await query<Record<string, string>>(
    `SELECT (SELECT count(*) FROM programmes)::text AS programmes,
            (SELECT max(updated_at)::text FROM programmes) AS programmes_at,
            (SELECT count(*) FROM events)::text AS events,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            (SELECT count(*) FROM role_assignments)::text AS roles`,
  )
  return row
}

describe('WF04-T00 demo scope (programme:read, exact organization)', () => {
  it('PLATFORM_ADMIN reads both fixtures; the Chapter 01 leader reads both (owner Chapter 01)', async () => {
    for (const account of [ADMIN, LEADER]) {
      const items = await listDemoProgrammes(account)
      expect(items.map((i) => [i.id, i.type, i.organization.id, i.demo])).toEqual([
        [DEMO_PROGRAMME_ID, 'PROGRAMME', CHAPTER_01, true],
        [DEMO_CHALLENGE_ID, 'CHALLENGE', CHAPTER_01, true],
      ])
      const detail = await getDemoProgramme(account, DEMO_CHALLENGE_ID)
      expect(detail.organization).toEqual({
        id: CHAPTER_01,
        slug: 'chapter-01',
        name: 'Chapter 01',
        type: 'CHAPTER',
      })
      expect(detail.events.every((e) => e.programme_id === DEMO_CHALLENGE_ID)).toBe(true)
    }
    expect((await demoAccess(ADMIN))!.allowance).toBe('ALL')
    expect((await demoAccess(LEADER))!.allowance).toEqual([CHAPTER_01])
  })

  it('an ordinary member is denied: 403 on the list, 404 on a detail, no demo access', async () => {
    expect(await refusal(listDemoProgrammes(MEMBER))).toEqual({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
    expect(await refusal(getDemoProgramme(MEMBER, DEMO_PROGRAMME_ID))).toMatchObject({
      status: 404,
    })
    expect(await demoAccess(MEMBER)).toBeNull()
  })

  it('a leader of another organization sees no Chapter 01 fixture (404, empty list)', async () => {
    const { account } = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    expect(await listDemoProgrammes(account)).toEqual([])
    for (const id of [DEMO_PROGRAMME_ID, DEMO_CHALLENGE_ID])
      expect(await refusal(getDemoProgramme(account, id))).toMatchObject({ status: 404 })
    expect((await demoAccess(account))!.allowance).toEqual([CHAPTER_02])
  })

  it('PROGRAMME_ORGANIZER (any scope), membership, leadership and titles grant nothing', async () => {
    const labelled = [
      await person({
        code: 'PROGRAMME_ORGANIZER',
        scopeType: 'PROGRAMME',
        scopeId: DEMO_PROGRAMME_ID,
      }),
      await person({ code: 'PROGRAMME_ORGANIZER', scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 }),
      await person({ code: 'PROGRAMME_ORGANIZER', scopeType: 'PLATFORM', scopeId: null }),
    ]
    const related = await person({
      code: 'HUB_MEMBER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_01,
    })
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED')`,
      [related.profile, CHAPTER_01],
    )
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'PROGRAMME_ORGANIZER', 'ACTIVE')`,
      [related.profile, CHAPTER_01],
    )
    for (const { account } of [...labelled, related]) {
      expect(hasOpsAccess(await resolveActor(account))).toBe(false)
      expect(await demoAccess(account)).toBeNull()
      expect(await refusal(listDemoProgrammes(account))).toMatchObject({ status: 403 })
      expect(await refusal(getDemoProgramme(account, DEMO_CHALLENGE_ID))).toMatchObject({
        status: 404,
      })
    }
  })

  it('unknown, non-demo and malformed ids are the same 404', async () => {
    for (const id of [
      '60000000-0000-0000-0000-000000000001', // the seed programme row: not demo
      'd4000000-0000-0000-0000-000000000099',
      'not-a-uuid',
      '',
    ])
      expect(await refusal(getDemoProgramme(ADMIN, id))).toMatchObject({ status: 404 })
  })
})

describe('WF04-S02 owner options (DEC-WF04-S02-D2)', () => {
  it('admin: every HUB / CHAPTER / CLB by name; leader: exactly its organization; member: none', async () => {
    const ops = await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE type::text IN ('HUB', 'CHAPTER', 'CLB') ORDER BY name, id`,
    )
    expect((await demoOwnerOptions(ADMIN)).map((o) => o.id)).toEqual(ops.map((o) => o.id))
    expect(await demoOwnerOptions(LEADER)).toEqual([
      { id: CHAPTER_01, slug: 'chapter-01', name: 'Chapter 01', type: 'CHAPTER' },
    ])
    expect(await demoOwnerOptions(MEMBER)).toEqual([])
    const { account } = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    expect((await demoOwnerOptions(account)).map((o) => o.id)).toEqual([CHAPTER_02])
    const labelled = await person({
      code: 'PROGRAMME_ORGANIZER',
      scopeType: 'PLATFORM',
      scopeId: null,
    })
    expect(await demoOwnerOptions(labelled.account)).toEqual([])
  })
})

describe('WF04-T00 boundaries', () => {
  it('reading the demo writes nothing: programmes, events, audit, analytics, roles unchanged', async () => {
    const before = await snapshot()
    await listDemoProgrammes(ADMIN)
    await listDemoProgrammes(LEADER)
    await getDemoProgramme(ADMIN, DEMO_PROGRAMME_ID)
    await getDemoProgramme(LEADER, DEMO_CHALLENGE_ID)
    await demoAccess(LEADER)
    expect(await snapshot()).toEqual(before)
  })

  it('fixture events are not rows; WF03 standalone events stay programme_id NULL', async () => {
    const [demoRows] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events WHERE id::text LIKE 'd40%' OR programme_id::text LIKE 'd40%'`,
    )
    expect(demoRows!.n).toBe(0)
    const standalone = await listOrganizationEvents(ADMIN, CHAPTER_01)
    expect(standalone.some((e) => e.id.startsWith('d40'))).toBe(false)
    const [linked] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events WHERE programme_id IS NOT NULL AND id = ANY($1::uuid[])`,
      [standalone.map((e) => e.id)],
    )
    expect(linked!.n).toBe(0)
  })

  it('the demo detail never carries account, email or session data', async () => {
    const text = JSON.stringify(await getDemoProgramme(ADMIN, DEMO_PROGRAMME_ID))
    expect(text).not.toMatch(/@|account|session|token|cookie|30000000-/i)
  })
})
