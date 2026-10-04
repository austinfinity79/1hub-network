import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { requestAccountDeletion } from '@/lib/account/settings'
import { isApiError } from '@/lib/api/errors'
import { consumeMagicLink, requestMagicLink } from '@/lib/auth/magic-link'
import { createSession, resolveSession } from '@/lib/auth/sessions'
import { resolveActor } from '@/lib/authz/actor'
import { closePool, query } from '@/lib/db/client'

import {
  decideAccountRequest,
  fileAccountRequest,
  getAccountRequest,
  listAccountRequests,
  runAccountOperation,
  type AccountOperation,
} from './account-ops'
import { holdsAt } from './scope'
import { ADM_FX, ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from './testing'

/**
 * ADMIN-PROD-05 — account operations on live PostgreSQL: PLATFORM_ADMIN-only
 * execution, LOCK / DEACTIVATE / SOFT_DELETE semantics, session invalidation
 * (existing session, new sign-in), self-action, leader escalations and their
 * processing, races and audit.
 */

const O = ADM_FX.org
const P = ADM_PEOPLE
type Person = keyof typeof P

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code, fields: error.fields }
    throw error
  }
  throw new Error('accepted')
}

const run = (who: Person, target: Person, op: AccountOperation, body: unknown = {}) =>
  runAccountOperation(P[who].account, P[target].profile, op, body, 'adm05')
const email = (who: Person) => `adm02-fx-${who.toLowerCase()}@example.test`
async function signIn(who: Person) {
  const { token } = await requestMagicLink(email(who), null)
  return consumeMagicLink(token)
}
async function status(who: Person) {
  const [row] = await query<{ account: string; profile: string }>(
    `SELECT a.status::text AS account, p.status::text AS profile FROM user_accounts a
       JOIN individual_profiles p ON p.account_id = a.id WHERE a.id = $1`,
    [P[who].account],
  )
  return row!
}

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

beforeEach(async () => {
  // Every test starts from the fixture's statuses and requests.
  await seedAdminFixture()
  await query(`DELETE FROM user_sessions WHERE account_id::text LIKE 'ad020000-%'`)
})

afterAll(async () => {
  await query(`DELETE FROM user_sessions WHERE account_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM auth_magic_link_requests WHERE email_normalized LIKE 'adm02-fx-%'`)
  await clearAdminFixture()
  await closePool()
})

describe('PLATFORM_ADMIN-only execution', () => {
  it('refuses leaders and members before looking at the id (no enumeration)', async () => {
    for (const who of ['hubLeader', 'chALeader', 'clbA1Leader', 'memberA'] as const) {
      for (const op of ['LOCK', 'DEACTIVATE', 'SOFT_DELETE'] as const) {
        expect(await failure(run(who, 'memberB', op)), `${who} ${op}`).toMatchObject({
          status: 403,
        })
      }
      expect(
        await failure(
          runAccountOperation(
            P[who].account,
            '00000000-0000-4000-8000-000000000000',
            'LOCK',
            {},
            'x',
          ),
        ),
      ).toMatchObject({ status: 403 })
    }
    expect(await status('memberB')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
    expect(
      await failure(
        runAccountOperation(
          P.admin.account,
          '00000000-0000-4000-8000-000000000000',
          'LOCK',
          {},
          'x',
        ),
      ),
    ).toMatchObject({
      status: 404,
    })
    expect(
      await failure(run('admin', 'memberB', 'LOCK', { reason: 'x'.repeat(501) })),
    ).toMatchObject({ status: 422 })
    expect(await failure(run('admin', 'memberB', 'LOCK', { hard: true }))).toMatchObject({
      status: 422,
    })
  })
})

describe('LOCK and DEACTIVATE invalidate sessions and sign-in', () => {
  it('LOCK: existing session rejected, sign-in refused, data kept; UNLOCK lets a new sign-in in', async () => {
    const { token } = await createSession(P.memberA.account)
    expect(await resolveSession(token)).not.toBeNull()
    const locked = await run('admin', 'memberA', 'LOCK', { reason: 'Spam' })
    expect(locked).toMatchObject({
      account_status: 'BLOCKED',
      profile_status: 'ACTIVE',
      changed: true,
    })
    expect(await resolveSession(token)).toBeNull()
    expect(await failure(signIn('memberA'))).toMatchObject({
      status: 403,
      code: 'AUTH_ACCOUNT_BLOCKED',
    })
    const [kept] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM individual_profiles WHERE id = $1`,
      [P.memberA.profile],
    )
    expect(kept!.n).toBe(1)
    expect((await run('admin', 'memberA', 'UNLOCK')).account_status).toBe('ACTIVE')
    expect(await resolveSession(token)).toBeNull()
    const again = await signIn('memberA')
    expect(await resolveSession(again.sessionToken)).not.toBeNull()
  })

  it('DEACTIVATE: account and profile off, unit roles closed, sign-in refused; REACTIVATE restores statuses only', async () => {
    const { token } = await createSession(P.chALeader.account)
    expect(holdsAt(await resolveActor(P.chALeader.account), 'member:read', O.CH_A)).toBe(true)
    const result = await run('admin', 'chALeader', 'DEACTIVATE')
    expect(result).toMatchObject({ account_status: 'DEACTIVATED', profile_status: 'DEACTIVATED' })
    expect(await resolveSession(token)).toBeNull()
    expect(await failure(signIn('chALeader'))).toMatchObject({ code: 'AUTH_ACCOUNT_BLOCKED' })
    const [roles] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_assignments WHERE individual_profile_id = $1 AND state = 'ACTIVE'`,
      [P.chALeader.profile],
    )
    expect(roles!.n).toBe(0)
    expect(await run('admin', 'chALeader', 'REACTIVATE')).toMatchObject({
      account_status: 'ACTIVE',
      profile_status: 'ACTIVE',
    })
    expect(holdsAt(await resolveActor(P.chALeader.account), 'member:read', O.CH_A)).toBe(false)
  })

  it('SOFT_DELETE records the privacy request, deactivates, deletes nothing and blocks reactivation', async () => {
    const result = await run('admin', 'memberB', 'SOFT_DELETE', { reason: 'Yêu cầu qua e-mail' })
    expect(result).toMatchObject({ account_status: 'DEACTIVATED', soft_deleted: true })
    const [request] = await query<{ status: string; handled: boolean }>(
      `SELECT status::text AS status, handled_by_account_id IS NOT NULL AS handled FROM account_deletion_requests WHERE account_id = $1`,
      [P.memberB.account],
    )
    expect(request).toEqual({ status: 'PROCESSED', handled: true })
    const [rows] = await query<{ a: number; p: number }>(
      `SELECT (SELECT count(*)::int FROM user_accounts WHERE id = $1) AS a,
              (SELECT count(*)::int FROM individual_profiles WHERE account_id = $1) AS p`,
      [P.memberB.account],
    )
    expect(rows).toEqual({ a: 1, p: 1 })
    expect(await failure(run('admin', 'memberB', 'REACTIVATE'))).toMatchObject({ status: 409 })
    expect((await run('admin', 'memberB', 'SOFT_DELETE')).changed).toBe(false)
  })

  it('transitions: same state is no change; locked cannot reactivate; deactivated cannot lock', async () => {
    await run('admin', 'memberC', 'LOCK')
    expect((await run('admin', 'memberC', 'LOCK')).changed).toBe(false)
    expect(await failure(run('admin', 'memberC', 'REACTIVATE'))).toMatchObject({ status: 409 })
    await run('admin', 'memberC', 'DEACTIVATE')
    expect(await failure(run('admin', 'memberC', 'LOCK'))).toMatchObject({ status: 409 })
    expect(await failure(run('admin', 'memberC', 'UNLOCK'))).toMatchObject({ status: 409 })
    const locks = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1 AND action = 'ACCOUNT_LOCKED'`,
      [P.memberC.account],
    )
    expect(locks[0]!.n).toBe(1)
  })
})

describe('self-action protection and races', () => {
  it('never lets an admin lock, deactivate or soft-delete their own account; the attempt is audited', async () => {
    for (const op of ['LOCK', 'DEACTIVATE', 'SOFT_DELETE'] as const) {
      expect(await failure(run('admin', 'admin', op)), op).toMatchObject({ status: 403 })
    }
    expect(await status('admin')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
    const [refused] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'ACCOUNT_SELF_ACTION_REFUSED'`,
      [P.admin.account],
    )
    expect(refused!.n).toBeGreaterThanOrEqual(3)
  })

  it('duplicate locks and lock vs deactivate end in one deterministic state', async () => {
    const twice = await Promise.all([
      run('admin', 'memberA', 'LOCK'),
      run('admin', 'memberA', 'LOCK'),
    ])
    expect(twice.filter((r) => r.changed)).toHaveLength(1)
    const race = await Promise.allSettled([
      run('admin', 'memberB', 'LOCK'),
      run('admin', 'memberB', 'DEACTIVATE'),
    ])
    for (const r of race)
      if (r.status === 'rejected') expect(r.reason).toMatchObject({ status: 409 })
    expect((await status('memberB')).account).toBe('DEACTIVATED')
  })
})

describe('leader escalations (file only) and admin processing', () => {
  it('files for an ACTIVE member of exactly the unit; the admin processes or declines', async () => {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
       VALUES ($1, $2, 'ACTIVE', 'PRESEED', now()), ($3, $2, 'ACTIVE', 'PRESEED', now())`,
      [P.memberA.profile, O.CH_A, P.memberB.profile],
    )
    const file = (who: Person, org: string, target: Person, body: unknown) =>
      fileAccountRequest(P[who].account, org, P[target].profile, body, 'adm05')
    const lock = await file('chALeader', O.CH_A, 'memberA', {
      action: 'LOCK',
      reason: 'Spam lặp lại',
    })
    expect(lock).toMatchObject({
      kind: 'ESCALATION',
      action: 'LOCK',
      status: 'PENDING',
      organization: { id: O.CH_A },
    })
    expect(await failure(file('chALeader', O.CH_A, 'memberA', { action: 'LOCK' }))).toMatchObject({
      status: 409,
    })
    expect(await failure(file('chALeader', O.CH_A, 'memberC', { action: 'LOCK' }))).toMatchObject({
      status: 404,
    })
    expect(
      await failure(file('chBLeader', O.CH_A, 'memberA', { action: 'DEACTIVATE' })),
    ).toMatchObject({ status: 403 })
    expect(
      await failure(file('hubLeader', O.CH_A, 'memberA', { action: 'DEACTIVATE' })),
    ).toMatchObject({ status: 403 })
    expect(await failure(file('chALeader', O.CH_A, 'chALeader', { action: 'LOCK' }))).toMatchObject(
      { status: 422 },
    )
    expect(
      await failure(file('chALeader', O.CH_A, 'memberA', { action: 'HARD_DELETE' })),
    ).toMatchObject({ status: 422 })
    // Leaders never execute and never see the queue.
    expect(
      await failure(listAccountRequests(P.chALeader.account, new URLSearchParams())),
    ).toMatchObject({ status: 403 })
    expect(await failure(getAccountRequest(P.chALeader.account, lock.id))).toMatchObject({
      status: 404,
    })
    expect(
      await failure(decideAccountRequest(P.chALeader.account, lock.id, 'PROCESS', {}, 'x')),
    ).toMatchObject({ status: 404 })
    expect(await status('memberA')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })

    await query(`INSERT INTO account_deletion_requests (account_id) VALUES ($1)`, [
      P.memberC.account,
    ])
    const queue = await listAccountRequests(P.admin.account, new URLSearchParams())
    const mine = queue.items.filter((i) =>
      [P.memberA.profile, P.memberC.profile].includes(i.target.profile_id ?? ''),
    )
    expect(mine.map((i) => [i.kind, i.action])).toEqual([
      ['ESCALATION', 'LOCK'],
      ['SELF_DELETION', 'SOFT_DELETE'],
    ])
    const processed = await decideAccountRequest(P.admin.account, lock.id, 'PROCESS', {}, 'adm05')
    expect(processed).toMatchObject({ status: 'PROCESSED', handler_profile_id: P.admin.profile })
    expect((await status('memberA')).account).toBe('BLOCKED')
    expect(
      await failure(decideAccountRequest(P.admin.account, lock.id, 'PROCESS', {}, 'x')),
    ).toMatchObject({ status: 409 })
    const selfDeletion = mine[1]!
    await decideAccountRequest(P.admin.account, selfDeletion.id, 'PROCESS', {}, 'adm05')
    expect((await status('memberC')).account).toBe('DEACTIVATED')
    const declined = await file('chALeader', O.CH_A, 'memberB', { action: 'DEACTIVATE' })
    expect(
      (
        await decideAccountRequest(
          P.admin.account,
          declined.id,
          'DECLINE',
          { reason: 'Không đủ căn cứ' },
          'adm05',
        )
      ).status,
    ).toBe('DECLINED')
    expect((await status('memberB')).account).toBe('ACTIVE')
    const audits = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE resource_id = ANY($1::uuid[]) ORDER BY created_at`,
      [[lock.id, declined.id]],
    )
    expect(audits.map((a) => a.action)).toEqual([
      'ACCOUNT_REQUEST_FILED',
      'ACCOUNT_REQUEST_PROCESSED',
      'ACCOUNT_REQUEST_FILED',
      'ACCOUNT_REQUEST_DECLINED',
    ])
    const text = JSON.stringify(
      await query(
        `SELECT before_data, after_data FROM audit_events WHERE actor_account_id::text LIKE 'ad020000-%'`,
      ),
    )
    expect(text).not.toMatch(/@example\.test|token|session_id/)
  })
})

describe('review hardening', () => {
  it('an admin never decides a request about their own account; the attempt is audited', async () => {
    const [own] = await query<{ id: string }>(
      `INSERT INTO account_deletion_requests (account_id) VALUES ($1) RETURNING id::text`,
      [P.admin.account],
    )
    for (const decision of ['PROCESS', 'DECLINE'] as const)
      expect(
        await failure(decideAccountRequest(P.admin.account, own!.id, decision, {}, 'adm05')),
        decision,
      ).toMatchObject({ status: 403 })
    expect(await status('admin')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
    const [refused] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'ACCOUNT_SELF_ACTION_REFUSED'`,
      [P.admin.account],
    )
    expect(refused!.n).toBe(2)
  })

  it('two admins locking each other at once: exactly one wins, the other is refused', async () => {
    await query(
      `INSERT INTO role_assignments (account_id, individual_profile_id, role_code, scope_type)
       VALUES ($1, $2, 'PLATFORM_ADMIN', 'PLATFORM')`,
      [P.memberC.account, P.memberC.profile],
    )
    const race = await Promise.allSettled([
      run('admin', 'memberC', 'LOCK'),
      run('memberC', 'admin', 'LOCK'),
    ])
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    for (const r of race)
      if (r.status === 'rejected') expect(r.reason).toMatchObject({ status: 403 })
    const after = [(await status('admin')).account, (await status('memberC')).account].sort()
    expect(after).toEqual(['ACTIVE', 'BLOCKED'])
  })

  it('processes the deletion request of an account that never got a profile', async () => {
    const lone = 'ad020000-0000-4000-8000-00000000fe01'
    await query(`INSERT INTO user_accounts (id, email, email_normalized) VALUES ($1, $2, $2)`, [
      lone,
      'adm02-fx-lone@example.test',
    ])
    const [request] = await query<{ id: string }>(
      `INSERT INTO account_deletion_requests (account_id) VALUES ($1) RETURNING id::text`,
      [lone],
    )
    const { token } = await createSession(lone)
    const done = await decideAccountRequest(P.admin.account, request!.id, 'PROCESS', {}, 'adm05')
    expect(done).toMatchObject({ status: 'PROCESSED', target: { profile_id: null } })
    const [account] = await query<{ status: string }>(
      `SELECT status::text AS status FROM user_accounts WHERE id = $1`,
      [lone],
    )
    expect(account!.status).toBe('DEACTIVATED')
    expect(await resolveSession(token)).toBeNull()
  })

  it('a session stops authenticating once its account is not ACTIVE, whatever set the status', async () => {
    const { token } = await createSession(P.memberB.account)
    expect(await resolveSession(token)).not.toBeNull()
    await query(`UPDATE user_accounts SET status = 'BLOCKED' WHERE id = $1`, [P.memberB.account])
    expect(await resolveSession(token)).toBeNull()
    await query(`UPDATE user_accounts SET status = 'ACTIVE' WHERE id = $1`, [P.memberB.account])
    expect(await resolveSession(token)).not.toBeNull()
  })
})

describe('account-deletion requests: processed, or rejected with a reason (PO, ADMIN-PROD-05-FIX)', () => {
  const REASON = 'Nghĩa vụ lưu giữ pháp lý: hồ sơ đang có tranh chấp chưa giải quyết.'
  const decide = (who: Person, id: string, decision: 'PROCESS' | 'DECLINE', body: unknown = {}) =>
    decideAccountRequest(P[who].account, id, decision, body, 'adm05')
  async function fileOwn(who: Person) {
    await requestAccountDeletion(P[who].account, 'adm05')
    const queue = await listAccountRequests(
      P.admin.account,
      new URLSearchParams({ kind: 'SELF_DELETION' }),
    )
    return queue.items.find((i) => i.target.profile_id === P[who].profile)!
  }
  async function kept(who: Person) {
    const [row] = await query<{ accounts: number; profiles: number; requests: number }>(
      `SELECT (SELECT count(*)::int FROM user_accounts WHERE id = $1) AS accounts,
              (SELECT count(*)::int FROM individual_profiles WHERE account_id = $1) AS profiles,
              (SELECT count(*)::int FROM account_deletion_requests WHERE account_id = $1) AS requests`,
      [P[who].account],
    )
    return row!
  }
  async function history(requestId: string) {
    return query<{ action: string; before: unknown; after: Record<string, unknown> | null }>(
      `SELECT action, before_data AS before, after_data AS after FROM audit_events
        WHERE resource_id = $1 ORDER BY created_at, action`,
      [requestId],
    )
  }

  it('names the requester only when the WF02 audit proves the user filed it', async () => {
    const own = await fileOwn('memberC')
    expect(own.requested_by_profile_id).toBe(P.memberC.profile)
    await query(`INSERT INTO account_deletion_requests (account_id) VALUES ($1)`, [
      P.memberB.account,
    ])
    const recorded = (
      await listAccountRequests(P.admin.account, new URLSearchParams({ kind: 'SELF_DELETION' }))
    ).items.find((i) => i.target.profile_id === P.memberB.profile)!
    expect(recorded.requested_by_profile_id).toBeNull()
  })

  it('rejects only with a reason; nothing about the account changes; the reason is audited', async () => {
    const own = await fileOwn('memberC')
    for (const body of [{}, undefined, null, { reason: '   ' }, { reason: null }])
      expect(
        await failure(decide('admin', own.id, 'DECLINE', body)),
        JSON.stringify(body),
      ).toMatchObject({ status: 422, fields: { reason: 'required' } })
    expect(
      await failure(decide('admin', own.id, 'DECLINE', { reason: 'x'.repeat(501) })),
    ).toMatchObject({ status: 422, fields: { reason: 'too_long' } })
    expect(
      await failure(decide('admin', own.id, 'DECLINE', { reason: REASON, hard: true })),
    ).toMatchObject({ status: 422, fields: { hard: 'not_accepted' } })
    expect((await getAccountRequest(P.admin.account, own.id)).status).toBe('PENDING')

    const rejected = await decide('admin', own.id, 'DECLINE', { reason: ` ${REASON} ` })
    expect(rejected).toMatchObject({
      status: 'DECLINED',
      handler_profile_id: P.admin.profile,
      target: { account_status: 'ACTIVE', profile_status: 'ACTIVE' },
    })
    expect(rejected.handled_at).not.toBeNull()
    expect(await status('memberC')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
    expect(await kept('memberC')).toEqual({ accounts: 1, profiles: 1, requests: 1 })
    const trail = await history(own.id)
    expect(trail.map((h) => h.action)).toEqual([
      'ACCOUNT_DELETION_REQUESTED',
      'ACCOUNT_REQUEST_DECLINED',
    ])
    expect(trail[1]).toMatchObject({
      before: { status: 'PENDING' },
      after: { status: 'DECLINED', action: 'SOFT_DELETE', reason: REASON },
    })
  })

  it('a leader’s SOFT_DELETE escalation also needs a reason; LOCK / DEACTIVATE keep it optional', async () => {
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
       VALUES ($1, $2, 'ACTIVE', 'PRESEED', now()), ($3, $2, 'ACTIVE', 'PRESEED', now())`,
      [P.memberA.profile, O.CH_A, P.memberB.profile],
    )
    const file = (target: Person, action: string) =>
      fileAccountRequest(P.chALeader.account, O.CH_A, P[target].profile, { action }, 'adm05')
    const softDelete = await file('memberA', 'SOFT_DELETE')
    expect(await failure(decide('admin', softDelete.id, 'DECLINE'))).toMatchObject({
      status: 422,
      fields: { reason: 'required' },
    })
    expect((await decide('admin', softDelete.id, 'DECLINE', { reason: REASON })).status).toBe(
      'DECLINED',
    )
    const lock = await file('memberB', 'LOCK')
    expect((await decide('admin', lock.id, 'DECLINE')).status).toBe('DECLINED')
    expect(await status('memberA')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
  })

  it('processing follows the deactivate / privacy flow and deletes nothing', async () => {
    const own = await fileOwn('memberC')
    const done = await decide('admin', own.id, 'PROCESS')
    expect(done).toMatchObject({
      status: 'PROCESSED',
      handler_profile_id: P.admin.profile,
      target: { account_status: 'DEACTIVATED', profile_status: 'DEACTIVATED' },
    })
    expect(await kept('memberC')).toEqual({ accounts: 1, profiles: 1, requests: 1 })
    expect(await failure(run('admin', 'memberC', 'REACTIVATE'))).toMatchObject({ status: 409 })
    const actions = (await history(own.id)).map((h) => h.action)
    expect(actions[0]).toBe('ACCOUNT_DELETION_REQUESTED')
    expect(actions).toContain('ACCOUNT_REQUEST_PROCESSED')
    expect(actions).not.toContain('ACCOUNT_REQUEST_DECLINED')
  })

  it('a decided request is final: duplicate or opposite decisions answer 409', async () => {
    const processed = await fileOwn('memberC')
    await decide('admin', processed.id, 'PROCESS')
    expect(await failure(decide('admin', processed.id, 'PROCESS'))).toMatchObject({ status: 409 })
    expect(
      await failure(decide('admin', processed.id, 'DECLINE', { reason: REASON })),
    ).toMatchObject({ status: 409 })
    const declined = await fileOwn('memberB')
    await decide('admin', declined.id, 'DECLINE', { reason: REASON })
    expect(
      await failure(decide('admin', declined.id, 'DECLINE', { reason: REASON })),
    ).toMatchObject({ status: 409 })
    expect(await failure(decide('admin', declined.id, 'PROCESS'))).toMatchObject({ status: 409 })
    expect(await status('memberB')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
    for (const id of [processed.id, declined.id]) {
      const decisions = (await history(id)).filter((h) =>
        ['ACCOUNT_REQUEST_PROCESSED', 'ACCOUNT_REQUEST_DECLINED'].includes(h.action),
      )
      expect(decisions).toHaveLength(1)
    }
  })

  it('only PLATFORM_ADMIN decides: leaders, members and the requester see 404', async () => {
    const own = await fileOwn('memberC')
    for (const who of ['chALeader', 'hubLeader', 'clbA1Leader', 'memberA', 'memberC'] as const)
      for (const decision of ['PROCESS', 'DECLINE'] as const)
        expect(
          await failure(decide(who, own.id, decision, { reason: REASON })),
          `${who} ${decision}`,
        ).toMatchObject({ status: 404 })
    expect(
      await failure(
        decide('admin', '00000000-0000-4000-8000-000000000000', 'DECLINE', { reason: REASON }),
      ),
    ).toMatchObject({ status: 404 })
    expect(await failure(decide('admin', 'not-a-uuid', 'PROCESS'))).toMatchObject({ status: 404 })
    expect((await getAccountRequest(P.admin.account, own.id)).status).toBe('PENDING')
    expect(await status('memberC')).toEqual({ account: 'ACTIVE', profile: 'ACTIVE' })
  })

  it('a concurrent process and reject resolve to exactly one decision', async () => {
    for (const who of ['memberC', 'memberB'] as const) {
      const own = await fileOwn(who)
      const race = await Promise.allSettled([
        decide('admin', own.id, 'PROCESS'),
        decide('admin', own.id, 'DECLINE', { reason: REASON }),
      ])
      const won = race.filter((r) => r.status === 'fulfilled')
      expect(won).toHaveLength(1)
      for (const r of race)
        if (r.status === 'rejected') expect(r.reason).toMatchObject({ status: 409 })
      const final = (await getAccountRequest(P.admin.account, own.id)).status
      expect(final).toBe(won[0]!.value.status)
      expect((await status(who)).account).toBe(final === 'PROCESSED' ? 'DEACTIVATED' : 'ACTIVE')
      expect(await kept(who)).toEqual({ accounts: 1, profiles: 1, requests: 1 })
      const decisions = (await history(own.id)).filter((h) =>
        ['ACCOUNT_REQUEST_PROCESSED', 'ACCOUNT_REQUEST_DECLINED'].includes(h.action),
      )
      expect(decisions).toHaveLength(1)
    }
  })
})
