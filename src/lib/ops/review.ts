import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { resolveActor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { require as requireCapability } from '@/lib/authz/authorize'
import { withTransaction } from '@/lib/db/client'
import { toSourceType } from '@/lib/network/network'

import type { LeadershipRecordDTO, MembershipRecordDTO } from './member-detail'
import { operationalOrganization } from './member-detail'

/**
 * WF03-S04 — membership review and leadership operations
 * (API 05 §8.3, DEC-WF03-G5/G6/G14, DEC-WF03-S04-D1..D3).
 *
 * Membership (`membership:confirm`): the two frozen review transitions only —
 * PENDING_APPROVAL → ACTIVE (provenance ORGANIZATION_VERIFIED, started now) or
 * → REJECTED (ended now). Every other move is 409; the API's "where policy
 * allows" transitions have no frozen policy (DEC-WF03-G5).
 *
 * Leadership (`leadership:manage`): create an ACTIVE LeadershipRecord for a
 * person with a membership in this organization (the member-ops predicate,
 * 03 Example B), and end one: ACTIVE → ALUMNI | REVOKED (SOT lifecycle),
 * history kept. No title update (not in the contract). A LeadershipRecord
 * never creates or ends a RoleAssignment, capability or scope (G6).
 *
 * Each mutation authorizes the actor for exactly this organization, locks the
 * row it changes, checks the current state inside the transaction, and writes
 * one audit event with ids and states only (G14). A refused call changes
 * nothing and writes nothing.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null)

function onlyKeys(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid(key, 'not_accepted')
  }
  return input
}

/** Target states a review may set; the other frozen states are not review outcomes. */
const REVIEW_STATES = ['ACTIVE', 'REJECTED'] as const
const MEMBERSHIP_STATES = [
  'PENDING_APPROVAL',
  'ACTIVE',
  'REJECTED',
  'WITHDRAWN',
  'SUSPENDED',
  'ALUMNI',
]

/** PATCH /ops/organizations/{orgId}/memberships/{membershipId} `{ status }`. */
export async function reviewMembership(
  accountId: string,
  orgId: string,
  membershipId: string,
  body: unknown,
  requestId: string,
): Promise<MembershipRecordDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'membership:confirm', {
    scopeType: 'ORGANIZATION',
    scopeId: orgId,
  })
  const org = await operationalOrganization(orgId)
  const input = onlyKeys(body, ['status'])
  if (typeof input.status !== 'string' || !MEMBERSHIP_STATES.includes(input.status))
    throw invalid('status', 'invalid')
  const target = input.status
  if (!UUID.test(membershipId)) throw notFound()

  return withTransaction(async (exec) => {
    const [row] = await exec<{ id: string; state: string }>(
      `SELECT id::text, state::text AS state FROM community_memberships
        WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [membershipId, org.id],
    )
    if (!row) throw notFound()
    if (
      row.state !== 'PENDING_APPROVAL' ||
      !(REVIEW_STATES as readonly string[]).includes(target)
    ) {
      throw conflict('This membership transition is not allowed.')
    }
    const [updated] =
      target === 'ACTIVE'
        ? await exec<{
            id: string
            state: string
            source: string
            created_at: Date
            started_at: Date
            ended_at: Date | null
          }>(
            `UPDATE community_memberships
                SET state = 'ACTIVE', source = 'ORGANIZATION_VERIFIED', started_at = now(), updated_at = now()
              WHERE id = $1
              RETURNING id::text, state::text AS state, source, created_at, started_at, ended_at`,
            [row.id],
          )
        : await exec<{
            id: string
            state: string
            source: string
            created_at: Date
            started_at: Date | null
            ended_at: Date
          }>(
            `UPDATE community_memberships
                SET state = 'REJECTED', ended_at = now(), updated_at = now()
              WHERE id = $1
              RETURNING id::text, state::text AS state, source, created_at, started_at, ended_at`,
            [row.id],
          )
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: target === 'ACTIVE' ? 'MEMBERSHIP_APPROVED' : 'MEMBERSHIP_REJECTED',
      resourceType: 'community_membership',
      resourceId: row.id,
      before: { organization_id: org.id, state: 'PENDING_APPROVAL' },
      after: {
        organization_id: org.id,
        state: target,
        ...(target === 'ACTIVE' ? { source_type: 'ORGANIZATION_VERIFIED' } : {}),
      },
      requestId,
    })
    return {
      id: updated!.id,
      state: updated!.state,
      source_type: toSourceType(updated!.source),
      requested_at: iso(updated!.created_at)!,
      started_at: iso(updated!.started_at),
      ended_at: iso(updated!.ended_at),
    }
  })
}

type LeadershipRow = {
  id: string
  title: string
  state: string
  started_at: Date
  ended_at: Date | null
}

const toLeadershipDTO = (r: LeadershipRow): LeadershipRecordDTO => ({
  id: r.id,
  title: r.title,
  state: r.state,
  started_at: iso(r.started_at)!,
  ended_at: iso(r.ended_at),
})

/** POST /ops/organizations/{orgId}/leadership `{ profile_id, title, valid_from?, valid_to: null }`. */
export async function createLeadership(
  accountId: string,
  orgId: string,
  body: unknown,
  requestId: string,
): Promise<LeadershipRecordDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'leadership:manage', { scopeType: 'ORGANIZATION', scopeId: orgId })
  const org = await operationalOrganization(orgId)
  const input = onlyKeys(body, ['profile_id', 'title', 'valid_from', 'valid_to'])
  if (typeof input.profile_id !== 'string' || !UUID.test(input.profile_id))
    throw invalid('profile_id', 'invalid')
  if (typeof input.title !== 'string' || !input.title.trim()) throw invalid('title', 'required')
  const title = input.title.trim()
  if (title.length > 100) throw invalid('title', 'too_long')
  // No planned-end column exists: a leadership is ended through PATCH (history kept).
  if (input.valid_to !== undefined && input.valid_to !== null)
    throw invalid('valid_to', 'not_supported')
  let startsOn: string | null = null
  if (input.valid_from !== undefined && input.valid_from !== null) {
    if (
      typeof input.valid_from !== 'string' ||
      !DATE.test(input.valid_from) ||
      Number.isNaN(Date.parse(input.valid_from))
    )
      throw invalid('valid_from', 'invalid')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(),
    )
    if (input.valid_from > today) throw invalid('valid_from', 'future')
    startsOn = input.valid_from
  }
  const profileId = input.profile_id

  return withTransaction(async (exec) => {
    // The person must have a membership in this organization (member-ops predicate).
    const related = await exec(
      `SELECT 1 FROM community_memberships WHERE organization_id = $1 AND profile_id = $2 LIMIT 1`,
      [org.id, profileId],
    )
    if (related.length === 0) throw notFound()
    let created: LeadershipRow | undefined
    try {
      ;[created] = await exec<LeadershipRow>(
        `INSERT INTO leadership_records (profile_id, organization_id, role_label, state, started_at)
         VALUES ($1, $2, $3, 'ACTIVE',
                 COALESCE(($4::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', now()))
         RETURNING id::text, role_label AS title, state::text AS state, started_at, ended_at`,
        [profileId, org.id, title, startsOn],
      )
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw conflict('This person already holds this title in this organization.')
      }
      throw error
    }
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'LEADERSHIP_CREATED',
      resourceType: 'leadership_record',
      resourceId: created!.id,
      before: null,
      after: { organization_id: org.id, profile_id: profileId, state: 'ACTIVE' },
      requestId,
    })
    return toLeadershipDTO(created!)
  })
}

const END_STATES = ['ALUMNI', 'REVOKED'] as const

/** PATCH /ops/organizations/{orgId}/leadership/{leadershipId} `{ status: ALUMNI | REVOKED }`. */
export async function endLeadership(
  accountId: string,
  orgId: string,
  leadershipId: string,
  body: unknown,
  requestId: string,
): Promise<LeadershipRecordDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'leadership:manage', { scopeType: 'ORGANIZATION', scopeId: orgId })
  const org = await operationalOrganization(orgId)
  const input = onlyKeys(body, ['status'])
  if (!(END_STATES as readonly unknown[]).includes(input.status)) throw invalid('status', 'invalid')
  const target = input.status as (typeof END_STATES)[number]
  if (!UUID.test(leadershipId)) throw notFound()

  return withTransaction(async (exec) => {
    const [row] = await exec<{ id: string; state: string }>(
      `SELECT id::text, state::text AS state FROM leadership_records
        WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [leadershipId, org.id],
    )
    if (!row) throw notFound()
    if (row.state !== 'ACTIVE') throw conflict('This leadership record is already closed.')
    const [updated] = await exec<LeadershipRow>(
      `UPDATE leadership_records SET state = $2::leadership_state, ended_at = now()
        WHERE id = $1
        RETURNING id::text, role_label AS title, state::text AS state, started_at, ended_at`,
      [row.id, target],
    )
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'LEADERSHIP_ENDED',
      resourceType: 'leadership_record',
      resourceId: row.id,
      before: { organization_id: org.id, state: 'ACTIVE' },
      after: { organization_id: org.id, state: target },
      requestId,
    })
    return toLeadershipDTO(updated!)
  })
}
