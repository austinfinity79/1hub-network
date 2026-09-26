import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { createSession, resolveSession } from '@/lib/auth/sessions'
import { closePool, query } from '@/lib/db/client'

import {
  listOwnSessions,
  requestAccountDeletion,
  revokeAllOwnSessions,
  revokeOwnSession,
} from './settings'

/**
 * WF02-S07 — sessions and the P13 deletion request against live PostgreSQL
 * (DEC-WF02-S07-G1..G6).
 */

afterAll(async () => {
  await closePool()
})

async function account(): Promise<string> {
  const email = `set-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

async function login(accountId: string) {
  const { token } = await createSession(accountId)
  const session = (await resolveSession(token))!
  return { token, id: session.sessionId }
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status }
    throw error
  }
  throw new Error('expected a refusal')
}

describe('own sessions (WF02-S07)', () => {
  it('lists only the account’s active sessions, current first, with safe fields', async () => {
    const a = await account()
    const b = await account()
    const s1 = await login(a)
    const s2 = await login(a)
    const expired = await login(a)
    await query(`UPDATE user_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1`, [
      expired.id,
    ])
    const revoked = await login(a)
    await query('UPDATE user_sessions SET revoked_at = now() WHERE id = $1', [revoked.id])
    await login(b)

    const list = await listOwnSessions(a, s1.id)
    expect(list.map((s) => [s.id, s.current])).toEqual([
      [s1.id, true],
      [s2.id, false],
    ])
    expect(Object.keys(list[0]!).sort()).toEqual(['created_at', 'current', 'expires_at', 'id'])
    const json = JSON.stringify(list)
    expect(json).not.toContain(s1.token)
    expect(json).not.toMatch(/token|hash|account_id|ip|agent|device/i)
  })

  it('revokes an own session immediately; the token stops working', async () => {
    const a = await account()
    const current = await login(a)
    const other = await login(a)
    expect(await revokeOwnSession(a, other.id, current.id)).toEqual({ current: false })
    expect(await resolveSession(other.token)).toBeNull()
    expect(await resolveSession(current.token)).not.toBeNull()
    // Revoking the current one reports it, so the route can clear the cookie.
    expect(await revokeOwnSession(a, current.id, current.id)).toEqual({ current: true })
    expect(await resolveSession(current.token)).toBeNull()
  })

  it('already revoked or expired own sessions are idempotent successes', async () => {
    const a = await account()
    const current = await login(a)
    const s = await login(a)
    await revokeOwnSession(a, s.id, current.id)
    const [before] = await query<{ revoked_at: Date }>(
      'SELECT revoked_at FROM user_sessions WHERE id = $1',
      [s.id],
    )
    await revokeOwnSession(a, s.id, current.id)
    const [after] = await query<{ revoked_at: Date }>(
      'SELECT revoked_at FROM user_sessions WHERE id = $1',
      [s.id],
    )
    expect(after!.revoked_at).toEqual(before!.revoked_at)
    const e = await login(a)
    await query(`UPDATE user_sessions SET expires_at = now() - interval '1 second' WHERE id = $1`, [
      e.id,
    ])
    await expect(revokeOwnSession(a, e.id, current.id)).resolves.toEqual({ current: false })
  })

  it('a foreign, unknown or malformed id is the same 404 and changes nothing', async () => {
    const a = await account()
    const b = await account()
    const mine = await login(a)
    const theirs = await login(b)
    for (const id of [
      theirs.id,
      '00000000-0000-0000-0000-000000000000',
      'not-a-uuid',
      "'; DROP TABLE x;--",
    ]) {
      expect(await refusal(revokeOwnSession(a, id, mine.id)), id).toEqual({
        code: 'UNCONTRACTED_NOT_FOUND',
        status: 404,
      })
    }
    expect(await resolveSession(theirs.token)).not.toBeNull()
  })

  it('concurrent revokes of the same session are safe', async () => {
    const a = await account()
    const current = await login(a)
    const s = await login(a)
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => revokeOwnSession(a, s.id, current.id)),
    )
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    expect(await resolveSession(s.token)).toBeNull()
  })

  it('revoke-all ends every session of the account, and only that account', async () => {
    const a = await account()
    const b = await account()
    const sessions = [await login(a), await login(a), await login(a)]
    const other = await login(b)
    expect(await revokeAllOwnSessions(a)).toBe(3)
    for (const s of sessions) expect(await resolveSession(s.token)).toBeNull()
    expect(await resolveSession(other.token)).not.toBeNull()
    expect(await revokeAllOwnSessions(a)).toBe(0)
    // A session created afterwards is unaffected (new login).
    const fresh = await login(a)
    expect(await resolveSession(fresh.token)).not.toBeNull()
  })
})

describe('account deletion request (WF02-S07, P13)', () => {
  const audits = async (accountId: string) =>
    (
      await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'ACCOUNT_DELETION_REQUESTED'`,
        [accountId],
      )
    )[0]!.n

  it('first request 201 + one audit; repeat 200 with the same row and no audit', async () => {
    const a = await account()
    const first = await requestAccountDeletion(a, 'r1')
    expect(first.status).toBe(201)
    expect(Object.keys(first.body).sort()).toEqual(['id', 'requested_at'])
    const again = await requestAccountDeletion(a, 'r2')
    expect(again).toEqual({ status: 200, body: first.body })
    expect(await audits(a)).toBe(1)
    const [audit] = await query<{ after_data: unknown; resource_id: string }>(
      `SELECT after_data, resource_id::text FROM audit_events WHERE actor_account_id = $1 AND action = 'ACCOUNT_DELETION_REQUESTED'`,
      [a],
    )
    expect(audit).toEqual({ after_data: { requested: true }, resource_id: first.body.id })
  })

  it('concurrent requests leave exactly one row and one audit', async () => {
    const a = await account()
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => requestAccountDeletion(a, `c${i}`)),
    )
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1)
    const rows = await query('SELECT id FROM account_deletion_requests WHERE account_id = $1', [a])
    expect(rows).toHaveLength(1)
    expect(await audits(a)).toBe(1)
  })

  it('the database refuses a second row for the same account', async () => {
    const a = await account()
    await requestAccountDeletion(a, 'r')
    await expect(
      query('INSERT INTO account_deletion_requests (account_id) VALUES ($1)', [a]),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('a request changes nothing else: account, profile, network, consent, visibility, sessions', async () => {
    const a = await account()
    const s = await login(a)
    const [p] = await query<{ id: string }>(
      `INSERT INTO individual_profiles (account_id, display_name, status, avatar_asset_id, onboarding_completed_at)
       VALUES ($1, 'Chi', 'ACTIVE', 'asset_0123456789abcdef0123456789abcdef', now()) RETURNING id::text`,
      [a],
    )
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, '10000000-0000-0000-0000-000000000101', 'ACTIVE', 'ORGANIZATION_VERIFIED')`,
      [p!.id],
    )
    await query(
      `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, '10000000-0000-0000-0000-000000000101', 'Chapter Leader', 'ACTIVE')`,
      [p!.id],
    )
    await query(
      `INSERT INTO projects (type, owner_profile_id, slug, name, status) VALUES ('STARTUP', $1, $2, 'V', 'ACTIVE')`,
      [p!.id, `del-${Date.now()}`],
    )
    await query(
      `INSERT INTO profile_visibility_settings (profile_id, default_level) VALUES ($1, 'NETWORK_ONLY')`,
      [p!.id],
    )
    await query(
      `INSERT INTO consent_records (account_id, consent_type, legal_document_id)
       SELECT $1, document_type::text::consent_type, id FROM legal_documents WHERE retired_at IS NULL AND effective_at <= now() LIMIT 1`,
      [a],
    )
    const snapshot = () =>
      query(
        `SELECT
           (SELECT row_to_json(u)::text FROM user_accounts u WHERE id = $1) AS account,
           (SELECT row_to_json(x)::text FROM individual_profiles x WHERE account_id = $1) AS profile,
           (SELECT json_agg(m ORDER BY m.id)::text FROM community_memberships m WHERE profile_id = $2) AS memberships,
           (SELECT json_agg(l ORDER BY l.id)::text FROM leadership_records l WHERE profile_id = $2) AS leadership,
           (SELECT json_agg(r ORDER BY r.id)::text FROM role_assignments r WHERE individual_profile_id = $2) AS roles,
           (SELECT json_agg(j ORDER BY j.id)::text FROM projects j WHERE owner_profile_id = $2) AS projects,
           (SELECT row_to_json(v)::text FROM profile_visibility_settings v WHERE profile_id = $2) AS visibility,
           (SELECT json_agg(c ORDER BY c.id)::text FROM consent_records c WHERE account_id = $1) AS consents,
           (SELECT json_agg(s ORDER BY s.id)::text FROM user_sessions s WHERE account_id = $1) AS sessions`,
        [a, p!.id],
      )
    const before = await snapshot()
    await requestAccountDeletion(a, 'inv')
    expect(await snapshot()).toEqual(before)
    expect(await resolveSession(s.token)).not.toBeNull()
  })
})
