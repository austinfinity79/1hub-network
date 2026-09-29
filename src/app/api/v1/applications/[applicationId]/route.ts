import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { getApplication, saveApplicationAnswers } from '@/lib/application/application'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * GET/PATCH /api/v1/applications/{applicationId} — 05 §21 (DEC-L5-D3).
 * GET: the venture's owner only; anyone else the same 404. A SUBMITTED
 * application reads its snapshot.
 * PATCH `{ answers }`: the owner saves a DRAFT; SUBMITTED is 409.
 */
export const dynamic = 'force-dynamic'

const idOf = (request: Request) =>
  decodeURIComponent(new URL(request.url).pathname.split('/').pop() ?? '')

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return getApplication(session.accountId, idOf(request))
})

export const PATCH = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  return saveApplicationAnswers(session.accountId, idOf(request), body)
})
