import { ApiError } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { resendMagicLink } from '@/lib/auth/magic-link'

/**
 * POST /api/v1/auth/magic-link/resend — 05:187-197. Maps WF01-S02.
 * Returns refreshed resend/expiry metadata and retires the previous link.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { auth_request_id?: unknown } | null

  if (!body || typeof body.auth_request_id !== 'string') {
    throw new ApiError('AUTH_LINK_INVALID', 400, 'Unknown authentication request.')
  }

  const { response } = await resendMagicLink(body.auth_request_id)
  // 202 Accepted, per 05:197.
  return withStatus(202, response)
})
