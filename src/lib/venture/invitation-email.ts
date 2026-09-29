import { publicBaseUrl } from '@/lib/auth/magic-link-email'
import { maskEmail } from '@/lib/auth/tokens'
import { devRoutesEnabled } from '@/lib/dev-routes'
import {
  EmailDeliveryError,
  resendConfigured,
  sendWithResend,
  type OutboundEmail,
} from '@/lib/email/resend'

/**
 * WF02 team invitation by e-mail (DEC-L2R-D8; BA row 90, BR-NOT-01).
 *
 * The message tells the invitee that an invitation waits and where to find it.
 * It carries no token: the invitation is accepted by the signed-in account
 * whose address it was sent to, on "Dự án & startup của tôi". The text is built
 * from the sentence ME7 draws and is pending PO copy review (D-E1).
 *
 * Transport as for the sign-in link: Resend when configured; with dev routes
 * on (local / CI only) an in-memory outbox; otherwise delivery fails closed.
 */

export type InvitationNotice = {
  to: string
  venture: { name: string; type: string }
  role_label: string | null
  permission: 'EDIT' | 'VIEW'
}

export const PERMISSION_LABELS = { OWNER: 'Chủ sở hữu', EDIT: 'Biên tập', VIEW: 'Xem' } as const

type Stored = { subject: string; text: string; link: string; at: number }

declare global {
  var __hubDevInvitationOutbox: Map<string, Stored> | undefined
}

const outbox = (): Map<string, Stored> => (globalThis.__hubDevInvitationOutbox ??= new Map())

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** One line, so a name can never add a header or a second line to the subject. */
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim()

/** "AgriLink mời bạn vào đội với vai trò Cố vấn vận hành · quyền Xem" (ME7). */
export function invitationSentence(notice: Omit<InvitationNotice, 'to'>): string {
  const role = notice.role_label ? ` với vai trò ${oneLine(notice.role_label)}` : ''
  return `${oneLine(notice.venture.name)} mời bạn vào đội${role} · quyền ${PERMISSION_LABELS[notice.permission]}`
}

export function renderInvitationEmail(notice: InvitationNotice, link: string): OutboundEmail {
  const sentence = `${invitationSentence(notice)}.`
  const how =
    'Đăng nhập 1hub.network bằng địa chỉ email này để xem lời mời. Bạn chỉ vào đội sau khi chấp nhận.'
  const ignore = 'Nếu bạn không biết đội này, hãy bỏ qua email này.'
  const text = [sentence, '', `Xem lời mời: ${link}`, '', how, ignore].join('\n')
  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#efefef;font-family:Arial,Helvetica,sans-serif;color:#170002">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:20px;font-weight:600;padding-bottom:12px">Lời mời vào đội</td></tr>
        <tr><td style="font-size:15px;line-height:22px;padding-bottom:24px">${escapeHtml(sentence)}</td></tr>
        <tr><td style="padding-bottom:24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#fc523c;color:#160002;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:8px">Xem lời mời</a></td></tr>
        <tr><td style="font-size:13px;line-height:20px;color:#534041">${how} ${ignore}</td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`
  return {
    to: notice.to,
    subject: `Lời mời vào đội ${oneLine(notice.venture.name)} trên 1hub.network`,
    html,
    text,
  }
}

/** Sends the invitation notice; throws EmailDeliveryError when nothing was sent. */
export async function deliverInvitation(
  notice: InvitationNotice,
  requestOrigin?: string,
): Promise<void> {
  const link = `${publicBaseUrl(requestOrigin)}/projects`
  const message = renderInvitationEmail(notice, link)
  if (resendConfigured()) {
    const { id } = await sendWithResend(message)
    // Masked address and provider id only; never the venture or the body.
    console.info('invitation e-mail accepted', { provider: 'resend', id, to: maskEmail(notice.to) })
    return
  }
  if (devRoutesEnabled()) {
    outbox().set(notice.to, { subject: message.subject, text: message.text, link, at: Date.now() })
    return
  }
  throw new EmailDeliveryError('not_configured')
}

/** Dev / test only: the last invitation "sent" to `email`, or null. */
export function readDevInvitationOutbox(
  email: string,
): { subject: string; text: string; link: string } | null {
  if (!devRoutesEnabled()) return null
  const entry = outbox().get(email)
  return entry ? { subject: entry.subject, text: entry.text, link: entry.link } : null
}
