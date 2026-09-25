import { NextResponse } from 'next/server'

import { ApiError, isApiError, toUnexpectedError } from './errors'
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id'

/**
 * M0-T05 — route handler wrapper.
 *
 * Guarantees the two things the contract requires of every response: a request
 * id in the headers (05:38-46), and that any failure leaves as the frozen error
 * envelope rather than a framework stack trace.
 *
 * A handler returns its DTO directly. Single resources are returned bare, per
 * 05:67; only list endpoints get an envelope, built by listEnvelope().
 */
export type ApiContext = {
  requestId: string
  request: Request
}

export type ApiHandler<T> = (context: ApiContext) => Promise<T> | T

export function withApi<T>(handler: ApiHandler<T>) {
  return async (request: Request): Promise<NextResponse> => {
    const requestId = resolveRequestId(request.headers)

    try {
      const body = await handler({ requestId, request })

      if (body === undefined) {
        return new NextResponse(null, {
          status: 204,
          headers: { [REQUEST_ID_HEADER]: requestId },
        })
      }

      return NextResponse.json(body, {
        status: 200,
        headers: { [REQUEST_ID_HEADER]: requestId },
      })
    } catch (caught) {
      // Anything not deliberately thrown as ApiError is an internal fault, and
      // its message never reaches the client.
      const error: ApiError = isApiError(caught) ? caught : toUnexpectedError()

      return NextResponse.json(error.toEnvelope(requestId), {
        status: error.status,
        headers: { [REQUEST_ID_HEADER]: requestId },
      })
    }
  }
}
