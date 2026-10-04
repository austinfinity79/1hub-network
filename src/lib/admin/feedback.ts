/**
 * ADMIN-PROD-02 — feedback operations foundation (PD-5; ADMIN-PROD-01 feedback
 * contract; Sprint1 FB-01). Storage: the existing `feedback_submissions`,
 * extended by migration 017 — one table shared with the Sprint1 submission.
 *
 *   lifecycle   NEW → IN_REVIEW → DONE, and NEW → DONE (duplicate / spam, with
 *               a note). No reopen.
 *   type        BUG, UX, FEATURE picked by the sender; OTHER only by an admin
 *               reclassifying (and for rows from before typing existed).
 *   sender      `account_id` / `profile_id` when signed in; a guest has neither
 *               and may leave an e-mail, used only to reply.
 *   screenshot  optional, ≤ 5 MB, in the media asset store; served to managers
 *               only and only for 90 days after submission; then the reference
 *               is cleared (`screenshot_deleted_at`) and the file removed by
 *               `runFeedbackScreenshotRetention` (every queue read) and
 *               `scripts/admin/feedback-retention.mjs` (daily, ADMIN-PROD-05).
 *               The record itself follows its own lifecycle.
 *   manage      `feedback:manage`, PLATFORM_ADMIN only. No e-mail / Slack: the
 *               weekly summary is read in the portal.
 */

export const FEEDBACK_STATUSES = ['NEW', 'IN_REVIEW', 'DONE'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_TYPES = ['BUG', 'UX', 'FEATURE', 'OTHER'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]
/** What a sender may pick; OTHER is the admin's reclassification bucket. */
export const SENDER_FEEDBACK_TYPES: readonly FeedbackType[] = ['BUG', 'UX', 'FEATURE']

export const FEEDBACK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number]

/** FB-01 bounds; the note is a technical bound. */
export const FEEDBACK_LIMITS = {
  content: 2000,
  screenshotBytes: 5 * 1024 * 1024,
  guestEmail: 254,
  resolutionNote: 2000,
} as const

export const FEEDBACK_SCREENSHOT_RETENTION_DAYS = 90

const TRANSITIONS: Record<FeedbackStatus, readonly FeedbackStatus[]> = {
  NEW: ['IN_REVIEW', 'DONE'],
  IN_REVIEW: ['DONE'],
  DONE: [],
}

export function canTransitionFeedback(from: FeedbackStatus, to: FeedbackStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** When a screenshot submitted at `createdAt` must be gone. */
export function screenshotExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + FEEDBACK_SCREENSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

export function isScreenshotExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= screenshotExpiresAt(createdAt).getTime()
}

/** The weekly summary's open / closed split (ADMIN-PROD-01 feedback contract). */
export function summaryBucket(status: FeedbackStatus): 'open' | 'closed' {
  return status === 'DONE' ? 'closed' : 'open'
}

const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:".]{2,}$/

/**
 * A guest's optional e-mail (FB-01, PD-5): absent or blank → null; otherwise a
 * plausible address of at most 254 characters, or 'invalid'. Shared with the
 * Sprint1 submission; only `feedback:manage` holders ever read it back.
 */
export function parseGuestEmail(value: unknown): string | null | 'invalid' {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return 'invalid'
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > FEEDBACK_LIMITS.guestEmail || !EMAIL.test(trimmed)) return 'invalid'
  return trimmed
}

/** The context keys an operator may see; anything else the client sent stays stored, unshown. */
export const FEEDBACK_CONTEXT_KEYS = [
  'route',
  'screen',
  'step',
  'workflow',
  'browser',
  'os',
  'device',
  'viewport',
  'locale',
  'user_agent',
] as const

export function projectFeedbackContext(context: unknown): Record<string, string> {
  if (typeof context !== 'object' || context === null || Array.isArray(context)) return {}
  const out: Record<string, string> = {}
  for (const key of FEEDBACK_CONTEXT_KEYS) {
    const value = (context as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 300)
  }
  return out
}
