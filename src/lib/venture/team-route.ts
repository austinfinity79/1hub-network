import { unauthenticated } from '@/lib/api/errors'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * Shared by the /ventures/{ventureId}/team* handlers: the session account and
 * the path ids, read from the URL as the S05 venture route does.
 */
export async function teamRequest(request: Request) {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const parts = new URL(request.url).pathname.split('/').map(decodeURIComponent)
  const at = parts.indexOf('ventures')
  const ventureId = parts[at + 1] ?? ''
  // …/team/{membershipId} or …/team/invitations/{membershipId}/(accept|decline)
  const tail = parts.slice(at + 3)
  const membershipId = (tail[0] === 'invitations' ? tail[1] : tail[0]) ?? ''
  return { accountId: session.accountId, ventureId, membershipId }
}
