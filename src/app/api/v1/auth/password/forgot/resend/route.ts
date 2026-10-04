import { withApi, withStatus } from '@/lib/api/handler'
import { resendPasswordReset, retirePasswordReset } from '@/lib/auth/credentials'
import { deliverPasswordReset } from '@/lib/auth/password-reset-email'
import { requireJsonBody } from '@/lib/auth/require-json'

import { dispatchReset } from '../dispatch'

/**
 * POST /api/v1/auth/password/forgot/resend — US-01.04 "Gửi lại sau 0:45".
 * Body: request_id from the forgot answer. Server-enforced 45 s spacing
 * (429 AUTH_RATE_LIMITED); the earlier link is retired by the new one.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request }) => {
  requireJsonBody(request)
  const body = (await request.json().catch(() => null)) as { request_id?: unknown } | null

  const issued = await resendPasswordReset(body?.request_id)
  dispatchReset(issued, new URL(request.url).origin, deliverPasswordReset, retirePasswordReset)
  return withStatus(202, issued.response)
})
