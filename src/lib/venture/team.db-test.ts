import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import {
  acceptInvitation,
  declineInvitation,
  getOwnInvitation,
  getTeam,
  inviteMember,
  removeMember,
  updateMemberRole,
  type MemberPermission,
} from './team'
import { seedVenture } from './testing'
import { getVenture, updateVenture } from './venture'

/**
 * WF02-S06 — canonical venture team against live PostgreSQL
 * (DEC-WF02-H7, DEC-WF02-S06-G1..G9, migration 008; DEC-L2R-D6..D8,
 * migration 011). The e-mail side of an invitation and ME7's own list are in
 * invitations.db-test.ts.
 */

afterAll(async () => {
  await closePool()
})

type Person = { accountId: string; profileId: string; email: string }

/** A completed member (onboarding DONE), directly in canonical rows. */
async function person(done = true): Promise<Person> {
  const email = `team-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, $3, now(), $4) RETURNING id::text`,
    [a!.id, `Person ${email.slice(5, 18)}`, done ? 'ACTIVE' : 'DRAFT', done ? new Date() : null],
  )
  return { accountId: a!.id, profileId: p!.id, email }
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status, fields: error.fields }
    throw error
  }
  throw new Error('expected a refusal')
}

const RID = 'req-team-test'

/** The team's venture; the record itself is covered by venture.db-test.ts. */
async function venture(owner: Person, name = 'Team venture', extra: Record<string, unknown> = {}) {
  return seedVenture(owner.accountId, { type: 'STARTUP', name, ...extra })
}

async function rowOf(id: string) {
  const [row] = await query<Record<string, unknown>>(
    `SELECT state::text AS state, profile_id::text AS profile_id, invite_email_normalized,
            joined_at, ended_at, invited_by_profile_id::text AS invited_by, role_label, permission
       FROM project_members WHERE id = $1`,
    [id],
  )
  return row!
}

async function auditsFor(id: string) {
  return query<{ action: string; before_data: unknown; after_data: unknown }>(
    `SELECT action, before_data, after_data FROM audit_events
      WHERE resource_type = 'project_member' AND resource_id = $1 ORDER BY created_at, id`,
    [id],
  )
}

/** Owner + one ACTIVE member reached through the real invite/accept path; VIEW unless stated. */
async function teamWithMember(permission?: MemberPermission) {
  const owner = await person()
  const mate = await person()
  const v = await venture(owner)
  const inv = await inviteMember(
    owner.accountId,
    v.id,
    { email: mate.email, role_label: 'CTO', ...(permission ? { permission } : {}) },
    RID,
  )
  await acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID)
  return { owner, mate, v, membershipId: inv.membership_id! }
}

describe('WF02-S06 invitation create', () => {
  it('owner creates a PENDING_CONFIRMATION email invitation; nothing is activated', async () => {
    const owner = await person()
    const v = await venture(owner)
    const created = await inviteMember(
      owner.accountId,
      v.id,
      { email: '  New.Person@Example.TEST ', role_label: '  Co-founder ' },
      RID,
    )
    expect(created).toMatchObject({
      kind: 'PENDING_INVITATION',
      email: 'new.person@example.test',
      role_label: 'Co-founder',
    })
    const row = await rowOf(created.membership_id!)
    expect(row).toMatchObject({
      state: 'PENDING_CONFIRMATION',
      profile_id: null,
      invite_email_normalized: 'new.person@example.test',
      joined_at: null,
      invited_by: owner.profileId,
    })
    const audits = await auditsFor(created.membership_id!)
    expect(audits.map((a) => a.action)).toEqual(['VENTURE_TEAM_INVITED'])
    expect(JSON.stringify(audits)).not.toContain('example.test')
  })

  it('client authority fields are refused; email is validated; role_label bounded', async () => {
    const owner = await person()
    const v = await venture(owner)
    for (const key of ['owner_profile_id', 'invited_by_profile_id', 'profile_id', 'state']) {
      expect(
        await refusal(inviteMember(owner.accountId, v.id, { email: 'a@b.test', [key]: 'x' }, RID)),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [key]: 'not_accepted' },
      })
    }
    expect(
      await refusal(inviteMember(owner.accountId, v.id, { email: 'not-an-email' }, RID)),
    ).toMatchObject({ status: 422, fields: { email: 'invalid' } })
    expect(
      await refusal(
        inviteMember(
          owner.accountId,
          v.id,
          { email: 'a@b.test', role_label: 'x'.repeat(101) },
          RID,
        ),
      ),
    ).toMatchObject({ status: 422, fields: { role_label: 'too_long' } })
  })

  it('DEC-L2R-D7: an invitation is VIEW unless the owner states EDIT; OWNER is never a row', async () => {
    const owner = await person()
    const v = await venture(owner)
    const viewer = await inviteMember(owner.accountId, v.id, { email: 'viewer@example.test' }, RID)
    const editor = await inviteMember(
      owner.accountId,
      v.id,
      { email: 'editor@example.test', permission: 'EDIT' },
      RID,
    )
    expect([viewer.permission, editor.permission]).toEqual(['VIEW', 'EDIT'])
    expect((await rowOf(viewer.membership_id!)).permission).toBe('VIEW')
    expect((await rowOf(editor.membership_id!)).permission).toBe('EDIT')
    expect(await auditsFor(editor.membership_id!)).toEqual([
      {
        action: 'VENTURE_TEAM_INVITED',
        before_data: null,
        after_data: { project_id: v.id, state: 'PENDING_CONFIRMATION', permission: 'EDIT' },
      },
    ])
    for (const permission of ['OWNER', 'Chủ sở hữu', 'edit', '', null, 42]) {
      expect(
        await refusal(
          inviteMember(owner.accountId, v.id, { email: 'x@example.test', permission }, RID),
        ),
        String(permission),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { permission: 'invalid' },
      })
    }
    expect(
      await query(
        `SELECT 1 FROM project_members WHERE project_id = $1 AND invite_email_normalized = 'x@example.test'`,
        [v.id],
      ),
    ).toHaveLength(0)
  })

  it('S1-UAT-07 (DEC-S1I-D4): at most 20 people, owner and live invitations counted; a closed one frees its place', async () => {
    const owner = await person()
    const v = await venture(owner)
    for (let i = 0; i < 19; i++) {
      await inviteMember(owner.accountId, v.id, { email: `cap-${i}@example.test` }, RID)
    }
    expect(
      await refusal(inviteMember(owner.accountId, v.id, { email: 'cap-20@example.test' }, RID)),
    ).toMatchObject({ code: 'TEAM_FULL', status: 409 })
    const [first] = await query<{ id: string }>(
      `SELECT id::text FROM project_members
        WHERE project_id = $1 AND invite_email_normalized = 'cap-0@example.test'`,
      [v.id],
    )
    await removeMember(owner.accountId, v.id, first!.id, RID)
    const sent = await inviteMember(owner.accountId, v.id, { email: 'cap-20@example.test' }, RID)
    expect(sent.kind).toBe('PENDING_INVITATION')
    expect((await getTeam(owner.accountId, v.id)).counts.pending).toBe(19)
  })

  it('the owner cannot invite their own email; no row is created', async () => {
    const owner = await person()
    const v = await venture(owner)
    expect(
      await refusal(inviteMember(owner.accountId, v.id, { email: owner.email.toUpperCase() }, RID)),
    ).toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      status: 422,
      fields: { email: 'invalid' },
    })
    expect(await query('SELECT 1 FROM project_members WHERE project_id = $1', [v.id])).toHaveLength(
      0,
    )
  })

  it('invite never enumerates accounts: registered and unknown emails get the same outcome', async () => {
    const owner = await person()
    const registered = await person()
    const v = await venture(owner)
    const a = await inviteMember(owner.accountId, v.id, { email: registered.email }, RID)
    const b = await inviteMember(owner.accountId, v.id, { email: 'nobody-here@example.test' }, RID)
    const shape = (r: typeof a) => Object.keys(r).sort()
    expect(shape(a)).toEqual(shape(b))
    expect([a.kind, b.kind]).toEqual(['PENDING_INVITATION', 'PENDING_INVITATION'])
    expect(JSON.stringify(a)).not.toContain(registered.profileId)
    expect(JSON.stringify(a)).not.toContain(registered.accountId)
    expect((await rowOf(a.membership_id!)).profile_id).toBeNull()
  })

  it('duplicate and concurrent duplicate invites leave exactly one pending row', async () => {
    const owner = await person()
    const v = await venture(owner)
    const first = await inviteMember(owner.accountId, v.id, { email: 'dup@example.test' }, RID)
    // US-02.11 (DEC-S1I-D5): inviting a pending address again re-sends the same row.
    expect(
      await inviteMember(owner.accountId, v.id, { email: 'DUP@example.test' }, RID),
    ).toMatchObject({ membership_id: first.membership_id, resent: true })

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        inviteMember(owner.accountId, v.id, { email: 'race@example.test' }, RID),
      ),
    )
    // Concurrent sends serialise on the venture row: one row, the others re-send it
    // (a refusal is only ever the per-address send limit).
    for (const r of results) {
      if (r.status === 'rejected') {
        expect((r.reason as { code?: string }).code).toBe('INVITATION_RATE_LIMITED')
      }
    }
    const rows = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND invite_email_normalized = 'race@example.test'`,
      [v.id],
    )
    expect(rows).toHaveLength(1)
  })

  it('non-owner cannot invite: VIEW and EDIT members 403, stranger and bad ids 404', async () => {
    const { mate, v } = await teamWithMember()
    const editing = await teamWithMember('EDIT')
    const stranger = await person()
    for (const [who, id] of [
      [mate, v.id],
      [editing.mate, editing.v.id],
    ] as const) {
      expect(
        await refusal(inviteMember(who.accountId, id, { email: 'x@example.test' }, RID)),
      ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    }
    for (const [who, id] of [
      [stranger, v.id],
      [mate, '00000000-0000-0000-0000-000000000000'],
      [mate, 'nope'],
    ] as const) {
      expect(
        await refusal(inviteMember(who.accountId, id, { email: 'x@example.test' }, RID)),
      ).toMatchObject({ status: 404 })
    }
  })
})

describe('WF02-S06 accept / decline (explicit, recipient only)', () => {
  it('accept: PENDING → ACTIVE atomically; email cleared; repeated accept is idempotent', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const inv = await inviteMember(
      owner.accountId,
      v.id,
      { email: mate.email, role_label: 'Dev' },
      RID,
    )
    // Signing in alone changes nothing (never auto-activated).
    expect((await rowOf(inv.membership_id!)).state).toBe('PENDING_CONFIRMATION')
    expect(await getOwnInvitation(mate.accountId, v.id)).toMatchObject({
      membership_id: inv.membership_id,
      role_label: 'Dev',
      permission: 'VIEW',
    })

    const first = await acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID)
    expect(first).toEqual({ membership_id: inv.membership_id, state: 'ACTIVE' })
    const row = await rowOf(inv.membership_id!)
    expect(row).toMatchObject({
      state: 'ACTIVE',
      profile_id: mate.profileId,
      invite_email_normalized: null,
      role_label: 'Dev',
      permission: 'VIEW',
    })
    expect(row.joined_at).not.toBeNull()

    expect(await acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID)).toEqual(first)
    const audits = await auditsFor(inv.membership_id!)
    expect(audits.map((a) => a.action)).toEqual(['VENTURE_TEAM_INVITED', 'VENTURE_TEAM_JOINED'])
    const read = await getVenture(mate.accountId, v.id)
    expect([read.relation, read.permission, read.can_edit]).toEqual(['MEMBER', 'VIEW', false])
  })

  it('DEC-L2R-D7: accepting keeps the level the invitation carries', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const inv = await inviteMember(
      owner.accountId,
      v.id,
      { email: mate.email, role_label: 'Dev', permission: 'EDIT' },
      RID,
    )
    const own = await getOwnInvitation(mate.accountId, v.id)
    expect(own).toEqual({
      venture: { id: v.id, name: 'Team venture', type: 'STARTUP' },
      membership_id: inv.membership_id,
      role_label: 'Dev',
      permission: 'EDIT',
      invited_at: expect.any(String),
      expires_at: expect.any(String),
    })
    expect(inv).toMatchObject({ invited_at: own!.invited_at })
    await acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID)
    expect(await rowOf(inv.membership_id!)).toMatchObject({ state: 'ACTIVE', permission: 'EDIT' })
    expect(await getVenture(mate.accountId, v.id)).toMatchObject({
      relation: 'MEMBER',
      permission: 'EDIT',
      role_label: 'Dev',
      can_edit: true,
    })
    expect((await updateVenture(mate.accountId, v.id, { name: 'Edited' }, RID)).name).toBe('Edited')
    // JOINED is a state transition; the level is not restated on it.
    expect((await auditsFor(inv.membership_id!)).at(-1)).toEqual({
      action: 'VENTURE_TEAM_JOINED',
      before_data: { project_id: v.id, state: 'PENDING_CONFIRMATION' },
      after_data: { project_id: v.id, state: 'ACTIVE' },
    })
  })

  it('concurrent accepts create one ACTIVE row and one event', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const inv = await inviteMember(owner.accountId, v.id, { email: mate.email }, RID)
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID),
      ),
    )
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
    const active = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
      [v.id, mate.profileId],
    )
    expect(active).toHaveLength(1)
    const joined = (await auditsFor(inv.membership_id!)).filter(
      (a) => a.action === 'VENTURE_TEAM_JOINED',
    )
    expect(joined).toHaveLength(1)
  })

  it('another signed-in user, the owner, or a wrong path cannot accept or decline', async () => {
    const owner = await person()
    const mate = await person()
    const other = await person()
    const v = await venture(owner)
    const w = await venture(owner, 'Other venture')
    const inv = await inviteMember(owner.accountId, v.id, { email: mate.email }, RID)
    for (const who of [other, owner]) {
      for (const act of [acceptInvitation, declineInvitation]) {
        expect(await refusal(act(who.accountId, v.id, inv.membership_id!, RID))).toMatchObject({
          status: 404,
        })
      }
    }
    // The membership must belong to the venture in the path.
    expect(
      await refusal(acceptInvitation(mate.accountId, w.id, inv.membership_id!, RID)),
    ).toMatchObject({
      status: 404,
    })
    expect(await getOwnInvitation(other.accountId, v.id)).toBeNull()
    expect((await rowOf(inv.membership_id!)).state).toBe('PENDING_CONFIRMATION')
  })

  it('accept requires completed onboarding', async () => {
    const owner = await person()
    const draft = await person(false)
    const v = await venture(owner)
    const inv = await inviteMember(owner.accountId, v.id, { email: draft.email }, RID)
    expect(
      await refusal(acceptInvitation(draft.accountId, v.id, inv.membership_id!, RID)),
    ).toMatchObject({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
  })

  it('decline: PENDING → REJECTED, no membership; repeated decline is idempotent; accept afterwards 409', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const inv = await inviteMember(owner.accountId, v.id, { email: mate.email }, RID)
    expect(await declineInvitation(mate.accountId, v.id, inv.membership_id!, RID)).toEqual({
      membership_id: inv.membership_id,
      state: 'REJECTED',
    })
    expect(await declineInvitation(mate.accountId, v.id, inv.membership_id!, RID)).toMatchObject({
      state: 'REJECTED',
    })
    const row = await rowOf(inv.membership_id!)
    expect(row).toMatchObject({ state: 'REJECTED', profile_id: null })
    expect(row.ended_at).not.toBeNull()
    expect(
      await refusal(acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID)),
    ).toMatchObject({
      code: 'MEMBERSHIP_INVALID_TRANSITION',
      status: 409,
    })
    expect(await refusal(getVenture(mate.accountId, v.id))).toMatchObject({ status: 404 })
    expect((await auditsFor(inv.membership_id!)).map((a) => a.action)).toEqual([
      'VENTURE_TEAM_INVITED',
      'VENTURE_TEAM_INVITATION_REJECTED',
    ])
  })

  it('an already-ACTIVE recipient gets no second membership', async () => {
    const { owner, mate, v } = await teamWithMember()
    // US-02.11 "Email đã là thành viên → báo 'Người này đã ở trong đội'" (DEC-S1I-D5).
    expect(
      await refusal(inviteMember(owner.accountId, v.id, { email: mate.email }, RID)),
    ).toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      status: 422,
      fields: { email: 'already_member' },
    })
    const active = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
      [v.id, mate.profileId],
    )
    expect(active).toHaveLength(1)
  })

  it('accept vs cancel race ends in exactly one terminal transition', async () => {
    for (let i = 0; i < 3; i++) {
      const owner = await person()
      const mate = await person()
      const v = await venture(owner)
      const inv = await inviteMember(owner.accountId, v.id, { email: mate.email }, RID)
      await Promise.allSettled([
        acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID),
        removeMember(owner.accountId, v.id, inv.membership_id!, RID),
      ])
      const row = await rowOf(inv.membership_id!)
      // audit_events.created_at is the transaction start time, not commit order, so
      // concurrent events are compared as a set rather than by timestamp order.
      const actions = (await auditsFor(inv.membership_id!))
        .map((a) => a.action)
        .filter((a) => a !== 'VENTURE_TEAM_INVITED')
        .sort()
      if (row.state === 'REMOVED' && row.profile_id === null) {
        // Cancel won; the accept saw a closed invitation.
        expect(actions).toEqual(['VENTURE_TEAM_REMOVED'])
      } else {
        // Accept won; the owner's remove then closed an ACTIVE member (also legal).
        expect(row.profile_id).toBe(mate.profileId)
        expect(actions).toEqual(
          row.state === 'REMOVED'
            ? ['VENTURE_TEAM_JOINED', 'VENTURE_TEAM_REMOVED']
            : ['VENTURE_TEAM_JOINED'],
        )
      }
    }
  })
})

describe('WF02-S06 role edit, cancel, remove, owner protection', () => {
  it('owner edits role_label of an ACTIVE member; forged labels grant nothing', async () => {
    const { owner, mate, v, membershipId } = await teamWithMember()
    const out = await updateMemberRole(
      owner.accountId,
      v.id,
      membershipId,
      { role_label: 'Owner' },
      RID,
    )
    expect(out).toEqual({
      membership_id: membershipId,
      state: 'ACTIVE',
      role_label: 'Owner',
      permission: 'VIEW',
    })
    // Same value again: no new event.
    await updateMemberRole(owner.accountId, v.id, membershipId, { role_label: 'Owner' }, RID)
    const changed = (await auditsFor(membershipId)).filter(
      (a) => a.action === 'VENTURE_TEAM_ROLE_CHANGED',
    )
    expect(changed).toHaveLength(1)
    expect(JSON.stringify(changed)).not.toContain('Owner')
    // A label of "Owner" still grants no management capability, and no level.
    expect(await refusal(updateVenture(mate.accountId, v.id, { name: 'x' }, RID))).toMatchObject({
      status: 403,
    })
    expect(
      await refusal(inviteMember(mate.accountId, v.id, { email: 'q@example.test' }, RID)),
    ).toMatchObject({ status: 403 })
    const roles = await query('SELECT 1 FROM role_assignments WHERE individual_profile_id = $1', [
      mate.profileId,
    ])
    expect(roles).toHaveLength(0)
  })

  it('DEC-L2R-D7: the owner sets a member’s level; a change is audited with the level, never the label', async () => {
    const { owner, mate, v, membershipId } = await teamWithMember()
    const raised = await updateMemberRole(
      owner.accountId,
      v.id,
      membershipId,
      { permission: 'EDIT' },
      RID,
    )
    expect(raised).toEqual({
      membership_id: membershipId,
      state: 'ACTIVE',
      role_label: 'CTO',
      permission: 'EDIT',
    })
    expect(await getVenture(mate.accountId, v.id)).toMatchObject({
      permission: 'EDIT',
      can_edit: true,
    })
    const both = await updateMemberRole(
      owner.accountId,
      v.id,
      membershipId,
      { role_label: 'Advisor', permission: 'VIEW' },
      RID,
    )
    expect(both).toMatchObject({ role_label: 'Advisor', permission: 'VIEW' })
    expect(await getVenture(mate.accountId, v.id)).toMatchObject({
      permission: 'VIEW',
      role_label: 'Advisor',
      can_edit: false,
    })
    const changed = (await auditsFor(membershipId)).filter(
      (a) => a.action === 'VENTURE_TEAM_ROLE_CHANGED',
    )
    expect(changed.map((a) => [a.before_data, a.after_data])).toEqual([
      [
        { project_id: v.id, state: 'ACTIVE', permission: 'VIEW' },
        { project_id: v.id, state: 'ACTIVE', permission: 'EDIT' },
      ],
      [
        { project_id: v.id, state: 'ACTIVE', permission: 'EDIT' },
        { project_id: v.id, state: 'ACTIVE', permission: 'VIEW' },
      ],
    ])
    expect(JSON.stringify(changed)).not.toMatch(/CTO|Advisor/)
    for (const [body, field, reason] of [
      [{}, 'role_label', 'required'],
      [{ permission: 'OWNER' }, 'permission', 'invalid'],
      [{ permission: 'view' }, 'permission', 'invalid'],
      [{ role_label: 'x', permission: null }, 'permission', 'invalid'],
    ] as const) {
      expect(
        await refusal(updateMemberRole(owner.accountId, v.id, membershipId, body, RID)),
        JSON.stringify(body),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [field]: reason },
      })
    }
    expect(await rowOf(membershipId)).toMatchObject({ role_label: 'Advisor', permission: 'VIEW' })
  })

  it('DEC-L2R-D7: an EDIT member updates the venture and nothing in the team', async () => {
    const { owner, mate, v, membershipId } = await teamWithMember('EDIT')
    const other = await inviteMember(owner.accountId, v.id, { email: 'other@example.test' }, RID)
    expect((await updateVenture(mate.accountId, v.id, { name: 'By the member' }, RID)).name).toBe(
      'By the member',
    )
    expect(
      await refusal(inviteMember(mate.accountId, v.id, { email: 'q@example.test' }, RID)),
    ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    expect(
      await refusal(
        updateMemberRole(mate.accountId, v.id, membershipId, { permission: 'EDIT' }, RID),
      ),
    ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    for (const id of [other.membership_id!, membershipId]) {
      expect(await refusal(removeMember(mate.accountId, v.id, id, RID))).toMatchObject({
        code: 'SCOPE_FORBIDDEN',
        status: 403,
      })
    }
    expect(await getTeam(mate.accountId, v.id)).toMatchObject({
      viewer: 'MEMBER',
      can_manage: false,
      counts: { members: 2, pending: null },
    })
    expect((await rowOf(other.membership_id!)).state).toBe('PENDING_CONFIRMATION')
    expect((await getTeam(owner.accountId, v.id)).counts.pending).toBe(1)
  })

  it('non-owner cannot change roles or remove; body authority fields refused', async () => {
    const { owner, mate, v, membershipId } = await teamWithMember()
    expect(
      await refusal(updateMemberRole(mate.accountId, v.id, membershipId, { role_label: 'x' }, RID)),
    ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    expect(await refusal(removeMember(mate.accountId, v.id, membershipId, RID))).toMatchObject({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
    for (const key of ['state', 'profile_id', 'owner_profile_id']) {
      expect(
        await refusal(updateMemberRole(owner.accountId, v.id, membershipId, { [key]: 'x' }, RID)),
      ).toMatchObject({ status: 422, fields: { [key]: 'not_accepted' } })
    }
  })

  it('pending cancel and ACTIVE remove → REMOVED, rows kept; closed rows 409', async () => {
    const { owner, mate, v, membershipId } = await teamWithMember()
    const pending = await inviteMember(owner.accountId, v.id, { email: 'c@example.test' }, RID)
    expect(await removeMember(owner.accountId, v.id, pending.membership_id!, RID)).toEqual({
      membership_id: pending.membership_id,
      state: 'REMOVED',
    })
    expect(await rowOf(pending.membership_id!)).toMatchObject({
      state: 'REMOVED',
      profile_id: null,
      invite_email_normalized: 'c@example.test',
    })
    expect(await removeMember(owner.accountId, v.id, membershipId, RID)).toMatchObject({
      state: 'REMOVED',
    })
    const removed = await rowOf(membershipId)
    expect(removed).toMatchObject({ state: 'REMOVED', profile_id: mate.profileId })
    expect(removed.ended_at).not.toBeNull()
    expect(await refusal(removeMember(owner.accountId, v.id, membershipId, RID))).toMatchObject({
      code: 'MEMBERSHIP_INVALID_TRANSITION',
      status: 409,
    })
    expect(
      await refusal(
        updateMemberRole(owner.accountId, v.id, membershipId, { role_label: 'x' }, RID),
      ),
    ).toMatchObject({ status: 409 })
    // The removed member loses venture:read; the invitation stays closed for its email.
    expect(await refusal(getVenture(mate.accountId, v.id))).toMatchObject({ status: 404 })
  })

  it('remove vs role update race leaves a coherent row', async () => {
    const { owner, v, membershipId } = await teamWithMember()
    await Promise.allSettled([
      removeMember(owner.accountId, v.id, membershipId, RID),
      updateMemberRole(owner.accountId, v.id, membershipId, { role_label: 'Race' }, RID),
    ])
    const row = await rowOf(membershipId)
    expect(row.state).toBe('REMOVED')
    expect(row.ended_at).not.toBeNull()
  })

  it('the owner has no row: cannot be removed; owner_profile_id never changes; legacy owner rows are hidden', async () => {
    const { owner, v } = await teamWithMember()
    // A legacy owner member row (pre-S06 fixture shape) is neither listed nor addressable.
    const [legacy] = await query<{ id: string }>(
      `INSERT INTO project_members (project_id, profile_id, role_label, state) VALUES ($1, $2, 'Founder', 'ACTIVE') RETURNING id::text`,
      [v.id, owner.profileId],
    )
    expect(await refusal(removeMember(owner.accountId, v.id, legacy!.id, RID))).toMatchObject({
      status: 404,
    })
    const team = await getTeam(owner.accountId, v.id)
    expect(team.rows.filter((r) => r.kind === 'OWNER')).toHaveLength(1)
    expect(team.rows.some((r) => r.membership_id === legacy!.id)).toBe(false)
    const [p] = await query<{ owner: string }>(
      'SELECT owner_profile_id::text AS owner FROM projects WHERE id = $1',
      [v.id],
    )
    expect(p!.owner).toBe(owner.profileId)
  })

  it('no cross-project mutation: a membership id under another venture path is 404', async () => {
    const { owner, v, membershipId } = await teamWithMember()
    const w = await venture(owner, 'Second')
    expect(await refusal(removeMember(owner.accountId, w.id, membershipId, RID))).toMatchObject({
      status: 404,
    })
    expect(
      await refusal(
        updateMemberRole(owner.accountId, w.id, membershipId, { role_label: 'x' }, RID),
      ),
    ).toMatchObject({ status: 404 })
    expect((await rowOf(membershipId)).state).toBe('ACTIVE')
    expect((await getTeam(owner.accountId, v.id)).counts.members).toBe(2)
  })

  it('ARCHIVED venture: team is read-only', async () => {
    const { owner, v, membershipId } = await teamWithMember()
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    expect(
      await refusal(inviteMember(owner.accountId, v.id, { email: 'z@example.test' }, RID)),
    ).toMatchObject({ code: 'PROFILE_DEACTIVATED', status: 409 })
    expect(await refusal(removeMember(owner.accountId, v.id, membershipId, RID))).toMatchObject({
      status: 409,
    })
    expect((await getTeam(owner.accountId, v.id)).can_manage).toBe(false)
  })
})

describe('WF02-S06 list and privacy (G8)', () => {
  it('owner sees owner, ACTIVE members and pending emails; member sees no pending data', async () => {
    const { owner, mate, v } = await teamWithMember()
    await inviteMember(owner.accountId, v.id, { email: 'hidden-pending@example.test' }, RID)
    const declined = await person()
    const d = await inviteMember(owner.accountId, v.id, { email: declined.email }, RID)
    await declineInvitation(declined.accountId, v.id, d.membership_id!, RID)

    const own = await getTeam(owner.accountId, v.id)
    expect(own.viewer).toBe('OWNER')
    expect(own.rows.map((r) => r.kind)).toEqual(['OWNER', 'ACTIVE_MEMBER', 'PENDING_INVITATION'])
    expect(own.rows[0]).toMatchObject({
      membership_id: null,
      joined_at: null,
      role_label: null,
      permission: 'OWNER',
    })
    expect(own.counts).toEqual({ members: 2, pending: 1 })

    const seen = await getTeam(mate.accountId, v.id)
    expect(seen).toMatchObject({
      viewer: 'MEMBER',
      can_manage: false,
      counts: { members: 2, pending: null },
    })
    expect(seen.rows.map((r) => r.kind)).toEqual(['OWNER', 'ACTIVE_MEMBER'])
    const json = JSON.stringify(seen)
    for (const secret of [
      'hidden-pending',
      declined.email,
      owner.email,
      mate.email,
      owner.profileId,
      mate.profileId,
    ]) {
      expect(json).not.toContain(secret)
    }
    expect(json).not.toMatch(/"(email|metadata|slug|profile_id|account_id|invited_by_profile_id)"/)
    // The owner's own view carries only the pending email it manages.
    expect(JSON.stringify(own)).not.toContain(declined.email)
  })

  it('stranger, pending invitee and removed member cannot read the team', async () => {
    const { owner, mate, v, membershipId } = await teamWithMember()
    const stranger = await person()
    const invitee = await person()
    await inviteMember(owner.accountId, v.id, { email: invitee.email }, RID)
    await removeMember(owner.accountId, v.id, membershipId, RID)
    for (const who of [stranger, invitee, mate]) {
      expect(await refusal(getTeam(who.accountId, v.id))).toMatchObject({ status: 404 })
    }
    expect(await getOwnInvitation(invitee.accountId, v.id)).not.toBeNull()
  })

  it('DEC-L2R-D6/D7: every row states its level; the owner row states the creator role', async () => {
    const owner = await person()
    const editor = await person()
    const v = await venture(owner, 'Levels', { owner_role_label: 'Founder' })
    const inv = await inviteMember(
      owner.accountId,
      v.id,
      { email: editor.email, role_label: 'Dev', permission: 'EDIT' },
      RID,
    )
    await inviteMember(owner.accountId, v.id, { email: 'waiting@example.test' }, RID)
    await acceptInvitation(editor.accountId, v.id, inv.membership_id!, RID)
    const team = await getTeam(owner.accountId, v.id)
    expect(team.rows.map((r) => [r.kind, r.role_label, r.permission])).toEqual([
      ['OWNER', 'Founder', 'OWNER'],
      ['ACTIVE_MEMBER', 'Dev', 'EDIT'],
      ['PENDING_INVITATION', null, 'VIEW'],
    ])
    // The creator role is display text of the owner row, not a level and not a member row.
    expect(team.counts).toEqual({ members: 2, pending: 1 })
    expect((await getTeam(editor.accountId, v.id)).rows.map((r) => r.permission)).toEqual([
      'OWNER',
      'EDIT',
    ])
  })
})
