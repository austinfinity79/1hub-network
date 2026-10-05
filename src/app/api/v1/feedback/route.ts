import { ApiError } from '@/lib/api/errors'
import { withApi, withStatus } from '@/lib/api/handler'
import { readIdempotencyKey } from '@/lib/api/idempotency'
import { clientIp } from '@/lib/auth/client-ip'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import {
  assertFeedbackRate,
  buildFeedbackContext,
  parseFeedbackForm,
  storeFeedback,
} from '@/lib/feedback/submit'
import { createHash } from 'node:crypto'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'

/**
 * POST /api/v1/feedback — S1-UAT-02, FB-01 (US-X.01; API 05 §6, amendment
 * A13). Multipart: `type`, `content`, optional `screenshot`, optional `email`
 * (guests only), and the place it was sent from (`route`, `viewport`,
 * `locale`). Guests and members alike; the sender is the session, never a
 * body field. `201 { id, status: "RECEIVED", submitted_at }`.
 *
 * `Idempotency-Key` is REQUIRED (05 §2.3 lists feedback submit): a retry or a
 * double click replays the first answer and stores nothing twice; and a custom
 * header cannot be sent cross-site without a CORS preflight, so it also keeps
 * other sites from filing feedback in a member's name.
 */
export const dynamic = 'force-dynamic'

export const POST = withApi(async ({ request }) => {
  const key = readIdempotencyKey(request.headers)
  if (!key) {
    throw new ApiError('FEEDBACK_VALIDATION_FAILED', 400, 'An Idempotency-Key is required.', {
      idempotency_key: 'required',
    })
  }
  const type = request.headers.get('content-type') ?? ''
  if (!/^multipart\/form-data/i.test(type)) {
    throw new ApiError('FEEDBACK_VALIDATION_FAILED', 400, 'A multipart body is required.', {
      body: 'multipart_required',
    })
  }
  const form = await request.formData().catch(() => null)
  if (!form) {
    throw new ApiError('FEEDBACK_VALIDATION_FAILED', 400, 'The body could not be read.', {
      body: 'invalid',
    })
  }

  const session = await resolveSession(readSessionToken(request.headers))
  const accountId = session?.accountId ?? null
  const input = await parseFeedbackForm(form, accountId !== null)
  const context = buildFeedbackContext(input, request.headers.get('user-agent') ?? '')

  const outcome = await runIdempotent({
    key,
    operation: 'feedback.submit',
    actorAccountId: accountId,
    fingerprint: fingerprintRequest({
      type: input.type,
      content: input.content,
      email: input.guestEmail,
      route: input.route,
      screenshot: input.screenshot
        ? createHash('sha256').update(input.screenshot.bytes).digest('hex')
        : null,
    }),
    run: async (exec) => {
      // Counted only for a new submission: a replay is not another message.
      await assertFeedbackRate(accountId, clientIp(request))
      return { status: 201, body: await storeFeedback(exec, { accountId }, input, context) }
    },
  })
  return withStatus(outcome.status, outcome.body)
})
