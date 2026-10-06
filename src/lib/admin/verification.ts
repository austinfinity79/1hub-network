import { ApiError } from '@/lib/api/errors'
import type { Actor } from '@/lib/authz/actor'
import type { Executor } from '@/lib/db/client'
import { OPS_ORGANIZATION_TYPES } from '@/lib/ops/organizations'
import { organizationScope, type OrganizationScope } from '@/lib/ops/scope'

import { writeAdminAudit } from './admin-audit'
import { isUuid, nearestResponsibleUnit } from './hierarchy'
import { holdsAt } from './scope'

/**
 * ADMIN-PROD-02 — RoleVerificationRequest foundation (PD-1; ADMIN-PROD-01 §A).
 *
 * One declared HUB position = one `role_verification_requests` row, the single
 * canonical store shared by the user side (Sprint1 S1-UAT-03B) and the unit
 * queue (ADMIN-PROD-03). `fileVerificationRequest` is its only writer of new
 * rows; the queue, the decision effects and the user-side edits are the next
 * tasks', on these states and predicates.
 *
 *   lifecycle  PENDING → APPROVED | REJECTED (handler) · PENDING → WITHDRAWN
 *              (requester) · REJECTED → PENDING (requester edits, resubmits).
 *              APPROVED and WITHDRAWN are final. UAT labels: Chờ xác minh =
 *              PENDING, Đã xác minh = APPROVED, Không được xác minh = REJECTED.
 *   routing    to the position's own unit; when it has no `verification:review`
 *              holder, CLB → its Chapter → HUB Tổng, fixed on the row at
 *              submission. Never by the requester's highest role.
 *   handler    a `verification:review` holder on the routed unit (whole role or
 *              capability-only grant), or PLATFORM_ADMIN on any request; never
 *              the requester (self-selection never confirms itself). A unit
 *              whose only holder is the requester is skipped by the routing.
 *   effect     (ADMIN-PROD-03) a LeadershipRecord ACTIVE for a current term,
 *              ALUMNI ("Cựu …") for an ended one, plus an ACTIVE membership for a
 *              current term; never a RoleAssignment (DL:759, DEC-WF03-G6).
 *   pending    grants nothing: no membership, no leadership, no admin right.
 */

export const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]
export type VerificationParty = 'HANDLER' | 'REQUESTER'

/** The only legal moves, and who may make each. */
export const VERIFICATION_TRANSITIONS: Record<
  VerificationStatus,
  Partial<Record<VerificationStatus, VerificationParty>>
> = {
  PENDING: { APPROVED: 'HANDLER', REJECTED: 'HANDLER', WITHDRAWN: 'REQUESTER' },
  REJECTED: { PENDING: 'REQUESTER' },
  APPROVED: {},
  WITHDRAWN: {},
}

export function canTransitionVerification(
  from: VerificationStatus,
  to: VerificationStatus,
  by: VerificationParty,
): boolean {
  return VERIFICATION_TRANSITIONS[from]?.[to] === by
}

/**
 * Technical bounds. The position text keeps the bound the onboarding claim had
 * when this was written (200); S1-UAT-03 bounds the typed parts of a new
 * declaration to 60 (hub-position.ts), which a printed title stays within.
 */
export const VERIFICATION_LIMITS = {
  positionTitle: 200,
  rejectReason: 500,
} as const

/** A request's routed unit decides who may handle it; PLATFORM_ADMIN handles any; never the requester. */
export function canHandleVerification(
  actor: Actor | null,
  request: { routedToOrgId: string; requesterProfileId: string },
): boolean {
  if (!actor?.profileId || actor.profileId === request.requesterProfileId.toLowerCase())
    return false
  return holdsAt(actor, 'verification:review', request.routedToOrgId)
}

/** The queue filter: requests routed to these units (ALL for PLATFORM_ADMIN). */
export function verificationQueueScope(actor: Actor | null): OrganizationScope {
  return organizationScope(actor, 'verification:review')
}

/** PD-1 approval effect as data, for ADMIN-PROD-03. A term with no end is current. */
export function approvalEffect(request: { periodTo: string | null }): {
  leadershipState: 'ACTIVE' | 'ALUMNI'
  createsMembership: boolean
} {
  const current = request.periodTo === null
  return { leadershipState: current ? 'ACTIVE' : 'ALUMNI', createsMembership: current }
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/

/** `YYYY-MM` → the first day of that month (`YYYY-MM-01`); null when malformed. */
export function parseMonth(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = MONTH.exec(value.trim())
  return match ? `${match[1]}-${match[2]}-01` : null
}

/** The current month's first day in Vietnam time, where months are declared. */
export function currentMonth(now: Date = new Date()): string {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return `${local.toISOString().slice(0, 7)}-01`
}

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })

export type VerificationRequestInput = {
  organization_id: string
  position_title: string
  period_from: string
  period_to: string | null
}

/** Parses one declared position; months are `YYYY-MM`, past or current only. */
export function parseDeclaredPosition(
  body: unknown,
  now: Date = new Date(),
): VerificationRequestInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  const allowed = ['organization_id', 'position_title', 'period_from', 'period_to']
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid(key, 'not_accepted')
  }
  if (!isUuid(input.organization_id)) throw invalid('organization_id', 'invalid')
  if (typeof input.position_title !== 'string' || !input.position_title.trim())
    throw invalid('position_title', 'required')
  const title = input.position_title.trim()
  if (title.length > VERIFICATION_LIMITS.positionTitle) throw invalid('position_title', 'too_long')
  const from = parseMonth(input.period_from)
  if (!from) throw invalid('period_from', 'invalid')
  const to =
    input.period_to === null || input.period_to === undefined ? null : parseMonth(input.period_to)
  if (to === null && input.period_to !== null && input.period_to !== undefined)
    throw invalid('period_to', 'invalid')
  const month = currentMonth(now)
  if (from > month) throw invalid('period_from', 'future')
  if (to !== null && to > month) throw invalid('period_to', 'future')
  if (to !== null && to < from) throw invalid('period_to', 'before_start')
  return {
    organization_id: (input.organization_id as string).toLowerCase(),
    position_title: title,
    period_from: from,
    period_to: to,
  }
}

export type VerificationRequestRecord = {
  id: string
  organization_id: string
  position_title: string
  period_from: string
  period_to: string | null
  routed_to_org_id: string
  status: VerificationStatus
  version: number
  submitted_at: string
}

/**
 * Files one declared position, in the caller's transaction (the onboarding
 * completion or the S1-UAT-03B endpoint). Routes it, records the receiving unit,
 * and audits VERIFICATION_REQUEST_SUBMITTED with ids and states only. The same
 * open position twice is refused (422 `duplicate`, `uq_rvr_declared_position`).
 */
export async function fileVerificationRequest(
  exec: Executor,
  input: { accountId: string; body: unknown; requestId: string; now?: Date },
): Promise<VerificationRequestRecord> {
  const position = parseDeclaredPosition(input.body, input.now)
  const [profile] = await exec<{ id: string; status: string }>(
    `SELECT id::text, status::text AS status FROM individual_profiles WHERE account_id = $1 FOR UPDATE`,
    [input.accountId],
  )
  if (!profile) throw invalid('profile', 'missing')
  if (profile.status === 'DEACTIVATED') {
    throw new ApiError('PROFILE_DEACTIVATED', 409, 'Profile is deactivated.')
  }
  const [org] = await exec<{ id: string }>(
    `SELECT id::text FROM organizations
      WHERE id = $1 AND type::text = ANY($2::text[]) AND status = 'PUBLISHED'`,
    [position.organization_id, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!org) throw invalid('organization_id', 'organization_not_available')
  const route = await nearestResponsibleUnit(exec, org.id, profile.id)
  if (!route) throw invalid('organization_id', 'organization_not_available')

  const [row] = await exec<{ id: string; submitted_at: Date; version: number }>(
    `INSERT INTO role_verification_requests
       (requester_profile_id, organization_id, position_title, period_from, period_to, routed_to_org_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT DO NOTHING
     RETURNING id::text, submitted_at, version`,
    [
      profile.id,
      org.id,
      position.position_title,
      position.period_from,
      position.period_to,
      route.routedTo,
    ],
  )
  if (!row) throw invalid('position_title', 'duplicate')

  await writeAdminAudit(exec, {
    actorAccountId: input.accountId,
    action: 'VERIFICATION_REQUEST_SUBMITTED',
    target: { type: 'role_verification_request', id: row.id },
    organizationId: route.routedTo,
    after: {
      status: 'PENDING',
      position_organization_id: org.id,
      fallback: route.fallback,
      handler_found: route.handlerFound,
    },
    requestId: input.requestId,
  })
  return {
    id: row.id,
    organization_id: org.id,
    position_title: position.position_title,
    period_from: position.period_from.slice(0, 7),
    period_to: position.period_to?.slice(0, 7) ?? null,
    routed_to_org_id: route.routedTo,
    status: 'PENDING',
    version: row.version,
    submitted_at: new Date(row.submitted_at).toISOString(),
  }
}
