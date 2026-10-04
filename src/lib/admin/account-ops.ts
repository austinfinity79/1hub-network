import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { OPS_ORGANIZATION_TYPES } from '@/lib/ops/organizations'

import {
  ACCOUNT_REQUEST_LIMITS,
  ACCOUNT_REQUEST_STATUSES,
  mayEscalateAccountAction,
  mayExecuteAccountAction,
} from './account-actions'
import { writeAdminAudit } from './admin-audit'
import { isUuid } from './hierarchy'
import { discoveryNames } from './identity'
import { checkParams, cursorTime, decodeKeyset, encodeKeyset, parseLimit } from './paging'

/**
 * ADMIN-PROD-05 — account operations (PD-7; ADMIN-PROD-01 account lifecycle).
 * Execution is PLATFORM_ADMIN's alone (`account:administer`); a unit leader may
 * only FILE a request for an ACTIVE member of exactly its unit
 * (`account:escalate`). No hard delete exists anywhere.
 *
 *   LOCK         account ACTIVE → BLOCKED; every session revoked; sign-in refused
 *                (AUTH_ACCOUNT_BLOCKED). Data, profile and roles kept. UNLOCK
 *                reverses it (old sessions stay revoked).
 *   DEACTIVATE   account (ACTIVE or BLOCKED) and profile → DEACTIVATED; sessions
 *                revoked; organization-scoped role assignments closed; sign-in
 *                refused. REACTIVATE restores the statuses only (profile ACTIVE
 *                if onboarding was completed, else DRAFT); roles stay closed.
 *   SOFT_DELETE  the privacy / data-removal request: the account's deletion
 *                request (the user's own, or one recorded now) is PROCESSED and
 *                the account deactivated as above — flagged for the separate
 *                retention procedure; nothing is physically deleted, and it can
 *                no longer be reactivated here.
 * The same state again is no change (200, no audit). An admin never acts on
 * their own account (403, audited before any transaction). Locks: account row
 * first, then any request row — one order everywhere.
 */

export const ACCOUNT_OPERATIONS = [
  'LOCK',
  'UNLOCK',
  'DEACTIVATE',
  'REACTIVATE',
  'SOFT_DELETE',
] as const
export type AccountOperation = (typeof ACCOUNT_OPERATIONS)[number]
const ESCALATABLE = ['LOCK', 'DEACTIVATE', 'SOFT_DELETE'] as const

const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null)

async function signed(accountId: string): Promise<Actor> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  return actor
}

function parseReason(
  body: unknown,
  extra: readonly string[] = [],
): { reason: string | null; rest: Record<string, unknown> } {
  if (body === undefined || body === null) return { reason: null, rest: {} }
  if (typeof body !== 'object' || Array.isArray(body)) throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input))
    if (key !== 'reason' && !extra.includes(key)) throw invalid(key, 'not_accepted')
  let reason: string | null = null
  if (input.reason !== undefined && input.reason !== null) {
    if (typeof input.reason !== 'string') throw invalid('reason', 'invalid')
    reason = input.reason.trim() || null
    if (reason && reason.length > ACCOUNT_REQUEST_LIMITS.reason) throw invalid('reason', 'too_long')
  }
  return { reason, rest: input }
}

export type AccountStateDTO = {
  profile_id: string
  account_status: 'ACTIVE' | 'BLOCKED' | 'DEACTIVATED'
  profile_status: string
  soft_deleted: boolean
  changed: boolean
}

type Target = {
  account_id: string
  profile_id: string
  account_status: AccountStateDTO['account_status']
  profile_status: string
  onboarded: boolean
  soft_deleted: boolean
}

async function lockTarget(exec: Executor, profileId: string): Promise<Target> {
  if (!isUuid(profileId)) throw notFound()
  const [row] = await exec<Target>(
    `SELECT a.id::text AS account_id, p.id::text AS profile_id, a.status::text AS account_status,
            p.status::text AS profile_status, p.onboarding_completed_at IS NOT NULL AS onboarded,
            EXISTS (SELECT 1 FROM account_deletion_requests d
                     WHERE d.account_id = a.id AND d.status = 'PROCESSED') AS soft_deleted
       FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
      WHERE p.id = $1 FOR UPDATE OF a, p`,
    [profileId],
  )
  if (!row) throw notFound()
  return row
}

const state = (t: Target, changed: boolean): AccountStateDTO => ({
  profile_id: t.profile_id,
  account_status: t.account_status,
  profile_status: t.profile_status,
  soft_deleted: t.soft_deleted,
  changed,
})

/**
 * Executes one operation on a locked target in the caller's transaction (the
 * direct endpoints and request processing share it). Returns the new state.
 */
async function execute(
  exec: Executor,
  input: {
    actorAccountId: string
    target: Target
    operation: AccountOperation
    reason: string | null
    requestId: string
  },
): Promise<AccountStateDTO> {
  const { target: t, operation } = input
  const from = { status: t.account_status, profile_status: t.profile_status }
  let next: { account: Target['account_status']; profile: string } | null = null
  if (operation === 'LOCK') {
    if (t.account_status === 'DEACTIVATED') throw conflict('This account is deactivated.')
    if (t.account_status === 'ACTIVE') next = { account: 'BLOCKED', profile: t.profile_status }
  } else if (operation === 'UNLOCK') {
    if (t.account_status === 'DEACTIVATED')
      throw conflict('This account is deactivated; reactivate it instead.')
    if (t.account_status === 'BLOCKED') next = { account: 'ACTIVE', profile: t.profile_status }
  } else if (operation === 'DEACTIVATE' || operation === 'SOFT_DELETE') {
    if (t.account_status !== 'DEACTIVATED')
      next = { account: 'DEACTIVATED', profile: 'DEACTIVATED' }
  } else if (operation === 'REACTIVATE') {
    if (t.soft_deleted) throw conflict('This account is flagged for deletion.')
    if (t.account_status === 'BLOCKED') throw conflict('This account is locked; unlock it instead.')
    if (t.account_status === 'DEACTIVATED')
      next = { account: 'ACTIVE', profile: t.onboarded ? 'ACTIVE' : 'DRAFT' }
  }

  let softDeleteChanged = false
  if (operation === 'SOFT_DELETE' && !t.soft_deleted) {
    // The privacy request: the user's own row, or one recorded now; then processed.
    await exec(
      `INSERT INTO account_deletion_requests (account_id) VALUES ($1) ON CONFLICT (account_id) DO NOTHING`,
      [t.account_id],
    )
    const [request] = await exec<{ id: string; status: string }>(
      `UPDATE account_deletion_requests
          SET status = 'PROCESSED', handled_by_account_id = $2, handled_at = now()
        WHERE account_id = $1 RETURNING id::text, status::text AS status`,
      [t.account_id, input.actorAccountId],
    )
    await writeAdminAudit(exec, {
      actorAccountId: input.actorAccountId,
      action: 'ACCOUNT_SOFT_DELETE_REQUESTED',
      target: { type: 'account_deletion_request', id: request!.id },
      before: { status: t.account_status },
      after: { status: 'PROCESSED', profile_id: t.profile_id, retention: true },
      reason: input.reason,
      requestId: input.requestId,
    })
    t.soft_deleted = true
    softDeleteChanged = true
  }
  if (!next) return state(t, softDeleteChanged)

  await exec(
    `UPDATE user_accounts SET status = $2::account_status, updated_at = now() WHERE id = $1`,
    [t.account_id, next.account],
  )
  if (next.profile !== t.profile_status) {
    await exec(
      `UPDATE individual_profiles SET status = $2::profile_status, updated_at = now() WHERE id = $1`,
      [t.profile_id, next.profile],
    )
  }
  let revoked = 0
  if (next.account !== 'ACTIVE') {
    revoked = (
      await exec<{ id: string }>(
        `UPDATE user_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL RETURNING id::text`,
        [t.account_id],
      )
    ).length
  }
  let closed = 0
  if (next.account === 'DEACTIVATED') {
    closed = (
      await exec<{ id: string }>(
        `UPDATE role_assignments SET state = 'CLOSED', valid_to = now()
          WHERE individual_profile_id = $1 AND scope_type = 'ORGANIZATION' AND state = 'ACTIVE'
         RETURNING id::text`,
        [t.profile_id],
      )
    ).length
  }
  const action =
    operation === 'LOCK'
      ? 'ACCOUNT_LOCKED'
      : operation === 'UNLOCK'
        ? 'ACCOUNT_UNLOCKED'
        : operation === 'REACTIVATE'
          ? 'ACCOUNT_REACTIVATED'
          : 'ACCOUNT_DEACTIVATED'
  await writeAdminAudit(exec, {
    actorAccountId: input.actorAccountId,
    action,
    target: { type: 'user_account', id: t.account_id },
    before: from,
    after: {
      status: next.account,
      profile_status: next.profile,
      profile_id: t.profile_id,
      revoked_count: revoked,
      closed_count: closed,
      retention: operation === 'SOFT_DELETE',
    },
    reason: input.reason,
    requestId: input.requestId,
  })
  t.account_status = next.account
  t.profile_status = next.profile
  return state(t, true)
}

/** SOFT_DELETE for an account that never got a profile: the request processed, the account deactivated. */
async function softDeleteAccountOnly(
  exec: Executor,
  actorAccountId: string,
  targetAccountId: string,
  reason: string | null,
  requestId: string,
): Promise<void> {
  const [request] = await exec<{ id: string }>(
    `UPDATE account_deletion_requests SET status = 'PROCESSED', handled_by_account_id = $2, handled_at = now()
      WHERE account_id = $1 RETURNING id::text`,
    [targetAccountId, actorAccountId],
  )
  await writeAdminAudit(exec, {
    actorAccountId,
    action: 'ACCOUNT_SOFT_DELETE_REQUESTED',
    target: { type: 'account_deletion_request', id: request!.id },
    after: { status: 'PROCESSED', retention: true },
    reason,
    requestId,
  })
  const [before] = await exec<{ status: string }>(
    `SELECT status::text AS status FROM user_accounts WHERE id = $1`,
    [targetAccountId],
  )
  if (before?.status === 'DEACTIVATED') return
  await exec(`UPDATE user_accounts SET status = 'DEACTIVATED', updated_at = now() WHERE id = $1`, [
    targetAccountId,
  ])
  const revoked = (
    await exec<{ id: string }>(
      `UPDATE user_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL RETURNING id::text`,
      [targetAccountId],
    )
  ).length
  await writeAdminAudit(exec, {
    actorAccountId,
    action: 'ACCOUNT_DEACTIVATED',
    target: { type: 'user_account', id: targetAccountId },
    before: { status: before?.status ?? null },
    after: { status: 'DEACTIVATED', revoked_count: revoked, closed_count: 0, retention: true },
    reason,
    requestId,
  })
}

/** Refuses (403) and audits an admin acting on their own account, before any transaction. */
export async function refuseOwnAccountAction(
  accountId: string,
  targetProfileId: string,
  operation: AccountOperation,
  auditRequestId: string,
): Promise<void> {
  const actor = await signed(accountId)
  if (!mayExecuteAccountAction(actor) || actor.profileId !== targetProfileId.toLowerCase()) return
  await writeAdminAudit(query, {
    actorAccountId: accountId,
    action: 'ACCOUNT_SELF_ACTION_REFUSED',
    target: { type: 'user_account', id: accountId },
    after: { action: operation },
    requestId: auditRequestId,
  })
  throw forbidden()
}

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

/**
 * Locks the acting admin's account and the target's together (in id order, so
 * two admins acting on each other serialize) and requires the actor to still
 * be ACTIVE: two admins can never lock each other out at the same instant.
 */
async function lockActorWith(
  exec: Executor,
  actorAccountId: string,
  targetAccountId: string | null,
): Promise<void> {
  const rows = await exec<{ id: string; status: string }>(
    `SELECT id::text, status::text AS status FROM user_accounts
      WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [[actorAccountId, targetAccountId].filter(Boolean)],
  )
  if (rows.find((r) => r.id === actorAccountId)?.status !== 'ACTIVE') throw forbidden()
}

async function accountOfProfile(exec: Executor, profileId: string): Promise<string | null> {
  if (!isUuid(profileId)) return null
  const [row] = await exec<{ id: string }>(
    `SELECT account_id::text AS id FROM individual_profiles WHERE id = $1`,
    [profileId],
  )
  return row?.id ?? null
}

/** POST /ops/accounts/{profileId}/{lock|unlock|deactivate|reactivate|soft-delete} `{ reason? }`. */
export async function runAccountOperation(
  accountId: string,
  targetProfileId: string,
  operation: AccountOperation,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<AccountStateDTO> {
  const actor = await signed(accountId)
  // Anyone else is refused before the id is even looked at: ids cannot be probed.
  if (!mayExecuteAccountAction(actor)) throw forbidden()
  const { reason } = parseReason(body)
  if (!exec) await refuseOwnAccountAction(accountId, targetProfileId, operation, requestId)
  return inTransaction(exec, async (tx) => {
    await lockActorWith(tx, accountId, await accountOfProfile(tx, targetProfileId))
    const target = await lockTarget(tx, targetProfileId)
    if (target.profile_id === actor.profileId) throw forbidden()
    return execute(tx, { actorAccountId: accountId, target, operation, reason, requestId })
  })
}

/** POST /ops/organizations/{orgId}/members/{profileId}/account-requests `{ action, reason? }` → 201. */
export async function fileAccountRequest(
  accountId: string,
  orgId: string,
  targetProfileId: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<AccountRequestDTO> {
  const actor = await signed(accountId)
  if (!isUuid(orgId) || !mayEscalateAccountAction(actor, orgId)) throw forbidden()
  const { reason, rest } = parseReason(body ?? {}, ['action'])
  if (!(ESCALATABLE as readonly unknown[]).includes(rest.action)) throw invalid('action', 'invalid')
  const action = rest.action as (typeof ESCALATABLE)[number]
  if (!isUuid(targetProfileId)) throw notFound()
  if (targetProfileId.toLowerCase() === actor.profileId) throw invalid('profile_id', 'self')
  return inTransaction(exec, async (tx) => {
    const [org] = await tx<{ id: string }>(
      `SELECT id::text FROM organizations WHERE id = $1 AND type::text = ANY($2::text[])`,
      [orgId, [...OPS_ORGANIZATION_TYPES]],
    )
    if (!org) throw forbidden()
    // Only an ACTIVE member of exactly this unit (PD-7, "members of its unit").
    const [member] = await tx<{ account_id: string }>(
      `SELECT p.account_id::text FROM individual_profiles p
         JOIN community_memberships m ON m.profile_id = p.id
        WHERE p.id = $1 AND m.organization_id = $2 AND m.state = 'ACTIVE' LIMIT 1`,
      [targetProfileId, org.id],
    )
    if (!member) throw notFound()
    const [row] = await tx<{ id: string }>(
      `INSERT INTO account_action_requests (target_account_id, organization_id, requested_by_account_id, action, reason)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id::text`,
      [member.account_id, org.id, accountId, action, reason],
    )
    if (!row) throw conflict('This request is already pending.')
    await writeAdminAudit(tx, {
      actorAccountId: accountId,
      action: 'ACCOUNT_REQUEST_FILED',
      target: { type: 'account_action_request', id: row.id },
      organizationId: org.id,
      after: { status: 'PENDING', action, profile_id: targetProfileId.toLowerCase() },
      requestId,
    })
    return (await requestRows(tx, { id: row.id }))[0]!.dto
  })
}

export type AccountRequestDTO = {
  id: string
  kind: 'ESCALATION' | 'SELF_DELETION'
  action: 'LOCK' | 'DEACTIVATE' | 'SOFT_DELETE'
  status: 'PENDING' | 'PROCESSED' | 'DECLINED'
  target: {
    profile_id: string | null
    display_name: string | null
    account_status: string
    profile_status: string | null
  }
  organization: { id: string; name: string } | null
  requested_by_profile_id: string | null
  reason: string | null
  created_at: string
  handled_at: string | null
  handler_profile_id: string | null
}

type RequestRow = Omit<
  AccountRequestDTO,
  'target' | 'organization' | 'created_at' | 'handled_at'
> & {
  cursor_time: string
  target_profile_id: string | null
  target_account_id: string
  account_status: string
  profile_status: string | null
  org_id: string | null
  org_name: string | null
  created_at: Date
  handled_at: Date | null
}

const REQUESTS = `
  SELECT * FROM (
    SELECT 'ESCALATION' AS kind, r.id::text, r.action::text AS action, r.status::text AS status,
           r.created_at, r.handled_at, r.reason, r.target_account_id::text AS target_account_id,
           tp.id::text AS target_profile_id, ta.status::text AS account_status, tp.status::text AS profile_status,
           o.id::text AS org_id, o.name AS org_name, rp.id::text AS requested_by_profile_id,
           hp.id::text AS handler_profile_id
      FROM account_action_requests r
      JOIN user_accounts ta ON ta.id = r.target_account_id
      LEFT JOIN individual_profiles tp ON tp.account_id = r.target_account_id
      JOIN organizations o ON o.id = r.organization_id
      LEFT JOIN individual_profiles rp ON rp.account_id = r.requested_by_account_id
      LEFT JOIN individual_profiles hp ON hp.account_id = r.handled_by_account_id
    UNION ALL
    SELECT 'SELF_DELETION', d.id::text, 'SOFT_DELETE', d.status::text, d.requested_at, d.handled_at, NULL,
           d.account_id::text, tp.id::text, ta.status::text, tp.status::text, NULL, NULL,
           -- The requester is the user only when they filed it (WF02 audit); an admin-recorded
           -- request has no user requester.
           CASE WHEN EXISTS (SELECT 1 FROM audit_events e
                              WHERE e.action = 'ACCOUNT_DELETION_REQUESTED' AND e.resource_id = d.id)
                THEN tp.id::text END,
           hp.id::text
      FROM account_deletion_requests d
      JOIN user_accounts ta ON ta.id = d.account_id
      LEFT JOIN individual_profiles tp ON tp.account_id = d.account_id
      LEFT JOIN individual_profiles hp ON hp.account_id = d.handled_by_account_id
  ) q`

type RequestEntry = { dto: AccountRequestDTO; cursorTime: string; targetAccountId: string }

async function requestRows(
  exec: Executor,
  filter: {
    id?: string
    status?: string
    kind?: string
    after?: { t: string; i: string } | null
    limit?: number
  },
): Promise<RequestEntry[]> {
  const rows = await exec<RequestRow>(
    `SELECT q.*, ${cursorTime('q.created_at')} AS cursor_time FROM (${REQUESTS}) q
      WHERE ($1::text IS NULL OR q.id = $1)
        AND ($2::text IS NULL OR q.status = $2)
        AND ($3::text IS NULL OR q.kind = $3)
        AND ($4::timestamptz IS NULL OR (q.created_at, q.id::uuid) > ($4::timestamptz, $5::uuid))
      ORDER BY q.created_at, q.id
      LIMIT $6`,
    [
      filter.id ?? null,
      filter.status ?? null,
      filter.kind ?? null,
      filter.after?.t ?? null,
      filter.after?.i ?? null,
      filter.limit ?? 1,
    ],
  )
  const names = await discoveryNames(
    exec,
    rows.map((r) => r.target_profile_id),
  )
  return rows.map((r) => ({
    cursorTime: r.cursor_time,
    targetAccountId: r.target_account_id,
    dto: {
      id: r.id,
      kind: r.kind,
      action: r.action,
      status: r.status,
      target: {
        profile_id: r.target_profile_id,
        display_name: r.target_profile_id ? (names.get(r.target_profile_id) ?? null) : null,
        account_status: r.account_status,
        profile_status: r.profile_status,
      },
      organization: r.org_id ? { id: r.org_id, name: r.org_name! } : null,
      requested_by_profile_id: r.requested_by_profile_id,
      reason: r.reason,
      created_at: iso(r.created_at)!,
      handled_at: iso(r.handled_at),
      handler_profile_id: r.handler_profile_id,
    },
  }))
}

/** GET /ops/account-requests — leader escalations and users' own deletion requests, oldest first. */
export async function listAccountRequests(
  accountId: string,
  params: URLSearchParams,
): Promise<{
  items: AccountRequestDTO[]
  nextCursor: string | null
  limit: number
  counts: { pending: number }
}> {
  const actor = await signed(accountId)
  if (!mayExecuteAccountAction(actor)) throw forbidden()
  checkParams(params, ['status', 'kind', 'cursor', 'limit'])
  const status = params.get('status') ?? 'PENDING'
  if (!(ACCOUNT_REQUEST_STATUSES as readonly string[]).includes(status))
    throw invalid('status', 'invalid')
  const kind = params.get('kind')
  if (kind !== null && kind !== 'ESCALATION' && kind !== 'SELF_DELETION')
    throw invalid('kind', 'invalid')
  const limit = parseLimit(params)
  const after = decodeKeyset(params.get('cursor'))
  const rows = await requestRows(query, {
    status,
    kind: kind ?? undefined,
    after,
    limit: limit + 1,
  })
  const [pending] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM (${REQUESTS}) q WHERE q.status = 'PENDING'`,
  )
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    items: page.map((r) => r.dto),
    nextCursor:
      rows.length > limit && last ? encodeKeyset({ t: last.cursorTime, i: last.dto.id }) : null,
    limit,
    counts: { pending: pending!.n },
  }
}

/** GET /ops/account-requests/{id}. */
export async function getAccountRequest(accountId: string, id: string): Promise<AccountRequestDTO> {
  const actor = await signed(accountId)
  if (!isUuid(id) || !mayExecuteAccountAction(actor)) throw notFound()
  const [row] = await requestRows(query, { id: id.toLowerCase() })
  if (!row) throw notFound()
  return row.dto
}

/**
 * Refuses (403) and audits an admin deciding a request about their own account —
 * processing or declining — before any transaction (the routes call it ahead of
 * the idempotent run).
 */
export async function refuseOwnRequestDecision(
  accountId: string,
  id: string,
  decision: 'PROCESS' | 'DECLINE',
  auditRequestId: string,
): Promise<void> {
  const actor = await signed(accountId)
  if (!isUuid(id) || !mayExecuteAccountAction(actor)) return
  const [entry] = await requestRows(query, { id: id.toLowerCase() })
  if (!entry || entry.targetAccountId !== accountId) return
  const found = entry.dto
  await writeAdminAudit(query, {
    actorAccountId: accountId,
    action: 'ACCOUNT_SELF_ACTION_REFUSED',
    target: { type: 'user_account', id: accountId },
    after: { action: decision === 'PROCESS' ? found.action : 'DECLINE' },
    requestId: auditRequestId,
  })
  throw forbidden()
}

/** POST /ops/account-requests/{id}/process|decline `{ reason? }` — required to decline a deletion. */
export async function decideAccountRequest(
  accountId: string,
  id: string,
  decision: 'PROCESS' | 'DECLINE',
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<AccountRequestDTO> {
  const actor = await signed(accountId)
  if (!isUuid(id) || !mayExecuteAccountAction(actor)) throw notFound()
  const { reason } = parseReason(body)
  if (!exec) await refuseOwnRequestDecision(accountId, id, decision, requestId)
  const [entry] = await requestRows(exec ?? query, { id: id.toLowerCase() })
  if (!entry) throw notFound()
  if (entry.targetAccountId === accountId) throw forbidden()
  const found = entry.dto
  // PO decision (ADMIN-PROD-05-FIX): an account-deletion request — the user's own or a
  // leader's SOFT_DELETE escalation — may be rejected (DECLINED), but only with a reason
  // stating the legal / retention / security / operational obligation that blocks it.
  if (decision === 'DECLINE' && found.action === 'SOFT_DELETE' && !reason)
    throw invalid('reason', 'required')
  return inTransaction(exec, async (tx) => {
    const table =
      found.kind === 'ESCALATION' ? 'account_action_requests' : 'account_deletion_requests'
    // Accounts first (actor and target), then the request — the order every account operation uses.
    await lockActorWith(tx, accountId, entry.targetAccountId)
    const target = found.target.profile_id ? await lockTarget(tx, found.target.profile_id) : null
    const [locked] = await tx<{ status: string }>(
      `SELECT status::text AS status FROM ${table} WHERE id = $1 FOR UPDATE`,
      [found.id],
    )
    if (locked?.status !== 'PENDING') throw conflict('This request is no longer pending.')
    if (decision === 'PROCESS' && !target) {
      // An account without a profile (mid-onboarding) can still have its deletion processed.
      if (found.action !== 'SOFT_DELETE') throw conflict('The account has no profile to act on.')
      await softDeleteAccountOnly(tx, accountId, entry.targetAccountId, reason, requestId)
    } else if (decision === 'PROCESS' && target) {
      await execute(tx, {
        actorAccountId: accountId,
        target,
        operation: found.action,
        reason,
        requestId,
      })
    }
    if (found.kind === 'ESCALATION' || decision === 'DECLINE') {
      await tx(
        `UPDATE ${table} SET status = $2::account_request_status, handled_by_account_id = $3, handled_at = now()
          ${found.kind === 'ESCALATION' ? ', updated_at = now()' : ''}
          WHERE id = $1 AND status = 'PENDING'`,
        [found.id, decision === 'PROCESS' ? 'PROCESSED' : 'DECLINED', accountId],
      )
    }
    await writeAdminAudit(tx, {
      actorAccountId: accountId,
      action: decision === 'PROCESS' ? 'ACCOUNT_REQUEST_PROCESSED' : 'ACCOUNT_REQUEST_DECLINED',
      target: {
        type: found.kind === 'ESCALATION' ? 'account_action_request' : 'account_deletion_request',
        id: found.id,
      },
      organizationId: found.organization?.id ?? null,
      before: { status: 'PENDING' },
      after: { status: decision === 'PROCESS' ? 'PROCESSED' : 'DECLINED', action: found.action },
      reason,
      requestId,
    })
    return (await requestRows(tx, { id: found.id }))[0]!.dto
  })
}
