import { ApiError } from './errors'
import { IDEMPOTENCY_HEADER } from './idempotency'
import { REQUEST_ID_HEADER, newRequestId } from './request-id'
import type { ErrorEnvelope } from './types'

/**
 * M0-T05 — typed API client.
 *
 * Hand-written against the authoritative Markdown contract. It is NOT generated
 * from 05_API_CONTRACT_P0_v1.0.yaml: that file declares itself an
 * implementation skeleton, omits 21 endpoints and every request body, and types
 * the error code as a bare string. Generating from it would ship a client that
 * silently cannot call most of WF02 and WF03.
 *
 * The client never inspects roles or scopes to make decisions. Per CLAUDE.md
 * section 4 the server is authoritative; anything the client holds is display
 * state only.
 */
export const API_BASE_PATH = '/api/v1'

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Sent as Idempotency-Key. Required by 05:56-63 on unsafe mutations. */
  idempotencyKey?: string
  requestId?: string
  signal?: AbortSignal
  /** Overrides the origin; used by tests and server-side calls. */
  baseUrl?: string
}

function buildUrl(path: string, baseUrl?: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl ?? ''}${API_BASE_PATH}${normalised}`
}

/**
 * Performs a request and returns the parsed body.
 *
 * On a non-2xx it parses the frozen error envelope and throws ApiError, so
 * callers handle one failure type rather than branching on status codes. A
 * response that is not a valid envelope still throws, as an internal fault,
 * rather than being returned as if it were data.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, requestId, signal, baseUrl } = options

  const headers: Record<string, string> = {
    Accept: 'application/json',
    [REQUEST_ID_HEADER]: requestId ?? newRequestId(),
  }

  // FormData (multipart uploads, 05:36) sets its own boundary content type.
  const multipart = body instanceof FormData
  if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
  if (idempotencyKey) headers[IDEMPOTENCY_HEADER] = idempotencyKey

  const response = await fetch(buildUrl(path, baseUrl), {
    method,
    headers,
    ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
    // The session is an HTTP-only cookie, so it must ride along.
    credentials: 'same-origin',
    ...(signal ? { signal } : {}),
  })

  const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? headers[REQUEST_ID_HEADER]!

  if (response.status === 204) return undefined as T

  const payload: unknown = await response.json().catch(() => undefined)

  if (response.ok) return payload as T

  throw toApiError(payload, response.status, responseRequestId)
}

function toApiError(payload: unknown, status: number, requestId: string): ApiError {
  const envelope = payload as ErrorEnvelope | undefined
  const detail = envelope?.error

  if (!detail || typeof detail.code !== 'string') {
    // A non-enveloped failure is a contract violation by the server, reported
    // as an internal fault rather than guessed at.
    return new ApiError('UNCONTRACTED_INTERNAL', 500, `Malformed error response (${requestId}).`)
  }

  return new ApiError(
    detail.code as ApiError['code'],
    status as ApiError['status'],
    detail.message,
    detail.fields,
  )
}
