import { withApi, withStatus } from '@/lib/api/handler'
import { clientIp } from '@/lib/auth/client-ip'
import { requestPasswordReset, retirePasswordReset } from '@/lib/auth/credentials'
import { deliverPasswordReset } from '@/lib/auth/password-reset-email'
import { withTransaction } from '@/lib/db/client'
import { requireJsonBody } from '@/lib/auth/require-json'

import { dispatchReset } from './dispatch'

/**
 * POST /api/v1/auth/password/forgot — S1-UAT-01, US-01.04 step 1-2.
 * Body: identifier (username or e-mail). Always 202 with
 * `{ request_id, email_masked, resend_after_seconds: 45, expires_in_seconds: 900 }`:
 * the same shape whether or not an account exists, and the e-mail is sent
 * AFTER the response is decided, so neither body nor timing tells.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request }) => {
  requireJsonBody(request)
  const ip = clientIp(request)
  const body = (await request.json().catch(() => null)) as { identifier?: unknown } | null
  const identifier = typeof body?.identifier === 'string' ? body.identifier : ''

  const issued = await withTransaction((exec) => requestPasswordReset(identifier, ip, exec))
  dispatchReset(issued, new URL(request.url).origin, deliverPasswordReset, retirePasswordReset)
  return withStatus(202, issued.response)
})
