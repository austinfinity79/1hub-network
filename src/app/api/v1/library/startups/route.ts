import {
  asQueryError,
  libraryList,
  libraryParams,
  libraryRoute,
  startupDTO,
} from '@/lib/library/library-api'
import { listLibraryStartups } from '@/lib/library/library-service'

/**
 * GET /api/v1/library/startups — API §25.1 (WF06-PROD-03, DEC-W6P-D02 / D04).
 * Public; the same answer for every viewer. Canonical PUBLIC ACTIVE STARTUP
 * ventures plus the TEMPORARY_EXTERNAL remainder; `?q=&domain_id=&stage_id=
 * &sort=STAGE|NAME&cursor=&limit=`. An external outage serves the canonical
 * rows with `degraded: true`.
 */
export const dynamic = 'force-dynamic'

export const GET = libraryRoute(async ({ request }) => {
  const params = libraryParams(request.url, {
    single: ['q', 'sort', 'cursor', 'limit'],
    multi: ['domain_id', 'stage_id'],
  })
  const q = params.keyword()
  const domainIds = params.ids('domain_id')
  const stageIds = params.ids('stage_id')
  const sort = params.choice('sort', ['STAGE', 'NAME'] as const, 'STAGE')
  const { cursor, limit } = params.page()
  params.check()

  const result = await asQueryError(() =>
    listLibraryStartups({ q, domainIds, stageIds, sort, cursor, limit }),
  )
  return libraryList(
    result.items.map(startupDTO),
    { nextCursor: result.nextCursor, limit },
    {
      total: result.total,
      facets: {
        domain: result.facets.domain.map(({ id, label, count }) => ({ id, label, count })),
        stage: result.facets.stage.map(({ id, code, label, count }) => ({
          id,
          code,
          label,
          count,
        })),
      },
      degraded: result.external !== 'ok',
    },
  )
})
