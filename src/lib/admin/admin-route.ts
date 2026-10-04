import { unauthenticated } from '@/lib/api/errors'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * Shared by the ADMIN-PROD-04 handlers: the session account and the path
 * segment after `collection` (`venture-reviews`, `organizations`, `access`).
 * Path ids are only the resource asked for; authority comes from the server.
 */
export async function adminRequest(request: Request, ...collections: string[]) {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const parts = new URL(request.url).pathname.split('/').map(decodeURIComponent)
  const ids = collections.map((name) => parts[parts.indexOf(name) + 1] ?? '')
  return { accountId: session.accountId, ids }
}
