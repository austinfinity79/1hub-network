import type { Executor } from '@/lib/db/client'
import { safeUrl } from '@/lib/library/startup-adapter'
import { isAssetId } from '@/lib/media/avatar-storage'

/**
 * ADMIN-PROD-02 — venture review foundation (PD-2, PD-3; ADMIN-PROD-01 §B).
 *
 * Smallest persistence: `projects` IS the approved public version and the only
 * thing any public surface reads (the Library reads `status ACTIVE, visibility
 * PUBLIC` rows of it). A submission waits in `venture_reviews.proposed` — the
 * core fields as a snapshot (schema_version 1) — and replaces the live values
 * only on approval. No document-versioning engine: one pending row per venture
 * (`uq_venture_reviews_pending`), a version number for stale decisions, history
 * as the reviews' own rows plus audit events.
 *
 *   user-facing  DRAFT → PENDING_REVIEW → PUBLIC; PENDING_REVIEW → REJECTED →
 *                (edit) → PENDING_REVIEW. A PUBLIC venture with a pending core
 *                change stays PUBLIC, on its approved values.
 *   CORE         every field a public surface shows: name, one-line summary,
 *                sectors (domains), stage, region, website, logo, the founder's
 *                role label. Team membership is private and not core.
 *   reviewer     `venture:review`: PLATFORM_ADMIN only.
 */

export const VENTURE_CORE_FIELDS = [
  'name',
  'summary',
  'domain_ids',
  'stage_id',
  'region_id',
  'website',
  'logo_asset_id',
  'owner_role_label',
] as const

export type VentureCoreField = (typeof VENTURE_CORE_FIELDS)[number]

export type VentureCore = {
  name: string
  summary: string | null
  domain_ids: string[]
  stage_id: string | null
  region_id: string | null
  website: string | null
  logo_asset_id: string | null
  owner_role_label: string | null
}

export const VENTURE_SNAPSHOT_VERSION = 1

export const VENTURE_REVIEW_KINDS = ['FIRST_PUBLISH', 'CORE_CHANGE'] as const
export type VentureReviewKind = (typeof VENTURE_REVIEW_KINDS)[number]
export const VENTURE_REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'] as const
export type VentureReviewStatus = (typeof VENTURE_REVIEW_STATUSES)[number]

/** One submission's moves; a rejected venture is resubmitted as a new review. */
export const VENTURE_REVIEW_TRANSITIONS: Record<
  VentureReviewStatus,
  Partial<Record<VentureReviewStatus, 'REVIEWER' | 'OWNER'>>
> = {
  PENDING: { APPROVED: 'REVIEWER', REJECTED: 'REVIEWER', WITHDRAWN: 'OWNER' },
  APPROVED: {},
  REJECTED: {},
  WITHDRAWN: {},
}

export const VENTURE_REVIEW_LIMITS = { rejectReason: 500 } as const

const text = (value: string | null | undefined) => (value ?? '').trim() || null
const id = (value: string | null | undefined) => (value ? value.toLowerCase() : null)

/** One canonical form, so equal values always compare equal. */
export function normalizeCore(core: VentureCore): VentureCore {
  return {
    name: core.name.trim(),
    summary: text(core.summary),
    domain_ids: [...new Set(core.domain_ids.map((d) => d.toLowerCase()))].sort(),
    stage_id: id(core.stage_id),
    region_id: id(core.region_id),
    website: text(core.website),
    logo_asset_id: text(core.logo_asset_id),
    owner_role_label: text(core.owner_role_label),
  }
}

/** The core fields whose values differ, in the fixed field order. */
export function changedCoreFields(before: VentureCore, after: VentureCore): VentureCoreField[] {
  const a = normalizeCore(before)
  const b = normalizeCore(after)
  return VENTURE_CORE_FIELDS.filter(
    (field) => JSON.stringify(a[field]) !== JSON.stringify(b[field]),
  )
}

export function isPublicVenture(venture: { status: string; visibility: string }): boolean {
  return venture.status === 'ACTIVE' && venture.visibility === 'PUBLIC'
}

/**
 * REVIEW_REQUIRED, deterministically: YES exactly when a PUBLIC venture's core
 * fields change. A non-public venture's edits are private and are reviewed with
 * its first publish; a change outside the core (team, type, presentation) never
 * triggers a review.
 */
export function reviewRequired(
  venture: { status: string; visibility: string },
  before: VentureCore,
  after: VentureCore,
): { required: boolean; fields: VentureCoreField[] } {
  const fields = changedCoreFields(before, after)
  return { required: isPublicVenture(venture) && fields.length > 0, fields }
}

export type VentureLifecycleState = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLIC' | 'REJECTED' | 'ARCHIVED'

/** The user-facing state, from the canonical row and its latest review. */
export function ventureReviewState(
  venture: { status: string; visibility: string },
  latest: { kind: VentureReviewKind; status: VentureReviewStatus } | null,
): { state: VentureLifecycleState; pendingChange: boolean } {
  if (venture.status === 'ARCHIVED') return { state: 'ARCHIVED', pendingChange: false }
  if (isPublicVenture(venture)) {
    return { state: 'PUBLIC', pendingChange: latest?.status === 'PENDING' }
  }
  if (latest?.status === 'PENDING') return { state: 'PENDING_REVIEW', pendingChange: false }
  if (latest?.status === 'REJECTED') return { state: 'REJECTED', pendingChange: false }
  return { state: 'DRAFT', pendingChange: false }
}

/** PD-3 website: http / https only, the existing `safeUrl` rule; null clears it. */
export function parseWebsite(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || (typeof value === 'string' && value.trim() === ''))
    return { ok: true, value: null }
  const url = safeUrl(value)
  return url ? { ok: true, value: url } : { ok: false }
}

/** PD-3 logo: a reference into the existing media asset store, as avatars. */
export function isLogoReference(value: unknown): value is string {
  return isAssetId(value)
}

/** The snapshot stored in `venture_reviews.proposed`. */
export function coreSnapshot(core: VentureCore): Record<string, unknown> {
  return { schema_version: VENTURE_SNAPSHOT_VERSION, ...normalizeCore(core) }
}

/** Reads a stored snapshot back; null for any other shape. */
export function parseCoreSnapshot(value: unknown): VentureCore | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const nullableText = (x: unknown) => x === null || typeof x === 'string'
  if (
    v.schema_version !== VENTURE_SNAPSHOT_VERSION ||
    typeof v.name !== 'string' ||
    !Array.isArray(v.domain_ids) ||
    !v.domain_ids.every((d) => typeof d === 'string') ||
    !['summary', 'stage_id', 'region_id', 'website', 'logo_asset_id', 'owner_role_label'].every(
      (key) => nullableText(v[key]),
    )
  ) {
    return null
  }
  return normalizeCore(v as unknown as VentureCore)
}

/** The live (approved) core of one venture, from the canonical rows. */
export async function loadVentureCore(
  exec: Executor,
  ventureId: string,
): Promise<(VentureCore & { status: string; visibility: string }) | null> {
  const [row] = await exec<{
    name: string
    summary: string | null
    stage_id: string | null
    region_id: string | null
    website: string | null
    logo_asset_id: string | null
    owner_role_label: string | null
    status: string
    visibility: string
    domain_ids: string[]
  }>(
    `SELECT p.name, p.summary, p.stage_id::text, p.region_id::text, p.website, p.logo_asset_id,
            p.owner_role_label, p.status::text AS status, p.visibility::text AS visibility,
            COALESCE(ARRAY(SELECT d.vocabulary_item_id::text FROM project_domains d
                            WHERE d.project_id = p.id ORDER BY 1), '{}') AS domain_ids
       FROM projects p WHERE p.id = $1`,
    [ventureId],
  )
  if (!row) return null
  return { ...normalizeCore(row), status: row.status, visibility: row.visibility }
}
