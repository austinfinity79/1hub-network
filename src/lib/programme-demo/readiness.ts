import type { EditResult } from './journey'
import { PROGRAMME_TYPES, type ProgrammeDemoDetail } from './types'

/**
 * WF04 — demo publish checklist (DEC-WF04-H5).
 *
 * DRAFT → PUBLISHED is blocked while an item fails. Each item comes from an
 * existing source; no business field is made required by the demo itself:
 * - name       — `programmes.name` NOT NULL (001);
 * - type       — `programmes.programme_type` enum (001; Freeze D1);
 * - owner      — every Programme has a responsible Organization (architecture
 *                02 §2.5), and it must be one the actor may operate (H2);
 * - dates      — when both are set, the end is not before the start (the
 *                canonical Event rule, DEC-WF03-S07-EVENT-LIFECYCLE E3);
 * - problems   — a CHALLENGE needs at least one problem statement (the approved
 *                ADM5 reference rule, DEC-WF04-H4).
 * Stages, events, registration and team are never required.
 */

export type ReadinessItem = 'name' | 'type' | 'owner' | 'dates' | 'problems'
export type ReadinessCheck = { item: ReadinessItem; ok: boolean }

export type OrganizationAllowance = 'ALL' | readonly string[]

export function publishReadiness(
  detail: ProgrammeDemoDetail,
  allowedOrganizations: OrganizationAllowance,
): ReadinessCheck[] {
  const p = detail.programme
  const owner =
    Boolean(p.organization_id) &&
    (allowedOrganizations === 'ALL' || allowedOrganizations.includes(p.organization_id))
  const start = p.starts_at ? Date.parse(p.starts_at) : null
  const end = p.ends_at ? Date.parse(p.ends_at) : null
  const dates =
    (p.starts_at === null || Number.isFinite(start)) &&
    (p.ends_at === null || Number.isFinite(end)) &&
    (start === null || end === null || end >= start)
  const checks: ReadinessCheck[] = [
    { item: 'name', ok: p.name.trim().length > 0 },
    { item: 'type', ok: (PROGRAMME_TYPES as readonly string[]).includes(p.type) },
    { item: 'owner', ok: owner },
    { item: 'dates', ok: dates },
  ]
  if (p.type === 'CHALLENGE')
    checks.push({ item: 'problems', ok: (detail.problem_statements?.length ?? 0) > 0 })
  return checks
}

export function canPublish(
  detail: ProgrammeDemoDetail,
  allowedOrganizations: OrganizationAllowance,
): boolean {
  return (
    detail.programme.status === 'DRAFT' &&
    publishReadiness(detail, allowedOrganizations).every((c) => c.ok)
  )
}

/**
 * WF04-S07 — the one demo transition, DRAFT → PUBLISHED (DEC-WF04-H5,
 * DEC-WF04-S07-D1). Atomic: a failing checklist item or a programme that is
 * not a DRAFT changes nothing, so publishing twice is a no-op. Setup data is
 * kept as is; only `status` and `updated_at` change.
 */
export function publishProgramme(
  detail: ProgrammeDemoDetail,
  allowedOrganizations: OrganizationAllowance,
  now: Date,
): EditResult<{ missing: ReadinessItem[] }> | { ok: false; reason: 'not_draft' } {
  if (detail.programme.status !== 'DRAFT') return { ok: false, reason: 'not_draft' }
  const missing = publishReadiness(detail, allowedOrganizations)
    .filter((c) => !c.ok)
    .map((c) => c.item)
  if (missing.length > 0) return { ok: false, reason: 'invalid', errors: { missing } }
  const next = structuredClone(detail)
  next.programme.status = 'PUBLISHED'
  next.programme.updated_at = now.toISOString()
  return { ok: true, detail: next }
}
