import { devRoutesEnabled } from '@/lib/dev-routes'
import {
  EmailDeliveryError,
  resendConfigured,
  sendWithResend,
  type OutboundEmail,
} from '@/lib/email/resend'

import { PASSWORD_RESET_EXPIRES_IN_SECONDS } from './config'
import { publicBaseUrl } from './magic-link-email'
import { maskEmail } from './tokens'

/**
 * S1-UAT-01 — the "Đặt lại mật khẩu" e-mail (US-01.04). Same transport and the
 * same fail-closed rules as the magic-link e-mail (DEC-AUTH-EMAIL-D3): Resend
 * when configured, the local dev outbox with dev routes on, otherwise
 * EmailDeliveryError. The token travels only in the link's FRAGMENT
 * (`#token=`), so it never reaches a server log, a proxy or a Referer header;
 * the reset page reads it in the browser and posts it once.
 */

declare global {
  var __hubDevResetOutbox: Map<string, { link: string; at: number }> | undefined
}

const outbox = (): Map<string, { link: string; at: number }> =>
  (globalThis.__hubDevResetOutbox ??= new Map())

export function passwordResetUrl(token: string, base: string): string {
  return `${base}/auth/reset-password#token=${encodeURIComponent(token)}`
}

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function renderPasswordResetEmail(to: string, link: string): OutboundEmail {
  const minutes = Math.round(PASSWORD_RESET_EXPIRES_IN_SECONDS / 60)
  const expiry = `Liên kết có hiệu lực trong ${minutes} phút và chỉ dùng được một lần.`
  const ignore =
    'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại vẫn giữ nguyên.'
  const text = [
    'Bạn vừa yêu cầu đặt lại mật khẩu 1hub.network.',
    '',
    `Mở liên kết này để đặt mật khẩu mới: ${link}`,
    '',
    expiry,
    ignore,
  ].join('\n')
  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#efefef;font-family:Arial,Helvetica,sans-serif;color:#170002">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">Đặt lại mật khẩu 1hub.network</td></tr>
        <tr><td style="font-size:15px;line-height:22px;padding-bottom:24px">Bạn vừa yêu cầu đặt lại mật khẩu. Nhấn nút dưới đây để đặt mật khẩu mới.</td></tr>
        <tr><td style="padding-bottom:24px"><a href="${escapeAttr(link)}" style="display:inline-block;background:#fc523c;color:#160002;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:8px">Đặt mật khẩu mới</a></td></tr>
        <tr><td style="font-size:13px;line-height:20px;color:#534041">${expiry} ${ignore}</td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`
  return { to, subject: 'Đặt lại mật khẩu 1hub.network', html, text }
}

/** Sends the reset link; throws EmailDeliveryError when nothing was sent. */
export async function deliverPasswordReset(
  email: string,
  token: string,
  requestOrigin?: string,
): Promise<void> {
  const link = passwordResetUrl(token, publicBaseUrl(requestOrigin))
  if (resendConfigured()) {
    const { id } = await sendWithResend(renderPasswordResetEmail(email, link))
    // Masked address and provider id only; never the link, token or key.
    console.info('password-reset e-mail accepted', { provider: 'resend', id, to: maskEmail(email) })
    return
  }
  if (devRoutesEnabled()) {
    outbox().set(email, { link, at: Date.now() })
    return
  }
  throw new EmailDeliveryError('not_configured')
}

/** Dev / test only: the last reset link "sent" to `email`, or null. */
export function readDevResetOutbox(email: string): { link: string } | null {
  if (!devRoutesEnabled()) return null
  const entry = outbox().get(email)
  return entry ? { link: entry.link } : null
}
