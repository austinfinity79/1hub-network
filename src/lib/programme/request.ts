import { unauthenticated } from '@/lib/api/errors'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'

/**
 * Shared by the /programmes handlers: the session account and the programme id
 * from the URL. A malformed escape (`%E0%A4%A`) yields an empty id, which the
 * service answers with the canonical 404 instead of a URIError 500.
 */
export async function programmeRequest(request: Request) {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const parts = new URL(request.url).pathname.split('/')
  const raw = parts[parts.indexOf('programmes') + 1] ?? ''
  let programmeId = ''
  try {
    programmeId = decodeURIComponent(raw)
  } catch {
    programmeId = ''
  }
  return { accountId: session.accountId, programmeId }
}
