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
 * The copy is the PO's approved template (DEC-PDF-D4): the subject, one
 * sentence naming the inviter, the venture and the role, and "Xem lời mời".
 * Nothing else is added. The message carries no token and no id: the
 * invitation is accepted by the signed-in account whose address it was sent
 * to, on "Dự án & startup của tôi". Without a role the sentence ends at the
 * venture.
 *
 * Transport as for the sign-in link: Resend when configured; with dev routes
 * on (local / CI only) an in-memory outbox; otherwise delivery fails closed.
 */

export type InvitationNotice = {
  to: string
  /** The inviter's display name. */
  inviter: string
  venture: { name: string; type: string }
  role_label: string | null
  permission: 'EDIT' | 'VIEW'
}

type Stored = { subject: string; text: string; link: string; at: number }

declare global {
  var __hubDevInvitationOutbox: Map<string, Stored> | undefined
}

const outbox = (): Map<string, Stored> => (globalThis.__hubDevInvitationOutbox ??= new Map())

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** One line, so a name can never add a header or a second line to the subject. */
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim()

/** Shown when a profile has no name to give (onboarding requires one). */
const NO_NAME = 'Một thành viên'

export const INVITATION_CTA = 'Xem lời mời'

export function invitationSubject(notice: Pick<InvitationNotice, 'venture'>): string {
  return `Bạn được mời tham gia ${oneLine(notice.venture.name)} trên 1hub.network`
}

/** "Chi Đặng mời bạn tham gia Tracely với vai trò Co-founder." */
export function invitationBody(notice: Omit<InvitationNotice, 'to' | 'permission'>): string {
  const inviter = oneLine(notice.inviter) || NO_NAME
  const role = notice.role_label ? ` với vai trò ${oneLine(notice.role_label)}` : ''
  return `${inviter} mời bạn tham gia ${oneLine(notice.venture.name)}${role}.`
}

export function renderInvitationEmail(notice: InvitationNotice, link: string): OutboundEmail {
  const body = invitationBody(notice)
  const text = [body, '', `${INVITATION_CTA}: ${link}`].join('\n')
  const html = `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:24px;background:#efefef;font-family:Arial,Helvetica,sans-serif;color:#170002">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
        <tr><td style="font-size:15px;line-height:22px;padding-bottom:24px">${escapeHtml(body)}</td></tr>
        <tr><td><a href="${escapeHtml(link)}" style="display:inline-block;background:#fc523c;color:#160002;text-decoration:none;font-weight:600;font-size:15px;padding:13px 24px;border-radius:8px">${INVITATION_CTA}</a></td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`
  return { to: notice.to, subject: invitationSubject(notice), html, text }
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
