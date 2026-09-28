import { isIP } from 'node:net'

import { ApiError } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { requestMagicLink } from '@/lib/auth/magic-link'
import { deliverMagicLink } from '@/lib/auth/magic-link-email'
import { isProvisioned } from '@/lib/auth/provisioning'
import { checkEmailRate, checkIpRate } from '@/lib/auth/rate-limit'
import { isPlausibleEmail, normalizeEmail } from '@/lib/auth/tokens'
import { withTransaction, type Executor } from '@/lib/db/client'
import { devRoutesEnabled } from '@/lib/dev-routes'
import { EmailDeliveryError } from '@/lib/email/resend'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/auth/magic-link — 05:157-185. Maps WF01-S01.
 *
 * TASK 22-PREVIEW-AUTH (DEC-AUTH-EMAIL-D1…D3): Internal Alpha is invite-only.
 * An address that is neither an account nor on the launch roster answers 403
 * AUTH_ACCOUNT_NOT_PROVISIONED and gets no token and no account; this replaces
 * the contract's "do not disclose whether an account exists" rule on this
 * endpoint. A provisioned address gets 202 and the link by e-mail. Sends are
 * rate-limited per address and per IP (AUTH_RATE_LIMITED). If the e-mail cannot
 * be sent the token is rolled back and the answer is AUTH_EMAIL_DELIVERY_FAILED.
 *
 * The raw token goes into the e-mail only, never into an HTTP response or a
 * log line.
 *
 * IDEMPOTENCY (M0-T10). 05:56 lists this operation as one of the seven that
 * require an `Idempotency-Key`. When the header is present the request runs
 * through the durable store, so a retry returns the first response and issues no
 * second link.
 *
 * When the header is ABSENT the request is still processed. That leniency is a
 * PROVISIONAL decision, not a reading of the contract: rejecting would need an
 * error code for a missing key, and 05:48-63 names none. The choice is recorded
 * in docs/implementation/IDEMPOTENCY_STORE_P0.md and is the smaller of the two,
 * because inventing a public error code is the harder thing to undo.
 */
export const dynamic = 'force-dynamic'

/**
 * `request_ip` is an `inet` column: only a plain IPv4 / IPv6 literal is kept.
 * Anything else a proxy may forward ("unknown", "ip:port", an IPv6 zone id) is
 * dropped rather than failing the request (the contract answers 202 / 429 only).
 */
function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first && isIP(first) !== 0 && !first.includes('%') ? first : null
}

/** Issues the link inside the caller's transaction and e-mails it; a failed send rolls it back. */
async function issueAndSend(email: string, ip: string | null, origin: string, exec: Executor) {
  const { response, token, email: normalized } = await requestMagicLink(email, ip, exec)
  try {
    await deliverMagicLink(normalized, token, origin)
  } catch (error) {
    if (!(error instanceof EmailDeliveryError)) throw error
    console.error('magic-link e-mail not sent', { reason: error.reason })
    throw new ApiError('AUTH_EMAIL_DELIVERY_FAILED', 500, 'The sign-in e-mail could not be sent.')
  }
  return response
}

export const POST = withApi(async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null

  if (!body || typeof body.email !== 'string') {
    throw new ApiError('AUTH_EMAIL_INVALID', 400, 'A valid email address is required.')
  }

  const email = body.email
  const ip = clientIp(request)
  // Servers only: locally `next start` stamps every request with one loopback address.
  if (!devRoutesEnabled()) checkIpRate(ip)
  if (!isPlausibleEmail(email)) {
    throw new ApiError('AUTH_EMAIL_INVALID', 400, 'A valid email address is required.')
  }
  if (!(await isProvisioned(email))) {
    throw new ApiError(
      'AUTH_ACCOUNT_NOT_PROVISIONED',
      403,
      'This e-mail has not been granted Internal Alpha access.',
    )
  }
  // Servers only: local / CI dev sign-ins issue many links per persona.
  if (!devRoutesEnabled()) await checkEmailRate(normalizeEmail(email))
  const origin = new URL(request.url).origin
  const key = readIdempotencyKey(request.headers)

  if (!key) {
    const response = await withTransaction((exec) => issueAndSend(email, ip, origin, exec))
    // 202 Accepted: the link is dispatched out of band (05:168).
    return withStatus(202, response)
  }

  // Fingerprint the NORMALISED address, so that the same mailbox written in a
  // different case replays rather than being reported as a different request.
  const outcome = await runIdempotent({
    key,
    operation: 'auth.magic-link.request',
    // Unauthenticated by definition: this is the endpoint that starts a session.
    actorAccountId: null,
    fingerprint: fingerprintRequest({ email: normalizeEmail(email) }),
    run: async (exec) => ({ status: 202, body: await issueAndSend(email, ip, origin, exec) }),
  })

  return withStatus(outcome.status, outcome.body)
})
