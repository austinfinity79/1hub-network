import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getOwnProfile, updateOwnProfile } from '@/lib/profile/profile'

/**
 * GET/PATCH /api/v1/me/profile — 05 §4.3. Maps WF01-S06 and WF02-S02.
 * The profile is always the session's own; no id is taken from the client.
 */
export const dynamic = 'force-dynamic'

async function accountId(request: Request): Promise<string> {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return session.accountId
}

export const GET = withApi(async ({ request }) => getOwnProfile(await accountId(request)))

export const PATCH = withApi(async ({ request }) => {
  const id = await accountId(request)
  const body: unknown = await request.json().catch(() => null)
  return updateOwnProfile(id, body)
})
