import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { closePool, query } from '@/lib/db/client'
import { listOrganizationEvents } from '@/lib/ops/events'
import { hasOpsAccess } from '@/lib/ops/scope'

import { getProgramme, listProgrammes, programmeOwnerOptions } from './programme'

/**
 * WF04-PROD-04 — the WF04 read path against live PostgreSQL (rewritten from the
 * T00 demo read-model test, contract §17): canonical rows only, exact
 * `programme:read` scope, labels and relations grant nothing, no fixture is
 * readable, and reading writes nothing.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const SEED_CHALLENGE = 'c0000000-0000-0000-0000-000000000001' // DRAFT, Chapter 01
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001' // PUBLISHED, Chapter 01
const DEMO_FIXTURE_CHALLENGE = 'd4000000-0000-0000-0000-000000000002' // fixture only, no row
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
  const email = `wf04-read-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 read', 'ACTIVE', now(), now()) RETURNING id::text`,
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
            (SELECT count(*) FROM programme_application_forms)::text AS forms,
            (SELECT count(*) FROM events)::text AS events,
            (SELECT count(*) FROM audit_events)::text AS audit,
            (SELECT count(*) FROM analytics_events)::text AS analytics,
            (SELECT count(*) FROM role_assignments)::text AS roles`,
  )
  return row
}

describe('WF04-PROD-04 canonical reads (programme:read, exact organization)', () => {
  it('PLATFORM_ADMIN and the Chapter 01 leader read the canonical Chapter 01 rows', async () => {
    for (const account of [ADMIN, LEADER]) {
      const items = await listProgrammes(account)
      expect(items.map((i) => i.id)).toEqual(
        expect.arrayContaining([SEED_PROGRAMME, SEED_CHALLENGE]),
      )
      const detail = await getProgramme(account, SEED_CHALLENGE)
      expect(detail.organization).toEqual({
        id: CHAPTER_01,
        slug: 'chapter-01',
        name: 'Chapter 01',
        type: 'CHAPTER',
      })
      expect(detail.events.every((e) => e.programme_id === SEED_CHALLENGE)).toBe(true)
    }
  })

  it('an ordinary member is denied: 403 on the list, 404 on a detail', async () => {
    expect(await refusal(listProgrammes(MEMBER))).toEqual({ code: 'SCOPE_FORBIDDEN', status: 403 })
    expect(await refusal(getProgramme(MEMBER, SEED_PROGRAMME))).toMatchObject({ status: 404 })
  })

  it('a leader of another organization sees no Chapter 01 programme (404, not listed)', async () => {
    const { account } = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    const listed = await listProgrammes(account)
    expect(listed.some((p) => p.organization.id === CHAPTER_01)).toBe(false)
    for (const id of [SEED_PROGRAMME, SEED_CHALLENGE])
      expect(await refusal(getProgramme(account, id))).toMatchObject({ status: 404 })
  })

  it('PROGRAMME_ORGANIZER (any scope), membership, leadership and titles grant nothing', async () => {
    const labelled = [
      await person({
        code: 'PROGRAMME_ORGANIZER',
        scopeType: 'PROGRAMME',
        scopeId: SEED_PROGRAMME,
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
      expect(await refusal(listProgrammes(account))).toMatchObject({ status: 403 })
      expect(await refusal(getProgramme(account, SEED_CHALLENGE))).toMatchObject({ status: 404 })
      expect(await programmeOwnerOptions(account)).toEqual([])
    }
  })

  it('unknown, fixture-only and malformed ids are the same 404: nothing falls back to a fixture', async () => {
    for (const id of [
      DEMO_FIXTURE_CHALLENGE,
      'd4000000-0000-0000-0000-000000000099',
      'not-a-uuid',
      '',
    ])
      expect(await refusal(getProgramme(ADMIN, id))).toMatchObject({ status: 404 })
  })
})

describe('WF04-PROD-04 owner options (DEC-WF04-S02-D2, DEC-W4P-D13)', () => {
  it('admin: every active HUB / CHAPTER / CLB by name; leader: exactly its organization; member: none', async () => {
    const ops = await query<{ id: string }>(
      `SELECT id::text FROM organizations
        WHERE type::text IN ('HUB', 'CHAPTER', 'CLB') AND status::text <> 'ARCHIVED' ORDER BY name, id`,
    )
    expect((await programmeOwnerOptions(ADMIN)).map((o) => o.id)).toEqual(ops.map((o) => o.id))
    expect(await programmeOwnerOptions(LEADER)).toEqual([
      { id: CHAPTER_01, slug: 'chapter-01', name: 'Chapter 01', type: 'CHAPTER' },
    ])
    expect(await programmeOwnerOptions(MEMBER)).toEqual([])
    const { account } = await person({
      code: 'HUB_COMMUNITY_LEADER',
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    })
    expect((await programmeOwnerOptions(account)).map((o) => o.id)).toEqual([CHAPTER_02])
  })
})

describe('WF04-PROD-04 read boundaries', () => {
  it('reading writes nothing: programmes, forms, events, audit, analytics, roles unchanged', async () => {
    const before = await snapshot()
    await listProgrammes(ADMIN)
    await listProgrammes(LEADER)
    await getProgramme(ADMIN, SEED_PROGRAMME)
    await getProgramme(LEADER, SEED_CHALLENGE)
    await programmeOwnerOptions(LEADER)
    expect(await snapshot()).toEqual(before)
  })

  it('WF03 standalone events stay programme_id NULL; no fixture event is a row', async () => {
    const [fixtureRows] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events WHERE programme_id::text LIKE 'd4000000-0000-0000-0000-00000000000_'
         AND programme_id <> $1`,
      [SEED_PROGRAMME],
    )
    expect(fixtureRows!.n).toBe(0)
    const standalone = await listOrganizationEvents(ADMIN, CHAPTER_01)
    const [linked] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events WHERE programme_id IS NOT NULL AND id = ANY($1::uuid[])`,
      [standalone.map((e) => e.id)],
    )
    expect(linked!.n).toBe(0)
  })

  it('the detail never carries account, email or session data', async () => {
    const text = JSON.stringify(await getProgramme(ADMIN, SEED_PROGRAMME))
    expect(text).not.toMatch(/@|account|session|token|cookie|30000000-/i)
  })
})
