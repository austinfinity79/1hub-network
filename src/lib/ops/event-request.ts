import { unauthenticated } from '@/lib/api/errors'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/** Shared by the /events/{eventId} handlers: the session account and the event id from the URL. */
export async function eventRequest(request: Request) {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const parts = new URL(request.url).pathname.split('/').map(decodeURIComponent)
  return { accountId: session.accountId, eventId: parts[parts.indexOf('events') + 1] ?? '' }
}
