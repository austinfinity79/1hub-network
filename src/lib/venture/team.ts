import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit, type AuditAction } from '@/lib/audit/audit'
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/email'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'

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
 * Authority: every mutation needs `venture:team_manage` (owner only, Matrix
 * §E). An ACTIVE member holds `venture:read` only; `role_label` grants nothing.
 * Accept/decline belong to the recipient alone: the session account's
 * normalised email must equal the invitation email (G2). Invite creation never
 * looks up accounts, so it cannot reveal whether an email is registered.
 *
 * Races: each mutation locks its membership row, so accept vs cancel and
 * remove vs role edit resolve to one canonical transition; the partial unique
 * indexes of migration 008 stop duplicate pending invitations and duplicate
 * ACTIVE memberships. Audit events are written only on a real transition (G7),
 * with ids and states only.
 */

export const TEAM_LIMITS = { roleLabel: 100 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TeamRow =
  | {
      kind: 'OWNER'
      membership_id: null
      display_name: string
      role_label: null
      joined_at: null
    }
  | {
      kind: 'ACTIVE_MEMBER'
      membership_id: string
      display_name: string
      role_label: string | null
      joined_at: string
    }
  | {
      kind: 'PENDING_INVITATION'
      membership_id: string
      email: string
      role_label: string | null
      invited_at: string
    }

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
  invited_at: string
}

type Venture = {
  id: string
  name: string
  type: string
  status: string
  owner_profile_id: string
}

type Member = {
  id: string
  profile_id: string | null
  state: string
  role_label: string | null
  invite_email_normalized: string | null
}

const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Team validation failed.', { [field]: reason })

const archived = () =>
  new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')

async function actor(exec: Executor, accountId: string) {
  const [row] = await exec<{ profile_id: string; email: string }>(
    `SELECT p.id::text AS profile_id, a.email_normalized AS email
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
      WHERE a.id = $1`,
    [accountId],
  )
  return row ?? null
}

async function ventureOf(exec: Executor, ventureId: string): Promise<Venture | null> {
  if (!UUID.test(ventureId)) return null
  const [row] = await exec<Venture>(
    `SELECT id::text, name, type::text AS type, status::text AS status,
            owner_profile_id::text
       FROM projects WHERE id = $1`,
    [ventureId],
  )
  return row ?? null
}

async function isActiveMember(exec: Executor, ventureId: string, profileId: string) {
  const rows = await exec(
    `SELECT 1 FROM project_members
      WHERE project_id = $1 AND profile_id = $2 AND state = 'ACTIVE'`,
    [ventureId, profileId],
  )
  return rows.length > 0
}

/** The venture for a `venture:team_manage` mutation, or the refusal. */
async function managed(exec: Executor, accountId: string, ventureId: string) {
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
    `SELECT id::text, profile_id::text, state::text AS state, role_label,
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
) {
  await writeAudit(exec, {
    actorAccountId: accountId,
    action,
    resourceType: 'project_member',
    resourceId: membershipId,
    before: before ? { project_id: venture.id, state: before } : null,
    after: { project_id: venture.id, state: after },
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

/** GET /ventures/{id}/team: owner or ACTIVE member; pending data for the owner only (G8). */
export async function getTeam(accountId: string, ventureId: string): Promise<TeamDTO> {
  const me = await actor(query, accountId)
  const venture = me ? await ventureOf(query, ventureId) : null
  if (!me || !venture) throw notFound()
  const owner = venture.owner_profile_id === me.profile_id
  if (!owner && !(await isActiveMember(query, venture.id, me.profile_id))) throw notFound()

  const [ownerProfile] = await query<{ display_name: string | null }>(
    'SELECT display_name FROM individual_profiles WHERE id = $1',
    [venture.owner_profile_id],
  )
  const members = await query<{
    id: string
    display_name: string | null
    role_label: string | null
    joined_at: Date
  }>(
    `SELECT m.id::text, p.display_name, m.role_label, m.joined_at
       FROM project_members m JOIN individual_profiles p ON p.id = m.profile_id
      WHERE m.project_id = $1 AND m.state = 'ACTIVE' AND m.profile_id <> $2
      ORDER BY m.joined_at, m.id`,
    [venture.id, venture.owner_profile_id],
  )
  const pending = owner
    ? await query<{
        id: string
        invite_email_normalized: string
        role_label: string | null
        invited_at: Date
      }>(
        `SELECT id::text, invite_email_normalized, role_label, invited_at
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
      role_label: null,
      joined_at: null,
    },
    ...members.map((m): TeamRow => ({
      kind: 'ACTIVE_MEMBER',
      membership_id: m.id,
      display_name: m.display_name ?? '',
      role_label: m.role_label,
      joined_at: iso(m.joined_at),
    })),
    ...pending.map((p): TeamRow => ({
      kind: 'PENDING_INVITATION',
      membership_id: p.id,
      email: p.invite_email_normalized,
      role_label: p.role_label,
      invited_at: iso(p.invited_at),
    })),
  ]
  return {
    venture: { id: venture.id, name: venture.name, type: venture.type, status: venture.status },
    viewer: owner ? 'OWNER' : 'MEMBER',
    can_manage: owner && venture.status !== 'ARCHIVED',
    counts: { members: 1 + members.length, pending: owner ? pending.length : null },
    rows,
  }
}

/** POST /ventures/{id}/team/invitations `{email, role_label}` → 201 PENDING_CONFIRMATION. */
export async function inviteMember(
  accountId: string,
  ventureId: string,
  body: unknown,
  requestId: string,
): Promise<TeamRow> {
  const input = onlyKeys(body, ['email', 'role_label'])
  if (typeof input.email !== 'string' || !isPlausibleEmail(input.email))
    throw invalid('email', 'invalid')
  const email = normalizeEmail(input.email)
  const roleLabel = parseRoleLabel(input.role_label)

  return withTransaction(async (exec) => {
    const { me, venture } = await managed(exec, accountId, ventureId)
    // The owner is never a row. Only the owner's own address is compared, so
    // nothing about any other account is looked up or revealed.
    if (email === me.email) throw invalid('email', 'invalid')
    let created: { id: string; invited_at: Date } | undefined
    try {
      ;[created] = await exec<{ id: string; invited_at: Date }>(
        `INSERT INTO project_members
           (project_id, profile_id, role_label, state, joined_at,
            invite_email_normalized, invited_by_profile_id, invited_at, updated_at)
         VALUES ($1, NULL, $2, 'PENDING_CONFIRMATION', NULL, $3, $4, now(), now())
         RETURNING id::text, invited_at`,
        [venture.id, roleLabel, email, me.profile_id],
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
    )
    return {
      kind: 'PENDING_INVITATION',
      membership_id: created!.id,
      email,
      role_label: roleLabel,
      invited_at: iso(created!.invited_at),
    }
  })
}

/** PATCH /ventures/{id}/team/{membershipId} `{role_label}`: ACTIVE non-owner rows only. */
export async function updateMemberRole(
  accountId: string,
  ventureId: string,
  membershipId: string,
  body: unknown,
  requestId: string,
): Promise<MembershipResult & { role_label: string | null }> {
  const input = onlyKeys(body, ['role_label'])
  if (!('role_label' in input)) throw invalid('role_label', 'required')
  const roleLabel = parseRoleLabel(input.role_label)
  return withTransaction(async (exec) => {
    const { venture } = await managed(exec, accountId, ventureId)
    const row = await lockedMember(exec, venture, membershipId)
    if (row.state !== 'ACTIVE') throw conflict('Only an active member has an editable role.')
    if (row.role_label !== roleLabel) {
      await exec('UPDATE project_members SET role_label = $2, updated_at = now() WHERE id = $1', [
        row.id,
        roleLabel,
      ])
      await audit(
        exec,
        accountId,
        'VENTURE_TEAM_ROLE_CHANGED',
        venture,
        row.id,
        'ACTIVE',
        'ACTIVE',
        requestId,
      )
    }
    return { membership_id: row.id, state: 'ACTIVE', role_label: roleLabel }
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
  const [row] = await exec<Member>(
    `SELECT id::text, profile_id::text, state::text AS state, role_label,
            invite_email_normalized
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
  const [row] = await query<{ id: string; role_label: string | null; invited_at: Date }>(
    `SELECT id::text, role_label, invited_at FROM project_members
      WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION'
        AND invite_email_normalized = $2`,
    [venture.id, me.email],
  )
  if (!row) return null
  return {
    venture: { id: venture.id, name: venture.name, type: venture.type },
    membership_id: row.id,
    role_label: row.role_label,
    invited_at: iso(row.invited_at),
  }
}
