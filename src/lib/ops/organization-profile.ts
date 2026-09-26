import { ApiError, notFound } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { resolveActor } from '@/lib/authz/actor'
// Aliased: webpack would treat a bare `require(…)` as CommonJS and refuse to build.
import { require as requireCapability } from '@/lib/authz/authorize'
import { query, withTransaction, type Executor } from '@/lib/db/client'

import { childrenOf, parentsOf } from './hierarchy'
import { ORGANIZATION_LIMITS } from './organization-limits'
import { OPS_ORGANIZATION_TYPES, type OrganizationRefDTO } from './organizations'

/**
 * WF03-S06 — organization profile / detail (API 05 §8.5, DEC-WF03-C1/G8/G9/G14,
 * DEC-WF03-S06-D1..D4).
 *
 * Read: the canonical Organization row (name, type, lifecycle status,
 * description) and its hierarchy from the one canonical reader (G9), read-only.
 * Edit (`PATCH /ops/organizations/{orgId}/profile`, `org:manage`): only the
 * fields that are both canonical columns and approved by the S06 design —
 * `name` and `description`. Type, slug (the roster import key), status, logo,
 * parent / children and metadata are never written here; hierarchy belongs to
 * S08 (DEC-WF03-C1). An ARCHIVED organization is read-only (G8).
 *
 * Validation is complete before the write; the row is locked; a real change
 * writes one ORGANIZATION_UPDATED audit event (ids, field names and the public
 * name delta only); a no-op writes nothing.
 */

export type OrganizationProfileDTO = OrganizationRefDTO & {
  status: string
  description: string | null
  /** Canonical parent (ACTIVE PARENT relationship); null when none or inconsistent. */
  parent: OrganizationRefDTO | null
  children: OrganizationRefDTO[]
  /** Display only; every mutation re-authorizes on the server. */
  permissions: Array<'org:manage'>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EDITABLE = ['name', 'description'] as const

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })

type Row = OrganizationRefDTO & { status: string; description: string | null }

async function loadRow(exec: Executor, orgId: string, lock = false): Promise<Row> {
  const [row] = await exec<Row>(
    `SELECT id::text, slug, name, type::text AS type, status::text AS status, description
       FROM organizations WHERE id = $1 AND type::text = ANY($2::text[])${lock ? ' FOR UPDATE' : ''}`,
    [orgId, [...OPS_ORGANIZATION_TYPES]],
  )
  if (!row) throw notFound()
  return row
}

async function refs(exec: Executor, ids: string[]): Promise<Map<string, OrganizationRefDTO>> {
  if (ids.length === 0) return new Map()
  const rows = await exec<OrganizationRefDTO>(
    `SELECT id::text, slug, name, type::text AS type FROM organizations WHERE id = ANY($1::uuid[])`,
    [ids],
  )
  return new Map(rows.map((r) => [r.id, r]))
}

async function toDTO(
  exec: Executor,
  row: Row,
  permissions: OrganizationProfileDTO['permissions'],
): Promise<OrganizationProfileDTO> {
  const link = (await parentsOf(exec, [row.id])).get(row.id)
  const parentId = link?.kind === 'PARENT' ? link.parentId : null
  const childIds = await childrenOf(exec, row.id)
  const byId = await refs(exec, [...(parentId ? [parentId] : []), ...childIds])
  const children = childIds
    .map((id) => byId.get(id))
    .filter((c): c is OrganizationRefDTO => Boolean(c))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    status: row.status,
    description: row.description,
    parent: (parentId && byId.get(parentId)) || null,
    children,
    permissions,
  }
}

export async function getOrganizationProfile(
  accountId: string,
  orgId: string,
): Promise<OrganizationProfileDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'org:manage', { scopeType: 'ORGANIZATION', scopeId: orgId })
  if (!UUID.test(orgId)) throw notFound()
  const row = await loadRow(query, orgId)
  return toDTO(query, row, ['org:manage'])
}

type Patch = { name?: string; description?: string | null }

function parsePatch(body: unknown): Patch {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  // Server-owned and out-of-scope fields (id, slug, type, status, parent, logo,
  // metadata, timestamps …) are refused by name, never silently dropped.
  for (const key of Object.keys(input)) {
    if (!(EDITABLE as readonly string[]).includes(key)) throw invalid(key, 'not_accepted')
  }
  const patch: Patch = {}
  if ('name' in input) {
    if (typeof input.name !== 'string' || !input.name.trim()) throw invalid('name', 'required')
    const name = input.name.trim()
    if (name.length > ORGANIZATION_LIMITS.name) throw invalid('name', 'too_long')
    patch.name = name
  }
  if ('description' in input) {
    if (input.description !== null && typeof input.description !== 'string')
      throw invalid('description', 'invalid')
    const text = typeof input.description === 'string' ? input.description.trim() : ''
    if (text.length > ORGANIZATION_LIMITS.description) throw invalid('description', 'too_long')
    patch.description = text || null
  }
  if (Object.keys(patch).length === 0) throw invalid('body', 'empty')
  return patch
}

/** PATCH /ops/organizations/{orgId}/profile `{ name?, description? }`. */
export async function updateOrganizationProfile(
  accountId: string,
  orgId: string,
  body: unknown,
  requestId: string,
): Promise<OrganizationProfileDTO> {
  const actor = await resolveActor(accountId)
  await requireCapability(actor, 'org:manage', { scopeType: 'ORGANIZATION', scopeId: orgId })
  if (!UUID.test(orgId)) throw notFound()
  const patch = parsePatch(body)

  return withTransaction(async (exec) => {
    const row = await loadRow(exec, orgId, true)
    if (row.status === 'ARCHIVED') {
      throw new ApiError(
        'MEMBERSHIP_INVALID_TRANSITION',
        409,
        'An archived organization cannot be edited.',
      )
    }
    const changed = EDITABLE.filter(
      (field) => patch[field] !== undefined && patch[field] !== row[field],
    )
    if (changed.length === 0) return toDTO(exec, row, ['org:manage'])

    const [updated] = await exec<Row>(
      `UPDATE organizations
          SET name = $2, description = $3, updated_at = now()
        WHERE id = $1
        RETURNING id::text, slug, name, type::text AS type, status::text AS status, description`,
      [
        row.id,
        patch.name ?? row.name,
        patch.description !== undefined ? patch.description : row.description,
      ],
    )
    await writeAudit(exec, {
      actorAccountId: accountId,
      action: 'ORGANIZATION_UPDATED',
      resourceType: 'organization',
      resourceId: row.id,
      // Name is public identity; the description is only flagged, never copied.
      before: {
        organization_id: row.id,
        ...(changed.includes('name') ? { name: row.name } : {}),
      },
      after: {
        organization_id: row.id,
        changed_fields: changed,
        ...(changed.includes('name') ? { name: updated!.name } : {}),
      },
      requestId,
    })
    return toDTO(exec, updated!, ['org:manage'])
  })
}
