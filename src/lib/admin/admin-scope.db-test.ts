import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { can } from '@/lib/authz/authorize'
import { CAPABILITIES, ruleFor, type Capability } from '@/lib/authz/matrix'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { closePool, databaseUrl, query } from '@/lib/db/client'
import { organizationScope } from '@/lib/ops/scope'

import { mayExecuteAccountAction } from './account-actions'
import { delegationSourceFor, grantAccess, revokeAccess } from './delegation'
import { ancestorChain, fallbackChain, isDescendant, isDirectChild } from './hierarchy'
import { delegationReach, holdsAt, holdsPlatform } from './scope'
import { ADM_FX, ADM_PEOPLE, clearAdminFixture, insertGrant, seedAdminFixture } from './testing'
import { canHandleVerification, verificationQueueScope } from './verification'

/**
 * ADMIN-PROD-02 — server-side scope, delegation and the security matrix of the
 * task (§20), on live PostgreSQL. Authority comes only from the database; every
 * "client" input below is a resource id the caller names, never a role or scope.
 */

const O = ADM_FX.org
const P = ADM_PEOPLE
const actor = (key: keyof typeof P) => resolveActor(P[key].account)
const ORG_CAPS = CAPABILITIES.filter((c) => ruleFor(c)!.organizationRoles.length > 0)

async function failure(promise: Promise<unknown>): Promise<{ status: number; code: string }> {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code }
    throw error
  }
  throw new Error('accepted')
}

async function auditCount(): Promise<number> {
  const [row] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id::text LIKE 'ad020000-%'`,
  )
  return row!.n
}

const grant = (
  who: keyof typeof P,
  org: string,
  grantee: keyof typeof P,
  capability: string | null,
) =>
  grantAccess(
    P[who].account,
    { organizationId: org, granteeProfileId: P[grantee].profile, capability },
    'adm02-test',
  )

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

afterAll(async () => {
  await clearAdminFixture()
  await closePool()
})

beforeEach(async () => {
  // Each test starts from the fixture's grants only.
  await query(
    `DELETE FROM role_assignments WHERE individual_profile_id::text LIKE 'ad020000-%' AND
       (capability IS NOT NULL OR assigned_by IS NOT NULL)`,
  )
  await query(
    `UPDATE role_assignments SET state = 'ACTIVE', valid_to = NULL
      WHERE individual_profile_id::text LIKE 'ad020000-%'`,
  )
})

describe('hierarchy helpers on the canonical relationships', () => {
  it('walks CLB → Chapter → HUB Tổng and nothing else', async () => {
    expect(await ancestorChain(query, O.CLB_A1)).toEqual([O.CLB_A1, O.CH_A, O.HUB])
    expect(await fallbackChain(query, O.CLB_B1)).toEqual([O.CLB_B1, O.CH_B, O.HUB])
    expect(await fallbackChain(query, O.HUB)).toEqual([O.HUB])
    expect(await isDescendant(query, O.HUB, O.CLB_A2)).toBe(true)
    expect(await isDescendant(query, O.CH_A, O.CLB_B1)).toBe(false)
    expect(await isDescendant(query, O.CLB_A1, O.CH_A)).toBe(false)
    expect(await isDescendant(query, O.CH_A, O.CH_A)).toBe(false)
    expect(await isDirectChild(query, O.HUB, O.CH_A)).toBe(true)
    expect(await isDirectChild(query, O.HUB, O.CLB_A1)).toBe(false)
    expect(await ancestorChain(query, 'not-a-uuid')).toEqual([])
  })
})

describe('§20 PLATFORM_ADMIN — full scope', () => {
  it('holds every capability platform-wide, the five platform-only ones included', async () => {
    const admin = await actor('admin')
    for (const c of CAPABILITIES) expect(holdsPlatform(admin, c), c).toBe(true)
    expect(deriveCapabilities(admin)).toEqual([...CAPABILITIES].sort())
    expect(await delegationReach(query, admin)).toEqual({ kind: 'ALL' })
    expect(verificationQueueScope(admin)).toEqual({ kind: 'ALL' })
    expect(mayExecuteAccountAction(admin)).toBe(true)
    expect(
      canHandleVerification(admin, {
        routedToOrgId: O.CLB_B1,
        requesterProfileId: P.memberC.profile,
      }),
    ).toBe(true)
  })

  it('may grant on any community unit, never a platform role', async () => {
    const record = await grant('admin', O.CLB_B1, 'memberA', 'verification:review')
    expect(record).toMatchObject({ organization_id: O.CLB_B1, capability: 'verification:review' })
    expect(
      await failure(grant('admin', '00000000-0000-4000-8000-000000000000', 'memberA', null)),
    ).toEqual({ status: 404, code: 'UNCONTRACTED_NOT_FOUND' })
    expect(await failure(grant('admin', O.HUB, 'memberA', 'venture:review'))).toEqual({
      status: 422,
      code: 'PROFILE_VALIDATION_FAILED',
    })
  })
})

describe('§20 leader scopes — authority exact, reach one level down', () => {
  it('HUB leader: acts on HUB Tổng only; reaches HUB Tổng and its Chapters', async () => {
    const hub = await actor('hubLeader')
    expect(holdsAt(hub, 'membership:confirm', O.HUB)).toBe(true)
    // No inheritance (DL:764): the Chapter is not the HUB leader's to act on.
    expect(holdsAt(hub, 'membership:confirm', O.CH_A)).toBe(false)
    expect(
      await can(hub, 'verification:review', { scopeType: 'ORGANIZATION', scopeId: O.CH_A }),
    ).toBe(false)
    expect(await delegationReach(query, hub)).toEqual({
      kind: 'SOME',
      organizationIds: [O.HUB, O.CH_A, O.CH_B].sort(),
    })
    expect(await grant('hubLeader', O.CH_A, 'memberA', 'member:read')).toMatchObject({
      organization_id: O.CH_A,
    })
  })

  it('Chapter leader: reaches its own CLBs, receives their fallback', async () => {
    const chA = await actor('chALeader')
    expect(await delegationReach(query, chA)).toEqual({
      kind: 'SOME',
      organizationIds: [O.CH_A, O.CLB_A1, O.CLB_A2, O.CLB_ARCHIVED].sort(),
    })
    expect(await grant('chALeader', O.CLB_A2, 'memberA', 'verification:review')).toMatchObject({
      organization_id: O.CLB_A2,
    })
    expect(await grant('chALeader', O.CLB_A1, 'memberB', null)).toMatchObject({
      role_code: 'HUB_COMMUNITY_LEADER',
      capability: null,
    })
    expect(
      canHandleVerification(chA, { routedToOrgId: O.CH_A, requesterProfileId: P.memberC.profile }),
    ).toBe(true)
    expect(
      canHandleVerification(chA, {
        routedToOrgId: O.CLB_A2,
        requesterProfileId: P.memberC.profile,
      }),
    ).toBe(false)
  })

  it('CLB leader: its own CLB only', async () => {
    const clb = await actor('clbA1Leader')
    expect(await delegationReach(query, clb)).toEqual({ kind: 'SOME', organizationIds: [O.CLB_A1] })
    expect(await grant('clbA1Leader', O.CLB_A1, 'memberA', 'event:manage')).toMatchObject({
      organization_id: O.CLB_A1,
    })
    expect(await failure(grant('clbA1Leader', O.CLB_A2, 'memberA', 'event:manage'))).toEqual({
      status: 403,
      code: 'SCOPE_FORBIDDEN',
    })
  })
})

describe('§20 denials', () => {
  it('cross-branch: Chapter A cannot reach Chapter B or its CLB', async () => {
    const before = await auditCount()
    for (const target of [O.CH_B, O.CLB_B1]) {
      expect(await failure(grant('chALeader', target, 'memberA', 'member:read'))).toEqual({
        status: 403,
        code: 'SCOPE_FORBIDDEN',
      })
    }
    const chA = await actor('chALeader')
    expect(
      canHandleVerification(chA, { routedToOrgId: O.CH_B, requesterProfileId: P.memberC.profile }),
    ).toBe(false)
    expect(holdsAt(chA, 'member:read', O.CLB_B1)).toBe(false)
    expect(await auditCount()).toBe(before)
  })

  it('upward: a CLB or Chapter leader cannot grant on its parent; HUB not on a grandchild', async () => {
    const cases: Array<[keyof typeof P, string]> = [
      ['clbA1Leader', O.CH_A],
      ['clbA1Leader', O.HUB],
      ['chALeader', O.HUB],
      ['hubLeader', O.CLB_A1],
    ]
    for (const [who, target] of cases) {
      expect(await failure(grant(who, target, 'memberA', null)), `${who}→${target}`).toEqual({
        status: 403,
        code: 'SCOPE_FORBIDDEN',
      })
    }
  })

  it('greater permission: non-delegable capabilities and re-delegation are refused', async () => {
    for (const c of [
      'access:delegate',
      'leadership:manage',
      'org:manage_relationship',
      'network:read',
      'venture:review',
      'account:administer',
      'not:a_capability',
    ]) {
      expect(await failure(grant('chALeader', O.CLB_A1, 'memberA', c)), c).toEqual({
        status: 422,
        code: 'PROFILE_VALIDATION_FAILED',
      })
    }
    // A capability-only grantee holds that capability only and cannot pass anything on.
    await grant('chALeader', O.CH_A, 'memberA', 'member:read')
    const delegated = await actor('memberA')
    expect(holdsAt(delegated, 'member:read', O.CH_A)).toBe(true)
    for (const c of ORG_CAPS.filter((c) => c !== 'member:read'))
      expect(holdsAt(delegated, c, O.CH_A), c).toBe(false)
    expect(await failure(grant('memberA', O.CH_A, 'memberB', 'member:read'))).toEqual({
      status: 403,
      code: 'SCOPE_FORBIDDEN',
    })
    expect(await failure(grant('memberA', O.CLB_A1, 'memberB', null))).toEqual({
      status: 403,
      code: 'SCOPE_FORBIDDEN',
    })
    // A delegated grant never appears as the whole role in the session.
    expect(deriveManagedScopes(delegated)).toEqual([])
    expect(deriveCapabilities(delegated)).toEqual(['member:read'])
  })

  it('client-spoofed scope: a forged or non-delegable stored grant reads as nothing', async () => {
    // Rows written around the service (console, script) still cannot become authority.
    await insertGrant('memberB', O.CH_A, 'access:delegate')
    await insertGrant('memberB', O.CH_A, 'superuser:all')
    const forged = await actor('memberB')
    expect(forged.assignments).toEqual([])
    expect(await delegationSourceFor(query, forged, O.CH_A)).toBeNull()
    expect(await failure(grant('memberB', O.CH_A, 'memberC', 'member:read'))).toEqual({
      status: 403,
      code: 'SCOPE_FORBIDDEN',
    })
    // The named organization is only the resource: a leader naming a foreign
    // unit, an unknown id or a malformed one is refused alike.
    for (const target of [O.CH_B, '00000000-0000-4000-8000-000000000000', 'HUB']) {
      expect(await failure(grant('chALeader', target, 'memberA', null)), target).toEqual({
        status: 403,
        code: 'SCOPE_FORBIDDEN',
      })
    }
  })

  it('revoked, closed or expired grants grant nothing', async () => {
    const record = await grant('chALeader', O.CLB_A2, 'memberC', 'verification:review')
    expect(holdsAt(await actor('memberC'), 'verification:review', O.CLB_A2)).toBe(true)
    const revoked = await revokeAccess(
      P.admin.account,
      { organizationId: O.CLB_A2, grantId: record.id },
      'adm02-test',
    )
    expect(revoked.state).toBe('CLOSED')
    expect(revoked.revoked_at).not.toBeNull()
    expect(holdsAt(await actor('memberC'), 'verification:review', O.CLB_A2)).toBe(false)
    expect(
      await failure(
        revokeAccess(P.admin.account, { organizationId: O.CLB_A2, grantId: record.id }, 't'),
      ),
    ).toEqual({ status: 409, code: 'MEMBERSHIP_INVALID_TRANSITION' })

    await insertGrant('memberC', O.CLB_A2, 'verification:review', {
      validTo: '2020-01-01T00:00:00Z',
    })
    await insertGrant('memberC', O.CLB_A2, 'member:read', { state: 'CLOSED' })
    expect((await actor('memberC')).assignments).toEqual([])
  })
})

describe('delegation lifecycle, revoke authority and audit', () => {
  it('refuses an archived unit, an unavailable grantee and a duplicate', async () => {
    expect(await failure(grant('chALeader', O.CLB_ARCHIVED, 'memberA', null))).toEqual({
      status: 409,
      code: 'MEMBERSHIP_INVALID_TRANSITION',
    })
    for (const grantee of ['blocked', 'deactivated'] as const) {
      expect(await failure(grant('chALeader', O.CLB_A1, grantee, 'member:read'))).toEqual({
        status: 422,
        code: 'PROFILE_VALIDATION_FAILED',
      })
    }
    await grant('chALeader', O.CLB_A1, 'memberA', 'member:read')
    expect(await failure(grant('admin', O.CLB_A1, 'memberA', 'member:read'))).toEqual({
      status: 409,
      code: 'MEMBERSHIP_INVALID_TRANSITION',
    })
  })

  it('ADMIN-DECISION-02: only a current access:delegate holder on exactly the unit, or the admin, revokes', async () => {
    const revoke = (who: keyof typeof P, org: string, grantId: string) =>
      revokeAccess(P[who].account, { organizationId: org, grantId }, 'adm02-test')
    const denied = { status: 403, code: 'SCOPE_FORBIDDEN' }
    // memberB becomes a same-unit co-leader on CH_A (whole role, so access:delegate).
    const coLeader = await grant('chALeader', O.CH_A, 'memberB', null)
    const [g1, g2, g3] = await Promise.all([
      grant('chALeader', O.CH_A, 'memberC', 'member:read'),
      grant('chALeader', O.CH_A, 'memberC', 'event:manage'),
      grant('chALeader', O.CH_A, 'memberA', 'member:read'),
    ])
    // Same unit without the capability: memberA holds member:read there, not access:delegate.
    expect(await failure(revoke('memberA', O.CH_A, g2!.id)), 'no capability').toEqual(denied)
    // Parent, child and sibling units — the hierarchy never qualifies.
    expect(await failure(revoke('hubLeader', O.CH_A, g2!.id)), 'parent').toEqual(denied)
    expect(await failure(revoke('clbA1Leader', O.CH_A, g2!.id)), 'child').toEqual(denied)
    expect(await failure(revoke('chBLeader', O.CH_A, g2!.id)), 'sibling').toEqual(denied)
    // Forged scope: naming a unit the grant is not on, or one the actor holds nothing on.
    expect(await failure(revoke('chBLeader', O.CH_B, g2!.id)), 'forged own unit').toEqual({
      status: 404,
      code: 'UNCONTRACTED_NOT_FOUND',
    })
    expect(await failure(revoke('hubLeader', O.CLB_A1, g2!.id)), 'forged unit').toEqual(denied)
    // A forged stored access:delegate row (non-delegable capability) reads as nothing.
    await insertGrant('memberA', O.CH_A, 'access:delegate')
    expect(await failure(revoke('memberA', O.CH_A, g2!.id)), 'forged capability').toEqual(denied)
    // Same-unit co-leader with the capability: allowed, though not the grantor.
    expect((await revoke('memberB', O.CH_A, g1!.id)).state).toBe('CLOSED')

    // Parent grantor: chALeader granted on its child CLB_A1 but holds nothing there.
    const child = await grant('chALeader', O.CLB_A1, 'memberA', 'org:read')
    expect(await failure(revoke('chALeader', O.CLB_A1, child.id)), 'parent grantor').toEqual(denied)
    expect((await revoke('clbA1Leader', O.CLB_A1, child.id)).state).toBe('CLOSED')

    // Original grantor after losing access:delegate: no historical bypass.
    const own = await grant('memberB', O.CH_A, 'memberA', 'event:manage')
    await revoke('chALeader', O.CH_A, coLeader.id)
    expect(await failure(revoke('memberB', O.CH_A, own.id)), 'lost capability').toEqual(denied)
    expect(await failure(revoke('memberB', O.CH_A, g3!.id)), 'lost capability').toEqual(denied)

    // PLATFORM_ADMIN keeps platform-wide revocation; nothing denied was closed.
    expect((await revoke('admin', O.CH_A, own.id)).state).toBe('CLOSED')
    const open = await query<{ id: string }>(
      `SELECT id::text FROM role_assignments WHERE id = ANY($1::uuid[]) AND state = 'ACTIVE'`,
      [[g2!.id, g3!.id]],
    )
    expect(open.map((r) => r.id).sort()).toEqual([g2!.id, g3!.id].sort())
    // A refused revocation writes no audit; each success writes one.
    const audits = await query<{ action: string; resource_id: string }>(
      `SELECT action, resource_id::text FROM audit_events
        WHERE action = 'ACCESS_REVOKED' AND resource_id = ANY($1::uuid[])`,
      [[g1!.id, g2!.id, g3!.id, child.id, own.id, coLeader.id]],
    )
    expect(audits.map((r) => r.resource_id).sort()).toEqual(
      [g1!.id, child.id, own.id, coLeader.id].sort(),
    )
    // A grant id read through another unit is not found there.
    expect(await failure(revoke('admin', O.CLB_A2, g2!.id))).toEqual({
      status: 404,
      code: 'UNCONTRACTED_NOT_FOUND',
    })
  })

  it('ADMIN-DECISION-02: two co-leaders revoking each other at once — exactly one wins, no deadlock', async () => {
    const b = await grant('chALeader', O.CH_A, 'memberB', null)
    const [chA] = await query<{ id: string }>(
      `SELECT id::text FROM role_assignments WHERE individual_profile_id = $1 AND scope_id = $2
          AND capability IS NULL AND state = 'ACTIVE'`,
      [P.chALeader.profile, O.CH_A],
    )
    const race = await Promise.allSettled([
      revokeAccess(P.chALeader.account, { organizationId: O.CH_A, grantId: b.id }, 't'),
      revokeAccess(P.memberB.account, { organizationId: O.CH_A, grantId: chA!.id }, 't'),
    ])
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const lost = race.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(lost.reason).toMatchObject({ status: 403, code: 'SCOPE_FORBIDDEN' })
  })

  it('ADMIN-DECISION-02: grant reach is unchanged (own unit and direct children only)', async () => {
    expect((await grant('hubLeader', O.CH_A, 'memberA', 'member:read')).state).toBe('ACTIVE')
    expect((await grant('chALeader', O.CLB_A1, 'memberB', 'member:read')).state).toBe('ACTIVE')
    expect((await grant('clbA1Leader', O.CLB_A1, 'memberC', 'member:read')).state).toBe('ACTIVE')
    for (const [who, org] of [
      ['chALeader', O.HUB],
      ['chALeader', O.CH_B],
      ['clbA1Leader', O.CLB_A2],
      ['clbA1Leader', O.CH_A],
      ['hubLeader', O.CLB_A1],
    ] as const) {
      expect(await failure(grant(who, org, 'memberA', 'org:read')), `${who}→${org}`).toEqual({
        status: 403,
        code: 'SCOPE_FORBIDDEN',
      })
    }
    // Never beyond what the grantor holds: platform-only and non-delegable are refused.
    for (const capability of ['venture:review', 'access:delegate', 'account:escalate']) {
      expect(
        (await failure(grant('chALeader', O.CH_A, 'memberA', capability))).status,
        capability,
      ).toBeGreaterThanOrEqual(403)
    }
  })

  it('audits every grant and revoke with grantor, grantee, capability and scope only', async () => {
    const record = await grant('chALeader', O.CLB_A2, 'memberA', 'verification:review')
    await revokeAccess(
      P.admin.account,
      { organizationId: O.CLB_A2, grantId: record.id },
      'adm02-audit',
    )
    const rows = await query<{
      action: string
      actor: string
      resource_type: string
      before_data: Record<string, unknown> | null
      after_data: Record<string, unknown>
    }>(
      `SELECT action, actor_account_id::text AS actor, resource_type, before_data, after_data
         FROM audit_events WHERE resource_id = $1 ORDER BY created_at`,
      [record.id],
    )
    expect(rows.map((r) => [r.action, r.actor])).toEqual([
      ['ACCESS_GRANTED', P.chALeader.account],
      ['ACCESS_REVOKED', P.admin.account],
    ])
    expect(rows[0]!.after_data).toEqual({
      state: 'ACTIVE',
      grantee_profile_id: P.memberA.profile,
      grantor_profile_id: P.chALeader.profile,
      role_code: 'HUB_COMMUNITY_LEADER',
      capability: 'verification:review',
      source: O.CH_A,
      organization_id: O.CLB_A2,
    })
    expect(rows[1]!.before_data).toEqual({ state: 'ACTIVE' })
    expect(rows[1]!.after_data).toMatchObject({ state: 'CLOSED', organization_id: O.CLB_A2 })
    const text = JSON.stringify(rows)
    expect(text).not.toContain('@example.test')
    expect(text).not.toContain('ADM02 ')
  })
})

describe('review hardening (independent security review)', () => {
  it('refuses a self-grant, so authority cannot chain down to a grandchild', async () => {
    const self = (who: keyof typeof P, org: string) =>
      grantAccess(
        P[who].account,
        { organizationId: org, granteeProfileId: P[who].profile, capability: null },
        'adm02-test',
      )
    for (const [who, org] of [
      ['hubLeader', O.CH_A],
      ['chALeader', O.CLB_A1],
      ['admin', O.CLB_B1],
    ] as const) {
      expect(await failure(self(who, org)), `${who}→${org}`).toEqual({
        status: 422,
        code: 'PROFILE_VALIDATION_FAILED',
      })
    }
    expect(holdsAt(await actor('hubLeader'), 'member:read', O.CLB_A1)).toBe(false)
  })

  it('refuses a grant from an ARCHIVED source unit (read-only)', async () => {
    await query(`UPDATE organizations SET status = 'ARCHIVED' WHERE id = $1`, [O.CH_B])
    try {
      expect(await failure(grant('chBLeader', O.CLB_B1, 'memberA', 'member:read'))).toEqual({
        status: 409,
        code: 'MEMBERSHIP_INVALID_TRANSITION',
      })
    } finally {
      await query(`UPDATE organizations SET status = 'PUBLISHED' WHERE id = $1`, [O.CH_B])
    }
  })

  it('refuses a grant when the grantor’s authority is revoked concurrently', async () => {
    const other = new Client({ connectionString: databaseUrl() })
    await other.connect()
    try {
      await other.query('BEGIN')
      await other.query(
        `UPDATE role_assignments SET state = 'CLOSED', valid_to = now()
          WHERE individual_profile_id = $1 AND scope_id = $2`,
        [P.chALeader.profile, O.CH_A],
      )
      // The grant resolves the actor before the revocation commits, then waits on
      // the locked source assignment and re-reads it.
      const pending = failure(grant('chALeader', O.CLB_A1, 'memberA', 'member:read'))
      await new Promise((resolve) => setTimeout(resolve, 300))
      await other.query('COMMIT')
      expect(await pending).toEqual({ status: 403, code: 'SCOPE_FORBIDDEN' })
    } finally {
      await other.end()
    }
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_assignments WHERE individual_profile_id = $1`,
      [P.memberA.profile],
    )
    expect(n!.n).toBe(0)
  })

  it('answers a malformed unit id with 403, never a server error, for every actor', async () => {
    for (const who of ['admin', 'chALeader'] as const) {
      expect(await failure(grant(who, 'not-a-uuid', 'memberA', null)), who).toEqual({
        status: 403,
        code: 'SCOPE_FORBIDDEN',
      })
    }
  })

  it('never lets anyone handle their own verification request', async () => {
    const admin = await actor('admin')
    const clb = await actor('clbA1Leader')
    expect(
      canHandleVerification(admin, { routedToOrgId: O.HUB, requesterProfileId: P.admin.profile }),
    ).toBe(false)
    expect(
      canHandleVerification(clb, {
        routedToOrgId: O.CLB_A1,
        requesterProfileId: P.clbA1Leader.profile,
      }),
    ).toBe(false)
    expect(
      canHandleVerification(clb, {
        routedToOrgId: O.CLB_A1,
        requesterProfileId: P.memberA.profile,
      }),
    ).toBe(true)
  })
})

describe('existing capabilities keep their meaning', () => {
  it('a whole-role leader holds the organization capabilities, none of the platform ones', async () => {
    const chA = await actor('chALeader')
    expect(deriveCapabilities(chA)).toEqual([...ORG_CAPS].sort())
    for (const c of ORG_CAPS) {
      expect(
        await can(chA, c as Capability, { scopeType: 'ORGANIZATION', scopeId: O.CH_A }),
        c,
      ).toBe(true)
      expect(
        await can(chA, c as Capability, { scopeType: 'ORGANIZATION', scopeId: O.CLB_A1 }),
        c,
      ).toBe(false)
    }
    expect(holdsPlatform(chA, 'venture:review')).toBe(false)
    expect(organizationScope(chA, 'verification:review')).toEqual({
      kind: 'SOME',
      organizationIds: [O.CH_A],
    })
    expect(mayExecuteAccountAction(chA)).toBe(false)
    // ADMIN-DECISION-04: no leader account escalation capability exists.
    expect(CAPABILITIES as readonly string[]).not.toContain('account:escalate')
  })
})
