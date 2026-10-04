import type { IssuedReset } from '@/lib/auth/credentials'
import { EmailDeliveryError } from '@/lib/email/resend'

/**
 * Sends the reset e-mail without holding the HTTP answer for it, so an
 * existing account (one e-mail sent) and an unknown one (none) answer in the
 * same time (task section 14, enumeration). A send that fails retires the
 * link it carried: no undelivered token stays usable. Logs a reason only.
 */
export function dispatchReset(
  issued: IssuedReset,
  origin: string,
  deliver: (email: string, token: string, origin?: string) => Promise<void>,
  retire: (requestId: string) => Promise<void>,
): void {
  if (!issued.delivery) return
  const { email, token } = issued.delivery
  void deliver(email, token, origin).catch(async (error: unknown) => {
    const reason = error instanceof EmailDeliveryError ? error.reason : 'unexpected'
    console.error('password-reset e-mail not sent', { reason })
    await retire(issued.response.request_id).catch(() => undefined)
  })
}
