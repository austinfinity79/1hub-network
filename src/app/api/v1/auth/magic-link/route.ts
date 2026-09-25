import { ApiError } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { requestMagicLink } from '@/lib/auth/magic-link'

/**
 * POST /api/v1/auth/magic-link — 05:157-185. Maps WF01-S01.
 *
 * Always 202 for a well-formed address, whether or not the account exists, per
 * the contract rule not to disclose account existence.
 *
 * The raw token is deliberately dropped here: it belongs in the email, never in
 * an HTTP response and never in a log line.
 */
export const dynamic = 'force-dynamic'

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first && first.length <= 45 ? first : null
}

export const POST = withApi(async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null

  if (!body || typeof body.email !== 'string') {
    throw new ApiError('AUTH_EMAIL_INVALID', 400, 'A valid email address is required.')
  }

  const { response } = await requestMagicLink(body.email, clientIp(request))
  // 202 Accepted: the link is dispatched out of band (05:168).
  return withStatus(202, response)
})
