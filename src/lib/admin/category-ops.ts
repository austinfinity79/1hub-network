import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { resolveActor, type Actor } from '@/lib/authz/actor'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { isVocabularyType, type VocabularyType } from '@/lib/vocabulary/vocabulary'

import { writeAdminAudit } from './admin-audit'
import { categoryChangeAllowed, CATEGORY_STATUSES } from './categories'
import { isUuid } from './hierarchy'
import { holdsPlatform } from './scope'

/**
 * ADMIN-PROD-05 — lightweight categories (ADMIN-PROD-01 categories contract;
 * `vocabulary:manage`, PLATFORM_ADMIN only). The existing `vocabulary_items` of
 * the six existing types, nothing else: list, label, order, ACTIVE / ARCHIVED
 * (VENTURE_STAGE: label and order only). No type is created, no item is ever
 * deleted, no generic configuration or CMS.
 *
 * Referential safety: archiving touches no reference. Every row that already
 * points at an item keeps it (foreign keys unchanged, labels still resolved
 * for display); `assertSelectable` only stops NEW selections of an archived
 * item. The list shows how many canonical rows use each item.
 */

const forbidden = () =>
  new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this resource.')
const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })

const LABEL_MAX = 200
const ORDER_MAX = 100_000

export type CategoryItemDTO = {
  id: string
  code: string
  label: string
  sort_order: number
  status: 'ACTIVE' | 'ARCHIVED'
  /** Canonical rows that reference this item (profiles, ventures). */
  in_use: number
}

/** Every column that references a vocabulary item, by type (one count per item). */
const USAGE = `
  SELECT ref, count(*)::int AS n FROM (
    SELECT region_vocab_id AS ref FROM individual_profiles
    UNION ALL SELECT country_vocab_id FROM individual_profiles
    UNION ALL SELECT vocab_id FROM profile_domains
    UNION ALL SELECT vocab_id FROM profile_skills
    UNION ALL SELECT vocab_id FROM profile_specializations
    UNION ALL SELECT region_id FROM projects
    UNION ALL SELECT stage_id FROM projects
    UNION ALL SELECT vocabulary_item_id FROM project_domains
  ) refs WHERE ref = ANY($1::uuid[]) GROUP BY ref`

async function manager(accountId: string): Promise<Actor> {
  const actor = await resolveActor(accountId)
  if (!actor.profileId) throw unauthenticated()
  if (!holdsPlatform(actor, 'vocabulary:manage')) throw forbidden()
  return actor
}

function typeOf(raw: string): VocabularyType {
  if (!isVocabularyType(raw)) throw notFound()
  return raw
}

async function items(exec: Executor, type: VocabularyType): Promise<CategoryItemDTO[]> {
  const rows = await exec<Omit<CategoryItemDTO, 'in_use'>>(
    `SELECT id::text, slug AS code, label, sort_order, status::text AS status
       FROM vocabulary_items WHERE type_code = $1 ORDER BY sort_order, label, id`,
    [type],
  )
  const usage = await exec<{ ref: string; n: number }>(USAGE, [rows.map((r) => r.id)])
  const used = new Map(usage.map((u) => [u.ref, u.n]))
  return rows.map((r) => ({ ...r, in_use: used.get(r.id) ?? 0 }))
}

/** GET /ops/categories/{type} — every item, ACTIVE and ARCHIVED, in display order. */
export async function listCategories(
  accountId: string,
  rawType: string,
): Promise<{ type: VocabularyType; items: CategoryItemDTO[] }> {
  await manager(accountId)
  const type = typeOf(rawType)
  return { type, items: await items(query, type) }
}

const inTransaction = <T>(exec: Executor | undefined, work: (exec: Executor) => Promise<T>) =>
  exec ? work(exec) : withTransaction(work)

/** PATCH /ops/categories/{type}/{itemId} `{ label?, sort_order?, status? }`. */
export async function updateCategory(
  accountId: string,
  rawType: string,
  itemId: string,
  body: unknown,
  requestId: string,
  exec?: Executor,
): Promise<CategoryItemDTO> {
  await manager(accountId)
  const type = typeOf(rawType)
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  const keys = Object.keys(input)
  for (const key of keys)
    if (!['label', 'sort_order', 'status'].includes(key)) throw invalid(key, 'not_accepted')
  if (keys.length === 0) throw invalid('body', 'empty')
  if ('label' in input) {
    if (!categoryChangeAllowed(type, 'label')) throw invalid('label', 'not_allowed')
    if (typeof input.label !== 'string' || !input.label.trim()) throw invalid('label', 'required')
    if (input.label.trim().length > LABEL_MAX) throw invalid('label', 'too_long')
  }
  if ('sort_order' in input) {
    if (!categoryChangeAllowed(type, 'order')) throw invalid('sort_order', 'not_allowed')
    if (
      !Number.isInteger(input.sort_order) ||
      (input.sort_order as number) < 0 ||
      (input.sort_order as number) > ORDER_MAX
    )
      throw invalid('sort_order', 'invalid')
  }
  if ('status' in input) {
    if (!categoryChangeAllowed(type, 'archive')) throw invalid('status', 'not_allowed')
    if (!(CATEGORY_STATUSES as readonly unknown[]).includes(input.status))
      throw invalid('status', 'invalid')
  }
  if (!isUuid(itemId)) throw notFound()

  return inTransaction(exec, async (tx) => {
    const [row] = await tx<{ id: string; label: string; sort_order: number; status: string }>(
      `SELECT id::text, label, sort_order, status::text AS status FROM vocabulary_items
        WHERE id = $1 AND type_code = $2 FOR UPDATE`,
      [itemId, type],
    )
    if (!row) throw notFound()
    const label = 'label' in input ? (input.label as string).trim() : row.label
    const order = 'sort_order' in input ? (input.sort_order as number) : row.sort_order
    const status = 'status' in input ? (input.status as string) : row.status
    const relabel = label !== row.label || order !== row.sort_order
    if (relabel || status !== row.status) {
      await tx(
        `UPDATE vocabulary_items SET label = $2, sort_order = $3, status = $4::vocab_status, updated_at = now()
          WHERE id = $1`,
        [row.id, label, order, status],
      )
      if (relabel) {
        await writeAdminAudit(tx, {
          actorAccountId: accountId,
          action: 'VOCABULARY_ITEM_UPDATED',
          target: { type: 'vocabulary_item', id: row.id },
          before: { sort_order: row.sort_order },
          after: { type, sort_order: order, label_changed: label !== row.label },
          requestId,
        })
      }
      if (status !== row.status) {
        await writeAdminAudit(tx, {
          actorAccountId: accountId,
          action: status === 'ARCHIVED' ? 'VOCABULARY_ITEM_ARCHIVED' : 'VOCABULARY_ITEM_ACTIVATED',
          target: { type: 'vocabulary_item', id: row.id },
          before: { status: row.status },
          after: { type, status },
          requestId,
        })
      }
    }
    return (await items(tx, type)).find((i) => i.id === row.id)!
  })
}

/**
 * PUT /ops/categories/{type}/order `{ ids: [...] }` — the whole type's order at
 * once: `ids` must name every item of the type exactly once; positions become
 * 10, 20, 30… All items are locked (in id order), so two reorders serialize and
 * the result is always one of them, never a mix.
 */
export async function reorderCategories(
  accountId: string,
  rawType: string,
  body: unknown,
  requestId: string,
): Promise<{ type: VocabularyType; items: CategoryItemDTO[] }> {
  await manager(accountId)
  const type = typeOf(rawType)
  if (!categoryChangeAllowed(type, 'order')) throw invalid('ids', 'not_allowed')
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) if (key !== 'ids') throw invalid(key, 'not_accepted')
  const ids = input.ids
  if (!Array.isArray(ids) || !ids.every((id) => isUuid(id))) throw invalid('ids', 'invalid')
  const wanted = (ids as string[]).map((id) => id.toLowerCase())
  if (new Set(wanted).size !== wanted.length) throw invalid('ids', 'duplicate')

  return withTransaction(async (tx) => {
    const current = await tx<{ id: string; sort_order: number }>(
      `SELECT id::text, sort_order FROM vocabulary_items WHERE type_code = $1 ORDER BY id FOR UPDATE`,
      [type],
    )
    const known = new Set(current.map((c) => c.id))
    if (wanted.length !== current.length || !wanted.every((id) => known.has(id)))
      throw invalid('ids', 'incomplete')
    const before = new Map(current.map((c) => [c.id, c.sort_order]))
    for (const [index, id] of wanted.entries()) {
      const order = (index + 1) * 10
      if (before.get(id) === order) continue
      await tx(`UPDATE vocabulary_items SET sort_order = $2, updated_at = now() WHERE id = $1`, [
        id,
        order,
      ])
      await writeAdminAudit(tx, {
        actorAccountId: accountId,
        action: 'VOCABULARY_ITEM_UPDATED',
        target: { type: 'vocabulary_item', id },
        before: { sort_order: before.get(id) ?? null },
        after: { type, sort_order: order, label_changed: false },
        requestId,
      })
    }
    return { type, items: await items(tx, type) }
  })
}
