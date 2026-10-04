import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { updateCategory } from '@/lib/admin/category-ops'

/**
 * PATCH /api/v1/ops/categories/{type}/{itemId} — 05 §28 (A11):
 * `{ label?, sort_order?, status? }` (ACTIVE / ARCHIVED; VENTURE_STAGE label and
 * order only). No create, no delete.
 */
export const dynamic = 'force-dynamic'

export const PATCH = withApi(async ({ request, requestId }) => {
  // `/categories/{type}/{itemId}`: the type follows `categories`, the item follows the type.
  const { accountId, ids } = await adminRequest(request, 'categories')
  const type = ids[0]!
  const parts = new URL(request.url).pathname.split('/').map(decodeURIComponent)
  const itemId = parts[parts.indexOf('categories') + 2] ?? ''
  const body: unknown = await request.json().catch(() => undefined)
  return updateCategory(accountId, type, itemId, body, requestId)
})
