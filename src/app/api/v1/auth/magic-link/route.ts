import { isIP } from 'node:net'

import { ApiError } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { requestMagicLink } from '@/lib/auth/magic-link'
import { normalizeEmail } from '@/lib/auth/tokens'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/auth/magic-link — 05:157-185. Maps WF01-S01.
 *
 * Always 202 for a well-formed address, whether or not the account exists, per
 * the contract rule not to disclose account existence.
 *
 * The raw token is deliberately dropped here: it belongs in the email, never in
 * an HTTP response and never in a log line.
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

export const POST = withApi(async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null

  if (!body || typeof body.email !== 'string') {
    throw new ApiError('AUTH_EMAIL_INVALID', 400, 'A valid email address is required.')
  }

  const email = body.email
  const ip = clientIp(request)
  const key = readIdempotencyKey(request.headers)

  if (!key) {
    const { response } = await requestMagicLink(email, ip)
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
    run: async (exec) => {
      const { response } = await requestMagicLink(email, ip, exec)
      return { status: 202, body: response }
    },
  })

  return withStatus(outcome.status, outcome.body)
})
