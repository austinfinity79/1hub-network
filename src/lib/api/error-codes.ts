/**
 * M0-T05 — frozen error codes.
 *
 * SOURCE OF TRUTH: docs/architecture/05_API_CONTRACT_P0_v1.0.md. The Markdown is
 * authoritative; the sibling YAML self-describes as a skeleton and types `code`
 * as a bare string with no enum, so it cannot be the source.
 * `contract.test.ts` parses the Markdown and fails if this list drifts.
 *
 * The contract declares codes in two places: `Errors:` lines on each endpoint,
 * and the "Known business error codes" list under the auth callback.
 */

export const FROZEN_ERROR_CODES = [
  // 05:185 — POST /auth/magic-link
  'AUTH_RATE_LIMITED',
  'AUTH_EMAIL_INVALID',
  // 05:225-228 — POST /auth/magic-link/consume
  'AUTH_LINK_EXPIRED',
  'AUTH_LINK_ALREADY_USED',
  'AUTH_LINK_INVALID',
  'AUTH_ACCOUNT_BLOCKED',
  // 05:337 — PATCH /me/profile
  'PROFILE_VALIDATION_FAILED',
  'VOCABULARY_ITEM_INACTIVE',
  'PROFILE_DEACTIVATED',
  // 05:434 — consent accept/revoke
  'CONSENT_NOT_REVOCABLE',
  'CONSENT_ALREADY_REVOKED',
  // 05:490 — POST /me/onboarding/complete
  'ONBOARDING_REQUIREMENTS_MISSING',
  // 05:812 — PATCH /ops/.../memberships/{id}
  'MEMBERSHIP_INVALID_TRANSITION',
  'SCOPE_FORBIDDEN',
] as const

export type FrozenErrorCode = (typeof FROZEN_ERROR_CODES)[number]

/**
 * CONTRACT GAP, not an invention.
 *
 * The error envelope requires a `code`, and the HTTP table at 05:98-107 maps
 * 401, 404 and 500, but the contract names no code for any of them. Rather than
 * quietly minting plausible-looking codes and letting them harden into an
 * unapproved contract, these are namespaced `UNCONTRACTED_` so they are obvious
 * on the wire, greppable in logs, and impossible to mistake for frozen codes.
 *
 * Resolution belongs to a contract amendment, not to this implementation.
 * `contract.test.ts` asserts none of these ever appears in FROZEN_ERROR_CODES.
 */
export const UNCONTRACTED_ERROR_CODES = [
  'UNCONTRACTED_UNAUTHENTICATED',
  'UNCONTRACTED_NOT_FOUND',
  'UNCONTRACTED_INTERNAL',
  // M0-T10. 05:48-63 requires the Idempotency-Key header on seven operations
  // but names no code for a key replayed against different content, and no code
  // for a key whose first attempt is still in flight. 409 is the contract's own
  // mapping for "lifecycle/state conflict / duplicate relation" (05:104), so the
  // status is contracted even though the code is not.
  'UNCONTRACTED_IDEMPOTENCY_CONFLICT',
] as const

export type UncontractedErrorCode = (typeof UNCONTRACTED_ERROR_CODES)[number]

/**
 * Codes frozen by an approved human decision rather than by the Markdown
 * contract (so the drift test against 05 does not list them). Each names its
 * decision record in docs/decisions/DECISION_LOG.md; they are not gap codes.
 */
export const DECISION_ERROR_CODES = [
  // DEC-WF01-S07-D8: 409, the submitted legal document version is no longer current.
  'LEGAL_DOCUMENT_VERSION_STALE',
  // DEC-WF01-S07-D8: 422, unsupported visibility group/level combination.
  'VISIBILITY_VALIDATION_FAILED',
] as const

export type DecisionErrorCode = (typeof DECISION_ERROR_CODES)[number]

export type ApiErrorCode = FrozenErrorCode | UncontractedErrorCode | DecisionErrorCode

/** Canonical HTTP mapping, 05:98-107. */
export const HTTP_STATUS_MEANING = {
  400: 'malformed request / validation',
  401: 'unauthenticated / expired session',
  403: 'authenticated but not authorized',
  404: 'resource not found or intentionally hidden',
  409: 'lifecycle/state conflict / duplicate relation',
  422: 'semantically valid JSON but business validation failed',
  429: 'rate limited',
  500: 'unexpected server error',
} as const

export type ApiHttpStatus = keyof typeof HTTP_STATUS_MEANING

export function isFrozenErrorCode(value: string): value is FrozenErrorCode {
  return (FROZEN_ERROR_CODES as readonly string[]).includes(value)
}

export function isUncontractedErrorCode(value: string): value is UncontractedErrorCode {
  return (UNCONTRACTED_ERROR_CODES as readonly string[]).includes(value)
}
