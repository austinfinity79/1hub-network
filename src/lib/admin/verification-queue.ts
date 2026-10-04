import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { ruleFor } from '@/lib/authz/matrix'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { isAssetId, readAssetMeta } from '@/lib/media/avatar-storage'
import { toSourceType, type SourceType } from '@/lib/network/network'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { writeAdminAudit } from './admin-audit'
import { isUuid } from './hierarchy'
import { isCursorTime } from './venture-review'
import { notify } from './notifications'
import { holdsPlatform, inScope } from './scope'
import {
  approvalEffect,
  canHandleVerification,
  VERIFICATION_LIMITS,
  VERIFICATION_STATUSES,
  verificationQueueScope,
  type VerificationStatus,
} from './verification'

/**
 * ADMIN-PROD-03 — the unit-side RoleVerificationRequest workflow (PD-1;
 * ADMIN-PROD-01 §A; ADMIN-PROD-02 foundation). Queue, detail, approve, reject.
 *
 * Scope is the server's: a request is visible and decidable only where the actor
 * holds `verification:review` on the request's ROUTED unit (fixed at submission)
 * or platform-wide. Anything else — another unit, another branch, an unknown or
 * malformed id — answers the same 404. Nobody decides their own request (403,
 * and the attempt is audited). A decision locks the request row, checks PENDING
 * and the version the handler saw, re-reads the handler's grant FOR SHARE, and
 * commits the status, the effects, the audit event and the notification
 * together; the second of two racing decisions gets 409.
 *
 * Approval effects (contract §A, task §7), never a RoleAssignment (DL:759):
 *   current term   ACTIVE LeadershipRecord for the title, plus membership of the
 *                  unit: an ACTIVE one is reused (EXISTING), a PENDING_APPROVAL
 *                  one is activated (ACTIVATED, source ORGANIZATION_VERIFIED),
 *                  none → a new ACTIVE one (CREATED); a SUSPENDED one refuses
 *                  the approval (409) — no automatic reinstatement.
 *   ended term     ALUMNI LeadershipRecord with the term's months ("Cựu …"); no
 *                  membership.
 *   same record    an equal ACTIVE title (case-insensitive) or ALUMNI title with
 *                  the same start month is reused, never duplicated; a row
 *                  another writer inserts meanwhile is re-read, never a 500.
 */

type UnitRef = { id: string; name: string; type: string }

export type VerificationRequestSummaryDTO = {
  id: string
  status: VerificationStatus
  version: number
  position: {
    title: string
    organization: UnitRef
    /** `YYYY-MM`. */
    period_from: string
    /** `YYYY-MM`, or null for a current term. */
    period_to: string | null
    current: boolean
  }
  routed_to: UnitRef
  /** True when the request went past the position's own unit (PD-1 fallback). */
  fallback: boolean
  requester: { profile_id: string; display_name: string | null }
  submitted_at: string
  handled_at: string | null
  /** Display only: whether this viewer may approve or reject it now. */
  can_act: boolean
}

export type VerificationHistoryEntry = {
  event: string
  at: string
  by: 'REQUESTER' | 'HANDLER' | 'SYSTEM'
  status: string | null
  routed_to: string | null
  reason: string | null
}

export type VerificationRequestDetailDTO = VerificationRequestSummaryDTO & {
  requester: {
    profile_id: string
    display_name: string | null
    headline?: string
    avatar_url?: string
  }
  reject_reason: string | null
  handler_profile_id: string | null
  /** The requester's existing records in the position's unit (states only). */
  context: {
    memberships: Array<{
      state: string
      source_type: SourceType | null
      declaration: boolean
      started_at: string | null
      ended_at: string | null
    }>
    leadership: Array<{ title: string; state: string; started_at: string; ended_at: string | null }>
  }
  history: VerificationHistoryEntry[]
}

type RequestRow = {
  id: string
  /** `submitted_at` in UTC at microsecond precision, for the keyset cursor. */
  cursor_time: string
  status: VerificationStatus
  version: number
  position_title: string
  period_from: string
  period_to: string | null
  submitted_at: Date
  handled_at: Date | null
  reject_reason: string | null
  org_id: string
  org_name: string
  org_type: string
  org_status: string
  routed_id: string
  routed_name: string
  routed_type: string
  routed_status: string
  requester_profile_id: string
  requester_account_id: string
  display_name: string | null
  headline: string | null
  avatar_asset_id: string | null
  handler_profile_id: string | null
}

const SELECT_REQUEST = `
  SELECT r.id::text, r.status::text AS status, r.version, r.position_title,
         to_char(r.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
         to_char(r.period_from, 'YYYY-MM') AS period_from, to_char(r.period_to, 'YYYY-MM') AS period_to,
         r.submitted_at, r.handled_at, r.reject_reason,
         o.id::text AS org_id, o.name AS org_name, o.type::text AS org_type, o.status::text AS org_status,
         t.id::text AS routed_id, t.name AS routed_name, t.type::text AS routed_type,
         t.status::text AS routed_status,
         p.id::text AS requester_profile_id, p.account_id::text AS requester_account_id,
         p.display_name, p.headline, p.avatar_asset_id,
         hp.id::text AS handler_profile_id
    FROM role_verification_requests r
    JOIN organizations o ON o.id = r.organization_id
    JOIN organizations t ON t.id = r.routed_to_org_id
    JOIN individual_profiles p ON p.id = r.requester_profile_id
    LEFT JOIN individual_profiles hp ON hp.account_id = r.handled_by_account_id`

const MAX_LIMIT = 50
const LIST_PARAMS = ['status', 'organization_id', 'routed_to', 'cursor', 'limit']

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null)

/**
 * Keyset cursor on the queue order (`submitted_at`, id): a page boundary stays
 * put while decisions shrink the queue. The time is kept at microsecond
 * precision, exactly as stored.
 */
type Cursor = { t: string; i: string }
const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url')
function decodeCursor(raw: string | null): Cursor | null {
  if (raw === null) return null
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>
    if (isCursorTime(value.t) && isUuid(value.i)) {
      return { t: value.t, i: value.i }
    }
  } catch {
    // falls through to the refusal
  }
  throw invalid('cursor', 'invalid')
}

async function signedActor(accountId: string): Promise<Actor> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  return actor
}

/** Display names through PROFILE_DISCOVERY for a network viewer (no ops bypass, WF03 rule). */
async function visibleNames(
  exec: Executor,
  rows: RequestRow[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(rows.map((r) => r.requester_profile_id))]
  const levels = await discoveryLevelsOf(exec, ids)
  const out = new Map<string, string | null>()
  for (const row of rows) {
    const projected = projectDiscovery(
      {
        profile_id: row.requester_profile_id,
        display_name: row.display_name,
        avatar_asset_id: null,
        headline: null,
        bio: null,
        domain_ids: [],
        region_id: null,
      },
      levels.get(row.requester_profile_id) ?? 'NETWORK_ONLY',
      'NETWORK',
    )
    out.set(row.requester_profile_id, projected?.display_name ?? null)
  }
  return out
}

function toSummary(
  row: RequestRow,
  actor: Actor,
  names: Map<string, string | null>,
): VerificationRequestSummaryDTO {
  return {
    id: row.id,
    status: row.status,
    version: row.version,
    position: {
      title: row.position_title,
      organization: { id: row.org_id, name: row.org_name, type: row.org_type },
      period_from: row.period_from,
      period_to: row.period_to,
      current: row.period_to === null,
    },
    routed_to: { id: row.routed_id, name: row.routed_name, type: row.routed_type },
    fallback: row.routed_id !== row.org_id,
    requester: {
      profile_id: row.requester_profile_id,
      display_name: names.get(row.requester_profile_id) ?? null,
    },
    submitted_at: iso(row.submitted_at)!,
    handled_at: iso(row.handled_at),
    can_act:
      row.status === 'PENDING' &&
      canHandleVerification(actor, {
        routedToOrgId: row.routed_id,
        requesterProfileId: row.requester_profile_id,
      }),
  }
}

/** GET /ops/verification-requests — the viewer's queue, scope derived on the server. */
export async function listVerificationRequests(
  accountId: string,
  params: URLSearchParams,
): Promise<{
  items: VerificationRequestSummaryDTO[]
  nextCursor: string | null
  limit: number
  counts: { pending: number }
}> {
  const actor = await signedActor(accountId)
  const scope = verificationQueueScope(actor)
  if (scope.kind === 'SOME' && scope.organizationIds.length === 0) throw forbidden()

  for (const key of new Set(params.keys())) {
    if (!LIST_PARAMS.includes(key)) throw invalid(key, 'not_accepted')
    if (params.getAll(key).length > 1) throw invalid(key, 'duplicate')
  }
  const status = params.get('status') ?? 'PENDING'
  if (!(VERIFICATION_STATUSES as readonly string[]).includes(status))
    throw invalid('status', 'invalid')
  const organizationId = params.get('organization_id')
  if (organizationId !== null && !isUuid(organizationId))
    throw invalid('organization_id', 'invalid')
  const routedTo = params.get('routed_to')
  if (routedTo !== null && !isUuid(routedTo)) throw invalid('routed_to', 'invalid')
  // A routed unit outside the viewer's scope is refused, never silently emptied.
  if (routedTo !== null && !inScope(scope, routedTo)) throw forbidden()
  const rawLimit = params.get('limit')
  const limit = rawLimit === null ? 20 : Number(rawLimit)
  if (!/^\d{1,2}$/.test(rawLimit ?? '20') || limit < 1 || limit > MAX_LIMIT)
    throw invalid('limit', 'invalid')
  const after = decodeCursor(params.get('cursor'))

  const scopeIds = scope.kind === 'ALL' ? null : scope.organizationIds
  const rows = await query<RequestRow>(
    `${SELECT_REQUEST}
      WHERE ($1::uuid[] IS NULL OR r.routed_to_org_id = ANY($1::uuid[]))
        AND r.status = $2::verification_request_status
        AND ($3::uuid IS NULL OR r.organization_id = $3::uuid)
        AND ($4::uuid IS NULL OR r.routed_to_org_id = $4::uuid)
        AND ($6::timestamptz IS NULL OR (r.submitted_at, r.id) > ($6::timestamptz, $7::uuid))
      ORDER BY r.submitted_at, r.id
      LIMIT $5`,
    [scopeIds, status, organizationId, routedTo, limit + 1, after?.t ?? null, after?.i ?? null],
  )
  const [pending] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM role_verification_requests
      WHERE status = 'PENDING' AND ($1::uuid[] IS NULL OR routed_to_org_id = ANY($1::uuid[]))`,
    [scopeIds],
  )
  const page = rows.slice(0, limit)
  const names = await visibleNames(query, page)
  return {
    items: page.map((row) => toSummary(row, actor, names)),
    nextCursor:
      rows.length > limit
        ? encodeCursor({ t: page.at(-1)!.cursor_time, i: page.at(-1)!.id })
        : null,
    limit,
    counts: { pending: pending!.n },
  }
}

/** The request if the actor may see it; unknown, malformed and out-of-scope ids alike → 404. */
async function visibleRequest(
  exec: Executor,
  actor: Actor,
  requestId: string,
  lock: boolean,
): Promise<RequestRow> {
  if (!isUuid(requestId)) throw notFound()
  const scope = verificationQueueScope(actor)
  if (scope.kind === 'SOME' && scope.organizationIds.length === 0) throw notFound()
  // Scope is part of the statement, so a row outside it is never locked or waited on.
  const [row] = await exec<RequestRow>(
    `${SELECT_REQUEST}
      WHERE r.id = $1 AND ($2::uuid[] IS NULL OR r.routed_to_org_id = ANY($2::uuid[]))
      ${lock ? 'FOR UPDATE OF r' : ''}`,
    [requestId, scope.kind === 'ALL' ? null : scope.organizationIds],
  )
  if (!row) throw notFound()
  return row
}

const HISTORY_EVENT: Record<string, string> = {
  VERIFICATION_REQUEST_SUBMITTED: 'SUBMITTED',
  VERIFICATION_REQUEST_MIGRATED: 'MIGRATED',
  VERIFICATION_REQUEST_UPDATED: 'UPDATED',
  VERIFICATION_REQUEST_WITHDRAWN: 'WITHDRAWN',
  VERIFICATION_REQUEST_RESUBMITTED: 'RESUBMITTED',
  VERIFICATION_REQUEST_APPROVED: 'APPROVED',
  VERIFICATION_REQUEST_APPROVED_EXISTING_MEMBERSHIP: 'APPROVED',
  VERIFICATION_REQUEST_REJECTED: 'REJECTED',
}

async function history(exec: Executor, row: RequestRow): Promise<VerificationHistoryEntry[]> {
  const events = await exec<{
    action: string
    actor: string | null
    created_at: Date
    after_data: Record<string, unknown> | null
  }>(
    `SELECT action, actor_account_id::text AS actor, created_at, after_data FROM audit_events
      WHERE resource_type = 'role_verification_request' AND resource_id = $1
        AND action = ANY($2::text[])
      ORDER BY created_at, id`,
    [row.id, Object.keys(HISTORY_EVENT)],
  )
  return events.map((e) => {
    const after = e.after_data ?? {}
    const text = (key: string) => (typeof after[key] === 'string' ? (after[key] as string) : null)
    const event = HISTORY_EVENT[e.action]!
    return {
      event,
      at: iso(e.created_at)!,
      by:
        e.actor === null
          ? 'SYSTEM'
          : e.actor === row.requester_account_id
            ? 'REQUESTER'
            : 'HANDLER',
      status: text('status'),
      routed_to: event === 'SUBMITTED' || event === 'MIGRATED' ? text('organization_id') : null,
      reason: event === 'REJECTED' ? text('reason') : null,
    }
  })
}

/** GET /ops/verification-requests/{id} — what a review needs, nothing more. */
export async function getVerificationRequest(
  accountId: string,
  requestId: string,
): Promise<VerificationRequestDetailDTO> {
  const actor = await signedActor(accountId)
  const row = await visibleRequest(query, actor, requestId, false)
  return detail(query, row, actor)
}

async function detail(
  exec: Executor,
  row: RequestRow,
  actor: Actor,
): Promise<VerificationRequestDetailDTO> {
  const names = await visibleNames(exec, [row])
  const summary = toSummary(row, actor, names)
  const level =
    (await discoveryLevelsOf(exec, [row.requester_profile_id])).get(row.requester_profile_id) ??
    'NETWORK_ONLY'
  const projected = projectDiscovery(
    {
      profile_id: row.requester_profile_id,
      display_name: row.display_name,
      avatar_asset_id: null,
      headline: row.headline,
      bio: null,
      domain_ids: [],
      region_id: null,
    },
    level,
    'NETWORK',
  )
  const requester: VerificationRequestDetailDTO['requester'] = {
    profile_id: row.requester_profile_id,
    display_name: projected?.display_name ?? null,
  }
  if (projected?.headline) requester.headline = projected.headline
  if (projected && isAssetId(row.avatar_asset_id)) {
    const meta = await readAssetMeta(row.avatar_asset_id)
    if (meta?.owner_account_id === row.requester_account_id) {
      requester.avatar_url = `/media/assets/${row.avatar_asset_id}`
    }
  }
  const memberships = await exec<{
    state: string
    source: string | null
    hub_declaration: boolean
    started_at: Date | null
    ended_at: Date | null
  }>(
    `SELECT state::text AS state, source, hub_declaration, started_at, ended_at
       FROM community_memberships WHERE profile_id = $1 AND organization_id = $2
      ORDER BY created_at DESC, id`,
    [row.requester_profile_id, row.org_id],
  )
  const leadership = await exec<{
    title: string
    state: string
    started_at: Date
    ended_at: Date | null
  }>(
    `SELECT role_label AS title, state::text AS state, started_at, ended_at
       FROM leadership_records WHERE profile_id = $1 AND organization_id = $2
      ORDER BY started_at DESC, id`,
    [row.requester_profile_id, row.org_id],
  )
  return {
    ...summary,
    requester,
    reject_reason: row.reject_reason,
    handler_profile_id: row.handler_profile_id,
    context: {
      memberships: memberships.map((m) => ({
        state: m.state,
        source_type: toSourceType(m.source),
        declaration: m.hub_declaration,
        started_at: iso(m.started_at),
        ended_at: iso(m.ended_at),
      })),
      leadership: leadership.map((l) => ({
        title: l.title,
        state: l.state,
        started_at: iso(l.started_at)!,
        ended_at: iso(l.ended_at),
      })),
    },
    history: await history(exec, row),
  }
}

function parseDecision(
  body: unknown,
  allowReason: boolean,
): { version: number; reason: string | null } {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  const allowed = allowReason ? ['version', 'reason'] : ['version']
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw invalid(key, 'not_accepted')
  }
  if (!Number.isInteger(input.version) || (input.version as number) < 1)
    throw invalid('version', 'invalid')
  let reason: string | null = null
  if (allowReason && input.reason !== undefined && input.reason !== null) {
    if (typeof input.reason !== 'string') throw invalid('reason', 'invalid')
    reason = input.reason.trim() || null
    if (reason && reason.length > VERIFICATION_LIMITS.rejectReason)
      throw invalid('reason', 'too_long')
  }
  return { version: input.version as number, reason }
}

/**
 * Re-reads, FOR SHARE in the decision's transaction, a grant that lets the actor
 * handle requests routed to `routedTo`; a revocation committed first refuses the
 * decision, a later one waits for it.
 */
async function handlerStillHolds(
  exec: Executor,
  profileId: string,
  routedTo: string,
): Promise<boolean> {
  const rule = ruleFor('verification:review')!
  const rows = await exec<{ id: string }>(
    `SELECT id::text FROM role_assignments
      WHERE individual_profile_id = $1 AND state = 'ACTIVE'
        AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
        AND ((scope_type = 'PLATFORM' AND capability IS NULL AND role_code = ANY($2::text[]))
          OR (scope_type = 'ORGANIZATION' AND scope_id = $3 AND role_code = ANY($4::text[])
              AND (capability IS NULL OR capability = 'verification:review')))
      FOR SHARE`,
    [profileId, rule.platformRoles, routedTo, rule.organizationRoles],
  )
  return rows.length > 0
}

export type Decision = 'APPROVE' | 'REJECT'

/** Shared checks of a decision; returns the locked, decidable request. */
/**
 * Refuses (403) and audits a requester deciding their own request. Runs before
 * any transaction — the routes call it ahead of the idempotent run — so the
 * audit row is written on the only connection in use and survives the refusal.
 * `requester_profile_id` never changes, so an unlocked read is enough.
 */
export async function refuseOwnDecision(
  accountId: string,
  requestId: string,
  decision: Decision,
  auditRequestId: string,
): Promise<void> {
  const actor = await signedActor(accountId)
  let row: RequestRow
  try {
    row = await visibleRequest(query, actor, requestId, false)
  } catch {
    return // not visible: the decision itself answers 404
  }
  if (row.requester_profile_id !== actor.profileId) return
  await writeAdminAudit(query, {
    actorAccountId: accountId,
    action: 'VERIFICATION_REQUEST_SELF_ACTION_REFUSED',
    target: { type: 'role_verification_request', id: row.id },
    organizationId: row.routed_id,
    after: { status: row.status, action: decision },
    requestId: auditRequestId,
  })
  throw forbidden()
}

async function decidable(
  exec: Executor,
  actor: Actor,
  requestId: string,
  version: number,
): Promise<RequestRow> {
  const row = await visibleRequest(exec, actor, requestId, true)
  // `refuseOwnDecision` ran before the transaction; this guards any other caller.
  if (row.requester_profile_id === actor.profileId) throw forbidden()
  if (row.status !== 'PENDING') throw conflict('This request is no longer pending.')
  if (row.version !== version) throw conflict('This request changed; reload it.')
  if (!(await handlerStillHolds(exec, actor.profileId!, row.routed_id))) throw forbidden()
  if (row.routed_status === 'ARCHIVED' && !holdsPlatform(actor, 'verification:review')) {
    throw conflict('The receiving unit is archived.')
  }
  return row
}

type Outcome = {
  membership: 'CREATED' | 'ACTIVATED' | 'EXISTING' | 'NOT_APPLICABLE'
  membershipId: string | null
  leadership: 'CREATED' | 'EXISTING'
  leadershipId: string
  leadershipState: 'ACTIVE' | 'ALUMNI'
}

/** The approval effects, reusing whatever already exists (task §7). */
async function applyApproval(exec: Executor, row: RequestRow): Promise<Outcome> {
  const effect = approvalEffect({ periodTo: row.period_to })
  const profile = row.requester_profile_id
  const org = row.org_id
  const from = `${row.period_from}-01`
  const to = row.period_to ? `${row.period_to}-01` : null

  // Writers that do not take the requester lock (a membership request, WF03, the
  // roster) can race the inserts below; a conflict is re-read, never a 500.
  let membership: Outcome['membership'] = 'NOT_APPLICABLE'
  let membershipId: string | null = null
  for (let attempt = 0; effect.createsMembership && membershipId === null; attempt += 1) {
    if (attempt === 2) throw conflict('The membership changed meanwhile; retry.')
    const open = await exec<{ id: string; state: string }>(
      `SELECT id::text, state::text AS state FROM community_memberships
        WHERE profile_id = $1 AND organization_id = $2
          AND state IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED')
        ORDER BY created_at DESC, id FOR UPDATE`,
      [profile, org],
    )
    if (open.some((m) => m.state === 'SUSPENDED')) {
      throw conflict("This person's membership of the unit is suspended.")
    }
    const active = open.find((m) => m.state === 'ACTIVE')
    const pending = open.find((m) => m.state === 'PENDING_APPROVAL')
    if (active) {
      membership = 'EXISTING'
      membershipId = active.id
    } else if (pending) {
      await exec(
        `UPDATE community_memberships
            SET state = 'ACTIVE', source = 'ORGANIZATION_VERIFIED', started_at = now(), updated_at = now()
          WHERE id = $1`,
        [pending.id],
      )
      membership = 'ACTIVATED'
      membershipId = pending.id
    } else {
      const [created] = await exec<{ id: string }>(
        `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
         VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED', now())
         ON CONFLICT DO NOTHING
         RETURNING id::text`,
        [profile, org],
      )
      if (created) {
        membership = 'CREATED'
        membershipId = created.id
      }
    }
  }

  // An equal ACTIVE title (case-insensitive), or an ALUMNI one with the same start month.
  const findSame = async () =>
    (
      await exec<{ id: string }>(
        effect.leadershipState === 'ACTIVE'
          ? `SELECT id::text FROM leadership_records
              WHERE profile_id = $1 AND organization_id = $2 AND state = 'ACTIVE'
                AND lower(role_label) = lower($3)
              ORDER BY started_at, id LIMIT 1`
          : `SELECT id::text FROM leadership_records
              WHERE profile_id = $1 AND organization_id = $2 AND state = 'ALUMNI'
                AND lower(role_label) = lower($3)
                AND date_trunc('month', started_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = $4::date
              ORDER BY started_at, id LIMIT 1`,
        effect.leadershipState === 'ACTIVE'
          ? [profile, org, row.position_title]
          : [profile, org, row.position_title, from],
      )
    )[0]
  const result = (leadership: Outcome['leadership'], leadershipId: string): Outcome => ({
    membership,
    membershipId,
    leadership,
    leadershipId,
    leadershipState: effect.leadershipState,
  })
  const same = await findSame()
  if (same) return result('EXISTING', same.id)
  const [created] = await exec<{ id: string }>(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state, started_at, ended_at)
     VALUES ($1, $2, $3, $4::leadership_state,
             ($5::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
             ($6::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
     ON CONFLICT DO NOTHING
     RETURNING id::text`,
    [profile, org, row.position_title, effect.leadershipState, from, to],
  )
  if (created) return result('CREATED', created.id)
  const raced = await findSame()
  if (raced) return result('EXISTING', raced.id)
  throw conflict('The leadership record changed meanwhile; retry.')
}

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

/** POST /ops/verification-requests/{id}/approve `{ version }`. */
export async function approveVerificationRequest(
  accountId: string,
  requestId: string,
  body: unknown,
  auditRequestId: string,
  exec?: Executor,
): Promise<VerificationRequestDetailDTO> {
  const actor = await signedActor(accountId)
  const { version } = parseDecision(body, false)
  if (!exec) await refuseOwnDecision(accountId, requestId, 'APPROVE', auditRequestId)
  await inTransaction(exec, async (tx) => {
    const row = await decidable(tx, actor, requestId, version)
    const [requester] = await tx<{ status: string; account_status: string }>(
      `SELECT p.status::text AS status, a.status::text AS account_status
         FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
        WHERE p.id = $1 FOR UPDATE OF p`,
      [row.requester_profile_id],
    )
    if (requester?.status !== 'ACTIVE' || requester.account_status !== 'ACTIVE') {
      throw conflict("The requester's account or profile is not active.")
    }
    if (row.org_status !== 'PUBLISHED') throw conflict("The position's unit is not active.")

    const outcome = await applyApproval(tx, row)
    await tx(
      `UPDATE role_verification_requests
          SET status = 'APPROVED', handled_by_account_id = $2, handled_at = now(),
              version = version + 1, updated_at = now()
        WHERE id = $1`,
      [row.id, accountId],
    )
    await writeAdminAudit(tx, {
      actorAccountId: accountId,
      action:
        outcome.membership === 'EXISTING'
          ? 'VERIFICATION_REQUEST_APPROVED_EXISTING_MEMBERSHIP'
          : 'VERIFICATION_REQUEST_APPROVED',
      target: { type: 'role_verification_request', id: row.id },
      organizationId: row.routed_id,
      before: { status: 'PENDING', version },
      after: {
        status: 'APPROVED',
        version: version + 1,
        position_organization_id: row.org_id,
        membership_outcome: outcome.membership,
        membership_id: outcome.membershipId,
        leadership_outcome: outcome.leadership,
        leadership_id: outcome.leadershipId,
        leadership_state: outcome.leadershipState,
      },
      requestId: auditRequestId,
    })
    await notify(tx, {
      recipientAccountId: row.requester_account_id,
      type: 'VERIFICATION_APPROVED',
      resourceId: row.id,
    })
  })
  return getVerificationRequestAfterDecision(exec, actor, requestId)
}

/** POST /ops/verification-requests/{id}/reject `{ version, reason? }`. */
export async function rejectVerificationRequest(
  accountId: string,
  requestId: string,
  body: unknown,
  auditRequestId: string,
  exec?: Executor,
): Promise<VerificationRequestDetailDTO> {
  const actor = await signedActor(accountId)
  const { version, reason } = parseDecision(body, true)
  if (!exec) await refuseOwnDecision(accountId, requestId, 'REJECT', auditRequestId)
  await inTransaction(exec, async (tx) => {
    const row = await decidable(tx, actor, requestId, version)
    await tx(
      `UPDATE role_verification_requests
          SET status = 'REJECTED', handled_by_account_id = $2, handled_at = now(),
              reject_reason = $3, version = version + 1, updated_at = now()
        WHERE id = $1`,
      [row.id, accountId, reason],
    )
    await writeAdminAudit(tx, {
      actorAccountId: accountId,
      action: 'VERIFICATION_REQUEST_REJECTED',
      target: { type: 'role_verification_request', id: row.id },
      organizationId: row.routed_id,
      before: { status: 'PENDING', version },
      after: { status: 'REJECTED', version: version + 1, position_organization_id: row.org_id },
      reason,
      requestId: auditRequestId,
    })
    await notify(tx, {
      recipientAccountId: row.requester_account_id,
      type: 'VERIFICATION_REJECTED',
      resourceId: row.id,
    })
  })
  return getVerificationRequestAfterDecision(exec, actor, requestId)
}

/** The decided request as the handler now sees it (inside the idempotent transaction when given). */
async function getVerificationRequestAfterDecision(
  exec: Executor | undefined,
  actor: Actor,
  requestId: string,
): Promise<VerificationRequestDetailDTO> {
  const reader = exec ?? query
  const row = await visibleRequest(reader, actor, requestId, false)
  return detail(reader, row, actor)
}
