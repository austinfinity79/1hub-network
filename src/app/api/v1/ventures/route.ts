import { unauthenticated } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { createVenture } from '@/lib/venture/venture'

/**
 * POST /api/v1/ventures — 05 §5.3, WF02-S05. Body `{ type, name, summary,
 * domain_ids, region_id }` (DEC-WF02-H6). 201 with the new DRAFT venture; the
 * owner is the session's profile (DEC-WF02-S05-G2/G5).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  return withStatus(201, await createVenture(session.accountId, body))
})
