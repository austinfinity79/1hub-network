import { asQueryError, libraryParams, libraryRoute } from '@/lib/library/library-api'
import { problemsBody } from '@/lib/library/library-bodies'

/**
 * GET /api/v1/library/problems — API §25.1 (WF06-PROD-03, DEC-W6P-D02).
 * Public; the "Bài toán" file (TEMPORARY_EXTERNAL), server-paged.
 * `?q=&domain=&stage=&area=&sort=DEADLINE|PRIZE&cursor=&limit=`; facet values
 * are the file's own text.
 */
export const dynamic = 'force-dynamic'

export const GET = libraryRoute(async ({ request }) => {
  const params = libraryParams(request.url, {
    single: ['q', 'sort', 'cursor', 'limit'],
    multi: ['domain', 'stage', 'area'],
  })
  const q = params.keyword()
  const values = {
    domain: params.texts('domain'),
    stage: params.texts('stage'),
    area: params.texts('area'),
  }
  const sort = params.choice('sort', ['DEADLINE', 'PRIZE'] as const, 'DEADLINE')
  const { cursor, limit } = params.page()
  params.check()
  return asQueryError(() => problemsBody({ q, values, sort, cursor, limit }))
})
