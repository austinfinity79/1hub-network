import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import type { Executor } from '@/lib/db/client'
import { AVATAR_TYPES, avatarMaxBytes, readAsset } from '@/lib/media/avatar-storage'
import { PUBLISH_REQUIRED, VENTURE_LIMITS } from '@/lib/venture/venture'
import { assertSelectable } from '@/lib/vocabulary/vocabulary'

import { writeAdminAudit } from './admin-audit'
import { isUuid } from './hierarchy'
import {
  changedCoreFields,
  coreSnapshot,
  isLogoReference,
  isPublicVenture,
  loadVentureCore,
  parseCoreSnapshot,
  parseWebsite,
  reviewRequired,
  type VentureCore,
  type VentureReviewKind,
} from './venture-review'

/**
 * ADMIN-PROD-04 — the owner-side writers of the one venture review model
 * (PD-2, PD-3), shared with Sprint1 S1-UAT-06: the "Gửi duyệt" submission and
 * every save of core fields go through here; ADMIN-PROD-04 processes the same
 * `venture_reviews` rows. `projects` is always the approved / live version.
 *
 *   submit   owner only; a complete, not-yet-public venture → FIRST_PUBLISH
 *            review (PENDING) with the current values as the candidate.
 *   save     owner or EDIT member; core fields only (website and logo
 *            included; `owner_role_label` the owner's):
 *              pending review  → the candidate is updated, `version + 1`
 *                                (the reviewer always decides the latest one;
 *                                an older snapshot can never be approved); a
 *                                not-yet-public venture's private draft row
 *                                follows too, so a rejection loses no edit
 *              PUBLIC, changed → a CORE_CHANGE review; the live version stays
 *              otherwise       → written to the private row (APPLIED)
 *   never    a second review row while one is pending (unique index), a new
 *            venture, a business registration / tax code field.
 */

export const CORE_INPUT_KEYS = [
  'name',
  'summary',
  'domain_ids',
  'stage_id',
  'region_id',
  'website',
  'logo_asset_id',
  'owner_role_label',
] as const

type CoreChanges = Partial<VentureCore>

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })
const conflict = (message: string) => new ApiError('MEMBERSHIP_INVALID_TRANSITION', 409, message)
const readOnly = () =>
  new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')

/** Shape checks for a core save; nothing else is accepted (no tax code, no status, no type). */
export function parseCoreChanges(body: unknown): CoreChanges {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (!(CORE_INPUT_KEYS as readonly string[]).includes(key)) throw invalid(key, 'not_accepted')
  }
  const out: CoreChanges = {}
  const text = (key: string, max: number, required: boolean) => {
    const value = input[key]
    if (value !== null && typeof value !== 'string') throw invalid(key, 'invalid')
    const trimmed = (value as string | null)?.trim() || null
    if (!trimmed && required) throw invalid(key, 'required')
    if (trimmed && trimmed.length > max) throw invalid(key, 'too_long')
    return trimmed
  }
  const id = (key: string) => {
    const value = input[key]
    if (value === null) return null
    if (!isUuid(value)) throw invalid(key, 'invalid')
    return value.toLowerCase()
  }
  if ('name' in input) out.name = text('name', VENTURE_LIMITS.name, true)!
  if ('summary' in input) out.summary = text('summary', VENTURE_LIMITS.summary, false)
  if ('owner_role_label' in input)
    out.owner_role_label = text('owner_role_label', VENTURE_LIMITS.roleLabel, false)
  if ('stage_id' in input) out.stage_id = id('stage_id')
  if ('region_id' in input) out.region_id = id('region_id')
  if ('domain_ids' in input) {
    const value = input.domain_ids
    if (!Array.isArray(value) || !value.every((v) => isUuid(v)))
      throw invalid('domain_ids', 'invalid')
    const ids = [...new Set((value as string[]).map((v) => v.toLowerCase()))]
    if (ids.length > VENTURE_LIMITS.domains) throw invalid('domain_ids', 'too_many')
    out.domain_ids = ids
  }
  if ('website' in input) {
    const parsed = parseWebsite(input.website)
    if (!parsed.ok) throw invalid('website', 'invalid')
    out.website = parsed.value
  }
  if ('logo_asset_id' in input) {
    const value = input.logo_asset_id
    if (value !== null && !isLogoReference(value)) throw invalid('logo_asset_id', 'invalid')
    out.logo_asset_id = value as string | null
  }
  return out
}

/**
 * A logo is an existing asset of the media store (as avatars): uploaded by the
 * editor or the owner, an image type the store accepts (PNG, JPEG, WebP), within
 * its size limit, and present on disk. No URL, no second media store.
 */
export async function isAcceptableLogo(
  exec: Executor,
  assetId: string,
  uploaderAccountIds: readonly string[],
): Promise<boolean> {
  // Never a profile's current avatar: the avatar flow deletes a replaced avatar,
  // which would take a logo with it. Logos come from their own upload (S1-UAT-06).
  const [avatar] = await exec<{ id: string }>(
    `SELECT id::text FROM individual_profiles WHERE avatar_asset_id = $1 LIMIT 1`,
    [assetId],
  )
  if (avatar) return false
  const asset = await readAsset(assetId)
  if (!asset) return false
  return (
    uploaderAccountIds.includes(asset.meta.owner_account_id) &&
    Object.hasOwn(AVATAR_TYPES, asset.meta.content_type) &&
    asset.meta.byte_size <= avatarMaxBytes() &&
    asset.bytes.byteLength === asset.meta.byte_size
  )
}

type VentureAccess = {
  id: string
  status: string
  visibility: string
  owner: boolean
  permission: 'OWNER' | 'EDIT' | 'VIEW'
  owner_account_id: string
}

async function lockVenture(
  exec: Executor,
  accountId: string,
  ventureId: string,
): Promise<{ profileId: string; venture: VentureAccess }> {
  const [profile] = await exec<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  if (!profile) throw unauthenticated()
  if (!isUuid(ventureId)) throw notFound()
  const [row] = await exec<VentureAccess & { member_permission: 'EDIT' | 'VIEW' | null }>(
    `SELECT p.id::text, p.status::text AS status, p.visibility::text AS visibility,
            p.owner_profile_id = $1::uuid AS owner, m.permission AS member_permission,
            op.account_id::text AS owner_account_id
       FROM projects p
       JOIN individual_profiles op ON op.id = p.owner_profile_id
       LEFT JOIN project_members m
         ON m.project_id = p.id AND m.profile_id = $1::uuid AND m.state = 'ACTIVE'
      WHERE p.id = $2 FOR UPDATE OF p`,
    [profile.id, ventureId],
  )
  // Anyone unrelated gets the same 404 as an unknown id.
  if (!row || (!row.owner && !row.member_permission)) throw notFound()
  return {
    profileId: profile.id,
    venture: { ...row, permission: row.owner ? 'OWNER' : row.member_permission! },
  }
}

async function pendingReview(exec: Executor, ventureId: string) {
  const [row] = await exec<{
    id: string
    kind: VentureReviewKind
    version: number
    proposed: unknown
  }>(
    `SELECT id::text, kind::text AS kind, version, proposed FROM venture_reviews
      WHERE venture_id = $1 AND status = 'PENDING' FOR UPDATE`,
    [ventureId],
  )
  return row ?? null
}

async function latestWasRejected(exec: Executor, ventureId: string): Promise<boolean> {
  const [row] = await exec<{ status: string }>(
    `SELECT status::text AS status FROM venture_reviews WHERE venture_id = $1
      ORDER BY submitted_at DESC, id DESC LIMIT 1`,
    [ventureId],
  )
  return row?.status === 'REJECTED'
}

export type SubmittedReview = {
  id: string
  kind: VentureReviewKind
  status: 'PENDING'
  version: number
}

async function openReview(
  exec: Executor,
  input: {
    accountId: string
    ventureId: string
    kind: VentureReviewKind
    core: VentureCore
    requestId: string
  },
): Promise<SubmittedReview> {
  const resubmission = await latestWasRejected(exec, input.ventureId)
  const [row] = await exec<{ id: string; version: number }>(
    `INSERT INTO venture_reviews (venture_id, kind, proposed, submitted_by_account_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING
     RETURNING id::text, version`,
    [input.ventureId, input.kind, JSON.stringify(coreSnapshot(input.core)), input.accountId],
  )
  if (!row) throw conflict('This venture is already under review.')
  await writeAdminAudit(exec, {
    actorAccountId: input.accountId,
    action: resubmission ? 'VENTURE_REVIEW_RESUBMITTED' : 'VENTURE_REVIEW_SUBMITTED',
    target: { type: 'venture_review', id: row.id },
    after: {
      status: 'PENDING',
      kind: input.kind,
      venture_id: input.ventureId,
      version: row.version,
    },
    requestId: input.requestId,
  })
  return { id: row.id, kind: input.kind, status: 'PENDING', version: row.version }
}

/** "Gửi duyệt": the owner submits a complete, not-yet-public venture for its first publication. */
export async function submitVentureForReview(
  exec: Executor,
  input: { accountId: string; ventureId: string; requestId: string },
): Promise<SubmittedReview> {
  const { venture } = await lockVenture(exec, input.accountId, input.ventureId)
  if (!venture.owner) {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner submits this venture.')
  }
  if (venture.status === 'ARCHIVED') throw readOnly()
  if (isPublicVenture(venture)) throw conflict('This venture is already public.')
  if (await pendingReview(exec, venture.id)) throw conflict('This venture is already under review.')
  const core = (await loadVentureCore(exec, venture.id))!
  const present: Record<(typeof PUBLISH_REQUIRED)[number], boolean> = {
    name: Boolean(core.name),
    domain_ids: core.domain_ids.length > 0,
    summary: Boolean(core.summary),
    stage_id: Boolean(core.stage_id),
    owner_role_label: Boolean(core.owner_role_label),
  }
  const missing = PUBLISH_REQUIRED.filter((field) => !present[field])
  if (missing.length > 0) {
    throw new ApiError(
      'PROFILE_VALIDATION_FAILED',
      422,
      'This venture is not complete enough to be public.',
      Object.fromEntries(missing.map((field) => [field, 'required'])),
    )
  }
  return openReview(exec, { ...input, ventureId: venture.id, kind: 'FIRST_PUBLISH', core })
}

export type CoreSaveResult =
  | { mode: 'APPLIED'; fields: string[] }
  | { mode: 'UNCHANGED' }
  | { mode: 'REVIEW_CREATED'; review: SubmittedReview; fields: string[] }
  | { mode: 'REVIEW_UPDATED'; review: { id: string; version: number }; fields: string[] }

/** Every save of core fields, in the caller's transaction. */
export async function saveVentureCore(
  exec: Executor,
  input: { accountId: string; ventureId: string; body: unknown; requestId: string },
): Promise<CoreSaveResult> {
  const changes = parseCoreChanges(input.body)
  const { venture } = await lockVenture(exec, input.accountId, input.ventureId)
  if (venture.permission === 'VIEW') {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'This venture is read-only for you.')
  }
  if ('owner_role_label' in changes && !venture.owner) {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner states the owner role.')
  }
  if (venture.status === 'ARCHIVED') throw readOnly()

  const live = (await loadVentureCore(exec, venture.id))!
  const pending = await pendingReview(exec, venture.id)
  const base = pending ? parseCoreSnapshot(pending.proposed) : live
  if (!base) throw conflict('The pending review is unreadable; withdraw it first.')
  const candidate: VentureCore = { ...base, ...changes }

  // What is already held stays selectable and required values cannot be cleared.
  if (changes.summary === null && base.summary) throw invalid('summary', 'required')
  if (changes.stage_id === null && base.stage_id) throw invalid('stage_id', 'required')
  if (changes.domain_ids?.length === 0 && base.domain_ids.length > 0)
    throw invalid('domain_ids', 'required')
  if ((pending || isPublicVenture(venture)) && !candidate.owner_role_label)
    throw invalid('owner_role_label', 'required')
  if (changes.stage_id)
    await assertSelectable(
      exec,
      'stage_id',
      'VENTURE_STAGE',
      [changes.stage_id],
      new Set([base.stage_id ?? '']),
    )
  if (changes.region_id)
    await assertSelectable(
      exec,
      'region_id',
      'REGION',
      [changes.region_id],
      new Set([base.region_id ?? '']),
    )
  if (changes.domain_ids)
    await assertSelectable(
      exec,
      'domain_ids',
      'DOMAIN',
      changes.domain_ids,
      new Set(base.domain_ids),
    )
  if (
    changes.logo_asset_id &&
    changes.logo_asset_id !== base.logo_asset_id &&
    !(await isAcceptableLogo(exec, changes.logo_asset_id, [
      input.accountId,
      venture.owner_account_id,
    ]))
  ) {
    throw invalid('logo_asset_id', 'invalid')
  }

  const fields = changedCoreFields(base, candidate)
  if (fields.length === 0) return { mode: 'UNCHANGED' }

  if (pending) {
    const [updated] = await exec<{ version: number }>(
      `UPDATE venture_reviews SET proposed = $2, version = version + 1, updated_at = now()
        WHERE id = $1 RETURNING version`,
      [pending.id, JSON.stringify(coreSnapshot(candidate))],
    )
    await writeAdminAudit(exec, {
      actorAccountId: input.accountId,
      action: 'VENTURE_REVIEW_UPDATED',
      target: { type: 'venture_review', id: pending.id },
      after: {
        status: 'PENDING',
        kind: pending.kind,
        venture_id: venture.id,
        version: updated!.version,
        changed_count: fields.length,
      },
      requestId: input.requestId,
    })
    // A first publication's draft is private: it keeps the latest values, so a
    // rejection and a resubmission lose nothing. A public row never changes here.
    if (!isPublicVenture(venture)) await writeDraft(exec, venture.id, candidate, fields)
    return { mode: 'REVIEW_UPDATED', review: { id: pending.id, version: updated!.version }, fields }
  }

  if (isPublicVenture(venture)) {
    if (!reviewRequired(venture, live, candidate).required) return { mode: 'UNCHANGED' }
    const review = await openReview(exec, {
      accountId: input.accountId,
      ventureId: venture.id,
      kind: 'CORE_CHANGE',
      core: candidate,
      requestId: input.requestId,
    })
    return { mode: 'REVIEW_CREATED', review, fields }
  }

  // Not public, nothing pending: the private row is the draft.
  await writeDraft(exec, venture.id, candidate, fields)
  await writeAudit(exec, {
    actorAccountId: input.accountId,
    action: 'VENTURE_UPDATED',
    resourceType: 'project',
    resourceId: venture.id,
    before: { status: venture.status },
    after: { status: venture.status, fields: fields.slice().sort() },
    requestId: input.requestId,
  })
  return { mode: 'APPLIED', fields }
}

/** Writes core values onto a NOT-public venture's own row (its private draft). */
async function writeDraft(
  exec: Executor,
  ventureId: string,
  core: VentureCore,
  fields: readonly string[],
): Promise<void> {
  await exec(
    `UPDATE projects SET name = $2, summary = $3, stage_id = $4, region_id = $5, website = $6,
            logo_asset_id = $7, owner_role_label = $8, updated_at = now()
      WHERE id = $1 AND NOT (status = 'ACTIVE' AND visibility = 'PUBLIC')`,
    [
      ventureId,
      core.name,
      core.summary,
      core.stage_id,
      core.region_id,
      core.website,
      core.logo_asset_id,
      core.owner_role_label,
    ],
  )
  if (fields.includes('domain_ids')) await replaceProjectDomains(exec, ventureId, core.domain_ids)
}

/** Sets a venture's sectors to exactly `ids`. */
export async function replaceProjectDomains(
  exec: Executor,
  ventureId: string,
  ids: readonly string[],
) {
  await exec(
    'DELETE FROM project_domains WHERE project_id = $1 AND NOT (vocabulary_item_id = ANY($2::uuid[]))',
    [ventureId, ids],
  )
  await exec(
    `INSERT INTO project_domains (project_id, vocabulary_item_id)
     SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
    [ventureId, ids],
  )
}
