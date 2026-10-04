import { unauthenticated } from '@/lib/api/errors'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * Shared by the /ops/verification-requests handlers: the session account and the
 * request id segment, read from the URL. The id is only the resource asked for;
 * scope comes from the actor's grants on the server.
 */
export async function verificationRequest(request: Request) {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const parts = new URL(request.url).pathname.split('/').map(decodeURIComponent)
  const at = parts.indexOf('verification-requests')
  return { accountId: session.accountId, requestId: parts[at + 1] ?? '' }
}
