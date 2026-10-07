import { withApi } from '@/lib/api/handler'
import { viewerOf } from '@/lib/startup/access'
import { follow, followStatus, unfollow } from '@/lib/startup/follow'

/**
 * GET / PUT / DELETE /api/v1/startups/{slug}/follow — Follow v1 (API A18,
 * DEC-THAO-SP-D4). The caller's own state only (`{following}`); a guest gets
 * 401; an unpublished startup 404. Never a count or a follower list.
 */
export const dynamic = 'force-dynamic'

const slugOf = (request: Request) =>
  decodeURIComponent(new URL(request.url).pathname.split('/')[4] ?? '')

export const GET = withApi(async ({ request }) =>
  followStatus(await viewerOf(request.headers), slugOf(request)),
)

export const PUT = withApi(async ({ request }) =>
  follow(await viewerOf(request.headers), slugOf(request)),
)

export const DELETE = withApi(async ({ request }) =>
  unfollow(await viewerOf(request.headers), slugOf(request)),
)
