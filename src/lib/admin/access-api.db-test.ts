import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { can } from '@/lib/authz/authorize'
import { closePool, query } from '@/lib/db/client'

import {
  accessHistory,
  listAccess,
  listDelegationOrganizations,
  parseGrantBody,
} from './access-api'
import { grantAccess, revokeAccess } from './delegation'
import { holdsAt } from './scope'
import { ADM_FX, ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from './testing'

/**
 * ADMIN-PROD-04 — organization delegation APIs on live PostgreSQL: listing,
 * history, scope (IDOR), immediate revocation, grant / revoke races. The PD-6
 * grant rules themselves are proven in admin-scope.db-test.ts.
 */

const O = ADM_FX.org
const P = ADM_PEOPLE
type Person = keyof typeof P

const grant = (who: Person, org: string, grantee: Person, capability: string | null) =>
  grantAccess(
    P[who].account,
    { organizationId: org, granteeProfileId: P[grantee].profile, capability },
    'adm04',
  )
const revoke = (who: Person, org: string, grantId: string) =>
  revokeAccess(P[who].account, { organizationId: org, grantId }, 'adm04')
const list = (who: Person, org: string, state?: string) =>
  listAccess(P[who].account, org, new URLSearchParams(state ? { state } : {}))

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code, fields: error.fields }
    throw error
  }
  throw new Error('accepted')
}

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

afterAll(async () => {
  await clearAdminFixture()
  await closePool()
})

beforeEach(async () => {
  await query(`DELETE FROM audit_events WHERE actor_account_id::text LIKE 'ad020000-%'`)
  await query(
    `DELETE FROM role_assignments WHERE individual_profile_id::text LIKE 'ad020000-%'
       AND (capability IS NOT NULL OR assigned_by IS NOT NULL OR role_code = 'HUB_MEMBER')`,
  )
  await query(
    `UPDATE role_assignments SET state = 'ACTIVE', valid_to = NULL WHERE individual_profile_id::text LIKE 'ad020000-%'`,
  )
})

describe('list and history', () => {
  it('lists the unit’s grants to who may manage them: own unit, parent, admin', async () => {
    const g = await grant('chALeader', O.CLB_A1, 'memberA', 'verification:review')
    for (const who of ['chALeader', 'clbA1Leader', 'admin'] as const) {
      const items = (await list(who, O.CLB_A1)).items
      expect(items.map((i) => [i.capability, i.grantee.profile_id]).sort(), who).toEqual(
        [
          [null, P.clbA1Leader.profile],
          ['verification:review', P.memberA.profile],
        ].sort(),
      )
      expect(items.find((i) => i.id === g.id)).toMatchObject({
        state: 'ACTIVE',
        effective: true,
        // ADMIN-DECISION-02: the parent unit (and the grantor as such) reads, never revokes.
        can_revoke: who !== 'chALeader',
        granted_by_profile_id: P.chALeader.profile,
        grantee: { display_name: 'ADM02 memberA' },
      })
    }
    for (const who of ['chBLeader', 'hubLeader', 'memberA'] as const) {
      expect(await failure(list(who, O.CLB_A1)), who).toMatchObject({
        status: 403,
        code: 'SCOPE_FORBIDDEN',
      })
    }
    for (const org of ['00000000-0000-4000-8000-000000000000', 'nope']) {
      expect(await failure(list('admin', org))).toMatchObject({ status: 403 })
    }
    expect(await failure(list('admin', O.CLB_A1, 'OPEN'))).toMatchObject({ status: 422 })
    const text = JSON.stringify(await list('admin', O.CLB_A1))
    expect(text).not.toContain('@example.test')
  })

  it('keeps revoked grants in CLOSED / ALL and in the history, with actors', async () => {
    const g = await grant('chALeader', O.CLB_A2, 'memberB', 'member:read')
    await revoke('admin', O.CLB_A2, g.id)
    expect((await list('chALeader', O.CLB_A2)).items.map((i) => i.id)).not.toContain(g.id)
    expect(
      (await list('chALeader', O.CLB_A2, 'CLOSED')).items.find((i) => i.id === g.id),
    ).toMatchObject({
      state: 'CLOSED',
      effective: false,
      can_revoke: false,
    })
    const history = (await accessHistory(P.chALeader.account, O.CLB_A2)).items.filter(
      (h) => h.grant_id === g.id,
    )
    expect(history.map((h) => [h.event, h.actor_profile_id, h.capability])).toEqual([
      ['GRANTED', P.chALeader.profile, 'member:read'],
      ['REVOKED', P.admin.profile, 'member:read'],
    ])
    expect(await failure(accessHistory(P.chBLeader.account, O.CLB_A2))).toMatchObject({
      status: 403,
    })
  })
})

describe('revocation takes effect immediately; IDOR', () => {
  it('a revoked grantee fails authorization on the next call', async () => {
    const g = await grant('chALeader', O.CH_A, 'memberC', 'member:read')
    expect(
      await can(await resolveActor(P.memberC.account), 'member:read', {
        scopeType: 'ORGANIZATION',
        scopeId: O.CH_A,
      }),
    ).toBe(true)
    await revoke('chALeader', O.CH_A, g.id)
    const after = await resolveActor(P.memberC.account)
    expect(await can(after, 'member:read', { scopeType: 'ORGANIZATION', scopeId: O.CH_A })).toBe(
      false,
    )
    expect(holdsAt(after, 'member:read', O.CH_A)).toBe(false)
  })

  it('answers a grant through another unit, a foreign unit or a non-access row alike', async () => {
    const g = await grant('chALeader', O.CLB_A1, 'memberA', 'event:manage')
    // ADMIN-DECISION-02: a parent unit is refused like a foreign one; only an
    // authorized revoker naming the wrong unit learns "not found" there.
    expect(await failure(revoke('chALeader', O.CLB_A2, g.id))).toMatchObject({ status: 403 })
    expect(await failure(revoke('chBLeader', O.CLB_A1, g.id))).toMatchObject({ status: 403 })
    expect(await failure(revoke('chBLeader', O.CLB_B1, g.id))).toMatchObject({ status: 403 })
    expect(await failure(revoke('chBLeader', O.CH_B, g.id))).toMatchObject({ status: 404 })
    expect(await failure(revoke('clbA1Leader', O.CLB_A2, g.id))).toMatchObject({ status: 403 })
    // Roster HUB_MEMBER rows are memberships, not access: not listed, not revocable here.
    const [member] = await query<{ id: string }>(
      `INSERT INTO role_assignments (account_id, individual_profile_id, role_code, scope_type, scope_id)
       VALUES ($1, $2, 'HUB_MEMBER', 'ORGANIZATION', $3) RETURNING id::text`,
      [P.memberB.account, P.memberB.profile, O.CLB_A1],
    )
    expect((await list('admin', O.CLB_A1)).items.map((i) => i.id)).not.toContain(member!.id)
    expect(await failure(revoke('admin', O.CLB_A1, member!.id))).toMatchObject({ status: 404 })
  })

  it('parses the grant body strictly', () => {
    expect(parseGrantBody({ grantee_profile_id: P.memberA.profile })).toEqual({
      granteeProfileId: P.memberA.profile,
      capability: null,
    })
    for (const body of [
      null,
      [],
      { grantee_profile_id: 1 },
      { grantee_profile_id: 'x', scope_id: O.HUB },
      { grantee_profile_id: 'x', capability: 3 },
    ]) {
      expect(() => parseGrantBody(body), JSON.stringify(body)).toThrow()
    }
  })
})

describe('concurrency', () => {
  it('two identical grants: one wins; grant vs revoke: at most one live identical grant', async () => {
    const both = await Promise.allSettled([
      grant('chALeader', O.CLB_A1, 'memberA', 'org:read'),
      grant('admin', O.CLB_A1, 'memberA', 'org:read'),
    ])
    expect(both.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const live = (
      both.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string }>
    ).value
    const race = await Promise.allSettled([
      revoke('clbA1Leader', O.CLB_A1, live.id),
      grant('admin', O.CLB_A1, 'memberA', 'org:read'),
    ])
    for (const r of race) {
      if (r.status === 'rejected') expect(r.reason).toMatchObject({ status: 409 })
    }
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_assignments
        WHERE individual_profile_id = $1 AND scope_id = $2 AND capability = 'org:read' AND state = 'ACTIVE'`,
      [P.memberA.profile, O.CLB_A1],
    )
    expect(n!.n).toBeLessThanOrEqual(1)
  })
})

describe('ADMIN-PROD-06 — listDelegationOrganizations: the /ops/admin/access entry list', () => {
  it('PLATFORM_ADMIN sees every operational unit; a whole-role leader sees its own unit and direct children only', async () => {
    const admin = await listDelegationOrganizations(P.admin.account)
    const adminIds = admin.map((o) => o.id)
    expect(adminIds).toEqual(expect.arrayContaining([O.HUB, O.CH_A, O.CH_B, O.CLB_A1, O.CLB_B1]))

    const leader = await listDelegationOrganizations(P.chALeader.account)
    const leaderIds = leader.map((o) => o.id)
    expect(leaderIds).toEqual(expect.arrayContaining([O.CH_A, O.CLB_A1]))
    // Reach only (DEC-ADM reach: own unit + direct children) — a sibling
    // chapter and its own CLBs never list, even though the actor is a
    // delegation source somewhere.
    expect(leaderIds).not.toContain(O.CH_B)
    expect(leaderIds).not.toContain(O.CLB_B1)
  })

  it('holding access:delegate nowhere is refused, not an empty list (`access:delegate` is itself never delegable, DEC-ADM)', async () => {
    // A capability-only grant of verification:review alone — access:delegate
    // not among it — still gets the same refusal, not a narrowed list.
    const granted = await grant('admin', O.CLB_A1, 'memberB', 'verification:review')
    expect(await failure(listDelegationOrganizations(P.memberB.account))).toMatchObject({
      status: 403,
    })
    await revoke('admin', O.CLB_A1, granted.id)
    expect(await failure(listDelegationOrganizations(P.memberC.account))).toMatchObject({
      status: 403,
    })
  })
})
