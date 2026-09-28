import { devRoutesEnabled } from '@/lib/dev-routes'
import {
  EmailDeliveryError,
  resendConfigured,
  sendWithResend,
  type OutboundEmail,
} from '@/lib/email/resend'

import { MAGIC_LINK_EXPIRES_IN_SECONDS } from './config'
import { maskEmail } from './tokens'

/**
 * TASK 22-PREVIEW-AUTH — delivery of the existing magic link by e-mail
 * (DEC-AUTH-EMAIL-D3). Only the delivery step is new: the token, its hash, the
 * 15-minute expiry, single use and the callback are unchanged.
 *
 * Transport: Resend when RESEND_API_KEY and EMAIL_FROM are set. With dev routes
 * on (local / CI only, never on a server) and no key, the message goes to an
 * in-memory outbox that `/dev/outbox` reads, so tests can open the real link.
 * Otherwise delivery fails closed.
 */

declare global {
  var __hubDevOutbox: Map<string, { link: string; at: number }> | undefined
}

const outbox = (): Map<string, { link: string; at: number }> =>
  (globalThis.__hubDevOutbox ??= new Map())

/** The public origin for links in e-mail: APP_PUBLIC_BASE_URL, HTTPS only. */
export function publicBaseUrl(requestOrigin?: string): string {
  const configured = process.env.APP_PUBLIC_BASE_URL?.trim()
  if (configured) {
    let url: URL
    try {
      url = new URL(configured)
    } catch {
      throw new EmailDeliveryError('base_url_invalid')
    }
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    if (url.protocol === 'https:' || (local && devRoutesEnabled())) return url.origin
    throw new EmailDeliveryError('base_url_not_https')
  }
  // Local / CI only: without a configured origin the link points back to this server.
  if (devRoutesEnabled() && requestOrigin) return new URL(requestOrigin).origin
  throw new EmailDeliveryError('base_url_not_configured')
}

export function magicLinkUrl(token: string, base: string): string {
  return `${base}/auth/callback?token=${encodeURIComponent(token)}`
}

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function renderMagicLinkEmail(to: string, link: string): OutboundEmail {
  const minutes = Math.round(MAGIC_LINK_EXPIRES_IN_SECONDS / 60)
  const expiry = `Liên kết có hiệu lực trong ${minutes} phút và chỉ dùng được một lần.`
  const ignore = 'Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này.'
  const text = [
    'Bạn vừa yêu cầu đăng nhập 1hub.network.',
    '',
    `Mở liên kết này để đăng nhập: ${link}`,
    '',
    expiry,
    ignore,
  ].join('\n')
  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#efefef;font-family:Arial,Helvetica,sans-serif;color:#170002">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">Đăng nhập 1hub.network</td></tr>
        <tr><td style="font-size:15px;line-height:22px;padding-bottom:24px">Bạn vừa yêu cầu đăng nhập 1hub.network. Nhấn nút dưới đây để tiếp tục.</td></tr>
        <tr><td style="padding-bottom:24px"><a href="${escapeAttr(link)}" style="display:inline-block;background:#fc523c;color:#160002;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:8px">Đăng nhập</a></td></tr>
        <tr><td style="font-size:13px;line-height:20px;color:#534041">${expiry} ${ignore}</td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`
  return { to, subject: 'Đăng nhập 1hub.network', html, text }
}

/** Sends the link for `token` to `email`; throws EmailDeliveryError when nothing was sent. */
export async function deliverMagicLink(
  email: string,
  token: string,
  requestOrigin?: string,
): Promise<void> {
  const link = magicLinkUrl(token, publicBaseUrl(requestOrigin))
  if (resendConfigured()) {
    const { id } = await sendWithResend(renderMagicLinkEmail(email, link))
    // Masked address and provider id only; never the link, token or key.
    console.info('magic-link e-mail accepted', { provider: 'resend', id, to: maskEmail(email) })
    return
  }
  if (devRoutesEnabled()) {
    outbox().set(email, { link, at: Date.now() })
    return
  }
  throw new EmailDeliveryError('not_configured')
}

/** Dev / test only: the last link "sent" to `email`, or null. */
export function readDevOutbox(email: string): { link: string } | null {
  if (!devRoutesEnabled()) return null
  const entry = outbox().get(email)
  return entry ? { link: entry.link } : null
}
