import { createHash, createHmac, randomUUID } from 'node:crypto'

import { ApiError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { withTransaction, type Executor } from '@/lib/db/client'
import { getOnboardingState } from '@/lib/onboarding/state'

import {
  actor,
  INVITATION_DAYS,
  isActiveMember,
  managed,
  TEAM_MAX_PEOPLE,
  teamFull,
  teamHeadcount,
  ventureOf,
  type Venture,
} from './team'

/**
 * S1-UAT-07 — invitation by link (US-02.12, FB-18; DEC-S1I), in parallel with
 * the e-mail invitation of team.ts (US-02.11).
 *
 * A link is a `venture_invite_links` row (migration 020). Its token is
 * HMAC-SHA256(INVITE_LINK_SECRET, "venture-invite-link:v1:" + link id), the
 * first 160 bits in hex: unguessable, never stored (the row keeps only its
 * SHA-256), and recomputable by the server alone, so the owner can copy the
 * same link again without a database that could give it away. Without the
 * secret the feature answers INVITE_LINK_UNAVAILABLE; there is no default key.
 *
 * Owner only (`venture:team_manage`): read, ensure (create when none is live)
 * and regenerate. Regeneration revokes the open link and creates a new one in
 * one transaction holding the venture row; the partial unique index allows one
 * unrevoked link per venture, so concurrent requests cannot leave two.
 *
 * Receiver: preview and join, signed in with onboarding done. Joining is an
 * explicit POST with an empty body; the server always grants role "Thành viên"
 * and level VIEW, and refuses any field a client sends. Every unusable link —
 * unknown, malformed, expired, revoked, or its venture archived — is the same
 * INVITE_LINK_INVALID, which says nothing about the venture or the reason.
 */

export const LINK_ROLE_LABEL = 'Thành viên'
export const LINK_PERMISSION = 'VIEW'

/** 40 hex characters = 160 bits of the HMAC. */
const TOKEN_LENGTH = 40
const TOKEN = new RegExp(`^[0-9a-f]{${TOKEN_LENGTH}}$`)
const MIN_SECRET_LENGTH = 32

export type InviteLinkDTO = { path: string; expires_at: string }

export type InvitePreview = {
  venture: { name: string; type: string }
  role_label: string
  permission: typeof LINK_PERMISSION
  expires_at: string
  /** Set only when the signed-in account already belongs to the team. */
  membership: { venture_id: string; as: 'OWNER' | 'MEMBER' } | null
}

export type JoinResult = { venture_id: string; joined: boolean }

const invalidLink = () =>
  new ApiError('INVITE_LINK_INVALID', 404, 'This invitation is no longer valid.')

const unavailable = () =>
  new ApiError('INVITE_LINK_UNAVAILABLE', 500, 'Invite links are not available.')

function secret(): string {
  const value = process.env.INVITE_LINK_SECRET?.trim()
  if (!value || value.length < MIN_SECRET_LENGTH) throw unavailable()
  return value
}

/** The link's token; recomputed from its id, never read from storage. */
export function linkToken(linkId: string): string {
  return createHmac('sha256', secret())
    .update(`venture-invite-link:v1:${linkId}`)
    .digest('hex')
    .slice(0, TOKEN_LENGTH)
}

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

/** "Tracely Đà Nẵng" → "tracely-da-nang"; readability only, never trusted. */
export function inviteSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return slug || 'doi'
}

/** US-02.12 `1hub.network/moi/[slug-đội]-[mã]`, as a same-origin path. */
export const invitePath = (ventureName: string, token: string) =>
  `/moi/${inviteSlug(ventureName)}-${token}`

/** The token of a `/moi/…` code, or null; the slug part is ignored. */
export function parseInviteCode(code: string): string | null {
  const token = code.slice(-TOKEN_LENGTH)
  if (!TOKEN.test(token)) return null
  if (code.length > TOKEN_LENGTH && code[code.length - TOKEN_LENGTH - 1] !== '-') return null
  if (code.length > TOKEN_LENGTH + 41) return null
  return token
}

type LinkRow = { id: string; expires_at: Date; live: boolean }

async function openLink(exec: Executor, ventureId: string): Promise<LinkRow | null> {
  const [row] = await exec<LinkRow>(
    `SELECT id::text, expires_at, expires_at > now() AS live FROM venture_invite_links
      WHERE project_id = $1 AND revoked_at IS NULL FOR UPDATE`,
    [ventureId],
  )
  return row ?? null
}

const dto = (venture: Venture, link: { id: string; expires_at: Date }): InviteLinkDTO => ({
  path: invitePath(venture.name, linkToken(link.id)),
  expires_at: new Date(link.expires_at).toISOString(),
})

async function createLink(
  exec: Executor,
  accountId: string,
  profileId: string,
  venture: Venture,
  requestId: string,
  replaced: string | null,
): Promise<InviteLinkDTO> {
  const id = randomUUID()
  const token = linkToken(id)
  const [row] = await exec<{ id: string; expires_at: Date }>(
    `INSERT INTO venture_invite_links (id, project_id, token_hash, created_by_profile_id, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
     RETURNING id::text, expires_at`,
    [id, venture.id, tokenHash(token), profileId, INVITATION_DAYS],
  )
  await writeAudit(exec, {
    actorAccountId: accountId,
    action: replaced ? 'VENTURE_INVITE_LINK_REGENERATED' : 'VENTURE_INVITE_LINK_CREATED',
    resourceType: 'venture_invite_link',
    resourceId: row!.id,
    before: replaced ? { project_id: venture.id, revoked_link_id: replaced } : null,
    after: { project_id: venture.id, permission: LINK_PERMISSION },
    requestId,
  })
  return dto(venture, row!)
}

async function revoke(exec: Executor, linkId: string) {
  await exec(`UPDATE venture_invite_links SET revoked_at = now() WHERE id = $1`, [linkId])
}

/** GET …/team/invite-link: the live link, or null when none is live. Owner only. */
export async function getInviteLink(
  accountId: string,
  ventureId: string,
): Promise<{ link: InviteLinkDTO | null }> {
  secret()
  return withTransaction(async (exec) => {
    const { venture } = await managed(exec, accountId, ventureId)
    const link = await openLink(exec, venture.id)
    return { link: link?.live ? dto(venture, link) : null }
  })
}

/**
 * POST …/team/invite-link: the live link, created when none is live (an expired
 * open one is revoked first). Repeated calls return the same link. Owner only.
 */
export async function ensureInviteLink(
  accountId: string,
  ventureId: string,
  requestId: string,
): Promise<{ link: InviteLinkDTO; created: boolean }> {
  secret()
  return withTransaction(async (exec) => {
    const { me, venture } = await managed(exec, accountId, ventureId)
    await exec(`SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`, [venture.id])
    const open = await openLink(exec, venture.id)
    if (open?.live) return { link: dto(venture, open), created: false }
    if (open) await revoke(exec, open.id)
    const link = await createLink(
      exec,
      accountId,
      me.profile_id,
      venture,
      requestId,
      open?.id ?? null,
    )
    return { link, created: true }
  })
}

/**
 * POST …/team/invite-link/regenerate: the open link is revoked at once and a new
 * one created, in one transaction on the locked venture row. Owner only.
 */
export async function regenerateInviteLink(
  accountId: string,
  ventureId: string,
  requestId: string,
): Promise<{ link: InviteLinkDTO }> {
  secret()
  return withTransaction(async (exec) => {
    const { me, venture } = await managed(exec, accountId, ventureId)
    await exec(`SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`, [venture.id])
    const open = await openLink(exec, venture.id)
    if (open) await revoke(exec, open.id)
    const link = await createLink(
      exec,
      accountId,
      me.profile_id,
      venture,
      requestId,
      open?.id ?? null,
    )
    return { link }
  })
}

/** The live link a code names, with its venture, or the one refusal. */
async function usableLink(exec: Executor, code: string) {
  const token = parseInviteCode(code)
  if (!token) throw invalidLink()
  secret()
  const [row] = await exec<{ id: string; project_id: string; expires_at: Date }>(
    `SELECT l.id::text, l.project_id::text, l.expires_at
       FROM venture_invite_links l JOIN projects p ON p.id = l.project_id
      WHERE l.token_hash = $1 AND l.revoked_at IS NULL AND l.expires_at > now()
        AND p.status <> 'ARCHIVED'`,
    [tokenHash(token)],
  )
  const venture = row ? await ventureOf(exec, row.project_id) : null
  if (!row || !venture) throw invalidLink()
  return { link: row, venture }
}

async function membershipOf(
  exec: Executor,
  venture: Venture,
  profileId: string,
): Promise<'OWNER' | 'MEMBER' | null> {
  if (venture.owner_profile_id === profileId) return 'OWNER'
  return (await isActiveMember(exec, venture.id, profileId)) ? 'MEMBER' : null
}

/** GET /invite-links/{code}: what the link offers, for the signed-in receiver. */
export async function previewInviteLink(accountId: string, code: string): Promise<InvitePreview> {
  return withTransaction(async (exec) => {
    const me = await actor(exec, accountId)
    const { link, venture } = await usableLink(exec, code)
    const as = me ? await membershipOf(exec, venture, me.profile_id) : null
    return {
      venture: { name: venture.name, type: venture.type },
      role_label: LINK_ROLE_LABEL,
      permission: LINK_PERMISSION,
      expires_at: new Date(link.expires_at).toISOString(),
      membership: as ? { venture_id: venture.id, as } : null,
    }
  })
}

/**
 * POST /invite-links/{code}/join, empty body. One ACTIVE membership, role
 * "Thành viên", level VIEW; an owner or member gets the team back unchanged;
 * a full team is TEAM_FULL. A pending e-mail invitation of the same person to
 * this team is closed (REMOVED), so one person is never counted twice.
 */
export async function joinInviteLink(
  accountId: string,
  code: string,
  body: unknown,
  requestId: string,
): Promise<JoinResult> {
  if (body !== null && body !== undefined) {
    if (typeof body !== 'object' || Array.isArray(body)) throw invalidBody('body')
    // Role, level, owner, profile: nothing is taken from the client (DEC-S1I-D3).
    for (const key of Object.keys(body)) throw invalidBody(key)
  }
  const state = await getOnboardingState(accountId)
  if (!state.completed) {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Complete onboarding before joining a team.')
  }
  return withTransaction(async (exec) => {
    const me = await actor(exec, accountId)
    if (!me) throw invalidLink()
    const { link, venture } = await usableLink(exec, code)
    // Joins, invitations and regenerations of one venture take turns on the
    // venture row (always locked first), then the link is checked again: a
    // regeneration that won the lock has revoked it.
    await exec(`SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`, [venture.id])
    const still = await exec(
      `SELECT 1 FROM venture_invite_links l JOIN projects p ON p.id = l.project_id
        WHERE l.id = $1 AND l.revoked_at IS NULL AND l.expires_at > now()
          AND p.status <> 'ARCHIVED'`,
      [link.id],
    )
    if (still.length === 0) throw invalidLink()
    if (await membershipOf(exec, venture, me.profile_id)) {
      return { venture_id: venture.id, joined: false }
    }
    if ((await teamHeadcount(exec, venture)) >= TEAM_MAX_PEOPLE) {
      // The receiver's own live invitation already holds a place.
      const [own] = await exec(
        `SELECT 1 FROM project_members WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION'
            AND invite_email_normalized = $2 AND invite_expires_at > now()`,
        [venture.id, me.email],
      )
      if (!own) throw teamFull()
    }
    const closed = await exec<{ id: string }>(
      `UPDATE project_members SET state = 'REMOVED', ended_at = now(), updated_at = now()
        WHERE project_id = $1 AND state = 'PENDING_CONFIRMATION' AND invite_email_normalized = $2
        RETURNING id::text`,
      [venture.id, me.email],
    )
    let joined: { id: string } | undefined
    try {
      ;[joined] = await exec<{ id: string }>(
        `INSERT INTO project_members
           (project_id, profile_id, role_label, permission, state, joined_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', now(), now())
         RETURNING id::text`,
        [venture.id, me.profile_id, LINK_ROLE_LABEL, LINK_PERMISSION],
      )
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return { venture_id: venture.id, joined: false }
      }
      throw error
    }
    for (const row of closed) {
      await writeAudit(exec, {
        actorAccountId: accountId,
        action: 'VENTURE_TEAM_REMOVED',
        resourceType: 'project_member',
        resourceId: row.id,
        before: { project_id: venture.id, state: 'PENDING_CONFIRMATION' },
        after: { project_id: venture.id, state: 'REMOVED', reason: 'JOINED_BY_LINK' },
        requestId,
      })
    }
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'VENTURE_TEAM_JOINED',
      resourceType: 'project_member',
      resourceId: joined!.id,
      before: null,
      after: {
        project_id: venture.id,
        state: 'ACTIVE',
        permission: LINK_PERMISSION,
        invite_link_id: link.id,
      },
      requestId,
    })
    return { venture_id: venture.id, joined: true }
  })
}

const invalidBody = (field: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Join request is not valid.', {
    [field]: 'not_accepted',
  })
