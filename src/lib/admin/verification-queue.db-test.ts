import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, databaseUrl, query, withTransaction } from '@/lib/db/client'

import { grantAccess, revokeAccess } from './delegation'
import { convertLegacyDeclarations } from './legacy-declarations'
import { ADM_FX, ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from './testing'
import { fileVerificationRequest } from './verification'
import {
  approveVerificationRequest,
  getVerificationRequest,
  listVerificationRequests,
  rejectVerificationRequest,
} from './verification-queue'

/**
 * ADMIN-PROD-03 — the unit-side verification workflow on live PostgreSQL:
 * queue and detail scope (IDOR), approve / reject, existing-membership
 * idempotency, self-approval, handler eligibility, concurrency, validation,
 * history, notifications, the legacy conversion and the shared S1-UAT-03B model.
 */

const O = ADM_FX.org
const P = ADM_PEOPLE
type Person = keyof typeof P
const NOW = new Date('2026-10-04T05:00:00Z')
const FX_PROFILES = Object.values(ADM_PEOPLE).map((p) => p.profile)

async function file(who: Person, org: string, title = 'Chủ tịch', from = '2024-01', to?: string) {
  return withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P[who].account,
      body: {
        organization_id: org,
        position_title: title,
        period_from: from,
        period_to: to ?? null,
      },
      requestId: 'adm03-file',
      now: NOW,
    }),
  )
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code, fields: error.fields }
    throw error
  }
  throw new Error('accepted')
}

const list = (who: Person, params: Record<string, string> = {}) =>
  listVerificationRequests(P[who].account, new URLSearchParams(params))
const approve = (who: Person, id: string, body: unknown = { version: 1 }) =>
  approveVerificationRequest(P[who].account, id, body, 'adm03-test')
const reject = (who: Person, id: string, body: unknown = { version: 1 }) =>
  rejectVerificationRequest(P[who].account, id, body, 'adm03-test')

async function count(sql: string, params: unknown[]) {
  const [row] = await query<{ n: number }>(sql, params)
  return row!.n
}
const memberships = (who: Person, org: string) =>
  count(
    `SELECT count(*)::int AS n FROM community_memberships WHERE profile_id = $1 AND organization_id = $2`,
    [P[who].profile, org],
  )
const leaderships = (who: Person, org: string) =>
  count(
    `SELECT count(*)::int AS n FROM leadership_records WHERE profile_id = $1 AND organization_id = $2`,
    [P[who].profile, org],
  )

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

afterAll(async () => {
  await clearAdminFixture()
  await closePool()
})

beforeEach(async () => {
  await query(`DELETE FROM notifications WHERE recipient_account_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM audit_events WHERE resource_type = 'role_verification_request'
                 AND resource_id IN (SELECT id FROM role_verification_requests
                                      WHERE requester_profile_id::text LIKE 'ad020000-%')`)
  await query(`DELETE FROM audit_events WHERE actor_account_id::text LIKE 'ad020000-%'`)
  await query(
    `DELETE FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'`,
  )
  await query(`DELETE FROM community_memberships WHERE profile_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM leadership_records WHERE profile_id::text LIKE 'ad020000-%'`)
  await query(
    `DELETE FROM role_assignments WHERE individual_profile_id::text LIKE 'ad020000-%'
       AND (capability IS NOT NULL OR assigned_by IS NOT NULL)`,
  )
  await query(
    `UPDATE role_assignments SET state = 'ACTIVE', valid_to = NULL
      WHERE individual_profile_id::text LIKE 'ad020000-%'`,
  )
})

describe('queue scope (server-derived; client org filters cannot widen it)', () => {
  it('shows each handler exactly the requests routed to its units', async () => {
    const hub = await file('memberA', O.HUB)
    const chA = await file('memberA', O.CH_A)
    const clbA1 = await file('memberB', O.CLB_A1)
    const clbA2 = await file('memberB', O.CLB_A2) // no CLB handler → Chapter A
    const clbB1 = await file('memberC', O.CLB_B1) // no CLB handler → Chapter B
    const ids = async (who: Person) => (await list(who)).items.map((i) => i.id).sort()

    expect(await ids('admin')).toEqual([hub.id, chA.id, clbA1.id, clbA2.id, clbB1.id].sort())
    expect(await ids('hubLeader')).toEqual([hub.id])
    expect(await ids('chALeader')).toEqual([chA.id, clbA2.id].sort())
    expect(await ids('clbA1Leader')).toEqual([clbA1.id])
    expect(await ids('chBLeader')).toEqual([clbB1.id])
    expect((await list('chALeader')).counts).toEqual({ pending: 2 })
    expect(await failure(list('memberA'))).toMatchObject({ status: 403, code: 'SCOPE_FORBIDDEN' })
  })

  it('filters, pages deterministically and refuses a foreign routed unit', async () => {
    const first = await file('memberA', O.CLB_A2, 'Thành viên', '2023-01')
    const second = await file('memberB', O.CLB_A2, 'Thành viên', '2023-02')
    await file('memberC', O.CH_A)
    const byUnit = await list('chALeader', { organization_id: O.CLB_A2 })
    expect(byUnit.items.map((i) => i.id)).toEqual([first.id, second.id])
    expect(byUnit.items[0]).toMatchObject({
      fallback: true,
      routed_to: { id: O.CH_A },
      position: { organization: { id: O.CLB_A2 }, period_from: '2023-01', current: true },
      can_act: true,
    })
    const page1 = await list('chALeader', { limit: '1' })
    const page2 = await list('chALeader', { limit: '1', cursor: page1.nextCursor! })
    expect([page1.items[0]!.id, page2.items[0]!.id]).toEqual([first.id, second.id])
    expect((await list('chALeader', { status: 'APPROVED' })).items).toEqual([])
    expect(await failure(list('chALeader', { routed_to: O.CH_B }))).toMatchObject({ status: 403 })
    expect(await failure(list('chALeader', { routed_to: O.CLB_B1 }))).toMatchObject({ status: 403 })
    for (const [params, field] of [
      [{ status: 'DONE' }, 'status'],
      [{ organization_id: 'HUB' }, 'organization_id'],
      [{ scope: O.HUB }, 'scope'],
    ] as const) {
      expect(await failure(list('chALeader', params))).toMatchObject({
        status: 422,
        fields: { [field]: expect.any(String) },
      })
    }
  })
})

describe('detail scope and content (IDOR)', () => {
  it('opens a request only where its routed unit is in scope; others are 404 alike', async () => {
    const request = await file('memberB', O.CLB_A2, 'Trưởng Ban Sự kiện', '2024-05')
    expect((await getVerificationRequest(P.chALeader.account, request.id)).id).toBe(request.id)
    expect((await getVerificationRequest(P.admin.account, request.id)).id).toBe(request.id)
    for (const who of ['hubLeader', 'chBLeader', 'clbA1Leader', 'memberA', 'memberB'] as const) {
      expect(await failure(getVerificationRequest(P[who].account, request.id)), who).toMatchObject({
        status: 404,
      })
    }
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid', "1' OR '1'='1"]) {
      expect(await failure(getVerificationRequest(P.admin.account, id))).toMatchObject({
        status: 404,
      })
    }
  })

  it('returns review fields only, identity through discovery, the unit context and history', async () => {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source)
       VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED')`,
      [P.memberA.profile, O.CH_A],
    )
    const request = await file('memberA', O.CH_A, 'Phó Chủ tịch', '2025-01')
    const detail = await getVerificationRequest(P.chALeader.account, request.id)
    expect(detail.requester).toEqual({
      profile_id: P.memberA.profile,
      display_name: 'ADM02 memberA',
    })
    expect(detail.context.memberships).toEqual([
      expect.objectContaining({ state: 'PENDING_APPROVAL', source_type: 'SELF_DECLARED' }),
    ])
    expect(detail.history).toEqual([
      expect.objectContaining({
        event: 'SUBMITTED',
        by: 'REQUESTER',
        status: 'PENDING',
        routed_to: O.CH_A,
      }),
    ])
    const text = JSON.stringify(detail)
    for (const secret of ['@example.test', 'account_id', 'phone', 'full_name', 'email'])
      expect(text, secret).not.toContain(secret)

    await query(
      `INSERT INTO profile_visibility_settings (profile_id, default_level) VALUES ($1, 'PRIVATE')
       ON CONFLICT (profile_id) DO UPDATE SET default_level = 'PRIVATE', group_overrides = '{}'`,
      [P.memberA.profile],
    )
    try {
      const hidden = await getVerificationRequest(P.chALeader.account, request.id)
      expect(hidden.requester).toEqual({ profile_id: P.memberA.profile, display_name: null })
    } finally {
      await query(`DELETE FROM profile_visibility_settings WHERE profile_id = $1`, [
        P.memberA.profile,
      ])
    }
  })
})

describe('approve', () => {
  it('current term: ACTIVE leadership + new ACTIVE membership, APPROVED, audit, notice', async () => {
    const request = await file('memberA', O.CLB_A1, 'Chủ nhiệm', '2024-09')
    const done = await approve('clbA1Leader', request.id)
    expect(done).toMatchObject({ status: 'APPROVED', version: 2, can_act: false })
    expect(done.handler_profile_id).toBe(P.clbA1Leader.profile)
    expect(done.handled_at).not.toBeNull()
    const [m] = await query<{ state: string; source: string }>(
      `SELECT state::text AS state, source FROM community_memberships WHERE profile_id = $1 AND organization_id = $2`,
      [P.memberA.profile, O.CLB_A1],
    )
    expect(m).toEqual({ state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED' })
    const [l] = await query<{ role_label: string; state: string; started: string }>(
      `SELECT role_label, state::text AS state,
              to_char(started_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS started
         FROM leadership_records WHERE profile_id = $1 AND organization_id = $2`,
      [P.memberA.profile, O.CLB_A1],
    )
    expect(l).toEqual({ role_label: 'Chủ nhiệm', state: 'ACTIVE', started: '2024-09-01' })
    expect(
      await count(
        `SELECT count(*)::int AS n FROM role_assignments WHERE individual_profile_id = $1`,
        [P.memberA.profile],
      ),
    ).toBe(0)
    const [audit] = await query<{ action: string; after_data: Record<string, unknown> }>(
      `SELECT action, after_data FROM audit_events WHERE resource_id = $1 AND action LIKE '%APPROVED%'`,
      [request.id],
    )
    expect(audit).toMatchObject({
      action: 'VERIFICATION_REQUEST_APPROVED',
      after_data: {
        status: 'APPROVED',
        membership_outcome: 'CREATED',
        leadership_outcome: 'CREATED',
      },
    })
    const notices = await query<{ type: string; resource_id: string }>(
      `SELECT type::text AS type, resource_id::text FROM notifications WHERE recipient_account_id = $1`,
      [P.memberA.account],
    )
    expect(notices).toEqual([{ type: 'VERIFICATION_APPROVED', resource_id: request.id }])
    expect(done.history.map((h) => [h.event, h.by])).toEqual([
      ['SUBMITTED', 'REQUESTER'],
      ['APPROVED', 'HANDLER'],
    ])
  })

  it('ended term: ALUMNI leadership with the term, no membership', async () => {
    const request = await file('memberB', O.CH_A, 'Trưởng Ban Truyền thông', '2021-03', '2022-08')
    await approve('chALeader', request.id)
    expect(await memberships('memberB', O.CH_A)).toBe(0)
    const [l] = await query<{ state: string; started: string; ended: string }>(
      `SELECT state::text AS state,
              to_char(started_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS started,
              to_char(ended_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS ended
         FROM leadership_records WHERE profile_id = $1 AND organization_id = $2`,
      [P.memberB.profile, O.CH_A],
    )
    expect(l).toEqual({ state: 'ALUMNI', started: '2021-03', ended: '2022-08' })
  })
})

describe('existing membership / record (task §7)', () => {
  it('reuses an ACTIVE membership and an equal ACTIVE title: no duplicate, own audit code', async () => {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
       VALUES ($1, $2, 'ACTIVE', 'PRESEED', now())`,
      [P.memberC.profile, O.CH_B],
    )
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state)
       VALUES ($1, $2, 'chủ tịch', 'ACTIVE')`,
      [P.memberC.profile, O.CH_B],
    )
    const request = await file('memberC', O.CH_B, 'Chủ tịch', '2024-01')
    expect((await approve('chBLeader', request.id)).status).toBe('APPROVED')
    expect(await memberships('memberC', O.CH_B)).toBe(1)
    expect(await leaderships('memberC', O.CH_B)).toBe(1)
    const [audit] = await query<{ action: string; after_data: Record<string, unknown> }>(
      `SELECT action, after_data FROM audit_events WHERE resource_id = $1 AND action LIKE '%APPROVED%'`,
      [request.id],
    )
    expect(audit).toMatchObject({
      action: 'VERIFICATION_REQUEST_APPROVED_EXISTING_MEMBERSHIP',
      after_data: { membership_outcome: 'EXISTING', leadership_outcome: 'EXISTING' },
    })
    expect(
      await count(`SELECT count(*)::int AS n FROM notifications WHERE recipient_account_id = $1`, [
        P.memberC.account,
      ]),
    ).toBe(1)
  })

  it('activates a PENDING membership instead of adding one; two positions share it', async () => {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, hub_declaration)
       VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED', true)`,
      [P.memberA.profile, O.CH_A],
    )
    const one = await file('memberA', O.CH_A, 'Phó Chủ tịch', '2024-01')
    const two = await file('memberA', O.CH_A, 'Trưởng Ban Đối ngoại', '2024-06')
    await approve('chALeader', one.id)
    await approve('chALeader', two.id)
    const rows = await query<{ state: string; source: string }>(
      `SELECT state::text AS state, source FROM community_memberships WHERE profile_id = $1 AND organization_id = $2`,
      [P.memberA.profile, O.CH_A],
    )
    expect(rows).toEqual([{ state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED' }])
    expect(await leaderships('memberA', O.CH_A)).toBe(2)
  })

  it('refuses over a SUSPENDED membership and changes nothing', async () => {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source)
       VALUES ($1, $2, 'SUSPENDED', 'PRESEED')`,
      [P.memberB.profile, O.CLB_A1],
    )
    const request = await file('memberB', O.CLB_A1)
    expect(await failure(approve('clbA1Leader', request.id))).toMatchObject({
      status: 409,
      code: 'MEMBERSHIP_INVALID_TRANSITION',
    })
    const detail = await getVerificationRequest(P.clbA1Leader.account, request.id)
    expect(detail.status).toBe('PENDING')
    expect(await leaderships('memberB', O.CLB_A1)).toBe(0)
  })

  it('refuses an approval for a deactivated or blocked requester, leaving the request PENDING', async () => {
    const request = await file('memberC', O.CLB_A1)
    await query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE id = $1`, [P.memberC.account])
    try {
      expect(await failure(approve('clbA1Leader', request.id))).toMatchObject({ status: 409 })
      // A rejection stays possible.
      expect((await reject('clbA1Leader', request.id)).status).toBe('REJECTED')
    } finally {
      await query(`UPDATE user_accounts SET status = 'ACTIVE' WHERE id = $1`, [P.memberC.account])
    }
  })
})

describe('reject', () => {
  it('stores an optional reason, keeps the request, audits and notifies', async () => {
    const withReason = await file('memberA', O.HUB, 'Thành viên', '2024-02')
    const without = await file('memberB', O.HUB, 'Thành viên', '2024-02')
    const blank = await file('memberC', O.HUB, 'Thành viên', '2024-02')
    const a = await reject('hubLeader', withReason.id, {
      version: 1,
      reason: ' Không khớp danh sách ',
    })
    const b = await reject('hubLeader', without.id, { version: 1 })
    const c = await reject('hubLeader', blank.id, { version: 1, reason: '   ' })
    expect([a.reject_reason, b.reject_reason, c.reject_reason]).toEqual([
      'Không khớp danh sách',
      null,
      null,
    ])
    expect(a.history.at(-1)).toMatchObject({ event: 'REJECTED', reason: 'Không khớp danh sách' })
    expect(
      await count(
        `SELECT count(*)::int AS n FROM role_verification_requests WHERE id = ANY($1::uuid[])`,
        [[withReason.id, without.id, blank.id]],
      ),
    ).toBe(3)
    const [notice] = await query<{ type: string }>(
      `SELECT type::text AS type FROM notifications WHERE recipient_account_id = $1`,
      [P.memberA.account],
    )
    expect(notice).toEqual({ type: 'VERIFICATION_REJECTED' })
    expect(await memberships('memberA', O.HUB)).toBe(0)
    expect(
      await failure(
        reject('hubLeader', (await file('memberA', O.HUB)).id, {
          version: 1,
          reason: 'x'.repeat(501),
        }),
      ),
    ).toMatchObject({ status: 422, fields: { reason: 'too_long' } })
  })
})

describe('self-approval, eligibility, validation', () => {
  it('never lets a requester decide their own request, even as PLATFORM_ADMIN; the attempt is audited', async () => {
    const own = await file('admin', O.HUB)
    expect((await getVerificationRequest(P.admin.account, own.id)).can_act).toBe(false)
    for (const action of [approve, reject]) {
      expect(await failure(action('admin', own.id))).toMatchObject({
        status: 403,
        code: 'SCOPE_FORBIDDEN',
      })
    }
    const refused = await query<{ after_data: Record<string, unknown> }>(
      `SELECT after_data FROM audit_events WHERE resource_id = $1 AND action = 'VERIFICATION_REQUEST_SELF_ACTION_REFUSED'
        ORDER BY created_at`,
      [own.id],
    )
    expect(refused.map((r) => r.after_data.action)).toEqual(['APPROVE', 'REJECT'])
    expect((await getVerificationRequest(P.hubLeader.account, own.id)).status).toBe('PENDING')
    // Another handler of the unit decides it.
    expect((await approve('hubLeader', own.id)).status).toBe('APPROVED')
  })

  it('lets a delegated handler act, and not once the capability is revoked', async () => {
    const grant = await grantAccess(
      P.chALeader.account,
      {
        organizationId: O.CLB_A2,
        granteeProfileId: P.memberC.profile,
        capability: 'verification:review',
      },
      'adm03-test',
    )
    const request = await file('memberA', O.CLB_A2)
    expect(request.routed_to_org_id).toBe(O.CLB_A2)
    const second = await file('memberB', O.CLB_A2)
    expect((await approve('memberC', request.id)).status).toBe('APPROVED')
    await revokeAccess(
      P.chALeader.account,
      { organizationId: O.CLB_A2, grantId: grant.id },
      'adm03-test',
    )
    expect(await failure(approve('memberC', second.id))).toMatchObject({ status: 404 })
    // Authority is exact: Chapter A does not act on a request routed to its CLB.
    expect(await failure(approve('chALeader', second.id))).toMatchObject({ status: 404 })
  })

  it('refuses stale, decided, malformed and unknown decisions with controlled errors', async () => {
    const request = await file('memberA', O.CH_A)
    for (const body of [undefined, null, [], {}, { version: 0 }, { version: '1' }]) {
      expect(
        await failure(approveVerificationRequest(P.chALeader.account, request.id, body, 't')),
        JSON.stringify(body),
      ).toMatchObject({
        status: 422,
      })
    }
    for (const body of [
      { version: 1, role: 'PLATFORM_ADMIN' },
      { version: 1, organization_id: O.HUB },
    ]) {
      expect(await failure(approve('chALeader', request.id, body))).toMatchObject({
        status: 422,
        fields: expect.objectContaining({}),
      })
    }
    expect(
      await failure(approve('chALeader', request.id, { version: 1, reason: 'x' })),
    ).toMatchObject({
      status: 422,
      fields: { reason: 'not_accepted' },
    })
    expect(await failure(approve('chALeader', request.id, { version: 2 }))).toMatchObject({
      status: 409,
    })
    await approve('chALeader', request.id)
    expect(await failure(approve('chALeader', request.id, { version: 2 }))).toMatchObject({
      status: 409,
    })
    expect(await failure(reject('chALeader', request.id, { version: 2 }))).toMatchObject({
      status: 409,
    })
    expect(await failure(approve('admin', '00000000-0000-4000-8000-000000000000'))).toMatchObject({
      status: 404,
    })
    expect(await failure(approve('admin', 'nope'))).toMatchObject({ status: 404 })
  })
})

describe('concurrency: one terminal transition, no duplicate membership', () => {
  it('two approvers, approve vs reject, duplicate approve', async () => {
    const a = await file('memberA', O.CH_A, 'Chủ tịch', '2024-01')
    const results = await Promise.allSettled([
      approve('admin', a.id),
      approve('chALeader', a.id),
      approve('chALeader', a.id),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    for (const r of results.filter((r) => r.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ status: 409 })
    }
    expect(await memberships('memberA', O.CH_A)).toBe(1)
    expect(await leaderships('memberA', O.CH_A)).toBe(1)

    const b = await file('memberB', O.CH_A, 'Chủ tịch', '2024-01')
    const race = await Promise.allSettled([approve('chALeader', b.id), reject('admin', b.id)])
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const [row] = await query<{ status: string }>(
      `SELECT status::text AS status FROM role_verification_requests WHERE id = $1`,
      [b.id],
    )
    const decided = await count(
      `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1
         AND action IN ('VERIFICATION_REQUEST_APPROVED', 'VERIFICATION_REQUEST_REJECTED')`,
      [b.id],
    )
    expect(decided).toBe(1)
    expect(['APPROVED', 'REJECTED']).toContain(row!.status)
    expect(await memberships('memberB', O.CH_A)).toBe(row!.status === 'APPROVED' ? 1 : 0)
  })

  it('two positions of one person approved at once share one membership', async () => {
    const one = await file('memberC', O.CH_B, 'Phó Chủ tịch', '2024-01')
    const two = await file('memberC', O.CH_B, 'Thành viên', '2024-02')
    await Promise.all([approve('chBLeader', one.id), approve('admin', two.id)])
    expect(await memberships('memberC', O.CH_B)).toBe(1)
    expect(await leaderships('memberC', O.CH_B)).toBe(2)
  })
})

describe('review hardening (independent security review)', () => {
  it('pages by keyset: deciding items never makes the next page skip one', async () => {
    const r1 = await file('memberA', O.CH_A, 'Chủ tịch', '2024-01')
    const r2 = await file('memberB', O.CH_A, 'Chủ tịch', '2024-01')
    const r3 = await file('memberC', O.CH_A, 'Chủ tịch', '2024-01')
    const page1 = await list('chALeader', { limit: '1' })
    expect(page1.items.map((i) => i.id)).toEqual([r1.id])
    await approve('chALeader', r1.id)
    const page2 = await list('chALeader', { limit: '1', cursor: page1.nextCursor! })
    expect(page2.items.map((i) => i.id)).toEqual([r2.id])
    const page3 = await list('chALeader', { limit: '1', cursor: page2.nextCursor! })
    expect(page3.items.map((i) => i.id)).toEqual([r3.id])
    expect(page3.nextCursor).toBeNull()
    const huge = Buffer.from(JSON.stringify({ o: 1e21 })).toString('base64url')
    for (const [params, field] of [
      [{ limit: '0' }, 'limit'],
      [{ limit: '51' }, 'limit'],
      [{ limit: 'abc' }, 'limit'],
      [{ limit: '1e3' }, 'limit'],
      [{ cursor: 'garbage' }, 'cursor'],
      [{ cursor: huge }, 'cursor'],
    ] as const) {
      expect(await failure(list('chALeader', params)), JSON.stringify(params)).toMatchObject({
        status: 422,
        fields: { [field]: 'invalid' },
      })
    }
  })

  it('never locks or waits on a request outside the caller’s scope', async () => {
    const request = await file('memberA', O.CH_A)
    const other = new Client({ connectionString: databaseUrl() })
    await other.connect()
    try {
      await other.query('BEGIN')
      await other.query('SELECT 1 FROM role_verification_requests WHERE id = $1 FOR UPDATE', [
        request.id,
      ])
      const started = Date.now()
      expect(await failure(approve('chBLeader', request.id))).toMatchObject({ status: 404 })
      expect(Date.now() - started).toBeLessThan(1500)
    } finally {
      await other.query('ROLLBACK')
      await other.end()
    }
  })

  it('re-reads a membership another writer inserts meanwhile instead of failing', async () => {
    const request = await file('memberB', O.CH_B)
    const other = new Client({ connectionString: databaseUrl() })
    await other.connect()
    try {
      await other.query('BEGIN')
      await other.query(
        `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
         VALUES ($1, $2, 'ACTIVE', 'PRESEED', now())`,
        [P.memberB.profile, O.CH_B],
      )
      const pending = approve('chBLeader', request.id)
      await new Promise((resolve) => setTimeout(resolve, 300))
      await other.query('COMMIT')
      expect((await pending).status).toBe('APPROVED')
    } finally {
      await other.end()
    }
    expect(await memberships('memberB', O.CH_B)).toBe(1)
    const [audit] = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE resource_id = $1 AND action LIKE '%APPROVED%'`,
      [request.id],
    )
    expect(audit!.action).toBe('VERIFICATION_REQUEST_APPROVED_EXISTING_MEMBERSHIP')
  })

  it('matches an ALUMNI record by start month, whatever its day', async () => {
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state, started_at, ended_at)
       VALUES ($1, $2, 'Trưởng Ban', 'ALUMNI', '2021-03-15T03:00:00Z', '2022-08-20T03:00:00Z')`,
      [P.memberC.profile, O.CH_A],
    )
    const request = await file('memberC', O.CH_A, 'trưởng ban', '2021-03', '2022-08')
    await approve('chALeader', request.id)
    expect(await leaderships('memberC', O.CH_A)).toBe(1)
  })
})

describe('routing at the queue (PD-1)', () => {
  it('CLB handler present → CLB; absent → Chapter; Chapter absent too → HUB Tổng; never higher', async () => {
    expect((await file('memberA', O.CLB_A1)).routed_to_org_id).toBe(O.CLB_A1)
    expect((await file('memberA', O.CLB_A2)).routed_to_org_id).toBe(O.CH_A)
    await query(
      `UPDATE role_assignments SET state = 'CLOSED', valid_to = now()
        WHERE individual_profile_id = $1`,
      [P.chALeader.profile],
    )
    const top = await file('memberB', O.CLB_A2)
    expect(top.routed_to_org_id).toBe(O.HUB)
    expect((await list('hubLeader')).items.map((i) => i.id)).toContain(top.id)
  })
})

describe('shared model with S1-UAT-03B and the legacy conversion', () => {
  it('consumes a user-filed request; a resubmission is a new version, the old one is stale', async () => {
    const request = await file('memberA', O.CH_B)
    await reject('chBLeader', request.id, { version: 1, reason: 'Thiếu thông tin' })
    // The S1-UAT-03B user flow resubmits: REJECTED → PENDING, handled fields cleared, version + 1.
    await query(
      `UPDATE role_verification_requests SET status = 'PENDING', handled_at = NULL,
              handled_by_account_id = NULL, reject_reason = NULL, version = version + 1
        WHERE id = $1`,
      [request.id],
    )
    expect((await list('chBLeader')).items.map((i) => [i.id, i.version])).toEqual([[request.id, 3]])
    expect(await failure(approve('chBLeader', request.id, { version: 2 }))).toMatchObject({
      status: 409,
    })
    expect((await approve('chBLeader', request.id, { version: 3 })).status).toBe('APPROVED')
  })

  it('converts only declarations with an explicit month, never approves, keeps the source row', async () => {
    const legacy = async (
      who: Person,
      org: string,
      position: string | null,
      period: string | null,
    ) => {
      const [row] = await query<{ id: string }>(
        `INSERT INTO community_memberships
           (profile_id, organization_id, state, source, claimed_position, claimed_period, hub_declaration, created_at)
         VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED', $3, $4, true, '2026-09-01T03:00:00Z')
         RETURNING id::text`,
        [P[who].profile, org, position, period],
      )
      return row!.id
    }
    const good = await legacy('memberA', O.CLB_A2, 'Phó chủ nhiệm', '03/2024 - nay')
    const ended = await legacy('memberB', O.CH_A, 'Trưởng ban', 'Từ 01/2021 đến 12/2022')
    await legacy('memberC', O.CH_A, 'Phó trưởng chapter', '2024 – nay')
    await legacy('memberC', O.CLB_A1, null, '03/2024 - nay')
    await legacy('memberB', O.CLB_A1, 'Thành viên', '')
    await legacy('deactivated', O.CH_B, 'Thành viên', '03/2024 - nay')

    const dry = await withTransaction((exec) =>
      convertLegacyDeclarations(exec, {
        apply: false,
        requestId: 'adm03-legacy',
        now: NOW,
        onlyProfileIds: FX_PROFILES,
      }),
    )
    expect(dry).toMatchObject({
      scanned: 6,
      converted: 2,
      skipped: {
        period_year_only: 1,
        missing_position: 1,
        missing_period: 1,
        requester_unavailable: 1,
      },
    })
    expect(
      await count(
        `SELECT count(*)::int AS n FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'`,
        [],
      ),
    ).toBe(0)

    const applied = await withTransaction((exec) =>
      convertLegacyDeclarations(exec, {
        apply: true,
        requestId: 'adm03-legacy',
        now: NOW,
        onlyProfileIds: FX_PROFILES,
      }),
    )
    expect(applied.converted).toBe(2)
    const converted = await query<{
      id: string
      status: string
      routed: string
      from: string
      to: string | null
      submitted: string
    }>(
      `SELECT id::text, status::text AS status, routed_to_org_id::text AS routed,
              to_char(period_from, 'YYYY-MM') AS "from", to_char(period_to, 'YYYY-MM') AS "to",
              to_char(submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS submitted
         FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'
        ORDER BY period_from`,
      [],
    )
    expect(converted.map((row) => ({ ...row, id: undefined }))).toEqual([
      {
        status: 'PENDING',
        routed: O.CH_A,
        from: '2021-01',
        to: '2022-12',
        submitted: '2026-09-01',
      },
      {
        id: undefined,
        status: 'PENDING',
        routed: O.CH_A,
        from: '2024-03',
        to: null,
        submitted: '2026-09-01',
      },
    ])
    const sources = await query<{ state: string; claimed_period: string }>(
      `SELECT state::text AS state, claimed_period FROM community_memberships WHERE id = ANY($1::uuid[]) ORDER BY claimed_period`,
      [[good, ended]],
    )
    expect(sources).toEqual([
      { state: 'PENDING_APPROVAL', claimed_period: '03/2024 - nay' },
      { state: 'PENDING_APPROVAL', claimed_period: 'Từ 01/2021 đến 12/2022' },
    ])
    const history = (await getVerificationRequest(P.admin.account, converted[1]!.id)).history
    expect(history).toEqual([
      expect.objectContaining({ event: 'MIGRATED', by: 'SYSTEM', status: 'PENDING' }),
    ])

    const again = await withTransaction((exec) =>
      convertLegacyDeclarations(exec, {
        apply: true,
        requestId: 'adm03-legacy',
        now: NOW,
        onlyProfileIds: FX_PROFILES,
      }),
    )
    expect(again).toMatchObject({ converted: 0, skipped: { already_converted: 2 } })

    // Approving the converted current-term request activates the legacy membership itself.
    await approve('chALeader', converted[1]!.id)
    const [source] = await query<{ state: string; source: string }>(
      `SELECT state::text AS state, source FROM community_memberships WHERE id = $1`,
      [good],
    )
    expect(source).toEqual({ state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED' })
    expect(await memberships('memberA', O.CLB_A2)).toBe(1)
  })
})
