import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getVenture, updateVenture } from '@/lib/venture/venture'

/**
 * GET/PATCH /api/v1/ventures/{ventureId} — 05 §5.3, WF02-S05.
 * GET: owner or ACTIVE member (`venture:read`); anyone else 404.
 * PATCH: the owner or a member with EDIT (`venture:manage`, DEC-L2R-D7);
 * ARCHIVED read-only; `type` immutable.
 */
export const dynamic = 'force-dynamic'

const idOf = (request: Request) =>
  decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '')

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return getVenture(session.accountId, idOf(request))
})

export const PATCH = withApi(async ({ request, requestId }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  return updateVenture(session.accountId, idOf(request), body, requestId)
})
