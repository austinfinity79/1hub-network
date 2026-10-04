import type { Executor } from '@/lib/db/client'

/**
 * ADMIN-PROD-02 — in-system notification hook (ADMIN-PROD-01 §22).
 *
 * Two producers only: a role verification decision and a venture review
 * decision, each notifying the requester / owner. A verification SUBMISSION is
 * not a row: it shows in the receiving handlers' queue count (no per-handler
 * notice). Feedback has the weekly summary only. No e-mail, push, Slack or
 * notification centre. The row carries ids, never text, so a notice cannot leak
 * a reason or a title: the reader loads the resource under its own rules.
 */

export const NOTIFICATION_TYPES = [
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VENTURE_REVIEW_APPROVED',
  'VENTURE_REVIEW_REJECTED',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_RESOURCE: Record<
  NotificationType,
  'role_verification_request' | 'venture_review'
> = {
  VERIFICATION_APPROVED: 'role_verification_request',
  VERIFICATION_REJECTED: 'role_verification_request',
  VENTURE_REVIEW_APPROVED: 'venture_review',
  VENTURE_REVIEW_REJECTED: 'venture_review',
}

/** The notice a decision produces; null for every other transition. */
export function decisionNotification(
  subject: 'VERIFICATION' | 'VENTURE_REVIEW',
  status: string,
): NotificationType | null {
  if (status !== 'APPROVED' && status !== 'REJECTED') return null
  return `${subject}_${status}` as NotificationType
}

/** Writes one notice in the caller's transaction; returns its id. */
export async function notify(
  exec: Executor,
  input: { recipientAccountId: string; type: NotificationType; resourceId: string },
): Promise<string> {
  const [row] = await exec<{ id: string }>(
    `INSERT INTO notifications (recipient_account_id, type, resource_type, resource_id)
     VALUES ($1, $2, $3, $4) RETURNING id::text`,
    [input.recipientAccountId, input.type, NOTIFICATION_RESOURCE[input.type], input.resourceId],
  )
  return row!.id
}
