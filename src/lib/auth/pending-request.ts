/**
 * WF01-S01 → WF01-S02 handoff of the magic-link request state.
 *
 * WF01-S02 needs `request_id` to call POST /auth/magic-link/resend and shows
 * `email_masked`. Both arrive in the 202 body of POST /auth/magic-link (05:170).
 * No frozen source defines how the browser carries them between the two
 * screens, so the smallest carrier is used: the contract DTO, verbatim, in
 * sessionStorage for this tab only.
 *
 * What is stored is exactly the public 202 response. It contains no token and
 * no raw address: the magic-link token never reaches the browser at all, and
 * the address is already masked by the server. Nothing here is trusted for
 * authorization; WF01-S02 may still be opened without it.
 */

export type MagicLinkRequestAccepted = {
  request_id: string
  email_masked: string
  resend_after_seconds: number
  expires_in_seconds: number
  /**
   * S1-UAT-01: which e-mail WF01-S02 is confirming. Absent = the magic link
   * (compatibility); 'reset' = the forgot-password link (US-01.04), whose
   * 202 body has the same four fields.
   */
  kind?: 'reset'
}

export const PENDING_REQUEST_STORAGE_KEY = '1hub.auth.pending-request'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isAccepted(value: unknown): value is MagicLinkRequestAccepted {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.request_id === 'string' &&
    typeof v.email_masked === 'string' &&
    typeof v.resend_after_seconds === 'number' &&
    typeof v.expires_in_seconds === 'number' &&
    (v.kind === undefined || v.kind === 'reset')
  )
}

/** Stores only the four contract fields (and the kind), dropping anything else the body carried. */
export function savePendingRequest(storage: StorageLike, accepted: MagicLinkRequestAccepted): void {
  const { request_id, email_masked, resend_after_seconds, expires_in_seconds, kind } = accepted
  storage.setItem(
    PENDING_REQUEST_STORAGE_KEY,
    JSON.stringify({
      request_id,
      email_masked,
      resend_after_seconds,
      expires_in_seconds,
      ...(kind === 'reset' ? { kind } : {}),
    }),
  )
}

export function readPendingRequest(storage: StorageLike): MagicLinkRequestAccepted | null {
  const raw = storage.getItem(PENDING_REQUEST_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isAccepted(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearPendingRequest(storage: StorageLike): void {
  storage.removeItem(PENDING_REQUEST_STORAGE_KEY)
}

export { isAccepted as isMagicLinkRequestAccepted }
