import { asQueryError, libraryParams, libraryRoute, libraryViewer } from '@/lib/library/library-api'
import { foundersBody } from '@/lib/library/library-bodies'

/**
 * GET /api/v1/library/founders — API §25.1 (WF06-PROD-03, DEC-W6P-D03).
 * Session optional. A member (live session, ACTIVE account) gets the owners of
 * listed startups whose PROFILE_DISCOVERY allows it; a guest gets `items: []`
 * with `restricted: true`. `?q=&domain_id=&sort=NAME&cursor=&limit=`.
 */
export const dynamic = 'force-dynamic'

export const GET = libraryRoute(async ({ request }) => {
  const params = libraryParams(request.url, {
    single: ['q', 'sort', 'cursor', 'limit'],
    multi: ['domain_id'],
  })
  const q = params.keyword()
  const domainIds = params.ids('domain_id')
  params.choice('sort', ['NAME'] as const, 'NAME')
  const { cursor, limit } = params.page()
  params.check()

  const viewer = await libraryViewer(request.headers)
  return asQueryError(() => foundersBody(viewer, { q, domainIds, cursor, limit }))
})
