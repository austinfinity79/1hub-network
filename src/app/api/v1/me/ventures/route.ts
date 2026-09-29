import { listEnvelope } from '@/lib/api/envelope'
import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { listOwnVentures } from '@/lib/venture/venture'

/**
 * GET /api/v1/me/ventures — 05 §5.3, WF02-S08 (ME7). The ventures the session's
 * profile owns or belongs to as an ACTIVE member. The profile is derived from
 * the session only: query parameters are ignored, so no caller can list
 * another member's ventures.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const items = await listOwnVentures(session.accountId)
  return listEnvelope(items, { nextCursor: null, limit: items.length })
})
