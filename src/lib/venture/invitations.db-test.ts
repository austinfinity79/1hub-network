import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import {
  invitationSentence,
  renderInvitationEmail,
  type InvitationNotice,
} from './invitation-email'
import {
  acceptInvitation,
  declineInvitation,
  getOwnInvitation,
  INVITE_SEND_LIMITS,
  inviteMember,
  listOwnInvitations,
  removeMember,
} from './team'
import { seedVenture } from './testing'
import { listOwnVentures } from './venture'

/**
 * WF02 invitations by e-mail against live PostgreSQL (DEC-L2R-D8): the notice
 * is handed over inside the invitation's transaction, the invitee finds their
 * own invitations on ME7 (`GET /me/venture-invitations`) and joins only by
 * accepting, and the message is plain text with one link and no token. Nothing
 * here reaches a mail provider; team lifecycle itself is in team.db-test.ts.
 */

afterAll(async () => {
  await closePool()
})

type Person = { accountId: string; profileId: string; email: string }

const address = () => `inv-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`

async function account(email = address()): Promise<{ accountId: string; email: string }> {
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return { accountId: a!.id, email }
}

/** A completed member (onboarding DONE), directly in canonical rows. */
async function person(): Promise<Person> {
  const { accountId, email } = await account()
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'Inv', 'ACTIVE', now(), now()) RETURNING id::text`,
    [accountId],
  )
  return { accountId, profileId: p!.id, email }
}

const RID = 'req-invitations-test'

async function venture(
  owner: Person,
  name = 'Nông nghiệp số',
  extra: Record<string, unknown> = {},
) {
  return seedVenture(owner.accountId, { type: 'STARTUP', name, ...extra })
}

async function pendingRows(ventureId: string) {
  return query<{ id: string; permission: string }>(
    `SELECT id::text, permission FROM project_members
      WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION'`,
    [ventureId],
  )
}

/** Team events of one venture; the membership id is the resource, the venture is in the data. */
async function teamAudits(ventureId: string) {
  return query<{ action: string }>(
    `SELECT action FROM audit_events
      WHERE resource_type = 'project_member' AND after_data->>'project_id' = $1
      ORDER BY created_at, id`,
    [ventureId],
  )
}

describe('DEC-L2R-D8 sending', () => {
  it('the notice is handed over inside the transaction, with the venture, role and level', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const seen: InvitationNotice[] = []
    let visibleWhileSending: number | undefined
    const created = await inviteMember(
      owner.accountId,
      v.id,
      { email: ` ${mate.email.toUpperCase()} `, role_label: ' Cố vấn ', permission: 'EDIT' },
      RID,
      async (notice) => {
        seen.push(notice)
        // Another connection: nothing of the invitation is committed while it is being sent.
        visibleWhileSending = (await pendingRows(v.id)).length
      },
    )
    expect(seen).toEqual([
      {
        to: mate.email,
        venture: { name: 'Nông nghiệp số', type: 'STARTUP' },
        role_label: 'Cố vấn',
        permission: 'EDIT',
      },
    ])
    expect(visibleWhileSending).toBe(0)
    expect(await pendingRows(v.id)).toEqual([{ id: created.membership_id, permission: 'EDIT' }])
    expect((await teamAudits(v.id)).map((a) => a.action)).toEqual(['VENTURE_TEAM_INVITED'])
  })

  it('a notice that cannot be sent leaves no invitation, no event, and the address free', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const down = new Error('provider down')
    await expect(
      inviteMember(owner.accountId, v.id, { email: mate.email, permission: 'EDIT' }, RID, () =>
        Promise.reject(down),
      ),
    ).rejects.toBe(down)
    expect(await query('SELECT 1 FROM project_members WHERE project_id = $1', [v.id])).toHaveLength(
      0,
    )
    expect(await teamAudits(v.id)).toEqual([])
    expect(await listOwnInvitations(mate.accountId)).toEqual([])
    // The next attempt is not a duplicate.
    const sent = await inviteMember(
      owner.accountId,
      v.id,
      { email: mate.email },
      RID,
      async () => {},
    )
    expect(sent.kind).toBe('PENDING_INVITATION')
    expect(await pendingRows(v.id)).toEqual([{ id: sent.membership_id, permission: 'VIEW' }])
  })
})

describe('DEC-L2R-D13 send limits', () => {
  const sent = async () => {}
  const code = async (promise: Promise<unknown>) =>
    promise.then(
      () => 'sent',
      (error: unknown) => (isApiError(error) ? `${error.status} ${error.code}` : error),
    )

  it('one address of one venture: three sends a day, cancelling gives none back', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    for (let n = 0; n < INVITE_SEND_LIMITS.perAddress; n++) {
      const row = await inviteMember(owner.accountId, v.id, { email: mate.email }, RID, sent)
      await removeMember(owner.accountId, v.id, row.membership_id!, RID)
    }
    let delivered = 0
    expect(
      await code(
        inviteMember(owner.accountId, v.id, { email: mate.email }, RID, async () => {
          delivered++
        }),
      ),
    ).toBe('429 INVITATION_RATE_LIMITED')
    expect(delivered).toBe(0)
    expect(await pendingRows(v.id)).toEqual([])
    // Another address of the same venture is not held back.
    expect(await code(inviteMember(owner.accountId, v.id, { email: address() }, RID, sent))).toBe(
      'sent',
    )
  })

  it('one inviter: at most fifty sends a day across ventures', async () => {
    const owner = await person()
    const ventures = [
      await venture(owner, 'A'),
      await venture(owner, 'B'),
      await venture(owner, 'C'),
    ]
    for (let n = 0; n < INVITE_SEND_LIMITS.perInviter; n++) {
      const v = ventures[Math.floor(n / 20)]!
      await inviteMember(owner.accountId, v.id, { email: address() }, RID, sent)
    }
    expect(
      await code(inviteMember(owner.accountId, ventures[2]!.id, { email: address() }, RID, sent)),
    ).toBe('429 INVITATION_RATE_LIMITED')
    // Another owner is not held back.
    const other = await person()
    expect(
      await code(
        inviteMember(other.accountId, (await venture(other)).id, { email: address() }, RID, sent),
      ),
    ).toBe('sent')
  })

  it('concurrent invitations never pass the pending cap of a venture', async () => {
    const owner = await person()
    const v = await venture(owner)
    for (let n = 0; n < 18; n++)
      await inviteMember(owner.accountId, v.id, { email: address() }, RID, sent)
    const results = await Promise.all(
      [0, 1, 2, 3].map(() =>
        code(inviteMember(owner.accountId, v.id, { email: address() }, RID, sent)),
      ),
    )
    expect(results.filter((r) => r === 'sent')).toHaveLength(2)
    expect(await pendingRows(v.id)).toHaveLength(20)
  })
})

describe('DEC-L2R-D8 GET /me/venture-invitations', () => {
  it('own address only, oldest first, open ventures, never one’s own; gone once answered', async () => {
    const me = await person()
    const a = await person()
    const b = await person()
    const c = await person()
    const fromA = await venture(a, 'Alpha')
    const fromB = await venture(b, 'Beta', { type: 'PROJECT' })
    const fromC = await venture(c, 'Gamma')
    const mine = await venture(me, 'Mine')
    const invA = await inviteMember(
      a.accountId,
      fromA.id,
      { email: me.email, role_label: 'Dev', permission: 'EDIT' },
      RID,
    )
    const invB = await inviteMember(b.accountId, fromB.id, { email: me.email }, RID)
    const invC = await inviteMember(c.accountId, fromC.id, { email: me.email }, RID)
    await inviteMember(a.accountId, fromA.id, { email: 'someone-else@example.test' }, RID)
    // An archived venture invites nobody any more.
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [fromC.id])
    // A pending row carrying the owner's own address on the owner's venture is not an invitation.
    await query(
      `INSERT INTO project_members (project_id, role_label, state, joined_at, invite_email_normalized, invited_by_profile_id, invited_at)
       VALUES ($1, 'Self', 'PENDING_CONFIRMATION', NULL, $2, $3, now())`,
      [mine.id, me.email, me.profileId],
    )
    // Oldest first, by the time of the invitation rather than of the venture.
    await query('UPDATE project_members SET invited_at = $2 WHERE id = $1', [
      invA.membership_id,
      '2026-03-01T09:00:00Z',
    ])
    await query('UPDATE project_members SET invited_at = $2 WHERE id = $1', [
      invB.membership_id,
      '2026-02-01T09:00:00Z',
    ])

    const list = await listOwnInvitations(me.accountId)
    expect(list).toEqual([
      {
        venture: { id: fromB.id, name: 'Beta', type: 'PROJECT' },
        membership_id: invB.membership_id,
        role_label: null,
        permission: 'VIEW',
        invited_at: '2026-02-01T09:00:00.000Z',
      },
      {
        venture: { id: fromA.id, name: 'Alpha', type: 'STARTUP' },
        membership_id: invA.membership_id,
        role_label: 'Dev',
        permission: 'EDIT',
        invited_at: '2026-03-01T09:00:00.000Z',
      },
    ])
    const json = JSON.stringify(list)
    for (const secret of [me.email, a.email, 'someone-else', a.profileId, me.profileId]) {
      expect(json).not.toContain(secret)
    }
    expect(json).not.toMatch(/"(email|status|profile_id|account_id|invited_by_profile_id)"/)
    // Nobody else is asked about these invitations.
    for (const who of [a, b, c]) expect(await listOwnInvitations(who.accountId)).toEqual([])

    // Declined by me, cancelled by the owner, reopened venture: each one answers for itself.
    await declineInvitation(me.accountId, fromB.id, invB.membership_id!, RID)
    expect((await listOwnInvitations(me.accountId)).map((i) => i.venture.id)).toEqual([fromA.id])
    await removeMember(a.accountId, fromA.id, invA.membership_id!, RID)
    expect(await listOwnInvitations(me.accountId)).toEqual([])
    await query(`UPDATE projects SET status = 'DRAFT' WHERE id = $1`, [fromC.id])
    expect((await listOwnInvitations(me.accountId)).map((i) => i.membership_id)).toEqual([
      invC.membership_id,
    ])
  })

  it('an archived venture offers its invitation nowhere: not listed, not on its team page', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    await inviteMember(owner.accountId, v.id, { email: mate.email }, RID, async () => {})
    expect(await getOwnInvitation(mate.accountId, v.id)).not.toBeNull()
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    expect(await getOwnInvitation(mate.accountId, v.id)).toBeNull()
    expect(await listOwnInvitations(mate.accountId)).toEqual([])
  })

  it('an account without a profile is asked too: the invitation waits for the address', async () => {
    const owner = await person()
    const bare = await account()
    const v = await venture(owner)
    const inv = await inviteMember(owner.accountId, v.id, { email: bare.email }, RID)
    const [own] = await listOwnInvitations(bare.accountId)
    expect(own).toEqual({
      venture: { id: v.id, name: 'Nông nghiệp số', type: 'STARTUP' },
      membership_id: inv.membership_id,
      role_label: null,
      permission: 'VIEW',
      invited_at: expect.any(String),
    })
    expect(inv).toMatchObject({ invited_at: own!.invited_at })
    expect(await listOwnInvitations('00000000-0000-0000-0000-000000000000')).toEqual([])
  })

  it('accepting keeps the invited level; the venture then lists as MEMBER on ME7', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner, 'Nông nghiệp số', { owner_role_label: 'Founder' })
    const inv = await inviteMember(
      owner.accountId,
      v.id,
      { email: mate.email, role_label: 'Kỹ thuật', permission: 'EDIT' },
      RID,
    )
    // Pending is not a relation.
    expect(await listOwnVentures(mate.accountId)).toEqual([])
    expect((await listOwnInvitations(mate.accountId)).map((i) => i.membership_id)).toEqual([
      inv.membership_id,
    ])
    expect((await listOwnVentures(owner.accountId))[0]).toMatchObject({
      id: v.id,
      members: 1,
      pending_invitations: 1,
    })

    await acceptInvitation(mate.accountId, v.id, inv.membership_id!, RID)
    expect(await listOwnInvitations(mate.accountId)).toEqual([])
    expect(await listOwnVentures(mate.accountId)).toMatchObject([
      {
        id: v.id,
        name: 'Nông nghiệp số',
        relation: 'MEMBER',
        permission: 'EDIT',
        role_label: 'Kỹ thuật',
        can_edit: true,
        members: 2,
        pending_invitations: null,
      },
    ])
    expect((await listOwnVentures(owner.accountId))[0]).toMatchObject({
      id: v.id,
      relation: 'OWNER',
      permission: 'OWNER',
      role_label: 'Founder',
      members: 2,
      pending_invitations: 0,
    })
  })
})

describe('DEC-L2R-D8 the message', () => {
  const link = 'https://1hub.network/projects'

  it('names the venture, the role and the level in one sentence (ME7)', () => {
    expect(
      invitationSentence({
        venture: { name: 'AgriLink', type: 'STARTUP' },
        role_label: 'Cố vấn vận hành',
        permission: 'VIEW',
      }),
    ).toBe('AgriLink mời bạn vào đội với vai trò Cố vấn vận hành · quyền Xem')
    expect(
      invitationSentence({
        venture: { name: '  Agri\n Link ', type: 'PROJECT' },
        role_label: null,
        permission: 'EDIT',
      }),
    ).toBe('Agri Link mời bạn vào đội · quyền Biên tập')
  })

  it('escapes the name in HTML, keeps the subject on one line, carries the link and no token', () => {
    const notice: InvitationNotice = {
      to: 'someone@example.test',
      venture: { name: '<b>x</b>\r\nBcc: victim@example.test', type: 'STARTUP' },
      role_label: 'Dev',
      permission: 'EDIT',
    }
    const message = renderInvitationEmail(notice, link)
    expect(message.to).toBe('someone@example.test')
    expect(message.subject).toBe(
      'Lời mời vào đội <b>x</b> Bcc: victim@example.test trên 1hub.network',
    )
    expect(message.subject).not.toMatch(/[\r\n]/)
    expect(message.html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(message.html).not.toContain('<b>x</b>')
    expect(message.html).toContain(`href="${link}"`)
    expect(message.text).toContain(
      '<b>x</b> Bcc: victim@example.test mời bạn vào đội với vai trò Dev · quyền Biên tập.',
    )
    expect(message.text).toContain(`Xem lời mời: ${link}`)
    // One link, nothing appended to it, no secret of any kind.
    expect(message.text.match(/https?:\/\/\S+/g)).toEqual([link])
    expect(message.html.match(/https?:\/\/[^"<\s]+/g)).toEqual([link])
    expect(`${message.subject}\n${message.text}\n${message.html}`).not.toMatch(
      /token|[0-9a-f]{32}/i,
    )
  })
})
