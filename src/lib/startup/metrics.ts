import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { query, withTransaction, type Executor } from '@/lib/db/client'

import { startupAccess, type StartupAccess, type Viewer } from './access'

/**
 * THAO-06 Metrics v1 (DEC-THAO-SP-D2).
 *
 * - Catalogue: vocabulary type VENTURE_METRIC (governed; nothing free-form).
 * - Per venture and metric: one visibility, PUBLIC or PRIVATE (new = PRIVATE).
 * - Values: per quarter, append-only (a correction is a new row; the latest row
 *   of a quarter is current). Source MANUAL.
 * - Read: PUBLIC metrics wherever the startup is visible to the viewer; PRIVATE
 *   ones to the owner and EDIT members only. Write: owner / EDIT, not archived.
 * - Every write is audited with ids, metric and period; never the value.
 */

export type MetricUnit = 'count' | 'vnd'
export type MetricVisibility = 'PUBLIC' | 'PRIVATE'

export type CatalogueItem = { slug: string; label: string; unit: MetricUnit }

export type MetricPoint = { year: number; quarter: number; value: number }

export type MetricView = {
  slug: string
  label: string
  unit: MetricUnit
  /** Present for an editor only. */
  visibility?: MetricVisibility
  /** Latest quarter first; the current value of each quarter. */
  history: MetricPoint[]
}

export type MetricsDTO = {
  can_edit: boolean
  metrics: MetricView[]
  /** The ACTIVE catalogue, for an editor only. */
  catalogue?: CatalogueItem[]
}

const invalid = (field: string, reason: string) =>
  new ApiError('METRIC_VALIDATION_FAILED', 422, 'Metric validation failed.', { [field]: reason })

const unitOf = (metadata: unknown): MetricUnit =>
  (metadata as { unit?: string } | null)?.unit === 'vnd' ? 'vnd' : 'count'

/** The current quarter in Viet Nam time. */
export function currentQuarter(now: Date = new Date()): { year: number; quarter: number } {
  const vn = new Date(now.getTime() + 7 * 3_600_000)
  return { year: vn.getUTCFullYear(), quarter: Math.floor(vn.getUTCMonth() / 3) + 1 }
}

async function catalogue(exec: Executor): Promise<CatalogueItem[]> {
  const rows = await exec<{ slug: string; label: string; metadata: unknown }>(
    `SELECT slug, label, metadata FROM vocabulary_items
      WHERE type_code = 'VENTURE_METRIC' AND status = 'ACTIVE'
      ORDER BY sort_order, label`,
  )
  return rows.map((r) => ({ slug: r.slug, label: r.label, unit: unitOf(r.metadata) }))
}

export async function readMetrics(
  access: StartupAccess,
  exec: Executor = query,
): Promise<MetricsDTO> {
  const rows = await exec<{
    slug: string
    label: string
    metadata: unknown
    visibility: MetricVisibility
    year: number | null
    quarter: number | null
    value: string | null
  }>(
    `SELECT v.slug, v.label, v.metadata, vm.visibility::text AS visibility,
            cur.period_year AS year, cur.period_quarter AS quarter, cur.value::text AS value
       FROM venture_metrics vm
       JOIN vocabulary_items v ON v.id = vm.metric_id
       LEFT JOIN LATERAL (
         SELECT DISTINCT ON (period_year, period_quarter) period_year, period_quarter, value
           FROM venture_metric_values x
          WHERE x.venture_id = vm.venture_id AND x.metric_id = vm.metric_id
          ORDER BY period_year DESC, period_quarter DESC, created_at DESC, id DESC
       ) cur ON true
      WHERE vm.venture_id = $1 ${access.canEdit ? '' : "AND vm.visibility = 'PUBLIC'"}
      ORDER BY v.sort_order, v.label, cur.period_year DESC, cur.period_quarter DESC`,
    [access.ventureId],
  )
  const metrics: MetricView[] = []
  for (const r of rows) {
    let m = metrics.find((x) => x.slug === r.slug)
    if (!m) {
      m = {
        slug: r.slug,
        label: r.label,
        unit: unitOf(r.metadata),
        ...(access.canEdit ? { visibility: r.visibility } : {}),
        history: [],
      }
      metrics.push(m)
    }
    if (r.year !== null && r.quarter !== null && r.value !== null)
      m.history.push({ year: r.year, quarter: r.quarter, value: Number(r.value) })
  }
  return {
    can_edit: access.canEdit,
    // A metric without any value is shown to its editors only.
    metrics: access.canEdit ? metrics : metrics.filter((m) => m.history.length > 0),
    ...(access.canEdit ? { catalogue: await catalogue(exec) } : {}),
  }
}

async function editable(viewer: Viewer, slug: string, exec: Executor): Promise<StartupAccess> {
  if (!viewer.member || !viewer.accountId) throw unauthenticated()
  const access = await startupAccess(slug, viewer, exec, true)
  if (!access) throw notFound()
  if (access.role !== 'OWNER' && access.role !== 'EDIT')
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner and editors manage metrics.')
  if (access.archived)
    throw new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')
  return access
}

type RecordInput = { metric: string; year: number; quarter: number; value: number }

function parseRecord(body: unknown): RecordInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const b = body as Record<string, unknown>
  for (const key of Object.keys(b))
    if (!['metric', 'year', 'quarter', 'value'].includes(key)) throw invalid(key, 'not_accepted')
  if (typeof b.metric !== 'string' || !b.metric) throw invalid('metric', 'required')
  if (!Number.isInteger(b.year)) throw invalid('year', 'invalid')
  if (!Number.isInteger(b.quarter) || (b.quarter as number) < 1 || (b.quarter as number) > 4)
    throw invalid('quarter', 'invalid')
  const now = currentQuarter()
  const year = b.year as number
  const quarter = b.quarter as number
  if (year < 2000) throw invalid('year', 'invalid')
  if (year > now.year || (year === now.year && quarter > now.quarter))
    throw invalid('quarter', 'future')
  if (typeof b.value !== 'number' || !Number.isFinite(b.value)) throw invalid('value', 'invalid')
  if (b.value < 0) throw invalid('value', 'negative')
  if (b.value > 1e15) throw invalid('value', 'too_large')
  if (Math.round(b.value * 100) !== b.value * 100) throw invalid('value', 'precision')
  return { metric: b.metric, year, quarter, value: b.value }
}

/**
 * POST — a value for one quarter. A new metric starts PRIVATE; a second value
 * for the same quarter is a correction (a new row; the old one stays).
 */
export async function recordMetric(
  viewer: Viewer,
  slug: string,
  body: unknown,
  requestId: string,
): Promise<MetricsDTO> {
  const input = parseRecord(body)
  return withTransaction(async (exec) => {
    const access = await editable(viewer, slug, exec)
    const [metric] = await exec<{ id: string }>(
      `SELECT id::text FROM vocabulary_items
        WHERE type_code = 'VENTURE_METRIC' AND slug = $1 AND status = 'ACTIVE'`,
      [input.metric],
    )
    if (!metric) throw invalid('metric', 'unknown')
    await exec(
      `INSERT INTO venture_metrics (venture_id, metric_id, created_by_account_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [access.ventureId, metric.id, viewer.accountId],
    )
    const [prior] = await exec<{ n: number }>(
      `SELECT count(*)::int AS n FROM venture_metric_values
        WHERE venture_id = $1 AND metric_id = $2 AND period_year = $3 AND period_quarter = $4`,
      [access.ventureId, metric.id, input.year, input.quarter],
    )
    await exec(
      `INSERT INTO venture_metric_values
         (venture_id, metric_id, period_year, period_quarter, value, created_by_account_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [access.ventureId, metric.id, input.year, input.quarter, input.value, viewer.accountId],
    )
    await writeAudit(exec, {
      actorAccountId: viewer.accountId,
      action: 'VENTURE_METRIC_RECORDED',
      resourceType: 'project',
      resourceId: access.ventureId,
      before: null,
      after: {
        metric: input.metric,
        period: `${input.year}-Q${input.quarter}`,
        correction: (prior?.n ?? 0) > 0,
      },
      requestId,
    })
    return readMetrics(access, exec)
  })
}

/** PATCH — the visibility of one metric the venture already reports. */
export async function setMetricVisibility(
  viewer: Viewer,
  slug: string,
  metricSlug: string,
  body: unknown,
  requestId: string,
): Promise<MetricsDTO> {
  const visibility = (body as { visibility?: unknown } | null)?.visibility
  if (
    typeof body !== 'object' ||
    body === null ||
    Object.keys(body).some((k) => k !== 'visibility')
  )
    throw invalid('body', 'invalid')
  if (visibility !== 'PUBLIC' && visibility !== 'PRIVATE') throw invalid('visibility', 'invalid')
  return withTransaction(async (exec) => {
    const access = await editable(viewer, slug, exec)
    const [row] = await exec<{ metric_id: string; visibility: MetricVisibility }>(
      `SELECT vm.metric_id::text, vm.visibility::text AS visibility
         FROM venture_metrics vm JOIN vocabulary_items v ON v.id = vm.metric_id
        WHERE vm.venture_id = $1 AND v.slug = $2 AND v.type_code = 'VENTURE_METRIC'
        FOR UPDATE OF vm`,
      [access.ventureId, metricSlug],
    )
    if (!row) throw notFound()
    if (row.visibility !== visibility) {
      await exec(
        `UPDATE venture_metrics SET visibility = $3::visibility_level, updated_at = now()
          WHERE venture_id = $1 AND metric_id = $2`,
        [access.ventureId, row.metric_id, visibility],
      )
      await writeAudit(exec, {
        actorAccountId: viewer.accountId,
        action: 'VENTURE_METRIC_VISIBILITY_CHANGED',
        resourceType: 'project',
        resourceId: access.ventureId,
        before: { metric: metricSlug, visibility: row.visibility },
        after: { metric: metricSlug, visibility },
        requestId,
      })
    }
    return readMetrics(access, exec)
  })
}
