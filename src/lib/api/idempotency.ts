/**
 * M0-T05 — Idempotency-Key handling, 05:48-63.
 *
 * The contract requires the header on seven operation classes. This module
 * parses and validates it, and names the operations that require it.
 *
 * STORAGE LIVES IN `@/lib/idempotency/store`, added by M0-T10 on migration 003.
 * This module remains parsing-only on purpose: header validation is a pure
 * function with no database, which keeps it testable and keeps the storage
 * policy in one place.
 */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

const MAX_KEY_LENGTH = 255

/**
 * The seven operation classes listed at 05:56-63, `venture.create` of amendment
 * A2 (05 §19, DEC-L2R-D9), `application.create` / `application.submit` of
 * amendment A4 (05 §21, DEC-L5-D3), and `programme.create` / `programme.publish`
 * / `programme.close` of amendment A5 (05 §22, DEC-W4P-D12), and
 * `verification.decide` of amendment A9 (05 §26, ADMIN-PROD-03; optional header), and
 * `venture.review` / `access.grant-or-revoke` of amendment A10 (05 §27, ADMIN-PROD-04;
 * optional header), and `account.action` of amendment A11 (05 §28, ADMIN-PROD-05;
 * optional header).
 */
export const IDEMPOTENT_OPERATIONS = [
  'auth.magic-link.request',
  'consent.accept-or-revoke',
  'membership.request',
  'feedback.submit',
  'venture.team-invite',
  'event.create-or-publish',
  'organization.relationship-create-or-close',
  'venture.create',
  'application.create',
  'application.submit',
  'programme.create',
  'programme.publish',
  'programme.close',
  'verification.decide',
  'venture.review',
  'access.grant-or-revoke',
  'account.action',
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
