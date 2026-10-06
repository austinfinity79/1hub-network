import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import { acceptInvitation, declineInvitation, getTeam, inviteMember, removeMember } from './team'
import { seedVenture } from './testing'

/**
 * S1-UAT-07-FIX-02 — US-02.14 "Từ chối → Chủ sở hữu thấy 'Đã từ chối', có
 * thể mời lại" against live PostgreSQL: only the invited address can decline
 * an open, unexpired invitation; the owner then sees it in `declined` (never a
 * member), may invite the address again, and the declined entry gives way to
 * the new invitation or membership. The audit event is the activity signal.
 */

afterAll(async () => {
  await closePool()
})

type Person = { accountId: string; profileId: string; email: string }

const address = () => `dec-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`

/** A completed member (onboarding DONE), directly in canonical rows. */
async function person(): Promise<Person> {
  const email = address()
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'Dec', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  return { accountId: a!.id, profileId: p!.id, email }
}

const RID = 'req-decline-test'

async function code(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error.status
    throw error
  }
  return 'OK'
}

async function state(id: string) {
  const [row] = await query<{ state: string }>(
    'SELECT state::text FROM project_members WHERE id = $1',
    [id],
  )
  return row?.state
}

async function rejectedAudits(ventureId: string) {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_events
      WHERE action = 'VENTURE_TEAM_INVITATION_REJECTED' AND after_data->>'project_id' = $1`,
    [ventureId],
  )
  return rows[0]!.n
}

async function setup() {
  const owner = await person()
  const invitee = await person()
  const v = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'Từ chối' })
  const inv = await inviteMember(
    owner.accountId,
    v.id,
    { email: invitee.email, role_label: 'Cố vấn', permission: 'VIEW' },
    RID,
  )
  return { owner, invitee, v, inv }
}

describe('US-02.14 decline, owner side', () => {
  it('the owner sees "Đã từ chối" (declined), not a member, not pending; a member sees none', async () => {
    const { owner, invitee, v, inv } = await setup()
    const mate = await person()
    const other = await inviteMember(owner.accountId, v.id, { email: mate.email }, RID)
    await acceptInvitation(mate.accountId, v.id, other.membership_id, RID)

    expect(await declineInvitation(invitee.accountId, v.id, inv.membership_id, RID)).toEqual({
      membership_id: inv.membership_id,
      state: 'REJECTED',
    })
    const team = await getTeam(owner.accountId, v.id)
    expect(team.declined).toEqual([
      {
        membership_id: inv.membership_id,
        email: invitee.email,
        role_label: 'Cố vấn',
        permission: 'VIEW',
        invited_at: inv.invited_at,
        declined_at: expect.any(String),
      },
    ])
    expect(team.rows.map((r) => r.kind)).toEqual(['OWNER', 'ACTIVE_MEMBER'])
    expect(team.counts).toEqual({ members: 2, pending: 0 })
    // G8: a member reads no invitation data of any kind.
    expect((await getTeam(mate.accountId, v.id)).declined).toEqual([])
    expect(await rejectedAudits(v.id)).toBe(1)
  })

  it('the owner can invite the address again: a new pending row replaces "Đã từ chối"', async () => {
    const { owner, invitee, v, inv } = await setup()
    await declineInvitation(invitee.accountId, v.id, inv.membership_id, RID)
    const again = await inviteMember(owner.accountId, v.id, { email: invitee.email }, RID)
    expect(again.membership_id).not.toBe(inv.membership_id)
    expect(again.resent).toBe(false)
    expect(await state(inv.membership_id)).toBe('REJECTED')

    let team = await getTeam(owner.accountId, v.id)
    expect(team.declined).toEqual([])
    expect(team.rows.filter((r) => r.kind === 'PENDING_INVITATION')).toHaveLength(1)

    // Declined again: only the latest declined invitation of the address shows.
    await declineInvitation(invitee.accountId, v.id, again.membership_id, RID)
    team = await getTeam(owner.accountId, v.id)
    expect(team.declined.map((d) => d.membership_id)).toEqual([again.membership_id])

    // Invited a third time and accepted: one ACTIVE membership, nothing declined shown.
    const third = await inviteMember(owner.accountId, v.id, { email: invitee.email }, RID)
    await acceptInvitation(invitee.accountId, v.id, third.membership_id, RID)
    team = await getTeam(owner.accountId, v.id)
    expect(team.declined).toEqual([])
    const active = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM project_members
        WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
      [v.id, invitee.profileId],
    )
    expect(active[0]!.n).toBe(1)
  })
})

describe('US-02.14 decline, who and when', () => {
  it('another account, the owner and a malformed id get 404; nothing changes', async () => {
    const { owner, v, inv } = await setup()
    const stranger = await person()
    expect(await code(declineInvitation(stranger.accountId, v.id, inv.membership_id, RID))).toBe(
      404,
    )
    expect(await code(declineInvitation(owner.accountId, v.id, inv.membership_id, RID))).toBe(404)
    expect(await code(declineInvitation(stranger.accountId, v.id, 'not-a-uuid', RID))).toBe(404)
    expect(await state(inv.membership_id)).toBe('PENDING_CONFIRMATION')
    expect((await getTeam(owner.accountId, v.id)).declined).toEqual([])
  })

  it('an expired invitation cannot be declined (409) and stays as it was', async () => {
    const { owner, invitee, v, inv } = await setup()
    await query(
      `UPDATE project_members SET invite_expires_at = now() - interval '1 minute' WHERE id = $1`,
      [inv.membership_id],
    )
    expect(await code(declineInvitation(invitee.accountId, v.id, inv.membership_id, RID))).toBe(409)
    expect(await state(inv.membership_id)).toBe('PENDING_CONFIRMATION')
    expect((await getTeam(owner.accountId, v.id)).declined).toEqual([])
    expect(await rejectedAudits(v.id)).toBe(0)
  })

  it('a revoked invitation cannot be declined (409)', async () => {
    const { owner, invitee, v, inv } = await setup()
    await removeMember(owner.accountId, v.id, inv.membership_id, RID)
    expect(await code(declineInvitation(invitee.accountId, v.id, inv.membership_id, RID))).toBe(409)
    expect(await state(inv.membership_id)).toBe('REMOVED')
    expect((await getTeam(owner.accountId, v.id)).declined).toEqual([])
  })

  it('an accepted invitation cannot be declined (409): the membership stays ACTIVE', async () => {
    const { owner, invitee, v, inv } = await setup()
    await acceptInvitation(invitee.accountId, v.id, inv.membership_id, RID)
    expect(await code(declineInvitation(invitee.accountId, v.id, inv.membership_id, RID))).toBe(409)
    expect(await state(inv.membership_id)).toBe('ACTIVE')
    expect((await getTeam(owner.accountId, v.id)).declined).toEqual([])
  })

  it('declining twice is the same outcome: one REJECTED row, one event', async () => {
    const { owner, invitee, v, inv } = await setup()
    const [a, b] = await Promise.all([
      declineInvitation(invitee.accountId, v.id, inv.membership_id, RID),
      declineInvitation(invitee.accountId, v.id, inv.membership_id, RID),
    ])
    expect(a).toEqual(b)
    expect(await declineInvitation(invitee.accountId, v.id, inv.membership_id, RID)).toEqual(a)
    expect(await rejectedAudits(v.id)).toBe(1)
    expect((await getTeam(owner.accountId, v.id)).declined).toHaveLength(1)
  })
})
