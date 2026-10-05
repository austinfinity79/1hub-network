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
  // DEC-AUTH-EMAIL-D3: 500, the sign-in e-mail could not be sent; the link was rolled back.
  'AUTH_EMAIL_DELIVERY_FAILED',
  // DEC-L2R-D8: 500, the team invitation e-mail could not be sent; no invitation was created.
  'INVITATION_EMAIL_DELIVERY_FAILED',
  // DEC-L2R-D13: 429, too many invitation e-mails for this address or inviter in 24 hours.
  'INVITATION_RATE_LIMITED',
  // DEC-L5-D3: 422, an application request body or answer is invalid.
  'APPLICATION_VALIDATION_FAILED',
  // DEC-L5-D3: 409, the venture cannot apply (archived, type not accepted, programme closed).
  'APPLICATION_NOT_ELIGIBLE',
  // DEC-L5-D3: 409, the venture already has an active application to this programme.
  'APPLICATION_EXISTS',
  // DEC-L5-D3: 409, a submitted application is final.
  'APPLICATION_SUBMITTED',
  // DEC-L5-D3: 422, a required question is unanswered at submit.
  'APPLICATION_INCOMPLETE',
  // DEC-S1A-D9: 422, a sign-up / reset field fails its rule (`fields` names which).
  'AUTH_VALIDATION_FAILED',
  // DEC-S1A-D9: 401, wrong username/email or password; never says which part.
  'AUTH_INVALID_CREDENTIALS',
  // DEC-S1A-D9: 429, password sign-in suspended for 15 minutes after 5 wrong attempts.
  'AUTH_PASSWORD_LOGIN_LOCKED',
  // DEC-S1A-D9: 409, the username is already used (sign-up only; login never says).
  'AUTH_USERNAME_TAKEN',
  // DEC-S1A-D9: 409, sign-up refused; neutral, never says the e-mail has an account (DEC-S1A-D11).
  'AUTH_REGISTRATION_REJECTED',
  // DEC-S1A-D9: 400, the reset link is unknown or malformed.
  'AUTH_RESET_LINK_INVALID',
  // DEC-S1A-D9: 400, the reset link expired, was used, or was superseded by a resend.
  'AUTH_RESET_LINK_EXPIRED',
  // DEC-S1A-D9: 400, the Google callback state does not match this browser's.
  'AUTH_GOOGLE_STATE_MISMATCH',
  // DEC-S1A-D9: 400, Google sign-in could not complete (provider error, unverified e-mail, not configured).
  'AUTH_GOOGLE_FAILED',
  // DEC-S1F-D6: 422 (400 for a missing Idempotency-Key / non-multipart body), a feedback field fails its rule.
  'FEEDBACK_VALIDATION_FAILED',
  // DEC-S1F-D6: 429, more than 10 feedback messages in an hour (US-X.01).
  'FEEDBACK_RATE_LIMITED',
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
