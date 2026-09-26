import { ApiError, notFound } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { can } from '@/lib/authz/authorize'
import type { Capability } from '@/lib/authz/matrix'
import { query } from '@/lib/db/client'

import { parentsOf } from './hierarchy'
import { organizationScope, type OrganizationScope } from './scope'

/**
 * WF03-T00 — ops organization read model (API 05 §8.1, DEC-WF03-G8/G9/G11).
 *
 * `GET /ops/organizations` lists the operational organizations (HUB, CHAPTER,
 * CLB) the actor holds `network:read` for: every one for PLATFORM_ADMIN, the
 * exact assigned ones for a HUB_COMMUNITY_LEADER. The DTO is the frozen
 * OrganizationRefDTO (§11.1) plus the lifecycle status, the canonical parent
 * and the ACTIVE member count S01 inspects (WF03:28). Never returned: metadata,
 * description, logo, member or leader identities, RoleAssignments, audit data.
 *
 * The parent comes from the one hierarchy reader (G9). It is shown when it is
 * PUBLISHED or when the actor may read it too; otherwise it is omitted.
 */

export const OPS_ORGANIZATION_TYPES = ['HUB', 'CHAPTER', 'CLB'] as const
export type OpsOrganizationType = (typeof OPS_ORGANIZATION_TYPES)[number]

export type OrganizationRefDTO = { id: string; slug: string; name: string; type: string }

export type OpsOrganizationDTO = OrganizationRefDTO & {
  status: string
  parent: OrganizationRefDTO | null
  active_members: number
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Cursor = { n: string; i: string }

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}

/** An unusable cursor starts from the first page, as `parseListQuery` does for limits. */
function decodeCursor(raw: string): Cursor | null {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor
    if (typeof c.n === 'string' && typeof c.i === 'string' && UUID.test(c.i)) return c
  } catch {
    // fall through
  }
  return null
}

type Row = { id: string; slug: string; name: string; type: string; status: string }

async function withParentsAndCounts(
  rows: Row[],
  scope: OrganizationScope,
): Promise<OpsOrganizationDTO[]> {
  const ids = rows.map((r) => r.id)
  const parents = await parentsOf(query, ids)
  const parentIds = [...parents.values()].flatMap((p) => (p.kind === 'PARENT' ? [p.parentId] : []))
  const parentRows = parentIds.length
    ? await query<Row>(
        `SELECT id::text, slug, name, type::text AS type, status::text AS status
           FROM organizations WHERE id = ANY($1::uuid[])`,
        [parentIds],
      )
    : []
  const byId = new Map(parentRows.map((p) => [p.id, p]))
  const counts = ids.length
    ? await query<{ id: string; n: number }>(
        `SELECT organization_id::text AS id, count(*)::int AS n
           FROM community_memberships
          WHERE state = 'ACTIVE' AND organization_id = ANY($1::uuid[])
          GROUP BY 1`,
        [ids],
      )
    : []
  const countOf = new Map(counts.map((c) => [c.id, c.n]))
  const readable = (id: string) =>
    scope.kind === 'ALL' || scope.organizationIds.includes(id) || false

  return rows.map((row) => {
    const link = parents.get(row.id)
    const parentRow = link?.kind === 'PARENT' ? byId.get(link.parentId) : undefined
    const showParent = parentRow && (parentRow.status === 'PUBLISHED' || readable(parentRow.id))
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      status: row.status,
      parent: showParent
        ? { id: parentRow.id, slug: parentRow.slug, name: parentRow.name, type: parentRow.type }
        : null,
      active_members: countOf.get(row.id) ?? 0,
    }
  })
}

export type ListParams = { type?: string; q?: string; cursor?: string; limit: number }

/** GET /ops/organizations. 401 without a session; 403 with no ops scope at all. */
export async function listManagedOrganizations(accountId: string, params: ListParams) {
  const actor = await resolveActor(accountId)
  const scope = organizationScope(actor, 'network:read')
  if (scope.kind === 'SOME' && scope.organizationIds.length === 0) {
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
  }
  // A type outside HUB/CHAPTER/CLB matches nothing (no error code is contracted for it).
  const cursor = params.cursor ? decodeCursor(params.cursor) : null
  const q = params.q?.trim().slice(0, 100) || null

  const where: string[] = ['o.type::text = ANY($1::text[])']
  const values: unknown[] = [params.type ? [params.type] : [...OPS_ORGANIZATION_TYPES]]
  const add = (sql: string, value: unknown) => {
    values.push(value)
    where.push(sql.replace('?', `$${values.length}`))
  }
  if (scope.kind === 'SOME') add('o.id = ANY(?::uuid[])', scope.organizationIds)
  if (q) add(`o.name ILIKE ? ESCAPE '\\'`, `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
  if (cursor) {
    values.push(cursor.n, cursor.i)
    where.push(`(o.name, o.id) > ($${values.length - 1}, $${values.length}::uuid)`)
  }
  values.push(params.limit + 1)
  const rows = await query<Row>(
    `SELECT o.id::text, o.slug, o.name, o.type::text AS type, o.status::text AS status
       FROM organizations o
      WHERE ${where.join(' AND ')}
      ORDER BY o.name, o.id
      LIMIT $${values.length}`,
    values,
  )
  const page = rows.slice(0, params.limit)
  const last = page[page.length - 1]
  return {
    items: await withParentsAndCounts(page, scope),
    nextCursor:
      rows.length > params.limit && last ? encodeCursor({ n: last.name, i: last.id }) : null,
  }
}

export type OpsOrganizationContext = {
  organization: OrganizationRefDTO & { status: string }
  /** Display only (menu visibility); every API re-authorizes. */
  capabilities: Capability[]
}

const CONTEXT_CAPABILITIES: readonly Capability[] = [
  'org:read',
  'member:read',
  'org:manage',
  'event:manage',
  'org:manage_relationship',
]

/**
 * The organization a `/ops/org/:orgId/*` request is about, after the server
 * check of `capability` for exactly that organization. A malformed, unknown,
 * non-operational or out-of-scope id is the same 404, so the context in the URL
 * can never be used to probe or widen scope.
 */
export async function requireOpsOrganization(
  accountId: string,
  orgId: string,
  capability: Capability,
): Promise<OpsOrganizationContext> {
  if (!UUID.test(orgId)) throw notFound()
  const actor = await resolveActor(accountId)
  if (!(await can(actor, capability, { scopeType: 'ORGANIZATION', scopeId: orgId })))
    throw notFound()
  const [row] = await query<Row>(
    `SELECT id::text, slug, name, type::text AS type, status::text AS status
       FROM organizations WHERE id = $1 AND type::text = ANY($2::text[])`,
    [orgId, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!row) throw notFound()
  const capabilities: Capability[] = []
  for (const c of CONTEXT_CAPABILITIES) {
    if (await can(actor, c, { scopeType: 'ORGANIZATION', scopeId: orgId })) capabilities.push(c)
  }
  return { organization: row, capabilities }
}
