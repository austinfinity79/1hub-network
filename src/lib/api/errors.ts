import {
  type ApiErrorCode,
  type ApiHttpStatus,
  isFrozenErrorCode,
  isUncontractedErrorCode,
} from './error-codes'
import type { ErrorEnvelope } from './types'

/**
 * M0-T05 — the single way this API reports failure.
 *
 * Throwing ApiError is how a handler produces the frozen envelope. The code is
 * constrained to the contract's own set, so a new code cannot be introduced by
 * a passing string literal; adding one requires editing error-codes.ts, which
 * the contract drift test guards.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: ApiHttpStatus
  readonly fields: Record<string, string> | undefined

  constructor(
    code: ApiErrorCode,
    status: ApiHttpStatus,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fields = fields
  }

  /** True when the code comes from the frozen contract rather than a gap. */
  get isContracted(): boolean {
    return isFrozenErrorCode(this.code)
  }

  toEnvelope(requestId: string): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        request_id: requestId,
      },
    }
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/**
 * Wraps anything a handler threw that was not an ApiError.
 *
 * The original message is deliberately discarded: contract non-functional rules
 * (01:244) forbid leaking internals, and an unexpected throw may carry a stack
 * or a query fragment. The request id is the thread back to the server log.
 */
export function toUnexpectedError(): ApiError {
  return new ApiError('UNCONTRACTED_INTERNAL', 500, 'Unexpected server error.')
}

export function unauthenticated(): ApiError {
  return new ApiError('UNCONTRACTED_UNAUTHENTICATED', 401, 'Authentication is required.')
}

export function notFound(): ApiError {
  return new ApiError('UNCONTRACTED_NOT_FOUND', 404, 'Resource not found.')
}

/** True when the envelope reports a gap rather than a contracted failure. */
export function envelopeIsUncontracted(envelope: ErrorEnvelope): boolean {
  return isUncontractedErrorCode(envelope.error.code)
}
