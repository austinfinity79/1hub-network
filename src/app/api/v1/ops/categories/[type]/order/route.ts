import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { reorderCategories } from '@/lib/admin/category-ops'

/**
 * PUT /api/v1/ops/categories/{type}/order — 05 §28 (A11): `{ ids }` naming
 * every item of the type once; positions 10, 20, 30… in one transaction.
 */
export const dynamic = 'force-dynamic'

export const PUT = withApi(async ({ request, requestId }) => {
  const { accountId, ids } = await adminRequest(request, 'categories')
  const body: unknown = await request.json().catch(() => undefined)
  return reorderCategories(accountId, ids[0]!, body, requestId)
})
