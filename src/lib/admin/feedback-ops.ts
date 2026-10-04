import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { readAssetMeta, removeAsset } from '@/lib/media/avatar-storage'

import { writeAdminAudit } from './admin-audit'
import {
  canTransitionFeedback,
  FEEDBACK_LIMITS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_SCREENSHOT_RETENTION_DAYS,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  projectFeedbackContext,
  screenshotExpiresAt,
  summaryBucket,
  type FeedbackPriority,
  type FeedbackStatus,
  type FeedbackType,
} from './feedback'
import { isUuid } from './hierarchy'
import { discoveryNames } from './identity'
import { checkParams, cursorTime, decodeKeyset, encodeKeyset, parseDay, parseLimit } from './paging'
import { holdsPlatform } from './scope'

/**
 * ADMIN-PROD-05 — feedback operations (PD-5; ADMIN-PROD-01 feedback contract;
 * Sprint1 FB-01 owns the submission). `feedback:manage`, PLATFORM_ADMIN only:
 * anyone else gets 403 on the lists and 404 on every id.
 *
 *   lifecycle   NEW → IN_REVIEW → DONE; NEW → DONE only with a resolution note
 *               (duplicate / spam); DONE is final (no reopen); the same status
 *               again is no change. Invalid moves 409.
 *   triage      type (BUG, UX, FEATURE, OTHER), priority (LOW, MEDIUM, HIGH or
 *               none), owner (a `feedback:manage` holder, or none), status,
 *               resolution note (≤ 2,000). Row locked; every real change audited
 *               (FEEDBACK_STATUS_CHANGED / _PRIORITY_CHANGED / _ASSIGNED /
 *               _UPDATED) with codes and ids only, never the text.
 *   privacy     the guest e-mail and the content only in the detail; context
 *               reduced to the operator keys; the sender through PROFILE_DISCOVERY.
 *   screenshots kept 90 days from submission: served to managers only (not
 *               even the uploader) and never after that; physically removed
 *               by `runFeedbackScreenshotRetention` — on every queue read
 *               (bounded) and by `scripts/admin/feedback-retention.mjs` for a
 *               daily scheduled run.
 */

const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null)

async function manager(accountId: string): Promise<Actor> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  return actor
}

type Row = {
  id: string
  cursor_time: string
  type: FeedbackType
  status: FeedbackStatus
  priority: FeedbackPriority | null
  body: string
  context: unknown
  screenshot_asset_id: string | null
  screenshot_deleted_at: Date | null
  guest_email: string | null
  resolution_note: string | null
  created_at: Date
  updated_at: Date
  sender_profile_id: string | null
  member: boolean
  owner_profile_id: string | null
}

const SELECT = `
  SELECT f.id::text, ${cursorTime('f.created_at')} AS cursor_time, f.type::text AS type,
         f.status::text AS status, f.priority::text AS priority, f.body, f.context,
         f.screenshot_asset_id, f.screenshot_deleted_at, f.guest_email, f.resolution_note,
         f.created_at, f.updated_at, sp.id::text AS sender_profile_id,
         f.account_id IS NOT NULL AS member, op.id::text AS owner_profile_id
    FROM feedback_submissions f
    LEFT JOIN individual_profiles sp ON sp.account_id = f.account_id
    LEFT JOIN individual_profiles op ON op.account_id = f.assigned_owner_account_id`

type ScreenshotView = {
  asset_id: string | null
  url: string | null
  expires_at: string | null
  deleted_at: string | null
  expired: boolean
}

function screenshotOf(row: Row, now = new Date()): ScreenshotView | null {
  if (!row.screenshot_asset_id && !row.screenshot_deleted_at) return null
  const expiresAt = screenshotExpiresAt(new Date(row.created_at))
  const expired = now.getTime() >= expiresAt.getTime() || row.screenshot_asset_id === null
  return {
    asset_id: expired ? null : row.screenshot_asset_id,
    url: expired ? null : `/media/assets/${row.screenshot_asset_id}`,
    expires_at: expiresAt.toISOString(),
    deleted_at: iso(row.screenshot_deleted_at),
    expired,
  }
}

export type FeedbackSummaryDTO = {
  id: string
  type: FeedbackType
  status: FeedbackStatus
  priority: FeedbackPriority | null
  owner: { profile_id: string; display_name: string | null } | null
  sender: { kind: 'MEMBER' | 'GUEST'; profile_id: string | null; display_name: string | null }
  excerpt: string
  has_screenshot: boolean
  created_at: string
  updated_at: string
}

export type FeedbackDetailDTO = Omit<FeedbackSummaryDTO, 'excerpt' | 'has_screenshot'> & {
  content: string
  sender: FeedbackSummaryDTO['sender'] & { guest_email: string | null }
  context: Record<string, string>
  screenshot: ScreenshotView | null
  resolution_note: string | null
  history: Array<{
    event: string
    at: string
    by_profile_id: string | null
    status: string | null
    priority: string | null
    owner_profile_id: string | null
  }>
}

function summaryOf(row: Row, names: Map<string, string | null>): FeedbackSummaryDTO {
  const shot = screenshotOf(row)
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    priority: row.priority,
    owner: row.owner_profile_id
      ? { profile_id: row.owner_profile_id, display_name: names.get(row.owner_profile_id) ?? null }
      : null,
    sender: row.member
      ? {
          kind: 'MEMBER',
          profile_id: row.sender_profile_id,
          display_name: row.sender_profile_id ? (names.get(row.sender_profile_id) ?? null) : null,
        }
      : { kind: 'GUEST', profile_id: null, display_name: null },
    excerpt: row.body.length > 140 ? `${row.body.slice(0, 139)}…` : row.body,
    has_screenshot: Boolean(shot && !shot.expired),
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
  }
}

const LIST_PARAMS = [
  'status',
  'type',
  'priority',
  'owner',
  'created_from',
  'created_to',
  'cursor',
  'limit',
]

/** GET /ops/feedback — newest first; `counts.open` = NEW + IN_REVIEW. */
export async function listFeedback(
  accountId: string,
  params: URLSearchParams,
): Promise<{
  items: FeedbackSummaryDTO[]
  nextCursor: string | null
  limit: number
  counts: { open: number }
}> {
  const actor = await manager(accountId)
  if (!holdsPlatform(actor, 'feedback:manage')) throw forbidden()
  checkParams(params, LIST_PARAMS)
  const status = params.get('status')
  if (status !== null && !(FEEDBACK_STATUSES as readonly string[]).includes(status))
    throw invalid('status', 'invalid')
  const type = params.get('type')
  if (type !== null && !(FEEDBACK_TYPES as readonly string[]).includes(type))
    throw invalid('type', 'invalid')
  const priority = params.get('priority')
  if (
    priority !== null &&
    priority !== 'NONE' &&
    !(FEEDBACK_PRIORITIES as readonly string[]).includes(priority)
  )
    throw invalid('priority', 'invalid')
  const owner = params.get('owner')
  if (owner !== null && owner !== 'none' && !isUuid(owner)) throw invalid('owner', 'invalid')
  const from = parseDay(params, 'created_from')
  const to = parseDay(params, 'created_to')
  const limit = parseLimit(params)
  const before = decodeKeyset(params.get('cursor'))

  // Bounded, opportunistic retention: nothing past 90 days outlives a queue read.
  await runFeedbackScreenshotRetention(100)

  const rows = await query<Row>(
    `${SELECT}
      WHERE ($1::feedback_status IS NULL OR f.status = $1::feedback_status)
        AND ($2::feedback_type IS NULL OR f.type = $2::feedback_type)
        AND ($3::text IS NULL OR ($3 = 'NONE' AND f.priority IS NULL) OR f.priority::text = $3)
        AND ($4::text IS NULL OR ($4 = 'none' AND f.assigned_owner_account_id IS NULL)
             OR op.id::text = $4)
        AND ($5::date IS NULL OR f.created_at >= ($5::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND ($6::date IS NULL OR f.created_at < ($6::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND ($7::timestamptz IS NULL OR (f.created_at, f.id) < ($7::timestamptz, $8::uuid))
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT $9`,
    [
      status,
      type,
      priority,
      owner?.toLowerCase() ?? null,
      from,
      to,
      before?.t ?? null,
      before?.i ?? null,
      limit + 1,
    ],
  )
  const [open] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM feedback_submissions WHERE status IN ('NEW', 'IN_REVIEW')`,
  )
  const page = rows.slice(0, limit)
  const names = await discoveryNames(
    query,
    page.flatMap((r) => [r.owner_profile_id, r.sender_profile_id]),
  )
  const last = page.at(-1)
  return {
    items: page.map((r) => summaryOf(r, names)),
    nextCursor:
      rows.length > limit && last ? encodeKeyset({ t: last.cursor_time, i: last.id }) : null,
    limit,
    counts: { open: open!.n },
  }
}

const HISTORY = [
  'FEEDBACK_STATUS_CHANGED',
  'FEEDBACK_PRIORITY_CHANGED',
  'FEEDBACK_ASSIGNED',
  'FEEDBACK_UPDATED',
]

async function detailOf(exec: Executor, row: Row): Promise<FeedbackDetailDTO> {
  const names = await discoveryNames(exec, [row.owner_profile_id, row.sender_profile_id])
  const summary = summaryOf(row, names)
  const events = await exec<{
    action: string
    created_at: Date
    actor_profile_id: string | null
    after_data: Record<string, unknown> | null
  }>(
    `SELECT e.action, e.created_at, p.id::text AS actor_profile_id, e.after_data
       FROM audit_events e LEFT JOIN individual_profiles p ON p.account_id = e.actor_account_id
      WHERE e.resource_type = 'feedback_submission' AND e.resource_id = $1 AND e.action = ANY($2::text[])
      ORDER BY e.created_at, e.id`,
    [row.id, HISTORY],
  )
  const text = (v: unknown) => (typeof v === 'string' ? v : null)
  const { excerpt: _excerpt, has_screenshot: _shot, ...rest } = summary
  void _excerpt
  void _shot
  return {
    ...rest,
    content: row.body,
    sender: { ...summary.sender, guest_email: row.member ? null : row.guest_email },
    context: projectFeedbackContext(row.context),
    screenshot: screenshotOf(row),
    resolution_note: row.resolution_note,
    history: events.map((e) => ({
      event: e.action.replace('FEEDBACK_', ''),
      at: iso(e.created_at)!,
      by_profile_id: e.actor_profile_id,
      status: text(e.after_data?.status),
      priority: text(e.after_data?.priority),
      owner_profile_id: text(e.after_data?.owner_profile_id),
    })),
  }
}

async function visible(exec: Executor, actor: Actor, id: string, lock: boolean): Promise<Row> {
  if (!isUuid(id) || !holdsPlatform(actor, 'feedback:manage')) throw notFound()
  const [row] = await exec<Row>(`${SELECT} WHERE f.id = $1 ${lock ? 'FOR UPDATE OF f' : ''}`, [id])
  if (!row) throw notFound()
  return row
}

/** GET /ops/feedback/{id}. */
export async function getFeedback(accountId: string, id: string): Promise<FeedbackDetailDTO> {
  const actor = await manager(accountId)
  return detailOf(query, await visible(query, actor, id, false))
}

type Patch = {
  type?: FeedbackType
  priority?: FeedbackPriority | null
  owner_profile_id?: string | null
  status?: FeedbackStatus
  resolution_note?: string | null
}

function parsePatch(body: unknown): Patch {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  const keys = Object.keys(input)
  const allowed = ['type', 'priority', 'owner_profile_id', 'status', 'resolution_note']
  for (const key of keys) if (!allowed.includes(key)) throw invalid(key, 'not_accepted')
  if (keys.length === 0) throw invalid('body', 'empty')
  const out: Patch = {}
  if ('type' in input) {
    if (!(FEEDBACK_TYPES as readonly unknown[]).includes(input.type))
      throw invalid('type', 'invalid')
    out.type = input.type as FeedbackType
  }
  if ('priority' in input) {
    if (
      input.priority !== null &&
      !(FEEDBACK_PRIORITIES as readonly unknown[]).includes(input.priority)
    )
      throw invalid('priority', 'invalid')
    out.priority = input.priority as FeedbackPriority | null
  }
  if ('owner_profile_id' in input) {
    if (input.owner_profile_id !== null && !isUuid(input.owner_profile_id))
      throw invalid('owner_profile_id', 'invalid')
    out.owner_profile_id = (input.owner_profile_id as string | null)?.toLowerCase() ?? null
  }
  if ('status' in input) {
    if (!(FEEDBACK_STATUSES as readonly unknown[]).includes(input.status))
      throw invalid('status', 'invalid')
    out.status = input.status as FeedbackStatus
  }
  if ('resolution_note' in input) {
    const v = input.resolution_note
    if (v !== null && typeof v !== 'string') throw invalid('resolution_note', 'invalid')
    const note = (v as string | null)?.trim() || null
    if (note && note.length > FEEDBACK_LIMITS.resolutionNote)
      throw invalid('resolution_note', 'too_long')
    out.resolution_note = note
  }
  return out
}

/** An owner must be able to manage feedback: an ACTIVE account holding `feedback:manage`. */
async function ownerAccount(exec: Executor, profileId: string): Promise<string> {
  const [row] = await exec<{ account_id: string }>(
    `SELECT p.account_id::text FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
      WHERE p.id = $1 AND a.status = 'ACTIVE' AND p.status = 'ACTIVE'`,
    [profileId],
  )
  if (!row || !holdsPlatform(await resolveActor(row.account_id), 'feedback:manage'))
    throw invalid('owner_profile_id', 'not_eligible')
  return row.account_id
}

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

/** PATCH /ops/feedback/{id} `{ type?, priority?, owner_profile_id?, status?, resolution_note? }`. */
export async function updateFeedback(
  accountId: string,
  id: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<FeedbackDetailDTO> {
  const actor = await manager(accountId)
  // Non-managers learn nothing, not even a validation detail: the same 404 as an unknown id.
  if (!holdsPlatform(actor, 'feedback:manage')) throw notFound()
  const patch = parsePatch(body)
  return inTransaction(exec, async (tx) => {
    const row = await visible(tx, actor, id, true)
    const owner =
      'owner_profile_id' in patch && patch.owner_profile_id
        ? await ownerAccount(tx, patch.owner_profile_id)
        : null
    const next = {
      type: patch.type ?? row.type,
      priority: 'priority' in patch ? (patch.priority ?? null) : row.priority,
      ownerProfile:
        'owner_profile_id' in patch ? (patch.owner_profile_id ?? null) : row.owner_profile_id,
      status: patch.status ?? row.status,
      note: 'resolution_note' in patch ? (patch.resolution_note ?? null) : row.resolution_note,
    }
    if (next.status !== row.status) {
      if (!canTransitionFeedback(row.status, next.status))
        throw conflict('This status change is not allowed.')
      if (row.status === 'NEW' && next.status === 'DONE' && !next.note)
        throw invalid('resolution_note', 'required')
    }
    const changed = {
      status: next.status !== row.status,
      priority: next.priority !== row.priority,
      owner: next.ownerProfile !== row.owner_profile_id,
      type: next.type !== row.type,
      note: next.note !== row.resolution_note,
    }
    if (!Object.values(changed).some(Boolean)) return detailOf(tx, row)

    await tx(
      `UPDATE feedback_submissions
          SET type = $2::feedback_type, priority = $3::feedback_priority, status = $4::feedback_status,
              resolution_note = $5, updated_at = now(),
              assigned_owner_account_id = CASE WHEN $6 THEN $7::uuid ELSE assigned_owner_account_id END
        WHERE id = $1`,
      [row.id, next.type, next.priority, next.status, next.note, changed.owner, owner],
    )
    const audit = (
      action: Parameters<typeof writeAdminAudit>[1]['action'],
      before: Record<string, string | null | boolean>,
      after: Record<string, string | null | boolean>,
    ) =>
      writeAdminAudit(tx, {
        actorAccountId: accountId,
        action,
        target: { type: 'feedback_submission', id: row.id },
        before,
        after,
        requestId,
      })
    if (changed.status)
      await audit('FEEDBACK_STATUS_CHANGED', { status: row.status }, { status: next.status })
    if (changed.priority)
      await audit(
        'FEEDBACK_PRIORITY_CHANGED',
        { priority: row.priority },
        { priority: next.priority },
      )
    if (changed.owner)
      await audit(
        'FEEDBACK_ASSIGNED',
        { owner_profile_id: row.owner_profile_id },
        { owner_profile_id: next.ownerProfile },
      )
    if (changed.type || changed.note)
      await audit(
        'FEEDBACK_UPDATED',
        { type: row.type },
        { type: next.type, resolution_changed: changed.note },
      )
    return detailOf(tx, await visible(tx, actor, id, false))
  })
}

const TYPE_LABEL: Record<FeedbackType, string> = {
  BUG: 'technical_bug',
  UX: 'ux',
  FEATURE: 'feature_request',
  OTHER: 'other',
}

export type FeedbackWeeklySummary = {
  week: string
  from: string
  to: string
  total: number
  by_type: Array<{ type: FeedbackType; group: string; open: number; closed: number; total: number }>
  by_priority: Array<{ priority: FeedbackPriority | 'NONE'; open: number; closed: number }>
  by_owner: Array<{
    owner_profile_id: string | null
    display_name: string | null
    open: number
    closed: number
  }>
}

const WEEK = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/

/**
 * GET /ops/feedback/summary?week=YYYY-Www — the feedback received in one ISO week
 * (Monday 00:00, Vietnam time), by type × open / closed, by priority, by owner.
 * Read only: no e-mail, Slack or dashboard.
 */
export async function feedbackWeeklySummary(
  accountId: string,
  params: URLSearchParams,
): Promise<FeedbackWeeklySummary> {
  const actor = await manager(accountId)
  if (!holdsPlatform(actor, 'feedback:manage')) throw forbidden()
  checkParams(params, ['week'])
  const week = params.get('week')
  if (week !== null && !WEEK.test(week)) throw invalid('week', 'invalid')
  const [range] = await query<{ week: string; from: string; to: string; ok: boolean }>(
    `WITH w AS (
       SELECT COALESCE($1, to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'IYYY-"W"IW')) AS week)
     SELECT w.week, to_date(w.week, 'IYYY-"W"IW')::text AS "from",
            (to_date(w.week, 'IYYY-"W"IW') + 6)::text AS "to",
            to_char(to_date(w.week, 'IYYY-"W"IW'), 'IYYY-"W"IW') = w.week AS ok
       FROM w`,
    [week],
  )
  if (!range!.ok) throw invalid('week', 'invalid')
  const rows = await query<{
    type: FeedbackType
    priority: FeedbackPriority | null
    status: FeedbackStatus
    owner: string | null
    n: number
  }>(
    `SELECT f.type::text AS type, f.priority::text AS priority, f.status::text AS status,
            op.id::text AS owner, count(*)::int AS n
       FROM feedback_submissions f
       LEFT JOIN individual_profiles op ON op.account_id = f.assigned_owner_account_id
      WHERE f.created_at >= ($1::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
        AND f.created_at < ($1::date + 7)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
      GROUP BY 1, 2, 3, 4`,
    [range!.from],
  )
  const bucket = (status: FeedbackStatus) => summaryBucket(status)
  const byType = FEEDBACK_TYPES.map((type) => {
    const of = rows.filter((r) => r.type === type)
    const open = of.filter((r) => bucket(r.status) === 'open').reduce((s, r) => s + r.n, 0)
    const closed = of.filter((r) => bucket(r.status) === 'closed').reduce((s, r) => s + r.n, 0)
    return { type, group: TYPE_LABEL[type], open, closed, total: open + closed }
  })
  const byPriority = ([...FEEDBACK_PRIORITIES, 'NONE'] as const).map((priority) => {
    const of = rows.filter((r) => (r.priority ?? 'NONE') === priority)
    return {
      priority,
      open: of.filter((r) => bucket(r.status) === 'open').reduce((s, r) => s + r.n, 0),
      closed: of.filter((r) => bucket(r.status) === 'closed').reduce((s, r) => s + r.n, 0),
    }
  })
  const owners = [...new Set(rows.map((r) => r.owner))].sort((a, b) =>
    (a ?? '').localeCompare(b ?? ''),
  )
  const names = await discoveryNames(query, owners)
  return {
    week: range!.week,
    from: range!.from,
    to: range!.to,
    total: rows.reduce((s, r) => s + r.n, 0),
    by_type: byType,
    by_priority: byPriority,
    by_owner: owners.map((owner) => {
      const of = rows.filter((r) => r.owner === owner)
      return {
        owner_profile_id: owner,
        display_name: owner ? (names.get(owner) ?? null) : null,
        open: of.filter((r) => bucket(r.status) === 'open').reduce((s, r) => s + r.n, 0),
        closed: of.filter((r) => bucket(r.status) === 'closed').reduce((s, r) => s + r.n, 0),
      }
    }),
  }
}

/** The one retention statement, shared with `scripts/admin/feedback-retention.mjs`. */
export const SCREENSHOT_RETENTION_SQL = `
  WITH due AS (
    SELECT id, screenshot_asset_id FROM feedback_submissions
     WHERE screenshot_asset_id IS NOT NULL
       AND created_at <= $1::timestamptz - make_interval(days => $2)
     ORDER BY created_at, id
     LIMIT $3
     FOR UPDATE SKIP LOCKED)
  UPDATE feedback_submissions f
     SET screenshot_asset_id = NULL, screenshot_deleted_at = $1::timestamptz, updated_at = now()
    FROM due WHERE f.id = due.id
  RETURNING due.screenshot_asset_id AS asset,
            -- A file still used elsewhere (an avatar, a logo, another feedback) is never removed.
            (EXISTS (SELECT 1 FROM individual_profiles WHERE avatar_asset_id = due.screenshot_asset_id)
             OR EXISTS (SELECT 1 FROM projects WHERE logo_asset_id = due.screenshot_asset_id)
             OR EXISTS (SELECT 1 FROM venture_reviews WHERE proposed->>'logo_asset_id' = due.screenshot_asset_id)
             OR EXISTS (SELECT 1 FROM feedback_submissions o
                         WHERE o.screenshot_asset_id = due.screenshot_asset_id AND o.id <> due.id)) AS shared`

/**
 * PD-5 retention: screenshots of feedback submitted 90 days ago or more lose
 * their reference (`screenshot_deleted_at` set) and their file. Bounded and
 * skip-locked, so concurrent runs never collide. Files are removed inside the
 * transaction, before it commits: a crash can leave a stale reference (cleared
 * by the next run), never an unreferenced file. Returns how many were cleared.
 */
export async function runFeedbackScreenshotRetention(
  limit = 100,
  now: Date = new Date(),
): Promise<number> {
  return withTransaction(async (exec) => {
    const due = await exec<{ asset: string; shared: boolean }>(SCREENSHOT_RETENTION_SQL, [
      now.toISOString(),
      FEEDBACK_SCREENSHOT_RETENTION_DAYS,
      limit,
    ])
    for (const { asset, shared } of due) if (!shared) await removeAsset(asset)
    return due.length
  })
}

/** True when the asset is (or was) a feedback screenshot: only the manager rule may serve it. */
export async function isFeedbackScreenshot(assetId: string): Promise<boolean> {
  const [row] = await query<{ found: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM feedback_submissions WHERE screenshot_asset_id = $1) AS found`,
    [assetId],
  )
  return row?.found === true
}

/** Media route rule: a feedback manager may fetch a screenshot still inside its 90 days. */
export async function managerMayFetchScreenshot(
  accountId: string,
  assetId: string,
): Promise<boolean> {
  if (!holdsPlatform(await resolveActor(accountId), 'feedback:manage')) return false
  const [row] = await query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM feedback_submissions
                     WHERE screenshot_asset_id = $1
                       AND created_at > now() - make_interval(days => $2)) AS ok`,
    [assetId, FEEDBACK_SCREENSHOT_RETENTION_DAYS],
  )
  return row?.ok === true && (await readAssetMeta(assetId)) !== null
}
