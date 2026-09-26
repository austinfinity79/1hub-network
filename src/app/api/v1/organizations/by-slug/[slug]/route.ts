import { withApi } from '@/lib/api/handler'
import { getPublicOrganization } from '@/lib/public/organization'

/**
 * GET /api/v1/organizations/by-slug/{slug} — 05 §8.5, WF03-S09.
 * Public: no session required, and a session changes nothing (one projection
 * for every caller, DEC-WF03-S09-D1). Unknown, unpublished or non-operational
 * organizations are the same 404.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const parts = new URL(request.url).pathname.split('/')
  const slug = decodeURIComponent(parts[parts.indexOf('by-slug') + 1] ?? '')
  return getPublicOrganization(slug)
})
