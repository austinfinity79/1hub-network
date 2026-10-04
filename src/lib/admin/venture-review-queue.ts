import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { ruleFor } from '@/lib/authz/matrix'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { readAssetMeta } from '@/lib/media/avatar-storage'
import { projectDiscovery } from '@/lib/profile/projection'
import { discoveryLevelsOf } from '@/lib/profile/visibility'

import { writeAdminAudit } from './admin-audit'
import { isUuid } from './hierarchy'
import { notify } from './notifications'
import { holdsPlatform } from './scope'
import { replaceProjectDomains } from './venture-submission'
import {
  changedCoreFields,
  isCursorTime,
  isPublicVenture,
  loadVentureCore,
  normalizeCore,
  parseCoreSnapshot,
  VENTURE_REVIEW_KINDS,
  VENTURE_REVIEW_LIMITS,
  VENTURE_REVIEW_STATUSES,
  type VentureCore,
  type VentureCoreField,
  type VentureReviewKind,
  type VentureReviewStatus,
} from './venture-review'

/**
 * ADMIN-PROD-04 — venture review processing (PD-2, PD-3; ADMIN-PROD-01 §B).
 *
 * Reviewer: `venture:review`, PLATFORM_ADMIN only (C1: ventures belong to no
 * organization; no leader review scope exists). Anyone else: the list is 403,
 * every review id 404. Never the reviewer's own venture: the owner or an
 * ACTIVE team member is refused (403, audited before any transaction).
 *
 * A decision locks the review row, needs PENDING and the version the reviewer
 * saw (an owner edit bumps it, so an older candidate is never approved),
 * re-reads the reviewer's grant FOR SHARE and, on approval, locks the venture
 * and writes the candidate onto the SAME `projects` row (same id; sectors
 * replaced), making a first publication ACTIVE / PUBLIC. Rejection leaves the
 * live row untouched. Status, effects, audit and the owner's notice commit
 * together; the second of two racing decisions gets 409.
 */

type VentureCoreView = VentureCore

export type VentureReviewSummaryDTO = {
  id: string
  kind: VentureReviewKind
  status: VentureReviewStatus
  version: number
  venture: { id: string; type: string; name: string; status: string; visibility: string }
  proposed_name: string
  /** Core fields that would change on the public surface (all set ones for a first publication). */
  changed_fields: VentureCoreField[]
  owner: { profile_id: string; display_name: string | null }
  submitted_at: string
  reviewed_at: string | null
  can_act: boolean
}

type AssetView = { asset_id: string; url: string; content_type: string; byte_size: number } | null

export type VentureReviewDetailDTO = VentureReviewSummaryDTO & {
  owner: { profile_id: string; display_name: string | null; headline?: string }
  /** The approved public version; null before the first publication. */
  public_version: VentureCoreView | null
  proposed: VentureCoreView
  diff: Array<{ field: VentureCoreField; before: unknown; after: unknown }>
  /** Labels of every vocabulary id the two versions reference. */
  vocabulary: Record<string, string>
  logo: { public: AssetView; proposed: AssetView }
  reject_reason: string | null
  reviewer_profile_id: string | null
  history: Array<{
    event: string
    at: string
    by: 'OWNER' | 'TEAM' | 'REVIEWER' | 'SYSTEM'
    status: string | null
    reason: string | null
  }>
  previous_reviews: Array<{
    id: string
    kind: string
    status: string
    submitted_at: string
    reviewed_at: string | null
  }>
}

type ReviewRow = {
  id: string
  cursor_time: string
  kind: VentureReviewKind
  status: VentureReviewStatus
  version: number
  proposed: unknown
  submitted_at: Date
  reviewed_at: Date | null
  reject_reason: string | null
  reviewer_profile_id: string | null
  venture_id: string
  venture_type: string
  venture_name: string
  venture_status: string
  venture_visibility: string
  owner_profile_id: string
  owner_account_id: string
  owner_display_name: string | null
  owner_headline: string | null
}

const SELECT_REVIEW = `
  SELECT r.id::text,
         to_char(r.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time,
         r.kind::text AS kind, r.status::text AS status, r.version, r.proposed,
         r.submitted_at, r.reviewed_at, r.reject_reason, rp.id::text AS reviewer_profile_id,
         p.id::text AS venture_id, p.type::text AS venture_type, p.name AS venture_name,
         p.status::text AS venture_status, p.visibility::text AS venture_visibility,
         o.id::text AS owner_profile_id, o.account_id::text AS owner_account_id,
         o.display_name AS owner_display_name, o.headline AS owner_headline
    FROM venture_reviews r
    JOIN projects p ON p.id = r.venture_id
    JOIN individual_profiles o ON o.id = p.owner_profile_id
    LEFT JOIN individual_profiles rp ON rp.account_id = r.reviewed_by_account_id`

const MAX_LIMIT = 50
const LIST_PARAMS = ['status', 'kind', 'venture_id', 'cursor', 'limit']
const EMPTY: VentureCore = {
  name: '',
  summary: null,
  domain_ids: [],
  stage_id: null,
  region_id: null,
  website: null,
  logo_asset_id: null,
  owner_role_label: null,
}

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null)

async function reviewer(accountId: string): Promise<Actor> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  return actor
}

async function isOwnVenture(exec: Executor, actor: Actor, ventureId: string): Promise<boolean> {
  const [row] = await exec<{ own: boolean }>(
    `SELECT (p.owner_profile_id = $2::uuid OR EXISTS (
               SELECT 1 FROM project_members m
                WHERE m.project_id = p.id AND m.profile_id = $2::uuid AND m.state = 'ACTIVE')) AS own
       FROM projects p WHERE p.id = $1`,
    [ventureId, actor.profileId],
  )
  return row?.own === true
}

async function ownerNames(exec: Executor, rows: ReviewRow[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(rows.map((r) => r.owner_profile_id))]
  const levels = await discoveryLevelsOf(exec, ids)
  return new Map(
    rows.map((r) => [
      r.owner_profile_id,
      projectDiscovery(
        {
          profile_id: r.owner_profile_id,
          display_name: r.owner_display_name,
          avatar_asset_id: null,
          headline: null,
          bio: null,
          domain_ids: [],
          region_id: null,
        },
        levels.get(r.owner_profile_id) ?? 'NETWORK_ONLY',
        'NETWORK',
      )?.display_name ?? null,
    ]),
  )
}

async function summaries(
  exec: Executor,
  actor: Actor,
  rows: ReviewRow[],
): Promise<VentureReviewSummaryDTO[]> {
  if (rows.length === 0) return []
  const names = await ownerNames(exec, rows)
  const ids = [...new Set(rows.map((r) => r.venture_id))]
  // One read for every live version and one for the viewer's own ventures (no N+1).
  const lives = await exec<VentureCore & { id: string; status: string; visibility: string }>(
    `SELECT p.id::text, p.name, p.summary, p.stage_id::text, p.region_id::text, p.website,
            p.logo_asset_id, p.owner_role_label, p.status::text AS status, p.visibility::text AS visibility,
            COALESCE(ARRAY(SELECT d.vocabulary_item_id::text FROM project_domains d
                            WHERE d.project_id = p.id ORDER BY 1), '{}') AS domain_ids
       FROM projects p WHERE p.id = ANY($1::uuid[])`,
    [ids],
  )
  const liveById = new Map(lives.map((l) => [l.id, l]))
  const own = new Set(
    (
      await exec<{ id: string }>(
        `SELECT p.id::text FROM projects p
          WHERE p.id = ANY($1::uuid[])
            AND (p.owner_profile_id = $2::uuid OR EXISTS (
                   SELECT 1 FROM project_members m
                    WHERE m.project_id = p.id AND m.profile_id = $2::uuid AND m.state = 'ACTIVE'))`,
        [ids, actor.profileId],
      )
    ).map((r) => r.id),
  )
  return rows.map((row) => {
    const proposed = parseCoreSnapshot(row.proposed) ?? EMPTY
    const live = liveById.get(row.venture_id)
    const publicVersion = live && isPublicVenture(live) ? normalizeCore(live) : null
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      version: row.version,
      venture: {
        id: row.venture_id,
        type: row.venture_type,
        name: row.venture_name,
        status: row.venture_status,
        visibility: row.venture_visibility,
      },
      proposed_name: proposed.name,
      changed_fields: changedCoreFields(publicVersion ?? EMPTY, proposed),
      owner: {
        profile_id: row.owner_profile_id,
        display_name: names.get(row.owner_profile_id) ?? null,
      },
      submitted_at: iso(row.submitted_at)!,
      reviewed_at: iso(row.reviewed_at),
      can_act: row.status === 'PENDING' && !own.has(row.venture_id),
    }
  })
}

/** GET /ops/venture-reviews — PLATFORM_ADMIN's queue. */
export async function listVentureReviews(
  accountId: string,
  params: URLSearchParams,
): Promise<{
  items: VentureReviewSummaryDTO[]
  nextCursor: string | null
  limit: number
  counts: { pending: number }
}> {
  const actor = await reviewer(accountId)
  if (!holdsPlatform(actor, 'venture:review')) throw forbidden()
  for (const key of new Set(params.keys())) {
    if (!LIST_PARAMS.includes(key)) throw invalid(key, 'not_accepted')
    if (params.getAll(key).length > 1) throw invalid(key, 'duplicate')
  }
  const status = params.get('status') ?? 'PENDING'
  if (!(VENTURE_REVIEW_STATUSES as readonly string[]).includes(status))
    throw invalid('status', 'invalid')
  const kind = params.get('kind')
  if (kind !== null && !(VENTURE_REVIEW_KINDS as readonly string[]).includes(kind))
    throw invalid('kind', 'invalid')
  const ventureId = params.get('venture_id')
  if (ventureId !== null && !isUuid(ventureId)) throw invalid('venture_id', 'invalid')
  const rawLimit = params.get('limit')
  const limit = rawLimit === null ? 20 : Number(rawLimit)
  if (!/^\d{1,2}$/.test(rawLimit ?? '20') || limit < 1 || limit > MAX_LIMIT)
    throw invalid('limit', 'invalid')
  let after: { t: string; i: string } | null = null
  const rawCursor = params.get('cursor')
  if (rawCursor !== null) {
    try {
      const value = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as {
        t?: unknown
        i?: unknown
      }
      if (isCursorTime(value.t) && isUuid(value.i)) after = { t: value.t, i: value.i }
    } catch {
      // refused below
    }
    if (!after) throw invalid('cursor', 'invalid')
  }

  const rows = await query<ReviewRow>(
    `${SELECT_REVIEW}
      WHERE r.status = $1::venture_review_status
        AND ($2::venture_review_kind IS NULL OR r.kind = $2::venture_review_kind)
        AND ($3::uuid IS NULL OR r.venture_id = $3::uuid)
        AND ($5::timestamptz IS NULL OR (r.submitted_at, r.id) > ($5::timestamptz, $6::uuid))
      ORDER BY r.submitted_at, r.id
      LIMIT $4`,
    [status, kind, ventureId, limit + 1, after?.t ?? null, after?.i ?? null],
  )
  const [pending] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM venture_reviews WHERE status = 'PENDING'`,
  )
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    items: await summaries(query, actor, page),
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(JSON.stringify({ t: last.cursor_time, i: last.id })).toString('base64url')
        : null,
    limit,
    counts: { pending: pending!.n },
  }
}

/** The review if the actor may see it (reviewers only); anything else → 404. */
async function visibleReview(
  exec: Executor,
  actor: Actor,
  reviewId: string,
  lock: boolean,
): Promise<ReviewRow> {
  if (!isUuid(reviewId) || !holdsPlatform(actor, 'venture:review')) throw notFound()
  const [row] = await exec<ReviewRow>(
    `${SELECT_REVIEW} WHERE r.id = $1 ${lock ? 'FOR UPDATE OF r' : ''}`,
    [reviewId],
  )
  if (!row) throw notFound()
  return row
}

async function assetView(id: string | null): Promise<AssetView> {
  if (!id) return null
  const meta = await readAssetMeta(id)
  return meta
    ? {
        asset_id: id,
        url: `/media/assets/${id}`,
        content_type: meta.content_type,
        byte_size: meta.byte_size,
      }
    : null
}

const HISTORY_EVENT: Record<string, string> = {
  VENTURE_REVIEW_SUBMITTED: 'SUBMITTED',
  VENTURE_REVIEW_RESUBMITTED: 'RESUBMITTED',
  VENTURE_REVIEW_UPDATED: 'UPDATED',
  VENTURE_REVIEW_WITHDRAWN: 'WITHDRAWN',
  VENTURE_REVIEW_APPROVED: 'APPROVED',
  VENTURE_REVIEW_REJECTED: 'REJECTED',
}

async function detail(
  exec: Executor,
  actor: Actor,
  row: ReviewRow,
): Promise<VentureReviewDetailDTO> {
  const [summary] = await summaries(exec, actor, [row])
  const proposed = parseCoreSnapshot(row.proposed) ?? EMPTY
  const live = await loadVentureCore(exec, row.venture_id)
  const publicVersion: VentureCore | null =
    live && isPublicVenture(live)
      ? {
          name: live.name,
          summary: live.summary,
          domain_ids: live.domain_ids,
          stage_id: live.stage_id,
          region_id: live.region_id,
          website: live.website,
          logo_asset_id: live.logo_asset_id,
          owner_role_label: live.owner_role_label,
        }
      : null
  const before = publicVersion ?? EMPTY
  const diff = changedCoreFields(before, proposed).map((field) => ({
    field,
    before: publicVersion ? before[field] : null,
    after: proposed[field],
  }))
  const ids = [
    ...new Set(
      [before, proposed]
        .flatMap((c) => [...c.domain_ids, c.stage_id, c.region_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const labels = await exec<{ id: string; label: string }>(
    `SELECT id::text, label FROM vocabulary_items WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  const levels = await discoveryLevelsOf(exec, [row.owner_profile_id])
  const projected = projectDiscovery(
    {
      profile_id: row.owner_profile_id,
      display_name: row.owner_display_name,
      avatar_asset_id: null,
      headline: row.owner_headline,
      bio: null,
      domain_ids: [],
      region_id: null,
    },
    levels.get(row.owner_profile_id) ?? 'NETWORK_ONLY',
    'NETWORK',
  )
  const owner: VentureReviewDetailDTO['owner'] = {
    profile_id: row.owner_profile_id,
    display_name: projected?.display_name ?? null,
  }
  if (projected?.headline) owner.headline = projected.headline
  const events = await exec<{
    action: string
    actor: string | null
    created_at: Date
    after_data: Record<string, unknown> | null
  }>(
    `SELECT action, actor_account_id::text AS actor, created_at, after_data FROM audit_events
      WHERE resource_type = 'venture_review' AND resource_id = $1 AND action = ANY($2::text[])
      ORDER BY created_at, id`,
    [row.id, Object.keys(HISTORY_EVENT)],
  )
  const previous = await exec<{
    id: string
    kind: string
    status: string
    submitted_at: Date
    reviewed_at: Date | null
  }>(
    `SELECT id::text, kind::text AS kind, status::text AS status, submitted_at, reviewed_at
       FROM venture_reviews WHERE venture_id = $1 AND id <> $2 ORDER BY submitted_at DESC, id`,
    [row.venture_id, row.id],
  )
  return {
    ...summary!,
    owner,
    public_version: publicVersion,
    proposed,
    diff,
    vocabulary: Object.fromEntries(labels.map((l) => [l.id, l.label])),
    logo: {
      public: await assetView(publicVersion?.logo_asset_id ?? null),
      proposed: await assetView(proposed.logo_asset_id),
    },
    reject_reason: row.reject_reason,
    reviewer_profile_id: row.reviewer_profile_id,
    history: events.map((e) => {
      const event = HISTORY_EVENT[e.action]!
      const after = e.after_data ?? {}
      return {
        event,
        at: iso(e.created_at)!,
        by:
          e.actor === null
            ? 'SYSTEM'
            : event === 'APPROVED' || event === 'REJECTED'
              ? 'REVIEWER'
              : e.actor === row.owner_account_id
                ? 'OWNER'
                : 'TEAM',
        status: typeof after.status === 'string' ? after.status : null,
        reason: event === 'REJECTED' && typeof after.reason === 'string' ? after.reason : null,
      }
    }),
    previous_reviews: previous.map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      submitted_at: iso(p.submitted_at)!,
      reviewed_at: iso(p.reviewed_at),
    })),
  }
}

/**
 * Serving rule for the media route: a venture reviewer may fetch an asset that is
 * a venture's logo or the proposed logo of a review — and nothing else (avatars
 * keep their own rule). Others are unaffected.
 */
export async function reviewerMayFetchLogo(accountId: string, assetId: string): Promise<boolean> {
  const actor = await resolveActor(accountId)
  if (!holdsPlatform(actor, 'venture:review')) return false
  const [row] = await query<{ referenced: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM projects WHERE logo_asset_id = $1)
         OR EXISTS (SELECT 1 FROM venture_reviews WHERE proposed->>'logo_asset_id' = $1) AS referenced`,
    [assetId],
  )
  return row?.referenced === true
}

/** GET /ops/venture-reviews/{id}. */
export async function getVentureReview(
  accountId: string,
  reviewId: string,
): Promise<VentureReviewDetailDTO> {
  const actor = await reviewer(accountId)
  return detail(query, actor, await visibleReview(query, actor, reviewId, false))
}

export type ReviewDecision = 'APPROVE' | 'REJECT'

/** Refuses (403) and audits a reviewer deciding their own venture, before any transaction. */
export async function refuseOwnVentureReview(
  accountId: string,
  reviewId: string,
  decision: ReviewDecision,
  auditRequestId: string,
): Promise<void> {
  const actor = await reviewer(accountId)
  let row: ReviewRow
  try {
    row = await visibleReview(query, actor, reviewId, false)
  } catch {
    return
  }
  if (!(await isOwnVenture(query, actor, row.venture_id))) return
  await writeAdminAudit(query, {
    actorAccountId: accountId,
    action: 'VENTURE_REVIEW_SELF_ACTION_REFUSED',
    target: { type: 'venture_review', id: row.id },
    after: { status: row.status, action: decision, venture_id: row.venture_id },
    requestId: auditRequestId,
  })
  throw forbidden()
}

function parseDecision(
  body: unknown,
  allowReason: boolean,
): { version: number; reason: string | null } {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (!(allowReason ? ['version', 'reason'] : ['version']).includes(key))
      throw invalid(key, 'not_accepted')
  }
  if (!Number.isInteger(input.version) || (input.version as number) < 1)
    throw invalid('version', 'invalid')
  let reason: string | null = null
  if (allowReason && input.reason !== undefined && input.reason !== null) {
    if (typeof input.reason !== 'string') throw invalid('reason', 'invalid')
    reason = input.reason.trim() || null
    if (reason && reason.length > VENTURE_REVIEW_LIMITS.rejectReason)
      throw invalid('reason', 'too_long')
  }
  return { version: input.version as number, reason }
}

async function reviewerStillHolds(exec: Executor, profileId: string): Promise<boolean> {
  const rule = ruleFor('venture:review')!
  const rows = await exec<{ id: string }>(
    `SELECT id::text FROM role_assignments
      WHERE individual_profile_id = $1 AND scope_type = 'PLATFORM' AND capability IS NULL
        AND role_code = ANY($2::text[]) AND state = 'ACTIVE'
        AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
      FOR SHARE`,
    [profileId, rule.platformRoles],
  )
  return rows.length > 0
}

async function decidable(
  exec: Executor,
  actor: Actor,
  reviewId: string,
  version: number,
): Promise<ReviewRow> {
  // Lock order venture → review, the same as every owner-side save, so an
  // edit racing a decision serializes instead of deadlocking.
  const { venture_id: ventureId } = await visibleReview(exec, actor, reviewId, false)
  await exec(`SELECT 1 FROM projects WHERE id = $1 FOR UPDATE`, [ventureId])
  const row = await visibleReview(exec, actor, reviewId, true)
  if (await isOwnVenture(exec, actor, row.venture_id)) throw forbidden()
  if (row.status !== 'PENDING') throw conflict('This review is no longer pending.')
  if (row.version !== version) throw conflict('The candidate changed; reload it.')
  if (!(await reviewerStillHolds(exec, actor.profileId!))) throw forbidden()
  return row
}

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

/** POST /ops/venture-reviews/{id}/approve `{ version }`. */
export async function approveVentureReview(
  accountId: string,
  reviewId: string,
  body: unknown,
  auditRequestId: string,
  exec?: Executor,
): Promise<VentureReviewDetailDTO> {
  const actor = await reviewer(accountId)
  const { version } = parseDecision(body, false)
  if (!exec) await refuseOwnVentureReview(accountId, reviewId, 'APPROVE', auditRequestId)
  await inTransaction(exec, async (tx) => {
    const row = await decidable(tx, actor, reviewId, version)
    const [venture] = await tx<{ status: string; visibility: string }>(
      `SELECT status::text AS status, visibility::text AS visibility FROM projects WHERE id = $1`,
      [row.venture_id],
    )
    if (venture!.status === 'ARCHIVED') throw conflict('This venture is archived.')
    const candidate = parseCoreSnapshot(row.proposed)
    if (!candidate) throw conflict('The candidate is unreadable.')
    if (candidate.logo_asset_id && !(await readAssetMeta(candidate.logo_asset_id)))
      throw conflict('The proposed logo is no longer stored.')
    const publish = row.kind === 'FIRST_PUBLISH'
    await tx(
      `UPDATE projects SET name = $2, summary = $3, stage_id = $4, region_id = $5, website = $6,
              logo_asset_id = $7, owner_role_label = $8,
              status = CASE WHEN $9 AND status = 'DRAFT' THEN 'ACTIVE'::project_status ELSE status END,
              visibility = CASE WHEN $9 THEN 'PUBLIC'::visibility_level ELSE visibility END,
              updated_at = now()
        WHERE id = $1`,
      [
        row.venture_id,
        candidate.name,
        candidate.summary,
        candidate.stage_id,
        candidate.region_id,
        candidate.website,
        candidate.logo_asset_id,
        candidate.owner_role_label,
        publish,
      ],
    )
    await replaceProjectDomains(tx, row.venture_id, candidate.domain_ids)
    await tx(
      `UPDATE venture_reviews SET status = 'APPROVED', reviewed_by_account_id = $2, reviewed_at = now(),
              version = version + 1, updated_at = now()
        WHERE id = $1`,
      [row.id, accountId],
    )
    await writeAdminAudit(tx, {
      actorAccountId: accountId,
      action: 'VENTURE_REVIEW_APPROVED',
      target: { type: 'venture_review', id: row.id },
      before: { status: 'PENDING', version, visibility: venture!.visibility },
      after: {
        status: 'APPROVED',
        version: version + 1,
        kind: row.kind,
        venture_id: row.venture_id,
        visibility: publish ? 'PUBLIC' : venture!.visibility,
      },
      requestId: auditRequestId,
    })
    if (publish && venture!.visibility !== 'PUBLIC') {
      // The venture's own trail keeps its publication, as the self-publish did.
      await writeAudit(tx, {
        actorAccountId: accountId,
        action: 'VENTURE_PUBLISHED',
        resourceType: 'project',
        resourceId: row.venture_id,
        before: { status: venture!.status, visibility: venture!.visibility },
        after: {
          status: venture!.status === 'DRAFT' ? 'ACTIVE' : venture!.status,
          visibility: 'PUBLIC',
        },
        requestId: auditRequestId,
      })
    }
    await notify(tx, {
      recipientAccountId: row.owner_account_id,
      type: 'VENTURE_REVIEW_APPROVED',
      resourceId: row.id,
    })
  })
  const reader = exec ?? query
  return detail(reader, actor, await visibleReview(reader, actor, reviewId, false))
}

/** POST /ops/venture-reviews/{id}/reject `{ version, reason? }`. */
export async function rejectVentureReview(
  accountId: string,
  reviewId: string,
  body: unknown,
  auditRequestId: string,
  exec?: Executor,
): Promise<VentureReviewDetailDTO> {
  const actor = await reviewer(accountId)
  const { version, reason } = parseDecision(body, true)
  if (!exec) await refuseOwnVentureReview(accountId, reviewId, 'REJECT', auditRequestId)
  await inTransaction(exec, async (tx) => {
    const row = await decidable(tx, actor, reviewId, version)
    await tx(
      `UPDATE venture_reviews SET status = 'REJECTED', reviewed_by_account_id = $2, reviewed_at = now(),
              reject_reason = $3, version = version + 1, updated_at = now()
        WHERE id = $1`,
      [row.id, accountId, reason],
    )
    await writeAdminAudit(tx, {
      actorAccountId: accountId,
      action: 'VENTURE_REVIEW_REJECTED',
      target: { type: 'venture_review', id: row.id },
      before: { status: 'PENDING', version },
      after: {
        status: 'REJECTED',
        version: version + 1,
        kind: row.kind,
        venture_id: row.venture_id,
      },
      reason,
      requestId: auditRequestId,
    })
    await notify(tx, {
      recipientAccountId: row.owner_account_id,
      type: 'VENTURE_REVIEW_REJECTED',
      resourceId: row.id,
    })
  })
  const reader = exec ?? query
  return detail(reader, actor, await visibleReview(reader, actor, reviewId, false))
}
