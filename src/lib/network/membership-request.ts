import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { query, type Executor } from '@/lib/db/client'

import { toSourceType, type MembershipDTO } from './network'

/**
 * WF02-S04 — member-side membership request, POST /me/membership-requests
 * (05 §5.1; DEC-WF02-H11, DEC-WF02-S04-G1..G5).
 *
 * The session's own profile asks to join one organisation. The request is a
 * CommunityMembership in PENDING_APPROVAL with source SELF_DECLARED; it never
 * becomes ACTIVE here, and it creates no leadership, RoleAssignment,
 * capability or managed scope (approval is WF03). Only `organization_id` is
 * read from the body.
 */

/** G1: the requestable predicate, shared by the S04 option list and the POST. */
export const REQUESTABLE_TYPES = ['HUB', 'CHAPTER', 'CLB'] as const
const REQUESTABLE_SQL = `type::text = ANY($1::text[]) AND status = 'PUBLISHED'`

/** G4: an existing membership in one of these states refuses a new request. */
export const BLOCKING_STATES = ['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'ALUMNI'] as const

export type RequestableOrganization = { id: string; name: string; type: string }

/** Options for the S04 selector (convenience only; the POST re-validates). */
export async function listRequestableOrganizations(
  exec: Executor = query,
): Promise<RequestableOrganization[]> {
  return exec<RequestableOrganization>(
    `SELECT id::text, name, type::text AS type FROM organizations
      WHERE ${REQUESTABLE_SQL} ORDER BY name, id`,
    [REQUESTABLE_TYPES],
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const conflict = () =>
  new ApiError(
    'MEMBERSHIP_INVALID_TRANSITION',
    409,
    'A membership in this organisation already exists in a state that does not allow a new request.',
  )

export async function requestMembership(
  exec: Executor,
  accountId: string,
  body: unknown,
  requestId: string,
): Promise<{ status: 201; body: MembershipDTO }> {
  const organizationId = (body as { organization_id?: unknown } | null)?.organization_id
  // An id that is malformed, unknown, unpublished or of another type is hidden alike.
  if (typeof organizationId !== 'string' || !UUID.test(organizationId)) throw notFound()

  const [org] = await exec<RequestableOrganization>(
    `SELECT id::text, name, type::text AS type FROM organizations
      WHERE id = $2::uuid AND ${REQUESTABLE_SQL}`,
    [REQUESTABLE_TYPES, organizationId],
  )
  if (!org) throw notFound()

  const [profile] = await exec<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1 FOR UPDATE',
    [accountId],
  )
  if (!profile) throw notFound()

  // The profile row lock serialises this member's requests; the partial unique
  // index uq_open_membership still backs the open states.
  const blocking = await exec<{ state: string }>(
    `SELECT state::text AS state FROM community_memberships
      WHERE profile_id = $1 AND organization_id = $2 AND state::text = ANY($3::text[])`,
    [profile.id, org.id, BLOCKING_STATES],
  )
  if (blocking.length > 0) throw conflict()

  let created: { id: string; created_at: Date } | undefined
  try {
    ;[created] = await exec<{ id: string; created_at: Date }>(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source)
       VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED')
       RETURNING id::text, created_at`,
      [profile.id, org.id],
    )
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw conflict()
    throw error
  }

  await writeAudit(exec, {
    actorAccountId: accountId,
    action: 'MEMBERSHIP_REQUESTED',
    resourceType: 'community_membership',
    resourceId: created!.id,
    after: { organization_id: org.id, state: 'PENDING_APPROVAL' },
    requestId,
  })

  return {
    status: 201,
    body: {
      id: created!.id,
      organization: { id: org.id, name: org.name, type: org.type },
      status: 'PENDING_APPROVAL',
      source_type: toSourceType('SELF_DECLARED'),
      valid_from: null,
      valid_to: null,
    },
  }
}

/**
 * WF01 stage 4 — files the membership requests a member named in onboarding
 * (DEC-L1R-D5). Called by `completeOnboarding` inside its transaction, with
 * the profile row already locked.
 *
 * Each claim becomes the same record `requestMembership` writes:
 * PENDING_APPROVAL, SELF_DECLARED, audited as MEMBERSHIP_REQUESTED. The stated
 * position and period ride along as display text and confirm nothing. A unit
 * that is no longer requestable, or where the profile already has a membership
 * in a blocking state (a roster-verified one, for instance), is skipped: that
 * record stays as it is. Never creates leadership, a RoleAssignment or a
 * capability.
 */
export async function fileClaimedMemberships(
  exec: Executor,
  input: {
    accountId: string
    profileId: string
    claims: { organization_id: string; position: string | null; period: string | null }[]
    requestId: string
  },
): Promise<number> {
  let filed = 0
  for (const claim of input.claims) {
    if (!UUID.test(claim.organization_id)) continue
    const [org] = await exec<{ id: string }>(
      `SELECT id::text FROM organizations WHERE id = $2::uuid AND ${REQUESTABLE_SQL}`,
      [REQUESTABLE_TYPES, claim.organization_id],
    )
    if (!org) continue
    const blocking = await exec<{ state: string }>(
      `SELECT state::text AS state FROM community_memberships
        WHERE profile_id = $1 AND organization_id = $2 AND state::text = ANY($3::text[])`,
      [input.profileId, org.id, BLOCKING_STATES],
    )
    if (blocking.length > 0) continue

    const [created] = await exec<{ id: string }>(
      `INSERT INTO community_memberships
         (profile_id, organization_id, state, source, claimed_position, claimed_period)
       VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED', $3, $4)
       RETURNING id::text`,
      [input.profileId, org.id, claim.position, claim.period],
    )
    await writeAudit(exec, {
      actorAccountId: input.accountId,
      action: 'MEMBERSHIP_REQUESTED',
      resourceType: 'community_membership',
      resourceId: created!.id,
      after: { organization_id: org.id, state: 'PENDING_APPROVAL' },
      requestId: input.requestId,
    })
    filed += 1
  }
  return filed
}
