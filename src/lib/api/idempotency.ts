/**
 * M0-T05 — Idempotency-Key handling, 05:48-63.
 *
 * The contract requires the header on seven operation classes. This module
 * parses and validates it, and names the operations that require it.
 *
 * STORAGE IS NOT IMPLEMENTED. Replaying a stored response needs a key store,
 * and no such table exists in db/migrations/001_p0_init.sql. That gap was
 * raised in the readiness report and belongs to a schema decision, so this
 * module deliberately stops at parsing rather than pretending to deduplicate.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

const MAX_KEY_LENGTH = 255

/** The seven operation classes listed at 05:56-63. */
export const IDEMPOTENT_OPERATIONS = [
  'auth.magic-link.request',
  'consent.accept-or-revoke',
  'membership.request',
  'feedback.submit',
  'venture.team-invite',
  'event.create-or-publish',
  'organization.relationship-create-or-close',
] as const

export type IdempotentOperation = (typeof IDEMPOTENT_OPERATIONS)[number]

export function requiresIdempotencyKey(operation: string): operation is IdempotentOperation {
  return (IDEMPOTENT_OPERATIONS as readonly string[]).includes(operation)
}

export function readIdempotencyKey(headers: Headers): string | undefined {
  const key = headers.get(IDEMPOTENCY_HEADER)?.trim()

  if (!key || key.length > MAX_KEY_LENGTH) return undefined
  if (/[\u0000-\u001f\u007f]/.test(key)) return undefined

  return key
}
