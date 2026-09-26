import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { closePool, query, withTransaction } from '@/lib/db/client'

import { listRequestableOrganizations, requestMembership } from './membership-request'
import { getOwnNetwork } from './network'

/**
 * WF02-S04 — membership request against live PostgreSQL
 * (DEC-WF02-S04-G1..G4).
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'

const createdOrgs: string[] = []

afterAll(async () => {
  // Test organisations never have memberships; remove them so dev lists stay clean.
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [createdOrgs])
  await closePool()
})

async function member(): Promise<{ accountId: string; profileId: string }> {
  const email = `mreq-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status) VALUES ($1, 'Req', 'ACTIVE') RETURNING id::text`,
    [a!.id],
  )
  return { accountId: a!.id, profileId: p!.id }
}

async function org(type: string, status: string): Promise<string> {
  const slug = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [row] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ($1::org_type, $2, $3, $4::publication_status) RETURNING id::text`,
    [type, slug, `Test ${type} ${status}`, status],
  )
  createdOrgs.push(row!.id)
  return row!.id
}

const request = (accountId: string, organizationId: unknown, rid = 'req-test') =>
  withTransaction((exec) =>
    requestMembership(exec, accountId, { organization_id: organizationId }, rid),
  )

async function refusal(promise: Promise<unknown>): Promise<{ code: string; status: number }> {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status }
    throw error
  }
  throw new Error('expected a refusal')
}

const rows = (profileId: string, orgId: string) =>
  query<{ state: string; source: string }>(
    `SELECT state::text AS state, source FROM community_memberships
      WHERE profile_id = $1 AND organization_id = $2 ORDER BY created_at, id`,
    [profileId, orgId],
  )

const audits = async (accountId: string) =>
  (
    await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'MEMBERSHIP_REQUESTED'`,
      [accountId],
    )
  )[0]!.n

describe('membership request (WF02-S04)', () => {
  it('creates PENDING_APPROVAL / SELF_DECLARED, audits once, grants nothing', async () => {
    const m = await member()
    const before = await resolveActor(m.accountId)
    const { status, body } = await request(m.accountId, CHAPTER_01)
    expect(status).toBe(201)
    expect(body).toMatchObject({
      organization: { id: CHAPTER_01, type: 'CHAPTER' },
      status: 'PENDING_APPROVAL',
      source_type: 'SELF_DECLARED',
      valid_from: null,
    })
    expect(await rows(m.profileId, CHAPTER_01)).toEqual([
      { state: 'PENDING_APPROVAL', source: 'SELF_DECLARED' },
    ])
    expect(await audits(m.accountId)).toBe(1)
    const [audit] = await query<{ after_data: unknown; resource_type: string }>(
      `SELECT after_data, resource_type FROM audit_events WHERE actor_account_id = $1 AND action = 'MEMBERSHIP_REQUESTED'`,
      [m.accountId],
    )
    expect(audit).toEqual({
      resource_type: 'community_membership',
      after_data: { organization_id: CHAPTER_01, state: 'PENDING_APPROVAL' },
    })
    // No leadership, RoleAssignment, capability or managed scope.
    const counts = await query<{ l: number; r: number }>(
      `SELECT (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS l,
              (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id = $1) AS r`,
      [m.profileId],
    )
    expect(counts[0]).toEqual({ l: 0, r: 0 })
    const after = await resolveActor(m.accountId)
    expect(deriveCapabilities(after)).toEqual(deriveCapabilities(before))
    expect(deriveCapabilities(after)).toEqual([])
    expect(deriveManagedScopes(after)).toEqual([])
    // The read model shows the pending state.
    expect((await getOwnNetwork(m.accountId)).memberships.map((x) => x.status)).toEqual([
      'PENDING_APPROVAL',
    ])
  })

  for (const state of ['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'ALUMNI']) {
    it(`G4: an existing ${state} membership refuses a new request (409, nothing written)`, async () => {
      const m = await member()
      await query(
        `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, $3, 'ORGANIZATION_VERIFIED')`,
        [m.profileId, CHAPTER_01, state],
      )
      expect(await refusal(request(m.accountId, CHAPTER_01))).toEqual({
        code: 'MEMBERSHIP_INVALID_TRANSITION',
        status: 409,
      })
      expect(await rows(m.profileId, CHAPTER_01)).toHaveLength(1)
      expect(await audits(m.accountId)).toBe(0)
    })
  }

  for (const state of ['REJECTED', 'WITHDRAWN']) {
    it(`G4: after ${state} a new PENDING_APPROVAL record is created; history kept`, async () => {
      const m = await member()
      await query(
        `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, $3, 'SELF_DECLARED')`,
        [m.profileId, CHAPTER_01, state],
      )
      expect((await request(m.accountId, CHAPTER_01)).status).toBe(201)
      expect((await rows(m.profileId, CHAPTER_01)).map((r) => r.state)).toEqual([
        state,
        'PENDING_APPROVAL',
      ])
    })
  }

  it('a membership in another organisation does not block', async () => {
    const m = await member()
    await request(m.accountId, CHAPTER_01)
    expect((await request(m.accountId, CHAPTER_02)).status).toBe(201)
  })

  it('concurrent duplicate requests create exactly one record', async () => {
    const m = await member()
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => request(m.accountId, CHAPTER_02, `c${i}`)),
    )
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    for (const r of results) {
      if (r.status === 'rejected')
        expect((r.reason as { code: string }).code).toBe('MEMBERSHIP_INVALID_TRANSITION')
    }
    expect(await rows(m.profileId, CHAPTER_02)).toHaveLength(1)
    expect(await audits(m.accountId)).toBe(1)
  })

  it('G1: unknown, malformed, unpublished and non-requestable organisations are 404', async () => {
    const m = await member()
    const draft = await org('CHAPTER', 'DRAFT')
    const archived = await org('CLB', 'ARCHIVED')
    const company = await org('COMPANY', 'PUBLISHED')
    for (const target of [
      '00000000-0000-0000-0000-000000000000',
      'not-a-uuid',
      42,
      null,
      draft,
      archived,
      company,
    ]) {
      expect(await refusal(request(m.accountId, target)), String(target)).toEqual({
        code: 'UNCONTRACTED_NOT_FOUND',
        status: 404,
      })
    }
    expect(await audits(m.accountId)).toBe(0)
  })

  it('G1: the option list uses the same predicate', async () => {
    const draft = await org('CHAPTER', 'DRAFT')
    const company = await org('COMPANY', 'PUBLISHED')
    const published = await org('CLB', 'PUBLISHED')
    const ids = (await listRequestableOrganizations()).map((o) => o.id)
    expect(ids).toContain(CHAPTER_01)
    expect(ids).toContain(published)
    expect(ids).not.toContain(draft)
    expect(ids).not.toContain(company)
    for (const o of await listRequestableOrganizations()) {
      expect(['HUB', 'CHAPTER', 'CLB']).toContain(o.type)
      expect(Object.keys(o).sort()).toEqual(['id', 'name', 'type'])
    }
  })

  it('body identifiers other than organization_id are ignored', async () => {
    const a = await member()
    const b = await member()
    const { body } = await withTransaction((exec) =>
      requestMembership(
        exec,
        a.accountId,
        {
          organization_id: CHAPTER_01,
          profile_id: b.profileId,
          account_id: b.accountId,
          state: 'ACTIVE',
        },
        'r',
      ),
    )
    expect(body.status).toBe('PENDING_APPROVAL')
    expect(await rows(a.profileId, CHAPTER_01)).toHaveLength(1)
    expect(await rows(b.profileId, CHAPTER_01)).toHaveLength(0)
  })
})
