import { randomUUID } from 'node:crypto'

/**
 * M0-T05 — request correlation, 05:38-46.
 *
 * A client may send X-Request-ID. The server always returns a request id in
 * headers and in error payloads, so an id is generated when the client sends
 * none.
 */
export const REQUEST_ID_HEADER = 'X-Request-ID'

/** Bounded so a hostile client cannot write unbounded data into our logs. */
const MAX_CLIENT_REQUEST_ID = 200

export function newRequestId(): string {
  return `req_${randomUUID()}`
}

export function resolveRequestId(headers: Headers): string {
  const supplied = headers.get(REQUEST_ID_HEADER)?.trim()

  if (!supplied || supplied.length > MAX_CLIENT_REQUEST_ID) return newRequestId()
  // Control characters would corrupt log lines and response headers.
  if (/[\u0000-\u001f\u007f]/.test(supplied)) return newRequestId()

  return supplied
}
