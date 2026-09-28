import { ApiError } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { resendMagicLink, retireMagicLinkRequest } from '@/lib/auth/magic-link'
import { deliverMagicLink } from '@/lib/auth/magic-link-email'
import { checkEmailRate } from '@/lib/auth/rate-limit'
import { devRoutesEnabled } from '@/lib/dev-routes'
import { EmailDeliveryError } from '@/lib/email/resend'

/**
 * POST /api/v1/auth/magic-link/resend — 05:187-197. Maps WF01-S02.
 * Returns refreshed resend/expiry metadata and retires the previous link.
 * TASK 22-PREVIEW-AUTH: the new link is e-mailed under the same per-address
 * limit; if the send fails it is retired too (DEC-AUTH-EMAIL-D2 / D3).
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { auth_request_id?: unknown } | null

  if (!body || typeof body.auth_request_id !== 'string') {
    throw new ApiError('AUTH_LINK_INVALID', 400, 'Unknown authentication request.')
  }

  const { response, token, email } = await resendMagicLink(
    body.auth_request_id,
    devRoutesEnabled() ? undefined : checkEmailRate,
  )
  try {
    await deliverMagicLink(email, token, new URL(request.url).origin)
  } catch (error) {
    if (!(error instanceof EmailDeliveryError)) throw error
    await retireMagicLinkRequest(response.request_id)
    console.error('magic-link e-mail not sent', { reason: error.reason })
    throw new ApiError('AUTH_EMAIL_DELIVERY_FAILED', 500, 'The sign-in e-mail could not be sent.')
  }
  // 202 Accepted, per 05:197.
  return withStatus(202, response)
})
