import { unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { getDeclaredRoles, saveDeclaredRoles } from '@/lib/onboarding/roles'

/**
 * GET / PUT /api/v1/me/onboarding/roles — DEC-L1R-D5. Maps ACC-08.
 * The session's own self-declared ecosystem roles and, while onboarding is
 * open, the HUB units it names. PUT `{ roles, hub_claims }` replaces both and
 * grants nothing: no membership, leadership, RoleAssignment or capability.
 * 422 PROFILE_VALIDATION_FAILED for an unsupported role, an unavailable unit
 * or a call after onboarding is complete.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  return getDeclaredRoles(session.accountId)
})

export const PUT = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()
  const body: unknown = await request.json().catch(() => null)
  return saveDeclaredRoles(session.accountId, body)
})
