import { withApi } from '@/lib/api/handler'
import { adminRequest } from '@/lib/admin/admin-route'
import { listCategories } from '@/lib/admin/category-ops'

/**
 * GET /api/v1/ops/categories/{type} — 05 §28 (A11). Every item of one existing
 * vocabulary type, ACTIVE and ARCHIVED, with its usage count
 * (`vocabulary:manage`; anyone else 403; unknown type 404).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ids } = await adminRequest(request, 'categories')
  return listCategories(accountId, ids[0]!)
})
