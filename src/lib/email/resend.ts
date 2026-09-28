/**
 * TASK 22-PREVIEW-AUTH — outbound e-mail through Resend's HTTPS API (no SDK).
 *
 * Server-only: it reads RESEND_API_KEY and EMAIL_FROM from the process
 * environment and is imported only by route handlers. The key never leaves
 * this module: it is not logged, not returned and not part of any error.
 * A failed send throws; nothing reports a send that did not happen.
 */

const RESEND_URL = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

export type OutboundEmail = { to: string; subject: string; html: string; text: string }

/** `reason` is safe to log: no key, no recipient, no body. */
export class EmailDeliveryError extends Error {
  constructor(readonly reason: string) {
    super(`e-mail delivery failed: ${reason}`)
    this.name = 'EmailDeliveryError'
  }
}

export function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendWithResend(message: OutboundEmail): Promise<{ id: string }> {
  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!key || !from) throw new EmailDeliveryError('not_configured')

  let response: Response
  try {
    response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new EmailDeliveryError('network')
  }

  const body = (await response.json().catch(() => null)) as { id?: unknown; name?: unknown } | null
  if (!response.ok) {
    const name = typeof body?.name === 'string' ? body.name.replace(/[^a-z_]/gi, '') : 'unknown'
    throw new EmailDeliveryError(`provider_${response.status}_${name}`)
  }
  if (typeof body?.id !== 'string') throw new EmailDeliveryError('provider_no_id')
  return { id: body.id }
}
