import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import {
  ensureInviteLink,
  getInviteLink,
  joinInviteLink,
  linkToken,
  parseInviteCode,
  previewInviteLink,
  regenerateInviteLink,
  tokenHash,
} from './invite-link'
import {
  acceptInvitation,
  getOwnInvitation,
  getTeam,
  inviteMember,
  listOwnInvitations,
} from './team'
import { seedVenture } from './testing'

/**
 * S1-UAT-07 (DEC-S1I) against live PostgreSQL: invitation by link (US-02.12,
 * FB-18) and the e-mail invitation's expiry / re-send / limits (US-02.11).
 * A fixed test secret stands in for INVITE_LINK_SECRET.
 */

const SECRET = 'test-invite-link-secret-0123456789abcdef'
const RID = 'req-s1i-test'
let saved: string | undefined

beforeAll(() => {
  saved = process.env.INVITE_LINK_SECRET
  process.env.INVITE_LINK_SECRET = SECRET
})

afterAll(async () => {
  process.env.INVITE_LINK_SECRET = saved
  await closePool()
})

type Person = { accountId: string; profileId: string; email: string }

async function person(done = true): Promise<Person> {
  const email = `s1i-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'Người S1I', $2, now(), $3) RETURNING id::text`,
    [a!.id, done ? 'ACTIVE' : 'DRAFT', done ? new Date() : null],
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

const venture = (owner: Person, name = 'Tracely Đà Nẵng') =>
  seedVenture(owner.accountId, { type: 'STARTUP', name })

/** The `/moi/…` code of a path. */
const codeOf = (path: string) => path.slice('/moi/'.length)

const memberships = (ventureId: string, profileId: string) =>
  query<{ state: string; role_label: string; permission: string }>(
    `SELECT state::text AS state, role_label, permission FROM project_members
      WHERE project_id = $1 AND profile_id = $2`,
    [ventureId, profileId],
  )

const openLinks = (ventureId: string) =>
  query<{ id: string }>(
    `SELECT id::text FROM venture_invite_links WHERE project_id = $1 AND revoked_at IS NULL`,
    [ventureId],
  )

describe('token and URL', () => {
  it('160-bit hex token derived from the link id; only its SHA-256 is stored', async () => {
    const owner = await person()
    const v = await venture(owner)
    const { link } = await ensureInviteLink(owner.accountId, v.id, RID)
    expect(link.path).toMatch(/^\/moi\/tracely-da-nang-[0-9a-f]{40}$/)
    const token = parseInviteCode(codeOf(link.path))!
    const [row] = await query<{ id: string; token_hash: string }>(
      `SELECT id::text, token_hash FROM venture_invite_links WHERE project_id = $1`,
      [v.id],
    )
    expect(token).toBe(linkToken(row!.id))
    expect(row!.token_hash).toBe(tokenHash(token))
    // The raw token is nowhere in the database.
    const [hits] = await query<{ n: number }>(
      `SELECT (SELECT count(*) FROM venture_invite_links WHERE token_hash = $1
                 OR id::text = $1 OR project_id::text = $1)::int
            + (SELECT count(*) FROM audit_events WHERE after_data::text LIKE '%' || $1 || '%'
                 OR coalesce(before_data::text, '') LIKE '%' || $1 || '%')::int AS n`,
      [token],
    )
    expect(hits!.n).toBe(0)
  })

  it('the slug is cosmetic; malformed codes are refused alike', async () => {
    const token = 'a'.repeat(40)
    expect(parseInviteCode(`doi-khac-${token}`)).toBe(token)
    expect(parseInviteCode(token)).toBe(token)
    for (const bad of ['', 'x', `x${token}`, `${token}0`, 'A'.repeat(40), `-${'g'.repeat(40)}`]) {
      expect(parseInviteCode(bad), bad).toBeNull()
    }
  })

  it('without INVITE_LINK_SECRET the feature is unavailable, never on a default key', async () => {
    const owner = await person()
    const v = await venture(owner)
    process.env.INVITE_LINK_SECRET = 'short'
    try {
      expect(await refusal(ensureInviteLink(owner.accountId, v.id, RID))).toMatchObject({
        code: 'INVITE_LINK_UNAVAILABLE',
        status: 500,
      })
    } finally {
      process.env.INVITE_LINK_SECRET = SECRET
    }
    expect(await openLinks(v.id)).toEqual([])
  })
})

describe('owner: get, ensure, regenerate', () => {
  it('only the owner; the same live link on every ensure; get reflects it', async () => {
    const owner = await person()
    const stranger = await person()
    const v = await venture(owner)
    expect((await getInviteLink(owner.accountId, v.id)).link).toBeNull()
    const first = await ensureInviteLink(owner.accountId, v.id, RID)
    const again = await ensureInviteLink(owner.accountId, v.id, RID)
    expect(first.created).toBe(true)
    expect(again).toEqual({ link: first.link, created: false })
    expect((await getInviteLink(owner.accountId, v.id)).link).toEqual(first.link)
    expect(await refusal(ensureInviteLink(stranger.accountId, v.id, RID))).toMatchObject({
      status: 404,
    })
    // A member with any level cannot create or regenerate (US-02.12 "Chỉ Chủ sở hữu").
    await joinInviteLink(stranger.accountId, codeOf(first.link.path), null, RID)
    expect(await refusal(regenerateInviteLink(stranger.accountId, v.id, RID))).toMatchObject({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
  })

  it('7 days: valid before, invalid after; ensure then replaces the expired link', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const { link } = await ensureInviteLink(owner.accountId, v.id, RID)
    const days = (Date.parse(link.expires_at) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.99)
    // The database clock and this process's agree to well within a second.
    expect(days).toBeLessThan(7.001)
    expect((await previewInviteLink(receiver.accountId, codeOf(link.path))).membership).toBeNull()
    await query(
      `UPDATE venture_invite_links SET created_at = now() - interval '8 days',
              expires_at = now() - interval '1 second' WHERE project_id = $1`,
      [v.id],
    )
    expect(await refusal(previewInviteLink(receiver.accountId, codeOf(link.path)))).toMatchObject({
      code: 'INVITE_LINK_INVALID',
      status: 404,
    })
    expect(
      await refusal(joinInviteLink(receiver.accountId, codeOf(link.path), null, RID)),
    ).toMatchObject({
      code: 'INVITE_LINK_INVALID',
    })
    expect(await memberships(v.id, receiver.profileId)).toEqual([])
    const renewed = await ensureInviteLink(owner.accountId, v.id, RID)
    expect(renewed.created).toBe(true)
    expect(renewed.link.path).not.toBe(link.path)
    expect(await openLinks(v.id)).toHaveLength(1)
  })

  it('regenerate: the old link is invalid at once, the new one valid', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const { link: old } = await ensureInviteLink(owner.accountId, v.id, RID)
    const { link: fresh } = await regenerateInviteLink(owner.accountId, v.id, RID)
    expect(fresh.path).not.toBe(old.path)
    expect(await refusal(previewInviteLink(receiver.accountId, codeOf(old.path)))).toMatchObject({
      code: 'INVITE_LINK_INVALID',
    })
    expect((await previewInviteLink(receiver.accountId, codeOf(fresh.path))).venture.name).toBe(
      'Tracely Đà Nẵng',
    )
    // A stale browser still holding the old link joins nothing.
    expect(
      await refusal(joinInviteLink(receiver.accountId, codeOf(old.path), null, RID)),
    ).toMatchObject({
      code: 'INVITE_LINK_INVALID',
    })
    expect(await memberships(v.id, receiver.profileId)).toEqual([])
  })

  it('double and concurrent regenerations leave exactly one live link, the last one', async () => {
    const owner = await person()
    const v = await venture(owner)
    await regenerateInviteLink(owner.accountId, v.id, RID)
    await regenerateInviteLink(owner.accountId, v.id, RID)
    const results = await Promise.all(
      Array.from({ length: 6 }, () => regenerateInviteLink(owner.accountId, v.id, RID)),
    )
    const open = await openLinks(v.id)
    expect(open).toHaveLength(1)
    const live = (await getInviteLink(owner.accountId, v.id)).link!
    expect(results.map((r) => r.link.path)).toContain(live.path)
    const receiver = await person()
    for (const r of results.filter((x) => x.link.path !== live.path)) {
      expect(
        await refusal(previewInviteLink(receiver.accountId, codeOf(r.link.path))),
      ).toMatchObject({
        code: 'INVITE_LINK_INVALID',
      })
    }
    // Concurrent ensures never make a second live link either.
    await Promise.all(Array.from({ length: 5 }, () => ensureInviteLink(owner.accountId, v.id, RID)))
    expect(await openLinks(v.id)).toHaveLength(1)
  })

  it('an archived venture takes no one in: its link stops working', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const { link } = await ensureInviteLink(owner.accountId, v.id, RID)
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    expect(await refusal(previewInviteLink(receiver.accountId, codeOf(link.path)))).toMatchObject({
      code: 'INVITE_LINK_INVALID',
    })
  })
})

describe('receiver: preview and join (US-02.12)', () => {
  it('A: the preview shows only name, type, role, level; join creates one Member · VIEW row', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const code = codeOf((await ensureInviteLink(owner.accountId, v.id, RID)).link.path)
    const preview = await previewInviteLink(receiver.accountId, code)
    expect(Object.keys(preview).sort()).toEqual(
      ['expires_at', 'membership', 'permission', 'role_label', 'venture'].sort(),
    )
    expect(preview).toMatchObject({
      venture: { name: 'Tracely Đà Nẵng', type: 'STARTUP' },
      role_label: 'Thành viên',
      permission: 'VIEW',
      membership: null,
    })
    expect(JSON.stringify(preview)).not.toContain(v.id)
    expect(await joinInviteLink(receiver.accountId, code, null, RID)).toEqual({
      venture_id: v.id,
      joined: true,
    })
    expect(await memberships(v.id, receiver.profileId)).toEqual([
      { state: 'ACTIVE', role_label: 'Thành viên', permission: 'VIEW' },
    ])
  })

  it('B: an existing member or the owner opening the link gets the team, no new row', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const code = codeOf((await ensureInviteLink(owner.accountId, v.id, RID)).link.path)
    await joinInviteLink(receiver.accountId, code, null, RID)
    expect(await joinInviteLink(receiver.accountId, code, null, RID)).toEqual({
      venture_id: v.id,
      joined: false,
    })
    expect((await previewInviteLink(receiver.accountId, code)).membership).toEqual({
      venture_id: v.id,
      as: 'MEMBER',
    })
    expect(await joinInviteLink(owner.accountId, code, null, RID)).toEqual({
      venture_id: v.id,
      joined: false,
    })
    expect(await memberships(v.id, receiver.profileId)).toHaveLength(1)
    expect(await memberships(v.id, owner.profileId)).toEqual([])
  })

  it('C: a team of 20 people (pending invitations counted) refuses a join', async () => {
    const owner = await person()
    const v = await venture(owner)
    const code = codeOf((await ensureInviteLink(owner.accountId, v.id, RID)).link.path)
    for (let i = 0; i < 10; i++) {
      await joinInviteLink((await person()).accountId, code, null, RID)
    }
    for (let i = 0; i < 9; i++) {
      await inviteMember(
        owner.accountId,
        v.id,
        { email: `s1i-full-${i}-${v.id}@example.test` },
        RID,
      )
    }
    const late = await person()
    expect(await refusal(joinInviteLink(late.accountId, code, null, RID))).toMatchObject({
      code: 'TEAM_FULL',
      status: 409,
    })
    expect(await memberships(v.id, late.profileId)).toEqual([])
  })

  it('D/E: an unknown, revoked or expired link joins nothing, with one same answer', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const { link } = await ensureInviteLink(owner.accountId, v.id, RID)
    await regenerateInviteLink(owner.accountId, v.id, RID)
    const answers = [
      await refusal(joinInviteLink(receiver.accountId, codeOf(link.path), null, RID)),
      await refusal(joinInviteLink(receiver.accountId, `x-${'0'.repeat(40)}`, null, RID)),
      await refusal(joinInviteLink(receiver.accountId, 'not-a-code', null, RID)),
      await refusal(previewInviteLink(receiver.accountId, `x-${'f'.repeat(40)}`)),
    ]
    for (const answer of answers) {
      expect(answer).toEqual({ code: 'INVITE_LINK_INVALID', status: 404, fields: undefined })
    }
    expect(await memberships(v.id, receiver.profileId)).toEqual([])
  })

  it('F/G: double and concurrent joins make one membership', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const code = codeOf((await ensureInviteLink(owner.accountId, v.id, RID)).link.path)
    const results = await Promise.all(
      Array.from({ length: 5 }, () => joinInviteLink(receiver.accountId, code, null, RID)),
    )
    expect(results.filter((r) => r.joined)).toHaveLength(1)
    expect(await memberships(v.id, receiver.profileId)).toHaveLength(1)
  })

  it('H: a forged role or level is refused; nothing is created', async () => {
    const owner = await person()
    const receiver = await person()
    const v = await venture(owner)
    const code = codeOf((await ensureInviteLink(owner.accountId, v.id, RID)).link.path)
    for (const body of [
      { permission: 'EDIT' },
      { permission: 'OWNER' },
      { role_label: 'Founder' },
      { role: 'ADMIN' },
      [],
      'EDIT',
    ]) {
      expect(
        await refusal(joinInviteLink(receiver.accountId, code, body, RID)),
        JSON.stringify(body),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
      })
    }
    expect(await memberships(v.id, receiver.profileId)).toEqual([])
    // An empty object is an empty body.
    await joinInviteLink(receiver.accountId, code, {}, RID)
    expect(await memberships(v.id, receiver.profileId)).toEqual([
      { state: 'ACTIVE', role_label: 'Thành viên', permission: 'VIEW' },
    ])
  })

  it('onboarding first; a receiver with a pending e-mail invitation is counted once', async () => {
    const owner = await person()
    const unfinished = await person(false)
    const invited = await person()
    const v = await venture(owner)
    const code = codeOf((await ensureInviteLink(owner.accountId, v.id, RID)).link.path)
    expect(await refusal(joinInviteLink(unfinished.accountId, code, null, RID))).toMatchObject({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
    const pending = await inviteMember(
      owner.accountId,
      v.id,
      { email: invited.email, permission: 'EDIT' },
      RID,
    )
    await joinInviteLink(invited.accountId, code, null, RID)
    const [row] = await query<{ state: string }>(
      `SELECT state::text AS state FROM project_members WHERE id = $1`,
      [pending.membership_id],
    )
    expect(row!.state).toBe('REMOVED')
    expect(await memberships(v.id, invited.profileId)).toEqual([
      { state: 'ACTIVE', role_label: 'Thành viên', permission: 'VIEW' },
    ])
  })
})

describe('e-mail invitation (US-02.11)', () => {
  it('expires in 7 days; a re-send keeps the row, its role and level, and extends 7 days', async () => {
    const owner = await person()
    const v = await venture(owner)
    const first = await inviteMember(
      owner.accountId,
      v.id,
      { email: 'Resend@Example.test', role_label: 'CTO', permission: 'EDIT' },
      RID,
    )
    expect(first.resent).toBe(false)
    const days = (Date.parse(first.expires_at) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.99)
    await query(
      `UPDATE project_members SET invite_expires_at = now() + interval '1 day' WHERE id = $1`,
      [first.membership_id],
    )
    const again = await inviteMember(
      owner.accountId,
      v.id,
      { email: 'resend@example.test', role_label: 'Founder', permission: 'VIEW' },
      RID,
    )
    expect(again).toMatchObject({
      membership_id: first.membership_id,
      resent: true,
      role_label: 'CTO',
      permission: 'EDIT',
    })
    expect((Date.parse(again.expires_at) - Date.now()) / 86_400_000).toBeGreaterThan(6.99)
    const [{ n }] = (await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM project_members WHERE project_id = $1`,
      [v.id],
    )) as [{ n: number }]
    expect(n).toBe(1)
    // Double-click: the second send is the same row again.
    const twice = await Promise.all([
      inviteMember(owner.accountId, v.id, { email: 'dbl@example.test' }, RID),
      inviteMember(owner.accountId, v.id, { email: 'dbl@example.test' }, RID),
    ])
    expect(new Set(twice.map((t) => t.membership_id)).size).toBe(1)
  })

  it('an expired invitation is not accepted, not listed, not counted; a re-send revives it', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const inv = await inviteMember(owner.accountId, v.id, { email: mate.email }, RID)
    await query(
      `UPDATE project_members SET invite_expires_at = now() - interval '1 second' WHERE id = $1`,
      [inv.membership_id],
    )
    expect(
      await refusal(acceptInvitation(mate.accountId, v.id, inv.membership_id, RID)),
    ).toMatchObject({
      code: 'MEMBERSHIP_INVALID_TRANSITION',
      status: 409,
    })
    expect(await listOwnInvitations(mate.accountId)).toEqual([])
    expect(await getOwnInvitation(mate.accountId, v.id)).toBeNull()
    const team = await getTeam(owner.accountId, v.id)
    expect(team.counts.pending).toBe(0)
    expect(team.rows.find((r) => r.kind === 'PENDING_INVITATION')).toMatchObject({ expired: true })
    await inviteMember(owner.accountId, v.id, { email: mate.email }, RID)
    expect(await acceptInvitation(mate.accountId, v.id, inv.membership_id, RID)).toEqual({
      membership_id: inv.membership_id,
      state: 'ACTIVE',
    })
  })

  it('an active member’s address is refused; re-sends stay within the send limit', async () => {
    const owner = await person()
    const mate = await person()
    const v = await venture(owner)
    const code = codeOf((await ensureInviteLink(owner.accountId, v.id, RID)).link.path)
    await joinInviteLink(mate.accountId, code, null, RID)
    expect(
      await refusal(inviteMember(owner.accountId, v.id, { email: mate.email.toUpperCase() }, RID)),
    ).toMatchObject({ code: 'PROFILE_VALIDATION_FAILED', fields: { email: 'already_member' } })
    await inviteMember(owner.accountId, v.id, { email: 'limit@example.test' }, RID)
    await inviteMember(owner.accountId, v.id, { email: 'limit@example.test' }, RID)
    await inviteMember(owner.accountId, v.id, { email: 'limit@example.test' }, RID)
    expect(
      await refusal(inviteMember(owner.accountId, v.id, { email: 'limit@example.test' }, RID)),
    ).toMatchObject({ code: 'INVITATION_RATE_LIMITED', status: 429 })
  })
})
