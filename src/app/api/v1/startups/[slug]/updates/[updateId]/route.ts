import { withApi } from '@/lib/api/handler'
import { viewerOf } from '@/lib/startup/access'
import { deleteUpdate, editUpdate } from '@/lib/startup/updates'

/**
 * PATCH / DELETE /api/v1/startups/{slug}/updates/{updateId} — edit `{body}` or
 * soft-delete a post of the venture (API A18, DEC-THAO-SP-D3); owner / EDIT
 * only. A post of another venture is the same 404.
 */
export const dynamic = 'force-dynamic'

const idsOf = (request: Request) => {
  const parts = new URL(request.url).pathname.split('/')
  return [decodeURIComponent(parts[4] ?? ''), decodeURIComponent(parts[6] ?? '')] as const
}

export const PATCH = withApi(async ({ request, requestId }) => {
  const viewer = await viewerOf(request.headers)
  const [slug, id] = idsOf(request)
  const body = await request.json().catch(() => null)
  return editUpdate(viewer, slug, id, body, requestId)
})

export const DELETE = withApi(async ({ request, requestId }) => {
  const viewer = await viewerOf(request.headers)
  const [slug, id] = idsOf(request)
  return deleteUpdate(viewer, slug, id, requestId)
})
