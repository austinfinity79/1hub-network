import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit, type AuditAction } from '@/lib/audit/audit'
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'

import type { InvitationNotice } from './invitation-email'

/**
 * WF02-S06 — canonical venture team (API 05 §5.4; DEC-WF02-H7,
 * DEC-WF02-S06-G1..G9).
 *
 * One `project_members` row is either a pending email invitation
 * (PENDING_CONFIRMATION, no profile) or a profile membership. The owner is
 * `projects.owner_profile_id` only: never a row, so never removable here, and
 * the team rows of the list are derived from it (G5). A legacy row whose
 * profile is the owner is ignored and cannot be addressed.
 *
 * Authority (DEC-L2R-D7): every mutation here needs `venture:team_manage`,
 * which is the owner's alone. A row carries the level of its member, EDIT
 * ("Biên tập") or VIEW ("Xem"), set by the owner; EDIT lets the member update
 * the venture (venture.ts) and nothing in the team. `role_label` grants
 * nothing. Accept/decline belong to the recipient alone: the session account's
 * normalised email must equal the invitation email (G2). Invite creation never
 * looks up accounts, so it cannot reveal whether an email is registered.
 *
 * Sending (DEC-L2R-D8): `inviteMember` hands the notice to `deliver` inside
 * its transaction, so an e-mail that cannot be sent leaves no invitation.
 *
 * Sprint 1 (S1-UAT-07, DEC-S1I; US-02.11): an e-mail invitation expires 7 days
 * after it is sent (`invite_expires_at`, migration 020) and an expired one is
 * neither accepted nor shown to its recipient. Inviting an address that already
 * has a pending invitation re-sends that same row and extends it by 7 days: no
 * second row, and the role and level stay as first chosen. An address that is
 * already an active member is refused ("already_member"). The team holds at
 * most 20 people counting the owner, active members and live pending
 * invitations (TEAM_FULL), the same count the link flow uses (invite-link.ts).
 *
 * Races: each mutation locks its membership row, so accept vs cancel and
 * remove vs role edit resolve to one canonical transition; the partial unique
 * indexes of migration 008 stop duplicate pending invitations and duplicate
 * ACTIVE memberships. Audit events are written only on a real transition (G7),
 * with ids and states only.
 */

/** Provisional TECHNICAL bound; not a business rule. */
export const TEAM_LIMITS = { roleLabel: 100 } as const

/** US-02.11 / US-02.12, Appendix B: invitations last 7 days; a team holds at most 20. */
export const INVITATION_DAYS = 7
export const TEAM_MAX_PEOPLE = 20

/**
 * Invitation e-mails sent in the last 24 hours, counted over every state, so
 * cancelling an invitation gives no send back (DEC-L2R-D13): per venture and
 * address, and per inviting profile.
 */
export const INVITE_SEND_LIMITS = { perAddress: 3, perInviter: 50 } as const

export const MEMBER_PERMISSIONS = ['EDIT', 'VIEW'] as const
export type MemberPermission = (typeof MEMBER_PERMISSIONS)[number]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TeamRow =
  | {
      kind: 'OWNER'
      membership_id: null
      display_name: string
      role_label: string | null
      permission: 'OWNER'
      joined_at: null
    }
  | {
      kind: 'ACTIVE_MEMBER'
      membership_id: string
      display_name: string
      role_label: string | null
      permission: MemberPermission
      joined_at: string
    }
  | {
      kind: 'PENDING_INVITATION'
      membership_id: string
      email: string
      role_label: string | null
      permission: MemberPermission
      invited_at: string
      /** When the invitation stops being acceptable; a re-send moves it 7 days on. */
      expires_at: string
      expired: boolean
    }

export type PendingInvitationRow = Extract<TeamRow, { kind: 'PENDING_INVITATION' }>

export type TeamDTO = {
  venture: { id: string; name: string; type: string; status: string }
  viewer: 'OWNER' | 'MEMBER'
  can_manage: boolean
  counts: { members: number; pending: number | null }
  rows: TeamRow[]
}

export type MembershipResult = { membership_id: string; state: string }

export type InvitationView = {
  venture: { id: string; name: string; type: string }
  membership_id: string
  role_label: string | null
  permission: MemberPermission
  invited_at: string
  expires_at: string
}

export type Venture = {
  id: string
  name: string
  type: string
  status: string
  owner_profile_id: string
  owner_role_label: string | null
}

type Member = {
  id: string
  profile_id: string | null
  state: string
  role_label: string | null
  permission: MemberPermission
  invite_email_normalized: string | null
}

const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Team validation failed.', { [field]: reason })

const archived = () =>
  new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')

const sendLimited = () =>
  new ApiError('INVITATION_RATE_LIMITED', 429, 'Too many invitations sent. Try again later.')

export const teamFull = () =>
  new ApiError('TEAM_FULL', 409, 'The team already holds 20 people, pending invitations included.')

/**
 * People the team holds or has asked (Appendix B "Tối đa 20 thành viên, tính cả
 * lời mời đang chờ"): the owner, active members other than the owner, and
 * pending invitations that have not expired. Read inside the caller's
 * transaction after it locked the venture row.
 */
export async function teamHeadcount(exec: Executor, venture: Venture): Promise<number> {
  const [row] = await exec<{ n: number }>(
    `SELECT 1 + count(*) FILTER (WHERE state = 'ACTIVE' AND profile_id <> $2)
              + count(*) FILTER (WHERE state = 'PENDING_CONFIRMATION' AND invite_expires_at > now())
              AS n
       FROM project_members WHERE project_id = $1`,
    [venture.id, venture.owner_profile_id],
  )
  return Number(row?.n ?? 1)
}

export async function actor(exec: Executor, accountId: string) {
  const [row] = await exec<{ profile_id: string; email: string; name: string | null }>(
    `SELECT p.id::text AS profile_id, a.email_normalized AS email,
            coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.full_name), '')) AS name
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
      WHERE a.id = $1`,
    [accountId],
  )
  return row ?? null
}

export async function ventureOf(exec: Executor, ventureId: string): Promise<Venture | null> {
  if (!UUID.test(ventureId)) return null
  const [row] = await exec<Venture>(
    `SELECT id::text, name, type::text AS type, status::text AS status,
            owner_profile_id::text, owner_role_label
       FROM projects WHERE id = $1`,
    [ventureId],
  )
  return row ?? null
}

export async function isActiveMember(exec: Executor, ventureId: string, profileId: string) {
  const rows = await exec(
    `SELECT 1 FROM project_members
      WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
    [ventureId, profileId],
  )
  return rows.length > 0
}

/** The venture for a `venture:team_manage` mutation, or the refusal. */
export async function managed(exec: Executor, accountId: string, ventureId: string) {
  const me = await actor(exec, accountId)
  const venture = me ? await ventureOf(exec, ventureId) : null
  if (!me || !venture) throw notFound()
  if (venture.owner_profile_id !== me.profile_id) {
    // A member learns nothing new from 403; anyone else gets the same 404.
    if (await isActiveMember(exec, venture.id, me.profile_id)) {
      throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner manages the team.')
    }
    throw notFound()
  }
  if (venture.status === 'ARCHIVED') throw archived()
  return { me, venture }
}

/** A non-owner row of this venture, locked; anything else is hidden alike. */
async function lockedMember(exec: Executor, venture: Venture, membershipId: string) {
  if (!UUID.test(membershipId)) throw notFound()
  const [row] = await exec<Member>(
    `SELECT id::text, profile_id::text, state::text AS state, role_label, permission,
            invite_email_normalized
       FROM project_members WHERE id = $1 AND project_id = $2 FOR UPDATE`,
    [membershipId, venture.id],
  )
  if (!row || row.profile_id === venture.owner_profile_id) throw notFound()
  return row
}

async function audit(
  exec: Executor,
  accountId: string,
  action: AuditAction,
  venture: Venture,
  membershipId: string,
  before: string | null,
  after: string,
  requestId: string,
  /** The level before and after, when the event is about it. */
  permission?: { before: MemberPermission | null; after: MemberPermission },
) {
  await writeAudit(exec, {
    actorAccountId: accountId,
    action,
    resourceType: 'project_member',
    resourceId: membershipId,
    before: before
      ? {
          project_id: venture.id,
          state: before,
          ...(permission?.before ? { permission: permission.before } : {}),
        }
      : null,
    after: {
      project_id: venture.id,
      state: after,
      ...(permission ? { permission: permission.after } : {}),
    },
    requestId,
  })
}

function parseRoleLabel(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw invalid('role_label', 'invalid')
  const text = value.trim()
  if (text.length > TEAM_LIMITS.roleLabel) throw invalid('role_label', 'too_long')
  return text || null
}

function parsePermission(value: unknown): MemberPermission {
  if (!(MEMBER_PERMISSIONS as readonly unknown[]).includes(value)) {
    // OWNER is ownership and is never given through a team row.
    throw invalid('permission', 'invalid')
  }
  return value as MemberPermission
}

function onlyKeys(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  // Owner, profile, inviter and state are always server-derived.
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid(key, 'not_accepted')
  }
  return input
}

const iso = (value: unknown) => new Date(value as string).toISOString()

/**
 * GET /ventures/{id}/team: owner or ACTIVE member; pending data for the owner
 * only (G8). `exec` lets a caller's transaction read on its own connection
 * (WF05-PROD-03).
 */
export async function getTeam(
  accountId: string,
  ventureId: string,
  exec: Executor = query,
): Promise<TeamDTO> {
  const me = await actor(exec, accountId)
  const venture = me ? await ventureOf(exec, ventureId) : null
  if (!me || !venture) throw notFound()
  const owner = venture.owner_profile_id === me.profile_id
  if (!owner && !(await isActiveMember(exec, venture.id, me.profile_id))) throw notFound()

  const [ownerProfile] = await exec<{ display_name: string | null }>(
    'SELECT display_name FROM individual_profiles WHERE id = $1',
    [venture.owner_profile_id],
  )
  const members = await exec<{
    id: string
    display_name: string | null
    role_label: string | null
    permission: MemberPermission
    joined_at: Date
  }>(
    `SELECT m.id::text, p.display_name, m.role_label, m.permission, m.joined_at
       FROM project_members m JOIN individual_profiles p ON p.id = m.profile_id
      WHERE m.project_id = $1 AND m.state = 'ACTIVE' AND m.profile_id <> $2
      ORDER BY m.joined_at, m.id`,
    [venture.id, venture.owner_profile_id],
  )
  const pending = owner
    ? await exec<{
        id: string
        invite_email_normalized: string
        role_label: string | null
        permission: MemberPermission
        invited_at: Date
        invite_expires_at: Date
        expired: boolean
      }>(
        `SELECT id::text, invite_email_normalized, role_label, permission, invited_at,
                invite_expires_at, invite_expires_at <= now() AS expired
           FROM project_members
          WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION'
          ORDER BY invited_at, id`,
        [venture.id],
      )
    : []

  const rows: TeamRow[] = [
    {
      kind: 'OWNER',
      membership_id: null,
      display_name: ownerProfile?.display_name ?? '',
      role_label: venture.owner_role_label,
      permission: 'OWNER',
      joined_at: null,
    },
    ...members.map((m): TeamRow => ({
      kind: 'ACTIVE_MEMBER',
      membership_id: m.id,
      display_name: m.display_name ?? '',
      role_label: m.role_label,
      permission: m.permission,
      joined_at: iso(m.joined_at),
    })),
    ...pending.map((p): TeamRow => ({
      kind: 'PENDING_INVITATION',
      membership_id: p.id,
      email: p.invite_email_normalized,
      role_label: p.role_label,
      permission: p.permission,
      invited_at: iso(p.invited_at),
      expires_at: iso(p.invite_expires_at),
      expired: p.expired,
    })),
  ]
  return {
    venture: { id: venture.id, name: venture.name, type: venture.type, status: venture.status },
    viewer: owner ? 'OWNER' : 'MEMBER',
    can_manage: owner && venture.status !== 'ARCHIVED',
    counts: {
      members: 1 + members.length,
      pending: owner ? pending.filter((p) => !p.expired).length : null,
    },
    rows,
  }
}

/**
 * POST /ventures/{id}/team/invitations `{email, role_label, permission}` → 201
 * PENDING_CONFIRMATION, valid 7 days. Without a level the invitation is VIEW.
 * An address with a pending invitation (live or expired) gets that same row
 * re-sent and extended 7 days (`resent: true`, 200); its role and level stay.
 * `deliver` sends the notice; when it throws, nothing of the change remains.
 */
export async function inviteMember(
  accountId: string,
  ventureId: string,
  body: unknown,
  requestId: string,
  deliver?: (notice: InvitationNotice) => Promise<void>,
): Promise<PendingInvitationRow & { resent: boolean }> {
  const input = onlyKeys(body, ['email', 'role_label', 'permission'])
  if (typeof input.email !== 'string' || !isPlausibleEmail(input.email))
    throw invalid('email', 'invalid')
  const email = normalizeEmail(input.email)
  const roleLabel = parseRoleLabel(input.role_label)
  const permission: MemberPermission =
    input.permission === undefined ? 'VIEW' : parsePermission(input.permission)

  return withTransaction(async (exec) => {
    const { me, venture } = await managed(exec, accountId, ventureId)
    // The owner is never a row. Only the owner's own address is compared, so
    // nothing about any other account is looked up or revealed.
    if (email === me.email) throw invalid('email', 'invalid')
    // One invitation change of a venture at a time, so the counts below hold.
    await exec(`SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`, [venture.id])

    // US-02.11 "Email đã là thành viên": only this team's own members are compared.
    const member = await exec(
      `SELECT 1 FROM project_members m
         JOIN individual_profiles p ON p.id = m.profile_id
         JOIN user_accounts a ON a.id = p.account_id
        WHERE m.project_id = $1 AND m.state = 'ACTIVE' AND a.email_normalized = $2`,
      [venture.id, email],
    )
    if (member.length > 0) throw invalid('email', 'already_member')

    const [pending] = await exec<{
      id: string
      role_label: string | null
      permission: MemberPermission
      invited_at: Date
    }>(
      `SELECT id::text, role_label, permission, invited_at FROM project_members
        WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION' AND invite_email_normalized = $2
        FOR UPDATE`,
      [venture.id, email],
    )
    if (pending) return resend(exec, accountId, me, venture, email, pending, requestId, deliver)

    if ((await teamHeadcount(exec, venture)) >= TEAM_MAX_PEOPLE) throw teamFull()
    const [sent = { to_address: 0, by_inviter: 0 }] = await exec<{
      to_address: number
      by_inviter: number
    }>(
      `SELECT count(*) FILTER (WHERE project_id = $1 AND invite_email_normalized = $2)::int
                AS to_address,
              count(*) FILTER (WHERE invited_by_profile_id = $3)::int AS by_inviter
         FROM project_members
        WHERE invited_at > now() - interval '24 hours'
          AND (project_id = $1 OR invited_by_profile_id = $3)`,
      [venture.id, email, me.profile_id],
    )
    if (
      sent.to_address >= INVITE_SEND_LIMITS.perAddress ||
      sent.by_inviter >= INVITE_SEND_LIMITS.perInviter
    )
      throw sendLimited()
    let created: { id: string; invited_at: Date; invite_expires_at: Date } | undefined
    try {
      ;[created] = await exec<{ id: string; invited_at: Date; invite_expires_at: Date }>(
        `INSERT INTO project_members
           (project_id, profile_id, role_label, permission, state, joined_at,
            invite_email_normalized, invited_by_profile_id, invited_at, invite_expires_at,
            updated_at)
         VALUES ($1, NULL, $2, $3, 'PENDING_CONFIRMATION', NULL, $4, $5, now(),
                 now() + make_interval(days => $6), now())
         RETURNING id::text, invited_at, invite_expires_at`,
        [venture.id, roleLabel, permission, email, me.profile_id, INVITATION_DAYS],
      )
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw conflict('A pending invitation for this email already exists.')
      }
      throw error
    }
    await audit(
      exec,
      accountId,
      'VENTURE_TEAM_INVITED',
      venture,
      created!.id,
      null,
      'PENDING_CONFIRMATION',
      requestId,
      { before: null, after: permission },
    )
    // Last, inside the transaction: a notice that cannot be sent rolls all of it back.
    await deliver?.({
      to: email,
      inviter: me.name ?? '',
      venture: { name: venture.name, type: venture.type },
      role_label: roleLabel,
      permission,
    })
    return {
      kind: 'PENDING_INVITATION',
      membership_id: created!.id,
      email,
      role_label: roleLabel,
      permission,
      invited_at: iso(created!.invited_at),
      expires_at: iso(created!.invite_expires_at),
      expired: false,
      resent: false,
    }
  })
}

/**
 * US-02.11 "Gửi lại lời mời đang chờ → gia hạn 7 ngày, không tạo bản ghi mới":
 * the same row, its role and level unchanged, expiring 7 days from now. Sends
 * count against the per-address limit like new invitations (DEC-L2R-D13).
 */
async function resend(
  exec: Executor,
  accountId: string,
  me: { profile_id: string; name: string | null },
  venture: Venture,
  email: string,
  row: { id: string; role_label: string | null; permission: MemberPermission; invited_at: Date },
  requestId: string,
  deliver?: (notice: InvitationNotice) => Promise<void>,
): Promise<PendingInvitationRow & { resent: boolean }> {
  const [sends] = await exec<{ n: number }>(
    `SELECT count(*)::int AS n FROM audit_events
      WHERE resource_type = 'project_member' AND resource_id = $1
        AND action IN ('VENTURE_TEAM_INVITED', 'VENTURE_TEAM_INVITATION_RESENT')
        AND created_at > now() - interval '24 hours'`,
    [row.id],
  )
  if ((sends?.n ?? 0) >= INVITE_SEND_LIMITS.perAddress) throw sendLimited()
  const [updated] = await exec<{ invite_expires_at: Date }>(
    `UPDATE project_members
        SET invite_expires_at = now() + make_interval(days => $2), updated_at = now()
      WHERE id = $1
      RETURNING invite_expires_at`,
    [row.id, INVITATION_DAYS],
  )
  await audit(
    exec,
    accountId,
    'VENTURE_TEAM_INVITATION_RESENT',
    venture,
    row.id,
    'PENDING_CONFIRMATION',
    'PENDING_CONFIRMATION',
    requestId,
  )
  await deliver?.({
    to: email,
    inviter: me.name ?? '',
    venture: { name: venture.name, type: venture.type },
    role_label: row.role_label,
    permission: row.permission,
  })
  return {
    kind: 'PENDING_INVITATION',
    membership_id: row.id,
    email,
    role_label: row.role_label,
    permission: row.permission,
    invited_at: iso(row.invited_at),
    expires_at: iso(updated!.invite_expires_at),
    expired: false,
    resent: true,
  }
}

/**
 * PATCH /ventures/{id}/team/{membershipId} `{role_label, permission}`: either
 * or both, on an ACTIVE non-owner row only. The owner's level is not a row and
 * cannot be given or taken here.
 */
export async function updateMemberRole(
  accountId: string,
  ventureId: string,
  membershipId: string,
  body: unknown,
  requestId: string,
): Promise<MembershipResult & { role_label: string | null; permission: MemberPermission }> {
  const input = onlyKeys(body, ['role_label', 'permission'])
  if (!('role_label' in input) && !('permission' in input)) throw invalid('role_label', 'required')
  return withTransaction(async (exec) => {
    const { venture } = await managed(exec, accountId, ventureId)
    const row = await lockedMember(exec, venture, membershipId)
    if (row.state !== 'ACTIVE') throw conflict('Only an active member has an editable role.')
    const roleLabel = 'role_label' in input ? parseRoleLabel(input.role_label) : row.role_label
    const permission = 'permission' in input ? parsePermission(input.permission) : row.permission
    if (row.role_label !== roleLabel || row.permission !== permission) {
      await exec(
        `UPDATE project_members SET role_label = $2, permission = $3, updated_at = now()
          WHERE id = $1`,
        [row.id, roleLabel, permission],
      )
      await audit(
        exec,
        accountId,
        'VENTURE_TEAM_ROLE_CHANGED',
        venture,
        row.id,
        'ACTIVE',
        'ACTIVE',
        requestId,
        { before: row.permission, after: permission },
      )
    }
    return { membership_id: row.id, state: 'ACTIVE', role_label: roleLabel, permission }
  })
}

/** DELETE /ventures/{id}/team/{membershipId}: ACTIVE or PENDING → REMOVED; history kept (G6). */
export async function removeMember(
  accountId: string,
  ventureId: string,
  membershipId: string,
  requestId: string,
): Promise<MembershipResult> {
  return withTransaction(async (exec) => {
    const { venture } = await managed(exec, accountId, ventureId)
    const row = await lockedMember(exec, venture, membershipId)
    if (row.state !== 'ACTIVE' && row.state !== 'PENDING_CONFIRMATION') {
      throw conflict('This team row is already closed.')
    }
    await exec(
      `UPDATE project_members SET state = 'REMOVED', ended_at = now(), updated_at = now()
        WHERE id = $1`,
      [row.id],
    )
    await audit(
      exec,
      accountId,
      'VENTURE_TEAM_REMOVED',
      venture,
      row.id,
      row.state,
      'REMOVED',
      requestId,
    )
    return { membership_id: row.id, state: 'REMOVED' }
  })
}

/**
 * The recipient's own row, locked. A row is the recipient's while it still
 * carries their email (pending, declined) or their profile (accepted). Any
 * other row, including another person's invitation, is hidden as 404.
 */
async function recipientRow(
  exec: Executor,
  accountId: string,
  ventureId: string,
  membershipId: string,
) {
  const me = await actor(exec, accountId)
  const venture = me ? await ventureOf(exec, ventureId) : null
  if (!me || !venture || !UUID.test(membershipId)) throw notFound()
  const [row] = await exec<Member & { expired: boolean }>(
    `SELECT id::text, profile_id::text, state::text AS state, role_label, permission,
            invite_email_normalized, coalesce(invite_expires_at <= now(), false) AS expired
       FROM project_members WHERE id = $1 AND project_id = $2 FOR UPDATE`,
    [membershipId, venture.id],
  )
  const mine =
    row &&
    (row.invite_email_normalized === me.email ||
      (row.profile_id !== null && row.profile_id === me.profile_id))
  if (!mine || venture.owner_profile_id === me.profile_id) throw notFound()
  return { me, venture, row: row! }
}

/** POST …/team/invitations/{membershipId}/accept: PENDING → ACTIVE, explicitly (G2). */
export async function acceptInvitation(
  accountId: string,
  ventureId: string,
  membershipId: string,
  requestId: string,
): Promise<MembershipResult> {
  const state = await getOnboardingState(accountId)
  if (!state.completed) {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Complete onboarding before joining a team.')
  }
  return withTransaction(async (exec) => {
    const { me, venture, row } = await recipientRow(exec, accountId, ventureId, membershipId)
    // A repeated accept of the same row is the same outcome, not a new event.
    if (row.state === 'ACTIVE' && row.profile_id === me.profile_id) {
      return { membership_id: row.id, state: 'ACTIVE' }
    }
    if (row.state !== 'PENDING_CONFIRMATION') throw conflict('This invitation is closed.')
    // US-02.14 "Lời mời … hết hạn → không còn hiệu lực".
    if (row.expired) throw conflict('This invitation has expired.')
    if (venture.status === 'ARCHIVED') throw archived()
    if (await isActiveMember(exec, venture.id, me.profile_id)) {
      throw conflict('You are already a member of this team.')
    }
    try {
      await exec(
        `UPDATE project_members
            SET state = 'ACTIVE', profile_id = $2, joined_at = now(),
                invite_email_normalized = NULL, updated_at = now()
          WHERE id = $1`,
        [row.id, me.profile_id],
      )
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw conflict('You are already a member of this team.')
      }
      throw error
    }
    await audit(
      exec,
      accountId,
      'VENTURE_TEAM_JOINED',
      venture,
      row.id,
      'PENDING_CONFIRMATION',
      'ACTIVE',
      requestId,
    )
    return { membership_id: row.id, state: 'ACTIVE' }
  })
}

/** POST …/team/invitations/{membershipId}/decline: PENDING → REJECTED (G2). */
export async function declineInvitation(
  accountId: string,
  ventureId: string,
  membershipId: string,
  requestId: string,
): Promise<MembershipResult> {
  return withTransaction(async (exec) => {
    const { venture, row } = await recipientRow(exec, accountId, ventureId, membershipId)
    if (row.state === 'REJECTED') return { membership_id: row.id, state: 'REJECTED' }
    if (row.state !== 'PENDING_CONFIRMATION') throw conflict('This invitation is closed.')
    await exec(
      `UPDATE project_members SET state = 'REJECTED', ended_at = now(), updated_at = now()
        WHERE id = $1`,
      [row.id],
    )
    await audit(
      exec,
      accountId,
      'VENTURE_TEAM_INVITATION_REJECTED',
      venture,
      row.id,
      'PENDING_CONFIRMATION',
      'REJECTED',
      requestId,
    )
    return { membership_id: row.id, state: 'REJECTED' }
  })
}

/**
 * The signed-in recipient's own pending invitation to this venture, for the
 * S06 page when the viewer has no `venture:read`. Only that invitation and the
 * venture name are returned; never the team or any other invitation.
 */
export async function getOwnInvitation(
  accountId: string,
  ventureId: string,
): Promise<InvitationView | null> {
  const me = await actor(query, accountId)
  const venture = me ? await ventureOf(query, ventureId) : null
  if (!me || !venture || venture.owner_profile_id === me.profile_id) return null
  // As GET /me/venture-invitations: an archived venture takes no one in.
  if (venture.status === 'ARCHIVED') return null
  const [row] = await query<{
    id: string
    role_label: string | null
    permission: MemberPermission
    invited_at: Date
    invite_expires_at: Date
  }>(
    `SELECT id::text, role_label, permission, invited_at, invite_expires_at FROM project_members
      WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION'
        AND invite_email_normalized = $2 AND invite_expires_at > now()`,
    [venture.id, me.email],
  )
  if (!row) return null
  return {
    venture: { id: venture.id, name: venture.name, type: venture.type },
    membership_id: row.id,
    role_label: row.role_label,
    permission: row.permission,
    invited_at: iso(row.invited_at),
    expires_at: iso(row.invite_expires_at),
  }
}

/**
 * GET /me/venture-invitations (DEC-L2R-D8): the pending invitations sent to
 * the account's own address, oldest first. Each carries the venture's name and
 * type, the role and the level, and nothing of the team. An account without a
 * profile is asked too: the invitation waits for the address, not the profile.
 */
export async function listOwnInvitations(accountId: string): Promise<InvitationView[]> {
  const rows = await query<{
    id: string
    venture_id: string
    name: string
    type: string
    role_label: string | null
    permission: MemberPermission
    invited_at: Date
    invite_expires_at: Date
  }>(
    `SELECT m.id::text, p.id::text AS venture_id, p.name, p.type::text AS type,
            m.role_label, m.permission, m.invited_at, m.invite_expires_at
       FROM user_accounts a
       JOIN project_members m
         ON m.invite_email_normalized = a.email_normalized AND m.state = 'PENDING_CONFIRMATION'
        AND m.invite_expires_at > now()
       JOIN projects p ON p.id = m.project_id AND p.status <> 'ARCHIVED'
      WHERE a.id = $1
        AND NOT EXISTS (SELECT 1 FROM individual_profiles o
                         WHERE o.account_id = a.id AND o.id = p.owner_profile_id)
      ORDER BY m.invited_at, m.id`,
    [accountId],
  )
  return rows.map((row) => ({
    venture: { id: row.venture_id, name: row.name, type: row.type },
    membership_id: row.id,
    role_label: row.role_label,
    permission: row.permission,
    invited_at: iso(row.invited_at),
    expires_at: iso(row.invite_expires_at),
  }))
}
