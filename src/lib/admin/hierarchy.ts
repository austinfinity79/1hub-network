import { ruleFor, type Capability } from '@/lib/authz/matrix'
import type { Executor } from '@/lib/db/client'
import { parentsOf } from '@/lib/ops/hierarchy'
import { OPS_ORGANIZATION_TYPES } from '@/lib/ops/organizations'

/**
 * ADMIN-PROD-02 — organization hierarchy helpers for the Admin Portal.
 *
 * Built only on the canonical reader (`parentsOf`, DEC-WF03-G9): ACTIVE PARENT
 * rows of `organization_relationships`, never `organizations.parent_id`, a name
 * or a slug. No admin organization tree exists. P0 depth is three (HUB Tổng →
 * Chapter → CLB); the walk is bounded and stops at a root, an inconsistent link
 * or a repeat, so corrupt data cannot loop it.
 *
 * The hierarchy moves REQUESTS (PD-1 fallback) and bounds DELEGATION (PD-6). It
 * never grants authority by itself: holding a capability on a parent does not
 * hold it on a child (DL:764, DEC-WF03-G11).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DEPTH = 8

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Same organization, compared as canonical ids (case-insensitive UUID text). */
export function isSameScope(a: string | null | undefined, b: string | null | undefined): boolean {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
}

/** `[orgId, parent, grandparent, …]` by canonical ACTIVE PARENT relationships. */
export async function ancestorChain(exec: Executor, orgId: string): Promise<string[]> {
  if (!isUuid(orgId)) return []
  const chain = [orgId.toLowerCase()]
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    const current = chain.at(-1)!
    const link = (await parentsOf(exec, [current])).get(current)
    if (link?.kind !== 'PARENT' || chain.includes(link.parentId)) break
    chain.push(link.parentId)
  }
  return chain
}

/** True when `orgId` sits strictly below `ancestorId` (any depth). */
export async function isDescendant(
  exec: Executor,
  ancestorId: string,
  orgId: string,
): Promise<boolean> {
  if (!isUuid(ancestorId)) return false
  return (await ancestorChain(exec, orgId)).slice(1).some((id) => isSameScope(id, ancestorId))
}

/** True when `childId`'s one canonical parent is `parentId` (PD-6 delegation reach). */
export async function isDirectChild(
  exec: Executor,
  parentId: string,
  childId: string,
): Promise<boolean> {
  if (!isUuid(parentId) || !isUuid(childId)) return false
  const link = (await parentsOf(exec, [childId.toLowerCase()])).get(childId.toLowerCase())
  return link?.kind === 'PARENT' && isSameScope(link.parentId, parentId)
}

/** The canonical parent of one organization, or null (root, unknown or inconsistent). */
export async function parentOf(exec: Executor, orgId: string): Promise<string | null> {
  if (!isUuid(orgId)) return null
  const link = (await parentsOf(exec, [orgId.toLowerCase()])).get(orgId.toLowerCase())
  return link?.kind === 'PARENT' ? link.parentId : null
}

/**
 * PD-1 receiving-unit chain for a position held at `orgId`: the unit, then its
 * community ancestors — CLB → Chapter → HUB Tổng; Chapter → HUB Tổng; HUB Tổng.
 * Only community units (HUB, CHAPTER, CLB) take part; the walk stops at the
 * first organization of another type.
 */
export async function fallbackChain(exec: Executor, orgId: string): Promise<string[]> {
  const chain = await ancestorChain(exec, orgId)
  if (chain.length === 0) return []
  const rows = await exec<{ id: string; type: string }>(
    `SELECT id::text, type::text AS type FROM organizations WHERE id = ANY($1::uuid[])`,
    [chain],
  )
  const types = new Map(rows.map((r) => [r.id, r.type]))
  const out: string[] = []
  for (const id of chain) {
    if (!(OPS_ORGANIZATION_TYPES as readonly string[]).includes(types.get(id) ?? '')) break
    out.push(id)
  }
  return out
}

/**
 * True when someone can exercise `capability` on exactly this unit: an ACTIVE,
 * currently valid ORGANIZATION assignment there whose role holds it (whole role,
 * or a capability-only grant of it), held by an ACTIVE profile of an ACTIVE
 * account, on a PUBLISHED unit. PLATFORM_ADMIN is not a unit holder: it may act
 * anywhere, so counting it would make every fallback disappear. `excludeProfileId`
 * leaves one person out (the requester: nobody verifies their own position).
 */
export async function unitHasHolder(
  exec: Executor,
  orgId: string,
  capability: Capability,
  excludeProfileId: string | null = null,
): Promise<boolean> {
  const rule = ruleFor(capability)
  if (!rule || rule.organizationRoles.length === 0 || !isUuid(orgId)) return false
  const [row] = await exec<{ found: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM role_assignments ra
         JOIN individual_profiles p ON p.id = ra.individual_profile_id
         JOIN user_accounts a ON a.id = p.account_id
         JOIN organizations o ON o.id = ra.scope_id
        WHERE ra.scope_type = 'ORGANIZATION' AND ra.scope_id = $1
          AND ra.state = 'ACTIVE' AND ra.valid_from <= now()
          AND (ra.valid_to IS NULL OR ra.valid_to > now())
          AND ra.role_code = ANY($2::text[])
          AND (ra.capability IS NULL OR ra.capability = $3)
          AND p.status = 'ACTIVE' AND a.status = 'ACTIVE' AND o.status = 'PUBLISHED'
          AND ra.individual_profile_id IS DISTINCT FROM $4::uuid
     ) AS found`,
    [orgId, rule.organizationRoles, capability, excludeProfileId],
  )
  return row?.found === true
}

export type ResponsibleUnit = {
  /** The unit the request is routed to, recorded on it at submission. */
  routedTo: string
  /** The chain that was walked, the position's own unit first. */
  chain: string[]
  /** True when the position's own unit had no handler. */
  fallback: boolean
  /** False when no unit in the chain has a handler: PLATFORM_ADMIN handles it. */
  handlerFound: boolean
}

/**
 * PD-1: the nearest unit in the fallback chain with a `verification:review`
 * holder other than the requester. When none has one, the request rests with the
 * top of the chain (HUB Tổng), where PLATFORM_ADMIN — who may act on any request
 * but the requester's own — handles it. Null when `orgId` is not a community unit.
 */
export async function nearestResponsibleUnit(
  exec: Executor,
  orgId: string,
  requesterProfileId: string | null = null,
): Promise<ResponsibleUnit | null> {
  const chain = await fallbackChain(exec, orgId)
  if (chain.length === 0) return null
  for (const unit of chain) {
    if (await unitHasHolder(exec, unit, 'verification:review', requesterProfileId)) {
      return { routedTo: unit, chain, fallback: unit !== chain[0], handlerFound: true }
    }
  }
  return { routedTo: chain.at(-1)!, chain, fallback: chain.length > 1, handlerFound: false }
}
