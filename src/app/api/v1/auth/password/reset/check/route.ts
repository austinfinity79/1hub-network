import { withApi } from '@/lib/api/handler'
import { checkPasswordReset } from '@/lib/auth/credentials'
import { requireJsonBody } from '@/lib/auth/require-json'

/**
 * POST /api/v1/auth/password/reset/check — US-01.04. Body: token. 204 while the
 * link is usable; 400 AUTH_RESET_LINK_EXPIRED / _INVALID otherwise. Read-only:
 * WF01-S11 calls it on open so a spent link says so before a password is typed.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request }) => {
  requireJsonBody(request)
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  await checkPasswordReset(body?.token)
  return undefined
})
