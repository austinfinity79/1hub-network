import { withApi } from '@/lib/api/handler'
import { viewerOf } from '@/lib/startup/access'
import { setMetricVisibility } from '@/lib/startup/metrics'

/**
 * PATCH /api/v1/startups/{slug}/metrics/{metric} `{visibility}` — PUBLIC or
 * PRIVATE for one metric the venture reports (API A18, DEC-THAO-SP-D2); owner /
 * EDIT only.
 */
export const dynamic = 'force-dynamic'

export const PATCH = withApi(async ({ request, requestId }) => {
  const viewer = await viewerOf(request.headers)
  const parts = new URL(request.url).pathname.split('/')
  const body = await request.json().catch(() => null)
  return setMetricVisibility(
    viewer,
    decodeURIComponent(parts[4] ?? ''),
    decodeURIComponent(parts[6] ?? ''),
    body,
    requestId,
  )
})
