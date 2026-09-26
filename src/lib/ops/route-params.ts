import { unauthenticated } from '@/lib/api/errors'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * Shared by the /ops/organizations/{orgId}/… handlers: the session account and
 * the path segments after the organization id, read from the URL.
 */
export async function opsRequest(request: Request) {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const parts = new URL(request.url).pathname.split('/').map(decodeURIComponent)
  const at = parts.indexOf('organizations')
  return { accountId: session.accountId, orgId: parts[at + 1] ?? '', rest: parts.slice(at + 2) }
}
