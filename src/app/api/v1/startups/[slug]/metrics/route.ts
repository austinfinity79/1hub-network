import { notFound } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { startupAccess, viewerOf } from '@/lib/startup/access'
import { readMetrics, recordMetric } from '@/lib/startup/metrics'

/**
 * GET / POST /api/v1/startups/{slug}/metrics — Metrics v1 (API A18,
 * DEC-THAO-SP-D2). GET: the metrics the viewer may see (PUBLIC; PRIVATE too for
 * the owner and editors). POST `{metric, year, quarter, value}`: a quarterly
 * value, owner / EDIT only. Unknown or hidden startup: 404.
 */
export const dynamic = 'force-dynamic'

const slugOf = (request: Request) =>
  decodeURIComponent(new URL(request.url).pathname.split('/')[4] ?? '')

export const GET = withApi(async ({ request }) => {
  const access = await startupAccess(slugOf(request), await viewerOf(request.headers))
  if (!access) throw notFound()
  return readMetrics(access)
})

export const POST = withApi(async ({ request, requestId }) => {
  const viewer = await viewerOf(request.headers)
  const body = await request.json().catch(() => null)
  return recordMetric(viewer, slugOf(request), body, requestId)
})
