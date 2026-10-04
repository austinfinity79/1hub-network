import type { Executor } from '@/lib/db/client'
import { OPS_ORGANIZATION_TYPES } from '@/lib/ops/organizations'

import { writeAdminAudit } from './admin-audit'
import { nearestResponsibleUnit } from './hierarchy'
import { currentMonth, VERIFICATION_LIMITS } from './verification'

/**
 * ADMIN-PROD-03 — converting legacy onboarding HUB declarations into
 * RoleVerificationRequests (ADMIN-PROD-01 §A: D6B is superseded when the
 * request model ships; ADMIN-PROD-02 handoff item 1).
 *
 * A legacy declaration is a `community_memberships` row with `hub_declaration`
 * still PENDING_APPROVAL, carrying the declared position and period as free
 * text. Only a declaration with enough canonical information becomes a request:
 *   position  non-empty, ≤ 200 characters (the request's bound);
 *   period    an explicit start MONTH (MM/YYYY or YYYY-MM) and either an explicit
 *             end month or "nay" / "hiện tại" / "present" (current term); no
 *             future month; end not before start. A year alone ("2024 – nay")
 *             or any other text is not enough: no month is ever invented;
 *   unit      a PUBLISHED HUB / CHAPTER / CLB; requester ACTIVE profile and account.
 * Everything else is left as it is and counted with its reason.
 *
 * A converted request is PENDING only — never approved —, routed by PD-1 as
 * of the conversion (never to the requester), keeps the declaration's time as
 * `submitted_at`, and records its provenance in a VERIFICATION_REQUEST_MIGRATED
 * audit event (system actor, `membership_id`). The membership row is not
 * touched. Re-running converts nothing twice: a declaration with a provenance
 * event is skipped, and `uq_rvr_declared_position` refuses a duplicate position.
 * `apply: false` reports the same outcome and writes nothing.
 */

export const LEGACY_SKIP_REASONS = [
  'already_converted',
  'missing_position',
  'position_too_long',
  'missing_period',
  'period_year_only',
  'period_unparsed',
  'period_future',
  'period_order',
  'unit_unavailable',
  'requester_unavailable',
  'duplicate_position',
] as const
export type LegacySkipReason = (typeof LEGACY_SKIP_REASONS)[number]

export type LegacyPeriod = { from: string; to: string | null }

const MONTH_TOKEN = /(\d{1,2})\/(\d{4})|(\d{4})-(\d{1,2})(?!\d)/g
const CURRENT_WORDS = /\b(nay|hiện tại|hien tai|present|now)\b/u
const FILLER = /từ|tu|đến|den|to|[-–—~,]|\s/gu

/** Parses a free-text period, or says why it cannot (no month is ever guessed). */
export function parseLegacyPeriod(
  text: string | null,
  now: Date = new Date(),
): LegacyPeriod | { reason: LegacySkipReason } {
  const value = (text ?? '').trim().toLowerCase()
  if (!value) return { reason: 'missing_period' }
  const months: string[] = []
  for (const match of value.matchAll(MONTH_TOKEN)) {
    const year = match[2] ?? match[3]!
    const month = Number(match[1] ?? match[4])
    // A month outside 1 – 12 or a year before 1900 is a typo, never a date to store.
    if (month < 1 || month > 12 || Number(year) < 1900) return { reason: 'period_unparsed' }
    months.push(`${year}-${String(month).padStart(2, '0')}-01`)
  }
  const current = CURRENT_WORDS.test(value)
  const rest = value.replace(MONTH_TOKEN, '').replace(CURRENT_WORDS, '').replace(FILLER, '')
  if (months.length === 0) {
    return { reason: /\d{4}/.test(value) ? 'period_year_only' : 'period_unparsed' }
  }
  if (rest !== '' || months.length > 2) return { reason: 'period_unparsed' }
  let period: LegacyPeriod
  if (months.length === 2 && !current) period = { from: months[0]!, to: months[1]! }
  else if (months.length === 1 && current) period = { from: months[0]!, to: null }
  else return { reason: 'period_unparsed' }
  const month = currentMonth(now)
  if (period.from > month || (period.to !== null && period.to > month))
    return { reason: 'period_future' }
  if (period.to !== null && period.to < period.from) return { reason: 'period_order' }
  return period
}

export type LegacyConversionReport = {
  scanned: number
  converted: number
  skipped: Partial<Record<LegacySkipReason, number>>
  /** Ids and outcomes only: no position or period text. */
  items: Array<{
    membership_id: string
    outcome: 'converted' | LegacySkipReason
    request_id?: string
    routed_to?: string
  }>
}

type LegacyRow = {
  id: string
  profile_id: string
  organization_id: string
  claimed_position: string | null
  claimed_period: string | null
  created_at: Date
  profile_status: string
  account_status: string
  org_type: string
  org_status: string
  converted: boolean
}

export async function convertLegacyDeclarations(
  exec: Executor,
  options: {
    apply: boolean
    requestId: string
    now?: Date
    /** Limits the run to these requesters (one person's re-declaration, tests). */
    onlyProfileIds?: readonly string[]
  },
): Promise<LegacyConversionReport> {
  const rows = await exec<LegacyRow>(
    `SELECT m.id::text, m.profile_id::text, m.organization_id::text, m.claimed_position,
            m.claimed_period, m.created_at, p.status::text AS profile_status,
            a.status::text AS account_status, o.type::text AS org_type, o.status::text AS org_status,
            EXISTS (SELECT 1 FROM audit_events e
                     WHERE e.action = 'VERIFICATION_REQUEST_MIGRATED'
                       AND e.resource_type = 'role_verification_request'
                       AND e.after_data->>'membership_id' = m.id::text) AS converted
       FROM community_memberships m
       JOIN individual_profiles p ON p.id = m.profile_id
       JOIN user_accounts a ON a.id = p.account_id
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.hub_declaration AND m.state = 'PENDING_APPROVAL'
        AND ($1::uuid[] IS NULL OR m.profile_id = ANY($1::uuid[]))
      ORDER BY m.created_at, m.id`,
    [options.onlyProfileIds ?? null],
  )
  const report: LegacyConversionReport = {
    scanned: rows.length,
    converted: 0,
    skipped: {},
    items: [],
  }
  const skip = (row: LegacyRow, reason: LegacySkipReason) => {
    report.skipped[reason] = (report.skipped[reason] ?? 0) + 1
    report.items.push({ membership_id: row.id, outcome: reason })
  }

  for (const row of rows) {
    if (row.converted) {
      skip(row, 'already_converted')
      continue
    }
    const title = (row.claimed_position ?? '').trim()
    if (!title) {
      skip(row, 'missing_position')
      continue
    }
    if (title.length > VERIFICATION_LIMITS.positionTitle) {
      skip(row, 'position_too_long')
      continue
    }
    const period = parseLegacyPeriod(row.claimed_period, options.now)
    if ('reason' in period) {
      skip(row, period.reason)
      continue
    }
    if (
      !(OPS_ORGANIZATION_TYPES as readonly string[]).includes(row.org_type) ||
      row.org_status !== 'PUBLISHED'
    ) {
      skip(row, 'unit_unavailable')
      continue
    }
    if (row.profile_status !== 'ACTIVE' || row.account_status !== 'ACTIVE') {
      skip(row, 'requester_unavailable')
      continue
    }
    const route = await nearestResponsibleUnit(exec, row.organization_id, row.profile_id)
    if (!route) {
      skip(row, 'unit_unavailable')
      continue
    }
    if (!options.apply) {
      const [dup] = await exec<{ id: string }>(
        `SELECT id::text FROM role_verification_requests
          WHERE requester_profile_id = $1 AND organization_id = $2 AND status <> 'WITHDRAWN'
            AND lower(position_title) = lower($3) AND period_from = $4::date`,
        [row.profile_id, row.organization_id, title, period.from],
      )
      if (dup) skip(row, 'duplicate_position')
      else {
        report.converted += 1
        report.items.push({
          membership_id: row.id,
          outcome: 'converted',
          routed_to: route.routedTo,
        })
      }
      continue
    }
    const [created] = await exec<{ id: string }>(
      `INSERT INTO role_verification_requests
         (requester_profile_id, organization_id, position_title, period_from, period_to,
          routed_to_org_id, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING id::text`,
      [
        row.profile_id,
        row.organization_id,
        title,
        period.from,
        period.to,
        route.routedTo,
        row.created_at,
      ],
    )
    if (!created) {
      skip(row, 'duplicate_position')
      continue
    }
    await writeAdminAudit(exec, {
      actorAccountId: null,
      action: 'VERIFICATION_REQUEST_MIGRATED',
      target: { type: 'role_verification_request', id: created.id },
      organizationId: route.routedTo,
      after: {
        status: 'PENDING',
        membership_id: row.id,
        position_organization_id: row.organization_id,
        fallback: route.fallback,
        handler_found: route.handlerFound,
      },
      requestId: options.requestId,
    })
    report.converted += 1
    report.items.push({
      membership_id: row.id,
      outcome: 'converted',
      request_id: created.id,
      routed_to: route.routedTo,
    })
  }
  return report
}
