import type { Executor } from '@/lib/db/client'

/**
 * WF03-T00 — the one canonical hierarchy reader (DEC-WF03-G9).
 *
 * Hierarchy is read ONLY from `organization_relationships`: an ACTIVE row of
 * type PARENT whose source is the parent and whose target is the child. The
 * legacy `organizations.parent_id` column is never read here and never written
 * by WF03, and nothing is inferred from name, slug, region or type.
 *
 * P0 invariant: at most one ACTIVE PARENT per child. The schema does not
 * enforce it yet (migration 009 may, with the first relationship writes). A
 * child with more than one ACTIVE parent is a DATA INCONSISTENCY: it is
 * reported (ids only) and the child is shown with no parent rather than an
 * arbitrarily chosen one.
 */

export const PARENT_RELATIONSHIP = 'PARENT'

export type ParentLink =
  | { kind: 'NONE' }
  | { kind: 'PARENT'; parentId: string }
  | { kind: 'INCONSISTENT'; parentIds: string[] }

/** Canonical parent of each requested child, in one query. */
export async function parentsOf(
  exec: Executor,
  childIds: readonly string[],
): Promise<Map<string, ParentLink>> {
  const out = new Map<string, ParentLink>(childIds.map((id) => [id, { kind: 'NONE' }]))
  if (childIds.length === 0) return out
  const rows = await exec<{ child: string; parent: string }>(
    `SELECT target_org_id::text AS child, source_org_id::text AS parent
       FROM organization_relationships
      WHERE relationship_type = $1 AND state = 'ACTIVE' AND ended_at IS NULL
        AND target_org_id = ANY($2::uuid[])
      ORDER BY 1, 2`,
    [PARENT_RELATIONSHIP, childIds],
  )
  const grouped = new Map<string, string[]>()
  for (const row of rows) grouped.set(row.child, [...(grouped.get(row.child) ?? []), row.parent])
  for (const [child, parents] of grouped) {
    if (parents.length === 1) {
      out.set(child, { kind: 'PARENT', parentId: parents[0]! })
    } else {
      out.set(child, { kind: 'INCONSISTENT', parentIds: parents })
      console.warn('DATA INCONSISTENCY: more than one ACTIVE PARENT relationship', {
        child,
        parents,
      })
    }
  }
  return out
}

/** Canonical children of one organization (ACTIVE PARENT rows it is the source of). */
export async function childrenOf(exec: Executor, parentId: string): Promise<string[]> {
  const rows = await exec<{ child: string }>(
    `SELECT target_org_id::text AS child
       FROM organization_relationships
      WHERE relationship_type = $1 AND state = 'ACTIVE' AND ended_at IS NULL
        AND source_org_id = $2
      ORDER BY 1`,
    [PARENT_RELATIONSHIP, parentId],
  )
  return rows.map((r) => r.child)
}
