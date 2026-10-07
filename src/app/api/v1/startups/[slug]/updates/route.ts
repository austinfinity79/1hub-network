import { notFound } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { startupAccess, viewerOf } from '@/lib/startup/access'
import { postUpdate, readUpdates } from '@/lib/startup/updates'

/**
 * GET / POST /api/v1/startups/{slug}/updates — Updates v1 (API A18,
 * DEC-THAO-SP-D3). GET: the posts of a startup the viewer may see. POST
 * `{body}`: a plain-text post, owner / EDIT only. No notification.
 */
export const dynamic = 'force-dynamic'

const slugOf = (request: Request) =>
  decodeURIComponent(new URL(request.url).pathname.split('/')[4] ?? '')

export const GET = withApi(async ({ request }) => {
  const access = await startupAccess(slugOf(request), await viewerOf(request.headers))
  if (!access) throw notFound()
  return readUpdates(access)
})

export const POST = withApi(async ({ request, requestId }) => {
  const viewer = await viewerOf(request.headers)
  const body = await request.json().catch(() => null)
  return postUpdate(viewer, slugOf(request), body, requestId)
})
